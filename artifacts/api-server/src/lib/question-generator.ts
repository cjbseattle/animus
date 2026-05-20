import OpenAI from "openai";
import { db, questionsTable } from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import type { Logger } from "pino";

const LABELS = ["A", "B", "C", "D"] as const;

interface RawQuestion {
  content: string;
  passage?: string;
  choices: Array<{ text: string }>;
  correctIndex: number;
  explanation: string;
}

const TARGETS: Record<string, Record<string, number>> = {
  math: { easy: 30, medium: 30, hard: 20 },
  reading: { easy: 30, medium: 30, hard: 20 },
};

export async function ensureQuestionPool(logger: Logger): Promise<void> {
  const baseURL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const apiKey =
    process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] ??
    process.env["OPENAI_API_KEY"];

  if (!apiKey) {
    logger.warn("No OpenAI API key found — skipping AI question generation");
    return;
  }

  const openai = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });

  for (const type of ["math", "reading"] as const) {
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      const target = TARGETS[type]![difficulty]!;
      const [row] = await db
        .select({ cnt: count() })
        .from(questionsTable)
        .where(and(eq(questionsTable.type, type), eq(questionsTable.difficulty, difficulty)));

      const existing = Number(row?.cnt ?? 0);
      const needed = Math.max(0, target - existing);
      if (needed === 0) {
        logger.info({ type, difficulty, existing }, "Question pool is full — skipping");
        continue;
      }

      logger.info({ type, difficulty, existing, needed }, "Generating questions via OpenAI");
      await generateQuestions(openai, type, difficulty, needed, logger);
    }
  }

  logger.info("Question pool check complete");
}

async function generateQuestions(
  openai: OpenAI,
  type: string,
  difficulty: string,
  totalNeeded: number,
  logger: Logger
): Promise<void> {
  const BATCH = 10;
  let remaining = totalNeeded;

  while (remaining > 0) {
    const batchSize = Math.min(BATCH, remaining);
    try {
      const questions = await generateBatch(openai, type, difficulty, batchSize);
      if (questions.length > 0) {
        await db.insert(questionsTable).values(questions);
        logger.info({ type, difficulty, inserted: questions.length }, "Questions inserted");
      }
      remaining -= batchSize;
    } catch (err) {
      logger.error({ err, type, difficulty }, "Batch generation failed — stopping");
      break;
    }
  }
}

async function generateBatch(
  openai: OpenAI,
  type: string,
  difficulty: string,
  batchSize: number
) {
  const typeGuide =
    type === "reading"
      ? `Each question MUST include a unique reading passage of 80–130 words. Test: main idea, inference, vocabulary in context, author's tone, evidence analysis.`
      : `Cover: linear equations, quadratics, systems, geometry, ratios/percentages, functions, data analysis, word problems. Use realistic SAT phrasing.`;

  const diffGuide: Record<string, string> = {
    easy: "straightforward single-step problems, common vocabulary",
    medium: "multi-step reasoning, moderate complexity",
    hard: "complex multi-step problems, tricky distractors, abstract reasoning",
  };

  const prompt = `Generate exactly ${batchSize} SAT ${type} questions at ${difficulty} difficulty (${diffGuide[difficulty] ?? ""}).

${typeGuide}

IMPORTANT: Distribute correct answers EVENLY — across all ${batchSize} questions, each of indices 0,1,2,3 should appear roughly equally as correctIndex.

Return ONLY a valid JSON array — no markdown, no code fences, no extra text.

Each element must be:
{
  "content": "question text",
  ${type === "reading" ? '"passage": "the reading passage text",' : ""}
  "choices": [
    {"text": "option text for A"},
    {"text": "option text for B"},
    {"text": "option text for C"},
    {"text": "option text for D"}
  ],
  "correctIndex": 0,
  "explanation": "concise explanation of why the correct answer is right and why the others are wrong"
}

correctIndex: 0=A, 1=B, 2=C, 3=D. Vary this! Don't cluster all answers at the same index.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 8192,
  });

  const raw = (response.choices[0]?.message?.content ?? "[]").trim();
  const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  const parsed: RawQuestion[] = JSON.parse(cleaned);

  return parsed
    .filter((q) => q.content && Array.isArray(q.choices) && q.choices.length === 4)
    .map((q) => {
      const correctIndex = Math.max(0, Math.min(3, q.correctIndex ?? 0));
      const choices = q.choices.map((c, i) => ({
        id: LABELS[i],
        label: LABELS[i],
        text: c.text ?? "",
      }));
      return {
        type,
        difficulty,
        content: q.content,
        passage: q.passage ?? null,
        choices,
        correctChoiceId: LABELS[correctIndex],
        explanation: q.explanation ?? "",
      };
    });
}
