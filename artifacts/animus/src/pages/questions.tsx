import { useState } from "react";
import { useLocation } from "wouter";
import { useListQuestions } from "@workspace/api-client-react";
import { BrainCircuit, BookOpen, ChevronRight, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Tab = "math" | "reading";

const DIFFICULTY_STYLES: Record<string, string> = {
  easy: "bg-green-500/20 text-green-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  hard: "bg-destructive/20 text-destructive",
};

export default function Questions() {
  const [tab, setTab] = useState<Tab>("math");
  const [, setLocation] = useLocation();

  const { data: questions, isLoading } = useListQuestions({ type: tab }, {
    query: { staleTime: 60_000 },
  });

  return (
    <div className="flex-1 flex flex-col pt-8 pb-24 overflow-hidden">
      {/* Header */}
      <div className="px-6 mb-6">
        <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
          <Search className="w-8 h-8 text-primary" />
          QUESTIONS
        </h1>
        <p className="text-muted-foreground text-sm font-mono mt-2 uppercase tracking-wider">
          Browse the full question bank
        </p>
      </div>

      {/* Tabs */}
      <div className="px-6 mb-6">
        <div className="flex rounded-xl overflow-hidden border border-border/50 bg-black/30">
          <button
            onClick={() => setTab("math")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold uppercase tracking-wider transition-all duration-200",
              tab === "math"
                ? "bg-primary text-black shadow-[0_0_20px_rgba(0,255,255,0.3)]"
                : "text-muted-foreground hover:text-white"
            )}
          >
            <BrainCircuit className="w-4 h-4" />
            Math
          </button>
          <button
            onClick={() => setTab("reading")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold uppercase tracking-wider transition-all duration-200",
              tab === "reading"
                ? "bg-accent text-black shadow-[0_0_20px_rgba(255,0,255,0.3)]"
                : "text-muted-foreground hover:text-white"
            )}
          >
            <BookOpen className="w-4 h-4" />
            Reading
          </button>
        </div>
      </div>

      {/* Question count */}
      {!isLoading && questions && (
        <div className="px-6 mb-3">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            {questions.length} question{questions.length !== 1 ? "s" : ""} available
          </p>
        </div>
      )}

      {/* Question list */}
      <div className="flex-1 overflow-y-auto px-6 space-y-3">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))
        ) : questions && questions.length > 0 ? (
          questions.map((q, idx) => (
            <button
              key={q.id}
              onClick={() => setLocation(`/challenge?type=${tab}`)}
              className="w-full text-left"
            >
              <Card className={cn(
                "p-4 border transition-all duration-200 hover:border-white/20 active:scale-[0.98] cursor-pointer",
                tab === "math" ? "bg-primary/5 border-primary/10 hover:bg-primary/10" : "bg-accent/5 border-accent/10 hover:bg-accent/10"
              )}>
                <div className="flex items-start gap-3">
                  <span className="text-xs font-mono text-muted-foreground shrink-0 pt-1 w-6 text-right">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={cn("text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded", DIFFICULTY_STYLES[q.difficulty])}>
                        {q.difficulty}
                      </span>
                      {q.passage && (
                        <span className="text-xs text-muted-foreground font-mono">has passage</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-300 line-clamp-2 leading-relaxed">{q.content}</p>
                  </div>
                  <ChevronRight className={cn("w-4 h-4 shrink-0 mt-2", tab === "math" ? "text-primary" : "text-accent")} />
                </div>
              </Card>
            </button>
          ))
        ) : (
          <div className="p-8 text-center text-muted-foreground font-mono text-sm border border-dashed border-border rounded-xl">
            No {tab} questions found.
          </div>
        )}
      </div>
    </div>
  );
}
