import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetRandomQuestion, useSubmitAnswer, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Zap, Flame, X, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function Challenge() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const type = searchParams.get("type") as "math" | "reading" || "math";
  
  const queryClient = useQueryClient();
  const { data: user } = useGetMe();
  
  const { data: question, isLoading, refetch, isRefetching } = useGetRandomQuestion({ type }, {
    query: { refetchOnWindowFocus: false, staleTime: 0 }
  });
  
  const submitAnswer = useSubmitAnswer();
  
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  
  const handleSelect = (choiceId: string) => {
    if (result) return;
    setSelectedChoiceId(choiceId);
    
    if (question) {
      submitAnswer.mutate(
        { data: { questionId: question.id, choiceId, userId: 1 } },
        {
          onSuccess: (res) => {
            setResult(res);
            queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
            
            if (res.breakUnlocked) {
              setTimeout(() => {
                setLocation("/break");
              }, 2000);
            }
          }
        }
      );
    }
  };
  
  const handleNext = () => {
    setResult(null);
    setSelectedChoiceId(null);
    refetch();
  };

  if (isLoading || isRefetching) {
    return (
      <div className="flex-1 p-6 flex flex-col gap-6 pt-12">
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="space-y-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!question) return null;

  return (
    <div className="flex-1 flex flex-col bg-background min-h-0 relative">
      {/* Top Bar */}
      <div className="flex items-center justify-between p-4 border-b border-border/50 sticky top-0 bg-background/90 backdrop-blur z-20">
        <button onClick={() => setLocation("/")} className="p-2 text-muted-foreground hover:text-white rounded-full hover:bg-white/5 transition-colors">
          <X className="w-5 h-5" />
        </button>
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

      <div className="flex-1 overflow-y-auto p-6 pb-32">
        {/* Question Content */}
        <div className="space-y-6 mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className={cn(
              "text-xs font-bold uppercase tracking-wider px-2 py-1 rounded",
              question.difficulty === 'hard' ? "bg-destructive/20 text-destructive" :
              question.difficulty === 'medium' ? "bg-yellow-500/20 text-yellow-500" :
              "bg-green-500/20 text-green-500"
            )}>
              {question.difficulty}
            </span>
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">{type}</span>
          </div>
          
          {question.passage && (
            <Card className="p-5 bg-card/50 border-border/50 font-serif leading-relaxed text-gray-300 shadow-inner">
              {question.passage}
            </Card>
          )}
          
          <h2 className="text-xl md:text-2xl font-medium leading-snug text-white">
            {question.content}
          </h2>
        </div>

        {/* Choices */}
        <div className="space-y-3">
          {question.choices.map((choice) => {
            const isSelected = selectedChoiceId === choice.id;
            const isCorrectAnswer = result?.correctChoiceId === choice.id;
            
            let stateClass = "border-border/50 bg-card hover:bg-card/80 hover:border-white/20";
            if (result) {
              if (isCorrectAnswer) {
                stateClass = "border-green-500 bg-green-500/10 text-green-100 shadow-[0_0_15px_rgba(34,197,94,0.2)]";
              } else if (isSelected && !result.isCorrect) {
                stateClass = "border-destructive bg-destructive/10 text-destructive-foreground opacity-70";
              } else {
                stateClass = "border-border/20 bg-card/30 opacity-40";
              }
            } else if (isSelected) {
              stateClass = "border-primary bg-primary/10 text-white";
            }

            return (
              <button
                key={choice.id}
                disabled={!!result}
                onClick={() => handleSelect(choice.id)}
                className={cn(
                  "w-full p-4 rounded-xl border-2 text-left flex items-start gap-4 transition-all duration-200",
                  stateClass,
                  !result && "active:scale-[0.98]"
                )}
              >
                <div className={cn(
                  "w-8 h-8 shrink-0 rounded flex items-center justify-center font-mono font-bold text-sm",
                  result && isCorrectAnswer ? "bg-green-500 text-black" :
                  result && isSelected && !result.isCorrect ? "bg-destructive text-white" :
                  isSelected ? "bg-primary text-black" : "bg-white/10 text-muted-foreground"
                )}>
                  {choice.label}
                </div>
                <div className="flex-1 pt-1 font-medium">{choice.text}</div>
                
                {result && isCorrectAnswer && <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />}
                {result && isSelected && !result.isCorrect && <XCircle className="w-6 h-6 text-destructive shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Results / Explanation Panel */}
        {result && (
          <div className="mt-8 animate-in slide-in-from-bottom-4 fade-in duration-300">
            <Card className={cn(
              "p-5 border",
              result.isCorrect ? "bg-green-500/5 border-green-500/30" : "bg-destructive/5 border-destructive/30"
            )}>
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
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-primary font-mono font-bold text-sm bg-primary/20 px-2 py-0.5 rounded">
                      +{result.currencyEarned} <Zap className="w-3 h-3 inline" />
                    </span>
                  </div>
                )}
              </div>
              
              <div className="text-sm text-muted-foreground leading-relaxed mt-2 border-t border-border/50 pt-3">
                <span className="text-white font-bold block mb-1">Explanation</span>
                {result.explanation || question.explanation || "No explanation provided."}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Next Button Floating Action */}
      {result && !result.breakUnlocked && (
        <div className="absolute bottom-6 left-6 right-6 animate-in slide-in-from-bottom-8">
          <Button 
            onClick={handleNext} 
            size="lg" 
            className={cn(
              "w-full text-black font-black text-lg h-14 rounded-xl shadow-2xl transition-all active:scale-95",
              result.isCorrect ? "bg-primary hover:bg-primary/90 shadow-[0_0_30px_rgba(0,255,255,0.4)]" : "bg-white hover:bg-gray-200"
            )}
          >
            NEXT QUESTION
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      )}
      
      {result?.breakUnlocked && (
        <div className="absolute inset-0 bg-background/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
          <div className="w-24 h-24 rounded-full bg-accent/20 flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(255,0,255,0.5)]">
            <Flame className="w-12 h-12 text-accent fill-accent animate-pulse" />
          </div>
          <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-tight">Zone Achieved</h2>
          <p className="text-muted-foreground mb-8">You've answered 30 questions correctly in a row. You earned a break.</p>
          <div className="w-full max-w-xs h-2 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-accent w-full animate-[progress_2s_ease-in-out]" style={{ transformOrigin: "left" }} />
          </div>
        </div>
      )}
    </div>
  );
}
