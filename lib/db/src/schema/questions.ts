import { pgTable, text, serial, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const questionsTable = pgTable("questions", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // 'math' | 'reading'
  content: text("content").notNull(),
  passage: text("passage"),
  choices: jsonb("choices").notNull(), // [{id, label, text}]
  correctChoiceId: text("correct_choice_id").notNull(),
  difficulty: text("difficulty").notNull().default("medium"), // 'easy' | 'medium' | 'hard'
  explanation: text("explanation"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertQuestionSchema = createInsertSchema(questionsTable).omit({ id: true, createdAt: true });
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Question = typeof questionsTable.$inferSelect;
