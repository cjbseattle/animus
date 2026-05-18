import {
  useGetMeStats,
  useGetMissedQuestions,
} from "@workspace/api-client-react";
import { Activity, Target, BrainCircuit, BookOpen, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export default function Stats() {
  const { data: stats, isLoading } = useGetMeStats();
  const { data: missedQuestions, isLoading: isLoadingMissed } = useGetMissedQuestions({ limit: 5 });

  return (
    <div className="flex-1 flex flex-col pt-8 pb-24 px-6 overflow-y-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
          <Activity className="w-8 h-8 text-primary" />
          PERFORMANCE
        </h1>
        <p className="text-muted-foreground text-sm font-mono mt-2 uppercase tracking-wider">Data doesn't lie</p>
      </header>

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-32 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        </div>
      ) : stats ? (
        <div className="space-y-6">
          {/* Main Accuracy */}
          <Card className="p-6 bg-card border-border/50">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-widest mb-1">Overall Accuracy</h3>
                <div className="text-4xl font-black text-white tracking-tighter">
                  {Math.round(stats.accuracy)}%
                </div>
              </div>
              <Target className="w-8 h-8 text-accent opacity-50" />
            </div>
            <Progress
              value={stats.accuracy}
              className="h-2 bg-black/50"
              indicatorClassName="bg-accent shadow-[0_0_10px_rgba(255,0,255,0.5)]"
            />
            <div className="flex justify-between mt-3 text-xs font-mono text-muted-foreground">
              <span>{stats.totalCorrect} Correct</span>
              <span>{stats.totalAnswered} Total</span>
            </div>
          </Card>

          {/* Breakdown */}
          <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-widest mt-8 mb-2">Subject Breakdown</h2>
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-5 bg-primary/5 border-primary/20 flex flex-col justify-between">
              <div className="mb-4">
                <BrainCircuit className="w-6 h-6 text-primary mb-3" />
                <h3 className="font-bold text-white mb-1 uppercase tracking-wide">Math</h3>
                <div className="text-3xl font-black font-mono text-primary">
                  {Math.round(stats.mathAccuracy || 0)}%
                </div>
              </div>
              <div className="text-xs font-mono text-muted-foreground">
                {stats.mathCorrect} / {stats.mathAnswered}
              </div>
            </Card>

            <Card className="p-5 bg-accent/5 border-accent/20 flex flex-col justify-between">
              <div className="mb-4">
                <BookOpen className="w-6 h-6 text-accent mb-3" />
                <h3 className="font-bold text-white mb-1 uppercase tracking-wide">Reading</h3>
                <div className="text-3xl font-black font-mono text-accent">
                  {Math.round(stats.readingAccuracy || 0)}%
                </div>
              </div>
              <div className="text-xs font-mono text-muted-foreground">
                {stats.readingCorrect} / {stats.readingAnswered}
              </div>
            </Card>
          </div>

          <Card className="p-5 bg-card border-border mt-4">
            <h3 className="font-bold text-white mb-4 uppercase tracking-wide">Pacing & Effort</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-border/50">
                <span className="text-muted-foreground">Questions Answered</span>
                <span className="font-mono font-bold text-white">{stats.totalAnswered}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-border/50">
                <span className="text-muted-foreground">Correct Answers</span>
                <span className="font-mono font-bold text-green-400">{stats.totalCorrect}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Missed</span>
                <span className="font-mono font-bold text-destructive">{stats.totalAnswered - stats.totalCorrect}</span>
              </div>
            </div>
          </Card>

          {/* Frequently Missed Questions */}
          <div className="mt-4">
            <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Frequently Missed
            </h2>

            {isLoadingMissed ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
              </div>
            ) : missedQuestions && missedQuestions.length > 0 ? (
              <div className="space-y-3">
                {missedQuestions.map((q) => {
                  const missRate = q.attempts > 0 ? Math.round((q.missCount / q.attempts) * 100) : 0;
                  return (
                    <div
                      key={q.id}
                      className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 flex flex-col gap-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded",
                              q.difficulty === "hard"
                                ? "bg-destructive/20 text-destructive"
                                : q.difficulty === "medium"
                                ? "bg-yellow-500/20 text-yellow-500"
                                : "bg-green-500/20 text-green-500"
                            )}
                          >
                            {q.difficulty}
                          </span>
                          <span className="text-xs font-mono text-muted-foreground uppercase">{q.type}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-mono text-destructive font-bold">
                            {q.missCount}/{q.attempts} missed
                          </div>
                          <div className="text-xs font-mono text-muted-foreground">{missRate}% miss rate</div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-300 line-clamp-3 leading-relaxed">{q.content}</p>
                      <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
                        <div
                          className="h-full bg-destructive rounded-full transition-all"
                          style={{ width: `${missRate}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center text-muted-foreground font-mono text-sm border border-dashed border-border rounded-xl">
                No missed questions yet. Start practicing to see your weak spots.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
