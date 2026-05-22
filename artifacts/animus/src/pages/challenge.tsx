import { useState, useMemo, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useGetRandomQuestion,
  useSubmitAnswer,
  useGetMe,
  useGetQuestionHint,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Zap, Flame, X, CheckCircle2, XCircle, ArrowRight,
  RotateCcw, Star, Target, Lightbulb, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type Difficulty = "easy" | "medium" | "hard";
type Screen = "challenge" | "redemption" | "good-job" | "accuracy";

interface DisplayChoice {
  id: string;           // original DB id (A/B/C/D) — used for correctness check
  text: string;
  displayLabel: string; // what user sees: always A, B, C, D in order
}

interface WrongEntry {
  question: {
    id: number; type: string; content: string;
    passage?: string | null; difficulty: string;
    explanation?: string | null;
  };
  displayChoices: DisplayChoice[];
  correctChoiceId: string;
}

const DIFFICULTY_UP: Record<Difficulty, Difficulty> = {
  easy: "medium", medium: "hard", hard: "hard",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function makeDisplayChoices(
  choices: Array<{ id: string; label: string; text: string }>
): DisplayChoice[] {
  // Shuffle content, then relabel positions A, B, C, D so correct answer
  // is evenly distributed across all four positions.
  const shuffled = shuffle(choices);
  return shuffled.map((c, i) => ({
    id: c.id,
    text: c.text,
    displayLabel: ["A", "B", "C", "D"][i]!,
  }));
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DifficultyBadge({ d }: { d: string }) {
  return (
    <span className={cn(
      "text-xs font-bold uppercase tracking-wider px-2 py-1 rounded",
      d === "hard" ? "bg-destructive/20 text-destructive" :
      d === "medium" ? "bg-yellow-500/20 text-yellow-500" :
      "bg-green-500/20 text-green-500"
    )}>{d}</span>
  );
}

function ChoiceButton({
  choice, isSelected, revealed, correctChoiceId, onSelect, disabled,
}: {
  choice: DisplayChoice;
  isSelected: boolean;
  revealed: boolean;
  correctChoiceId: string | null;
  onSelect: () => void;
  disabled: boolean;
}) {
  const isCorrect = revealed && choice.id === correctChoiceId;
  const isWrong = revealed && isSelected && choice.id !== correctChoiceId;

  const border =
    revealed
      ? isCorrect
        ? "border-green-500 bg-green-500/10 shadow-[0_0_15px_rgba(34,197,94,0.2)]"
        : isWrong
        ? "border-destructive bg-destructive/10 opacity-70"
        : "border-border/20 bg-card/30 opacity-40"
      : isSelected
      ? "border-primary bg-primary/10"
      : "border-border/50 bg-card hover:bg-card/80 hover:border-white/20";

  const badge =
    revealed && isCorrect ? "bg-green-500 text-black"
    : revealed && isWrong ? "bg-destructive text-white"
    : isSelected ? "bg-primary text-black"
    : "bg-white/10 text-muted-foreground";

  return (
    <button
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "w-full p-4 rounded-xl border-2 text-left flex items-start gap-4 transition-all duration-200",
        border, !disabled && "active:scale-[0.98]"
      )}
    >
      <div className={cn("w-8 h-8 shrink-0 rounded flex items-center justify-center font-mono font-bold text-sm", badge)}>
        {choice.displayLabel}
      </div>
      <div className="flex-1 pt-1 font-medium">{choice.text}</div>
      {revealed && isCorrect && <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />}
      {revealed && isWrong && <XCircle className="w-6 h-6 text-destructive shrink-0" />}
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Challenge() {
  const [, setLocation] = useLocation();
  const typeParam = new URLSearchParams(window.location.search).get("type") as "math" | "reading" | null;
  const queryClient = useQueryClient();
  const { data: user } = useGetMe();

  // ── Query params (controls what question is fetched) ──────────────────────
  const [queryParams, setQueryParams] = useState<{
    type?: "math" | "reading";
    difficulty: Difficulty;
    excludeIds?: string;
  }>({ difficulty: "easy", ...(typeParam ? { type: typeParam } : {}) });

  // Track current display difficulty for badge
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");

  // Last 50 question IDs — ref so it doesn't trigger re-renders
  const recentIdsRef = useRef<number[]>([]);

  const { data: question, isLoading, isRefetching } = useGetRandomQuestion(
    queryParams,
    { query: { refetchOnWindowFocus: false, staleTime: 0 } }
  );

  // Record each question when it loads; reset hint state
  useEffect(() => {
    if (question?.id) {
      recentIdsRef.current = [
        ...recentIdsRef.current.filter((id) => id !== question.id),
        question.id,
      ].slice(-50);
      setHintText(null);
      setHintError(null);
    }
  }, [question?.id]);

  // Shuffle choices + relabel A,B,C,D — re-runs only when question changes
  const displayChoices = useMemo(
    () => (question?.choices ? makeDisplayChoices(question.choices as Array<{ id: string; label: string; text: string }>) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [question?.id]
  );

  // ── Session state ─────────────────────────────────────────────────────────
  const [sessionCount, setSessionCount] = useState(0);
  const [batchWrong, setBatchWrong] = useState<WrongEntry[]>([]);
  const [accuracyCorrect, setAccuracyCorrect] = useState(0);

  const [screen, setScreen] = useState<Screen>("challenge");
  const [redemptionQueue, setRedemptionQueue] = useState<WrongEntry[]>([]);
  const [redemptionIdx, setRedemptionIdx] = useState(0);
  const [redemptionSelected, setRedemptionSelected] = useState<string | null>(null);
  const [redemptionRevealed, setRedemptionRevealed] = useState(false);
  const [pendingAccuracy, setPendingAccuracy] = useState<{ correct: number; total: number } | null>(null);

  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  const submitAnswer = useSubmitAnswer();
  const getHint = useGetQuestionHint();

  // ── Hint state ────────────────────────────────────────────────────────────
  const [hintText, setHintText] = useState<string | null>(null);
  const [hintError, setHintError] = useState<string | null>(null);

  // ── Hint handler ─────────────────────────────────────────────────────────

  const handleHint = () => {
    if (!question || hintText || getHint.isPending) return;
    setHintError(null);
    getHint.mutate(
      { id: question.id, data: { userId: 1 } },
      {
        onSuccess: (res) => {
          setHintText(res.hint);
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error ?? err?.message ?? "Could not load hint";
          setHintError(msg);
        },
      }
    );
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const fetchNext = (nextDifficulty: Difficulty) => {
    setQueryParams({
      ...(typeParam ? { type: typeParam } : {}),
      difficulty: nextDifficulty,
      excludeIds: recentIdsRef.current.length > 0 ? recentIdsRef.current.join(",") : undefined,
    });
  };

  // ── Challenge handlers ────────────────────────────────────────────────────

  const handleSelect = (originalChoiceId: string) => {
    if (result || !question) return;
    setSelectedChoiceId(originalChoiceId);

    submitAnswer.mutate(
      { data: { questionId: question.id, choiceId: originalChoiceId, userId: 1 } },
      {
        onSuccess: (res) => {
          setResult(res);
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });

          const nextDiff = res.isCorrect ? DIFFICULTY_UP[difficulty] : "easy";
          setDifficulty(nextDiff);

          if (!res.isCorrect) {
            setBatchWrong((prev) => [
              ...prev,
              {
                question: question as WrongEntry["question"],
                displayChoices,
                correctChoiceId: res.correctChoiceId,
              },
            ]);
          }

          if (res.breakUnlocked) {
            setTimeout(() => setLocation("/break"), 2000);
          }
        },
      }
    );
  };

  const handleNext = () => {
    const newCount = sessionCount + 1;
    const newAcc = result?.isCorrect ? accuracyCorrect + 1 : accuracyCorrect;
    const nextDiff: Difficulty = result?.isCorrect ? DIFFICULTY_UP[difficulty] : "easy";

    setSessionCount(newCount);
    setResult(null);
    setSelectedChoiceId(null);

    const every5 = newCount % 5 === 0;
    const every10 = newCount % 10 === 0;

    const startRedemptionOrGoodJob = (wrongs: WrongEntry[]) => {
      if (wrongs.length > 0) {
        setRedemptionQueue([...wrongs]);
        setRedemptionIdx(0);
        setBatchWrong([]);
        setRedemptionSelected(null);
        setRedemptionRevealed(false);
        setScreen("redemption");
      } else {
        setBatchWrong([]);
        setScreen("good-job");
      }
    };

    if (every10) {
      setAccuracyCorrect(0);
      setPendingAccuracy({ correct: newAcc, total: 10 });
      startRedemptionOrGoodJob(batchWrong);
    } else if (every5) {
      setAccuracyCorrect(newAcc);
      startRedemptionOrGoodJob(batchWrong);
    } else {
      setAccuracyCorrect(newAcc);
      fetchNext(nextDiff);
    }
  };

  // ── Redemption handlers ───────────────────────────────────────────────────

  const handleRedemptionSelect = (choiceId: string) => {
    if (redemptionRevealed) return;
    setRedemptionSelected(choiceId);
    setRedemptionRevealed(true);
  };

  const handleRedemptionNext = () => {
    const nextIdx = redemptionIdx + 1;
    if (nextIdx < redemptionQueue.length) {
      setRedemptionIdx(nextIdx);
      setRedemptionSelected(null);
      setRedemptionRevealed(false);
    } else {
      setRedemptionSelected(null);
      setRedemptionRevealed(false);
      if (pendingAccuracy) {
        setScreen("accuracy");
      } else {
        setScreen("challenge");
        fetchNext(difficulty);
      }
    }
  };

  const handleGoodJobContinue = () => {
    if (pendingAccuracy) {
      setScreen("accuracy");
    } else {
      setScreen("challenge");
      fetchNext(difficulty);
    }
  };

  const handleAccuracyContinue = () => {
    setPendingAccuracy(null);
    setScreen("challenge");
    fetchNext(difficulty);
  };

  // ── Shared UI pieces ──────────────────────────────────────────────────────

  const batchPos = (sessionCount % 5) + 1;

  const TopBar = ({ label }: { label?: React.ReactNode }) => (
    <div className="flex items-center justify-between p-4 border-b border-border/50 sticky top-0 bg-background/90 backdrop-blur z-20">
      <button onClick={() => setLocation("/")} className="p-2 text-muted-foreground hover:text-white rounded-full hover:bg-white/5 transition-colors">
        <X className="w-5 h-5" />
      </button>
      {label ?? (
        <span className="text-xs font-mono text-muted-foreground">
          Q<span className="text-white font-bold">{sessionCount + 1}</span>
          <span className="text-muted-foreground/40 ml-1">({batchPos}/5)</span>
        </span>
      )}
      <div className="flex gap-3">
        <div className="flex items-center gap-1.5">
          <Flame className="w-4 h-4 text-accent" />
          <span className="font-mono font-bold">{user?.currentStreak || 0}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-primary" />
          <span className="font-mono font-bold">{user?.currency || 0}</span>
        </div>
      </div>
    </div>
  );

  // ── Redemption Screen ─────────────────────────────────────────────────────

  if (screen === "redemption" && redemptionQueue.length > 0) {
    const entry = redemptionQueue[redemptionIdx]!;
    const { question: rq, displayChoices: rChoices, correctChoiceId } = entry;
    const isCorrect = redemptionRevealed && redemptionSelected === correctChoiceId;

    return (
      <div className="flex-1 flex flex-col bg-background min-h-0 relative">
        <TopBar label={
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-bold text-yellow-400 uppercase tracking-wider">
              Second Chance {redemptionIdx + 1}/{redemptionQueue.length}
            </span>
          </div>
        } />

        <div className="flex-1 overflow-y-auto p-6 pb-32">
          <div className="mb-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm font-medium">
            You missed this one — give it another shot!
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-2">
              <DifficultyBadge d={rq.difficulty} />
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">{rq.type}</span>
            </div>
            {rq.passage && (
              <Card className="p-5 bg-card/50 border-border/50 font-serif leading-relaxed text-gray-300">{rq.passage}</Card>
            )}
            <h2 className="text-xl font-medium leading-snug text-white">{rq.content}</h2>
          </div>

          <div className="space-y-3">
            {rChoices.map((choice) => (
              <ChoiceButton
                key={choice.id}
                choice={choice}
                isSelected={redemptionSelected === choice.id}
                revealed={redemptionRevealed}
                correctChoiceId={redemptionRevealed ? correctChoiceId : null}
                onSelect={() => handleRedemptionSelect(choice.id)}
                disabled={redemptionRevealed}
              />
            ))}
          </div>

          {redemptionRevealed && (
            <div className="mt-6 animate-in slide-in-from-bottom-4 fade-in duration-300">
              <Card className={cn("p-5 border", isCorrect ? "bg-green-500/5 border-green-500/30" : "bg-destructive/5 border-destructive/30")}>
                <div className={cn("font-bold uppercase tracking-wider mb-2", isCorrect ? "text-green-400" : "text-destructive")}>
                  {isCorrect ? "✓ Got it this time!" : "✗ Not quite — keep going"}
                </div>
                {rq.explanation && <p className="text-sm text-muted-foreground leading-relaxed">{rq.explanation}</p>}
              </Card>
            </div>
          )}
        </div>

        {redemptionRevealed && (
          <div className="absolute bottom-6 left-6 right-6 animate-in slide-in-from-bottom-8">
            <Button onClick={handleRedemptionNext} size="lg"
              className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-black text-lg h-14 rounded-xl active:scale-95">
              {redemptionIdx + 1 < redemptionQueue.length ? "NEXT SECOND CHANCE" : "DONE"}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── Good Job Screen ───────────────────────────────────────────────────────

  if (screen === "good-job") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background p-8 text-center gap-6">
        <div className="w-24 h-24 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center shadow-[0_0_40px_rgba(34,197,94,0.3)]">
          <Star className="w-12 h-12 text-green-400 fill-green-400" />
        </div>
        <div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tight">Perfect 5!</h2>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Zero mistakes in 5 questions. Keep the streak alive!
          </p>
        </div>
        <Button onClick={handleGoodJobContinue} size="lg"
          className="bg-green-500 hover:bg-green-400 text-black font-black text-lg h-14 px-10 rounded-xl active:scale-95 shadow-[0_0_20px_rgba(34,197,94,0.4)]">
          {pendingAccuracy ? "SEE MY STATS" : "KEEP GOING"}
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    );
  }

  // ── Accuracy Screen ───────────────────────────────────────────────────────

  if (screen === "accuracy" && pendingAccuracy) {
    const pct = Math.round((pendingAccuracy.correct / pendingAccuracy.total) * 100);
    const grade =
      pct >= 90 ? { label: "Excellent", color: "text-primary", glow: "rgba(0,255,255,0.4)" }
      : pct >= 70 ? { label: "Good Work", color: "text-green-400", glow: "rgba(34,197,94,0.4)" }
      : pct >= 50 ? { label: "Keep Pushing", color: "text-yellow-400", glow: "rgba(234,179,8,0.4)" }
      : { label: "Needs Work", color: "text-destructive", glow: "rgba(239,68,68,0.4)" };

    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background p-8 text-center gap-6">
        <div className="flex items-center gap-2 text-muted-foreground text-sm font-mono uppercase tracking-widest">
          <Target className="w-4 h-4" />10-Question Check-In
        </div>
        <div className="flex flex-col items-center justify-center w-40 h-40 rounded-full border-4"
          style={{ borderColor: grade.glow.replace("0.4","0.6"), boxShadow: `0 0 60px ${grade.glow}` }}>
          <span className={cn("text-5xl font-black", grade.color)}>{pct}%</span>
          <span className="text-xs font-mono text-muted-foreground mt-1">
            {pendingAccuracy.correct}/{pendingAccuracy.total} correct
          </span>
        </div>
        <div>
          <h2 className={cn("text-2xl font-black uppercase tracking-tight", grade.color)}>{grade.label}</h2>
          <p className="text-muted-foreground text-sm mt-2 leading-relaxed max-w-xs">
            {pct >= 90 ? "Outstanding! Difficulty is ramping up."
              : pct >= 70 ? "Solid. Push into harder questions."
              : pct >= 50 ? "Improving — study the explanations."
              : "Review missed questions carefully."}
          </p>
        </div>
        <Button onClick={handleAccuracyContinue} size="lg"
          className="bg-white hover:bg-white/90 text-black font-black text-lg h-14 px-10 rounded-xl active:scale-95">
          BACK TO ARENA <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (isLoading || isRefetching) {
    return (
      <div className="flex-1 flex flex-col bg-background">
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <button onClick={() => setLocation("/")} className="p-2 text-muted-foreground rounded-full hover:bg-white/5">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 flex flex-col gap-6 pt-8">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <div className="space-y-3">
            {[1,2,3,4].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!question) return null;

  // ── Challenge Screen ──────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col bg-background min-h-0 relative">
      <TopBar />

      <div className="flex-1 overflow-y-auto p-6 pb-32">
        {/* Question */}
        <div className="space-y-4 mb-8">
          <div className="flex items-center gap-2">
            <DifficultyBadge d={question.difficulty} />
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">{question.type}</span>
          </div>
          {question.passage && (
            <Card className="p-5 bg-card/50 border-border/50 font-serif leading-relaxed text-gray-300 shadow-inner">
              {question.passage}
            </Card>
          )}
          <h2 className="text-xl font-medium leading-snug text-white">{question.content}</h2>

          {/* Hint button — only before answering */}
          {!result && (
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleHint}
                disabled={!!hintText || getHint.isPending}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all",
                  hintText
                    ? "border-yellow-500/30 text-yellow-500/50 cursor-default"
                    : "border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 active:scale-95"
                )}
              >
                {getHint.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Lightbulb className="w-3.5 h-3.5" />
                )}
                {hintText ? "Hint used" : getHint.isPending ? "Thinking…" : `Hint −30 ⚡`}
              </button>
            </div>
          )}

          {/* Hint card */}
          {hintText && (
            <div className="animate-in slide-in-from-top-2 fade-in duration-300">
              <Card className="p-4 bg-yellow-500/5 border border-yellow-500/20">
                <div className="flex items-start gap-2">
                  <Lightbulb className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-yellow-200/90 leading-relaxed">{hintText}</p>
                </div>
              </Card>
            </div>
          )}

          {/* Hint error */}
          {hintError && !hintText && (
            <p className="text-xs text-destructive/80 mt-1">{hintError}</p>
          )}
        </div>

        {/* Choices — always A, B, C, D in display order; content is shuffled */}
        <div className="space-y-3">
          {displayChoices.map((choice) => (
            <ChoiceButton
              key={choice.id}
              choice={choice}
              isSelected={selectedChoiceId === choice.id}
              revealed={!!result}
              correctChoiceId={result ? result.correctChoiceId : null}
              onSelect={() => handleSelect(choice.id)}
              disabled={!!result || submitAnswer.isPending}
            />
          ))}
        </div>

        {/* Explanation */}
        {result && (
          <div className="mt-8 animate-in slide-in-from-bottom-4 fade-in duration-300">
            <Card className={cn("p-5 border",
              result.isCorrect ? "bg-green-500/5 border-green-500/30" : "bg-destructive/5 border-destructive/30")}>
              <div className="flex items-center gap-3 mb-3">
                {result.isCorrect ? (
                  <div className="flex items-center gap-2 text-green-500 font-bold uppercase tracking-wider">
                    <Flame className="w-5 h-5 fill-current" /> Correct
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-destructive font-bold uppercase tracking-wider">
                    <XCircle className="w-5 h-5" /> Incorrect
                  </div>
                )}
                {result.isCorrect && (
                  <div className="ml-auto">
                    <span className="text-primary font-mono font-bold text-sm bg-primary/20 px-2 py-0.5 rounded">
                      +{result.currencyEarned} <Zap className="w-3 h-3 inline" />
                    </span>
                  </div>
                )}
              </div>
              <div className="text-sm text-muted-foreground leading-relaxed border-t border-border/50 pt-3">
                <span className="text-white font-bold block mb-1">Explanation</span>
                {result.explanation || question.explanation || "No explanation provided."}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Next CTA */}
      {result && !result.breakUnlocked && (
        <div className="absolute bottom-6 left-6 right-6 animate-in slide-in-from-bottom-8">
          <Button onClick={handleNext} size="lg" className={cn(
            "w-full text-black font-black text-lg h-14 rounded-xl shadow-2xl transition-all active:scale-95",
            result.isCorrect
              ? "bg-primary hover:bg-primary/90 shadow-[0_0_30px_rgba(0,255,255,0.4)]"
              : "bg-white hover:bg-gray-200"
          )}>
            NEXT QUESTION <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      )}

      {/* Break unlock overlay */}
      {result?.breakUnlocked && (
        <div className="absolute inset-0 bg-background/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
          <div className="w-24 h-24 rounded-full bg-accent/20 flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(255,0,255,0.5)]">
            <Flame className="w-12 h-12 text-accent fill-accent animate-pulse" />
          </div>
          <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-tight">Zone Achieved</h2>
          <p className="text-muted-foreground mb-8">You've earned a break. Loading your reward...</p>
          <div className="w-full max-w-xs h-2 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-accent w-full" />
          </div>
        </div>
      )}
    </div>
  );
}
