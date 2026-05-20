import { Router, type IRouter } from "express";
import { db, usersTable, answersTable, questionsTable, userPowerupsTable } from "@workspace/db";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import { GetMissedQuestionsQueryParams, UpdateUsernameBody, GetMyActivityQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/users/me", async (req, res): Promise<void> => {
  const user = await getOrCreateUser(1);
  res.json({
    id: user.id,
    username: user.username,
    currency: user.currency,
    currentStreak: user.currentStreak,
    longestStreak: user.longestStreak,
    totalCorrect: user.totalCorrect,
    totalAnswered: user.totalAnswered,
    consecutiveCorrect: user.consecutiveCorrect,
  });
});

router.get("/users/me/stats", async (req, res): Promise<void> => {
  const user = await getOrCreateUser(1);

  const allAnswers = await db
    .select({
      isCorrect: answersTable.isCorrect,
      type: questionsTable.type,
    })
    .from(answersTable)
    .innerJoin(questionsTable, eq(answersTable.questionId, questionsTable.id))
    .where(eq(answersTable.userId, user.id));

  const totalAnswered = allAnswers.length;
  const totalCorrect = allAnswers.filter((a) => a.isCorrect).length;

  const mathAnswers = allAnswers.filter((a) => a.type === "math");
  const mathAnswered = mathAnswers.length;
  const mathCorrect = mathAnswers.filter((a) => a.isCorrect).length;

  const readingAnswers = allAnswers.filter((a) => a.type === "reading");
  const readingAnswered = readingAnswers.length;
  const readingCorrect = readingAnswers.filter((a) => a.isCorrect).length;

  res.json({
    totalAnswered,
    totalCorrect,
    mathCorrect,
    mathAnswered,
    readingCorrect,
    readingAnswered,
    accuracy: totalAnswered > 0 ? (totalCorrect / totalAnswered) * 100 : 0,
    mathAccuracy: mathAnswered > 0 ? (mathCorrect / mathAnswered) * 100 : 0,
    readingAccuracy: readingAnswered > 0 ? (readingCorrect / readingAnswered) * 100 : 0,
  });
});

router.put("/users/me/username", async (req, res): Promise<void> => {
  const parsed = UpdateUsernameBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { username } = parsed.data;
  if (!username || username.trim().length === 0) {
    res.status(400).json({ error: "Username cannot be empty" });
    return;
  }
  const user = await getOrCreateUser(1);
  const [updated] = await db
    .update(usersTable)
    .set({ username: username.trim() })
    .where(eq(usersTable.id, user.id))
    .returning();
  res.json({
    id: updated.id,
    username: updated.username,
    currency: updated.currency,
    currentStreak: updated.currentStreak,
    longestStreak: updated.longestStreak,
    totalCorrect: updated.totalCorrect,
    totalAnswered: updated.totalAnswered,
    consecutiveCorrect: updated.consecutiveCorrect,
  });
});

router.get("/users/me/activity", async (req, res): Promise<void> => {
  const parsed = GetMyActivityQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const days = parsed.data.days ?? 35;
  const user = await getOrCreateUser(1);

  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      date: sql<string>`to_char(date_trunc('day', ${answersTable.answeredAt}), 'YYYY-MM-DD')`,
      count: sql<number>`cast(count(*) as int)`,
      correct: sql<number>`cast(sum(case when ${answersTable.isCorrect} = true then 1 else 0 end) as int)`,
    })
    .from(answersTable)
    .where(and(eq(answersTable.userId, user.id), gte(answersTable.answeredAt, since)))
    .groupBy(sql`date_trunc('day', ${answersTable.answeredAt})`)
    .orderBy(sql`date_trunc('day', ${answersTable.answeredAt})`);

  // Fill in missing days with zeros
  const activityMap = new Map(rows.map((r) => [r.date, r]));
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const entry = activityMap.get(dateStr);
    result.push({ date: dateStr, count: entry?.count ?? 0, correct: entry?.correct ?? 0 });
  }

  res.json(result);
});

router.get("/users/me/powerups", async (req, res): Promise<void> => {
  const user = await getOrCreateUser(1);
  const powerups = await db
    .select()
    .from(userPowerupsTable)
    .where(eq(userPowerupsTable.userId, user.id));

  res.json(
    powerups.map((p) => ({
      type: p.type,
      quantity: p.quantity,
    }))
  );
});

router.get("/users/me/missed-questions", async (req, res): Promise<void> => {
  const parsed = GetMissedQuestionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const limit = parsed.data.limit ?? 5;
  const user = await getOrCreateUser(1);

  const rows = await db
    .select({
      questionId: answersTable.questionId,
      content: questionsTable.content,
      type: questionsTable.type,
      passage: questionsTable.passage,
      difficulty: questionsTable.difficulty,
      missCount: sql<number>`cast(sum(case when ${answersTable.isCorrect} = false then 1 else 0 end) as int)`,
      attempts: sql<number>`cast(count(*) as int)`,
    })
    .from(answersTable)
    .innerJoin(questionsTable, eq(answersTable.questionId, questionsTable.id))
    .where(eq(answersTable.userId, user.id))
    .groupBy(answersTable.questionId, questionsTable.content, questionsTable.type, questionsTable.passage, questionsTable.difficulty)
    .orderBy(desc(sql`sum(case when ${answersTable.isCorrect} = false then 1 else 0 end)`))
    .limit(limit);

  const filtered = rows.filter((r) => r.missCount > 0);

  res.json(
    filtered.map((r) => ({
      id: r.questionId,
      type: r.type,
      content: r.content,
      passage: r.passage ?? null,
      difficulty: r.difficulty,
      missCount: r.missCount,
      attempts: r.attempts,
    }))
  );
});

export async function getOrCreateUser(id: number) {
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (existing) return existing;

  const [created] = await db.insert(usersTable).values({ username: "student" }).returning();
  return created;
}

export default router;
