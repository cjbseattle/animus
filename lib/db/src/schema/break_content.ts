import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const breakContentTable = pgTable("break_content", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().default("gif"), // 'video' | 'image' | 'gif'
  url: text("url").notNull(),
  caption: text("caption").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBreakContentSchema = createInsertSchema(breakContentTable).omit({ id: true, createdAt: true });
export type InsertBreakContent = z.infer<typeof insertBreakContentSchema>;
export type BreakContent = typeof breakContentTable.$inferSelect;
