import { useState } from "react";
import { Link } from "wouter";
import { useGetMe, useGetDailyQuestion } from "@workspace/api-client-react";
import { Zap, Flame, BrainCircuit, BookOpen, ChevronRight, Calculator, Shuffle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Mode = "math" | "reading" | "both";

function getNextMilestone(consecutiveCorrect: number = 0) {
  if (consecutiveCorrect < 5) return { next: 5, reward: "+20 bonus", current: consecutiveCorrect };
  if (consecutiveCorrect < 10) return { next: 10, reward: "2x multiplier", current: consecutiveCorrect };
  if (consecutiveCorrect < 20) return { next: 20, reward: "4x multiplier", current: consecutiveCorrect };
  if (consecutiveCorrect < 30) return { next: 30, reward: "Scroll break", current: consecutiveCorrect };
  return { next: consecutiveCorrect + 10, reward: "Bonus", current: consecutiveCorrect };
}

export default function Home() {
  const { data: user, isLoading: isLoadingUser } = useGetMe();
  useGetDailyQuestion();
  const [selectedMode, setSelectedMode] = useState<Mode>("math");

  const challengeUrl =
    selectedMode === "both"
      ? "/challenge"
      : `/challenge?type=${selectedMode}`;

  return (
    <div className="flex-1 flex flex-col pt-8 pb-24 px-6 gap-8 overflow-y-auto">
      {/* Header / Stats */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.2)]">ANIMUS</h1>
          <p className="text-muted-foreground text-sm font-mono mt-1 uppercase tracking-wider">Stay sharp</p>
        </div>

        <div className="flex flex-col items-end gap-2">
          {isLoadingUser ? (
            <Skeleton className="h-8 w-24 rounded-full" />
          ) : (
            <div className="flex gap-3">
              <div className="flex items-center gap-1.5 bg-card border border-border px-3 py-1.5 rounded-full shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                <Flame className="w-4 h-4 text-accent fill-accent animate-pulse" />
                <span className="font-bold font-mono text-white">{user?.currentStreak || 0}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-card border border-border px-3 py-1.5 rounded-full shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                <Zap className="w-4 h-4 text-primary fill-primary" />
                <span className="font-bold font-mono text-white">{user?.currency || 0}</span>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Milestone Tracker */}
      <section className="space-y-4">
        <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-widest">Next Milestone</h2>
        {isLoadingUser ? (
          <Skeleton className="h-24 w-full rounded-2xl" />
        ) : (
          <Card className="p-5 border-primary/30 bg-primary/5 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10 flex flex-col gap-3">
              <div className="flex justify-between items-end">
                <div className="text-2xl font-black font-mono text-white">
                  {user?.consecutiveCorrect || 0}
                  <span className="text-muted-foreground text-lg">/{getNextMilestone(user?.consecutiveCorrect).next}</span>
                </div>
                <div className="text-primary font-bold bg-primary/20 px-2 py-1 rounded text-sm uppercase tracking-wide">
                  {getNextMilestone(user?.consecutiveCorrect).reward}
                </div>
              </div>
              <Progress
                value={((user?.consecutiveCorrect || 0) / getNextMilestone(user?.consecutiveCorrect).next) * 100}
                className="h-2 bg-black/50"
                indicatorClassName="bg-primary shadow-[0_0_10px_rgba(0,255,255,0.8)]"
              />
            </div>
          </Card>
        )}
      </section>

      {/* Mode Selector & Action */}
      <section className="space-y-4 mt-auto">
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setSelectedMode("math")}
            className={cn(
              "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-200",
              selectedMode === "math"
                ? "border-primary bg-primary/10 text-white shadow-[0_0_20px_rgba(0,255,255,0.2)]"
                : "border-border bg-card text-muted-foreground hover:bg-card/80 hover:border-muted"
            )}
          >
            <Calculator className={cn("w-7 h-7 mb-2", selectedMode === "math" && "text-primary")} />
            <span className="font-bold uppercase tracking-wide text-xs">Math</span>
          </button>

          <button
            onClick={() => setSelectedMode("both")}
            className={cn(
              "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-200",
              selectedMode === "both"
                ? "border-white bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                : "border-border bg-card text-muted-foreground hover:bg-card/80 hover:border-muted"
            )}
          >
            <Shuffle className={cn("w-7 h-7 mb-2", selectedMode === "both" && "text-white")} />
            <span className="font-bold uppercase tracking-wide text-xs">Both</span>
          </button>

          <button
            onClick={() => setSelectedMode("reading")}
            className={cn(
              "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-200",
              selectedMode === "reading"
                ? "border-accent bg-accent/10 text-white shadow-[0_0_20px_rgba(255,0,255,0.2)]"
                : "border-border bg-card text-muted-foreground hover:bg-card/80 hover:border-muted"
            )}
          >
            <BookOpen className={cn("w-7 h-7 mb-2", selectedMode === "reading" && "text-accent")} />
            <span className="font-bold uppercase tracking-wide text-xs">Reading</span>
          </button>
        </div>

        <Link href={challengeUrl} className="block">
          <button className="w-full relative group overflow-hidden rounded-2xl bg-white text-black p-5 font-black text-xl tracking-tight flex items-center justify-center gap-3 transition-transform active:scale-95">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 ease-in-out" />
            <BrainCircuit className="w-6 h-6" />
            ENTER THE ARENA
            <ChevronRight className="w-6 h-6" />
          </button>
        </Link>
      </section>
    </div>
  );
}
