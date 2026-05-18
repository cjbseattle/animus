import { Router, type IRouter } from "express";
import { db, usersTable, userPowerupsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { PurchaseItemBody } from "@workspace/api-zod";
import { getOrCreateUser } from "./users";

const router: IRouter = Router();

const SHOP_ITEMS = [
  {
    id: "hint",
    name: "Hint",
    description: "Eliminates one wrong answer choice, giving you a 1-in-3 shot.",
    cost: 50,
    type: "hint" as const,
    icon: "Lightbulb",
  },
  {
    id: "skip",
    name: "Skip",
    description: "Skip a question without breaking your streak or losing progress.",
    cost: 75,
    type: "skip" as const,
    icon: "SkipForward",
  },
  {
    id: "shield",
    name: "Streak Shield",
    description: "Protects your streak from one wrong answer. Auto-activates when needed.",
    cost: 100,
    type: "shield" as const,
    icon: "ShieldCheck",
  },
];

router.get("/shop/items", async (_req, res): Promise<void> => {
  res.json(SHOP_ITEMS);
});

router.post("/shop/purchase", async (req, res): Promise<void> => {
  const parsed = PurchaseItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { itemId, userId } = parsed.data;

  const item = SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) {
    res.status(400).json({ error: "Item not found" });
    return;
  }

  const user = await getOrCreateUser(userId);

  if (user.currency < item.cost) {
    res.status(400).json({ error: "Insufficient currency" });
    return;
  }

  const newCurrency = user.currency - item.cost;
  await db.update(usersTable).set({ currency: newCurrency }).where(eq(usersTable.id, userId));

  const [existing] = await db
    .select()
    .from(userPowerupsTable)
    .where(and(eq(userPowerupsTable.userId, userId), eq(userPowerupsTable.type, item.type)));

  let newQuantity: number;
  if (existing) {
    newQuantity = existing.quantity + 1;
    await db
      .update(userPowerupsTable)
      .set({ quantity: newQuantity })
      .where(eq(userPowerupsTable.id, existing.id));
  } else {
    newQuantity = 1;
    await db.insert(userPowerupsTable).values({ userId, type: item.type, quantity: 1 });
  }

  res.json({
    success: true,
    remainingCurrency: newCurrency,
    powerupType: item.type,
    newQuantity,
  });
});

export default router;
