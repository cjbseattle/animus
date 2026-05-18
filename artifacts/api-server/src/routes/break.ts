import { Router, type IRouter } from "express";
import { db, breakContentTable } from "@workspace/db";
import { GetBreakContentQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/break/content", async (req, res): Promise<void> => {
  const parsed = GetBreakContentQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let query = db.select().from(breakContentTable).$dynamic();
  if (parsed.data.limit) {
    query = query.limit(parsed.data.limit);
  }

  const rows = await query;
  res.json(
    rows.map((r) => ({
      id: r.id,
      type: r.type,
      url: r.url,
      caption: r.caption,
      thumbnailUrl: r.thumbnailUrl ?? null,
    }))
  );
});

export default router;
