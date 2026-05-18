import { pgTable, serial, integer, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const userPowerupsTable = pgTable("user_powerups", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  type: text("type").notNull(), // 'hint' | 'skip' | 'shield'
  quantity: integer("quantity").notNull().default(0),
});

export const insertUserPowerupSchema = createInsertSchema(userPowerupsTable).omit({ id: true });
export type InsertUserPowerup = z.infer<typeof insertUserPowerupSchema>;
export type UserPowerup = typeof userPowerupsTable.$inferSelect;
