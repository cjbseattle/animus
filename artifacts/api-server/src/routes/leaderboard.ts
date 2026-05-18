import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { GetLeaderboardQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/leaderboard", async (req, res): Promise<void> => {
  const parsed = GetLeaderboardQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const limit = parsed.data.limit ?? 10;

  const users = await db
    .select()
    .from(usersTable)
    .orderBy(desc(usersTable.currency))
    .limit(limit);

  res.json(
    users.map((u, i) => ({
      rank: i + 1,
      userId: u.id,
      username: u.username,
      currency: u.currency,
      currentStreak: u.currentStreak,
      totalCorrect: u.totalCorrect,
    }))
  );
});

export default router;
