import { Router, type IRouter } from "express";
import { db, usersTable, answersTable, questionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/users/me", async (req, res): Promise<void> => {
  let user = await getOrCreateUser(1);
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
    accuracy: totalAnswered > 0 ? totalCorrect / totalAnswered : 0,
    mathAccuracy: mathAnswered > 0 ? mathCorrect / mathAnswered : 0,
    readingAccuracy: readingAnswered > 0 ? readingCorrect / readingAnswered : 0,
  });
});

export async function getOrCreateUser(id: number) {
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id));
  if (existing) return existing;

  const [created] = await db
    .insert(usersTable)
    .values({ username: "student" })
    .returning();
  return created;
}

export default router;
