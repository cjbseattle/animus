import { Router, type IRouter } from "express";
import { db, questionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
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

  let rows;
  if (parsed.data.type) {
    rows = await db
      .select()
      .from(questionsTable)
      .where(eq(questionsTable.type, parsed.data.type))
      .orderBy(sql`RANDOM()`)
      .limit(1);
  } else {
    rows = await db
      .select()
      .from(questionsTable)
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
