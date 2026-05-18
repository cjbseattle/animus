import { Router, type IRouter } from "express";
import { db, answersTable, questionsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { SubmitAnswerBody } from "@workspace/api-zod";
import { getOrCreateUser } from "./users";

const router: IRouter = Router();

const BASE_CURRENCY = 10;

function computeMultiplier(consecutiveCorrect: number): number {
  if (consecutiveCorrect >= 20) return 4;
  if (consecutiveCorrect >= 10) return 2;
  return 1;
}

function computeBonus(consecutiveCorrect: number): number {
  if (consecutiveCorrect === 5) return 20;
  return 0;
}

router.post("/answers", async (req, res): Promise<void> => {
  const parsed = SubmitAnswerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { questionId, choiceId, userId } = parsed.data;

  const [question] = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.id, questionId));

  if (!question) {
    res.status(404).json({ error: "Question not found" });
    return;
  }

  const user = await getOrCreateUser(userId);

  const isCorrect = choiceId === question.correctChoiceId;

  let newConsecutiveCorrect = isCorrect ? user.consecutiveCorrect + 1 : 0;
  let newStreak = isCorrect ? Math.max(user.currentStreak, newConsecutiveCorrect >= 3 ? newConsecutiveCorrect : user.currentStreak) : 0;
  if (!isCorrect) newStreak = 0;

  const multiplier = isCorrect ? computeMultiplier(newConsecutiveCorrect) : 1;
  const bonus = isCorrect ? computeBonus(newConsecutiveCorrect) : 0;
  const currencyEarned = isCorrect ? Math.floor(BASE_CURRENCY * multiplier) + bonus : 0;

  const newCurrency = user.currency + currencyEarned;
  const newTotalCorrect = isCorrect ? user.totalCorrect + 1 : user.totalCorrect;
  const newTotalAnswered = user.totalAnswered + 1;
  const longestStreak = Math.max(user.longestStreak, newConsecutiveCorrect);
  const breakUnlocked = newConsecutiveCorrect === 30;

  await db.insert(answersTable).values({
    userId: user.id,
    questionId,
    choiceId,
    isCorrect,
    currencyEarned,
  });

  await db
    .update(usersTable)
    .set({
      currency: newCurrency,
      currentStreak: newConsecutiveCorrect >= 3 ? newConsecutiveCorrect : (isCorrect ? user.currentStreak : 0),
      longestStreak,
      totalCorrect: newTotalCorrect,
      totalAnswered: newTotalAnswered,
      consecutiveCorrect: newConsecutiveCorrect,
    })
    .where(eq(usersTable.id, user.id));

  res.json({
    isCorrect,
    correctChoiceId: question.correctChoiceId,
    explanation: question.explanation ?? "",
    currencyEarned,
    newStreak: newConsecutiveCorrect >= 3 ? newConsecutiveCorrect : (isCorrect ? user.currentStreak : 0),
    streakMultiplier: multiplier,
    totalCurrency: newCurrency,
    breakUnlocked,
    consecutiveCorrect: newConsecutiveCorrect,
  });
});

export default router;
