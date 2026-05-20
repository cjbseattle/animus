import { Router, type IRouter } from "express";
import { db, questionsTable } from "@workspace/db";
import { eq, sql, and, notInArray } from "drizzle-orm";
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
