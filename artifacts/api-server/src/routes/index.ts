import { Router, type IRouter } from "express";
import healthRouter from "./health";
import questionsRouter from "./questions";
import answersRouter from "./answers";
import usersRouter from "./users";
import breakRouter from "./break";
import leaderboardRouter from "./leaderboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(questionsRouter);
router.use(answersRouter);
router.use(usersRouter);
router.use(breakRouter);
router.use(leaderboardRouter);

export default router;
