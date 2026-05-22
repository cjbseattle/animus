import { Router, type IRouter } from "express";
import { db, questionsTable, usersTable } from "@workspace/db";
import { eq, sql, and, notInArray } from "drizzle-orm";
import OpenAI from "openai";
import {
  GetRandomQuestionQueryParams,
  ListQuestionsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/questions/daily", async (req, res): Promise<void> => {
  const all = await db.select().from(questionsTable);
  if (all.length === 0) {
    res.status(404).json({ error: "No questions found" });
    return;
  }
  const dayIndex = Math.floor(Date.now() / 86400000) % all.length;
  const question = all[dayIndex];
  res.json(formatQuestion(question));
});

router.get("/questions/random", async (req, res): Promise<void> => {
  const parsed = GetRandomQuestionQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { type, difficulty, excludeIds } = parsed.data;

  const excludedIdList = excludeIds
    ? excludeIds.split(",").map(Number).filter((n) => !isNaN(n))
    : [];

  // Build conditions
  const conditions = [];
  if (type) conditions.push(eq(questionsTable.type, type));
  if (difficulty) conditions.push(eq(questionsTable.difficulty, difficulty));
  if (excludedIdList.length > 0) conditions.push(notInArray(questionsTable.id, excludedIdList));

  let rows = await db
    .select()
    .from(questionsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`RANDOM()`)
    .limit(1);

  // If no questions at the requested difficulty, fall back without difficulty filter
  if (rows.length === 0 && difficulty) {
    const fallbackConditions = [];
    if (type) fallbackConditions.push(eq(questionsTable.type, type));
    if (excludedIdList.length > 0) fallbackConditions.push(notInArray(questionsTable.id, excludedIdList));

    rows = await db
      .select()
      .from(questionsTable)
      .where(fallbackConditions.length > 0 ? and(...fallbackConditions) : undefined)
      .orderBy(sql`RANDOM()`)
      .limit(1);
  }

  if (rows.length === 0) {
    res.status(404).json({ error: "No questions found" });
    return;
  }
  res.json(formatQuestion(rows[0]));
});

router.get("/questions", async (req, res): Promise<void> => {
  const parsed = ListQuestionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let query = db.select().from(questionsTable).$dynamic();
  if (parsed.data.type) {
    query = query.where(eq(questionsTable.type, parsed.data.type));
  }
  if (parsed.data.limit) {
    query = query.limit(parsed.data.limit);
  }

  const rows = await query;
  res.json(rows.map(formatQuestion));
});

// In-memory hint cache — avoids regenerating hints for the same question
const hintCache = new Map<number, string>();

const HINT_COST = 30;

function getOpenAI() {
  const baseURL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const apiKey =
    process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] ??
    process.env["OPENAI_API_KEY"];
  if (!apiKey) return null;
  return new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
}

router.post("/questions/:id/hint", async (req, res): Promise<void> => {
  const questionId = parseInt(req.params["id"] ?? "", 10);
  if (isNaN(questionId)) {
    res.status(400).json({ error: "Invalid question id" });
    return;
  }

  const body = req.body as { userId?: unknown };
  const userId = typeof body.userId === "number" ? body.userId : 1;

  // Check user currency
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (user.currency < HINT_COST) {
    res.status(400).json({ error: `Need ${HINT_COST} ⚡ to use a hint (you have ${user.currency})` });
    return;
  }

  // Fetch the question
  const [question] = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.id, questionId))
    .limit(1);

  if (!question) {
    res.status(404).json({ error: "Question not found" });
    return;
  }

  // Serve from cache if available
  const cached = hintCache.get(questionId);
  if (cached) {
    // Still deduct currency even for cached hints
    const [updated] = await db
      .update(usersTable)
      .set({ currency: user.currency - HINT_COST })
      .where(eq(usersTable.id, userId))
      .returning({ currency: usersTable.currency });
    res.json({ hint: cached, remainingCurrency: updated?.currency ?? user.currency - HINT_COST });
    return;
  }

  // Generate hint via OpenAI
  const openai = getOpenAI();
  if (!openai) {
    res.status(503).json({ error: "AI service unavailable" });
    return;
  }

  const prompt = question.type === "math"
    ? `You are an SAT math tutor. Give a short, helpful hint (2-3 sentences max) for this question WITHOUT revealing the answer. Focus on the key concept or approach needed.\n\nQuestion: ${question.content}`
    : `You are an SAT reading tutor. Give a short, helpful hint (2-3 sentences max) for this question WITHOUT revealing the answer. Suggest what to look for in the passage.\n\nPassage: ${question.passage ?? "(no passage)"}\n\nQuestion: ${question.content}`;

  let hint: string;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 120,
      temperature: 0.5,
    });
    hint = completion.choices[0]?.message?.content?.trim() ?? "Think carefully about the key concept being tested here.";
  } catch {
    hint = "Think carefully about the key concept being tested here.";
  }

  hintCache.set(questionId, hint);

  // Deduct currency
  const [updated] = await db
    .update(usersTable)
    .set({ currency: user.currency - HINT_COST })
    .where(eq(usersTable.id, userId))
    .returning({ currency: usersTable.currency });

  res.json({ hint, remainingCurrency: updated?.currency ?? user.currency - HINT_COST });
});

function formatQuestion(q: typeof questionsTable.$inferSelect) {
  return {
    id: q.id,
    type: q.type,
    content: q.content,
    passage: q.passage ?? null,
    choices: q.choices,
    difficulty: q.difficulty,
    explanation: q.explanation ?? null,
  };
}

export default router;
