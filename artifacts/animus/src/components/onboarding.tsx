import { useState } from "react";
import { useUpdateUsername, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { BrainCircuit, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  const update = useUpdateUsername({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        onComplete();
      },
    },
  });

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }
    if (trimmed.length > 24) {
      setError("Name must be 24 characters or fewer.");
      return;
    }
    setError("");
    update.mutate({ data: { username: trimmed } });
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-8">
      {/* Glow backdrop */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-xs flex flex-col items-center text-center gap-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center shadow-[0_0_40px_rgba(0,255,255,0.2)]">
            <BrainCircuit className="w-10 h-10 text-primary" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tight text-white">ANIMUS</h1>
            <p className="text-muted-foreground text-sm font-mono uppercase tracking-widest mt-1">Your SAT Arena</p>
          </div>
        </div>

        {/* Prompt */}
        <div className="space-y-2">
          <h2 className="text-xl font-black text-white">What should we call you?</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Your name appears on your profile and tracks your progress.
          </p>
        </div>

        {/* Input */}
        <div className="w-full space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Enter your name..."
            maxLength={24}
            autoFocus
            className={cn(
              "w-full bg-card border-2 rounded-xl px-4 py-3.5 text-white font-medium text-center text-lg placeholder:text-muted-foreground/50 outline-none transition-all duration-200",
              error ? "border-destructive focus:border-destructive" : "border-border focus:border-primary focus:shadow-[0_0_20px_rgba(0,255,255,0.2)]"
            )}
          />
          {error && (
            <p className="text-destructive text-xs font-mono">{error}</p>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={handleSubmit}
          disabled={update.isPending || name.trim().length === 0}
          className={cn(
            "w-full flex items-center justify-center gap-3 py-4 rounded-xl font-black text-lg uppercase tracking-tight transition-all duration-200 active:scale-95",
            name.trim().length > 0 && !update.isPending
              ? "bg-white text-black hover:bg-white/90 shadow-[0_0_30px_rgba(255,255,255,0.15)]"
              : "bg-white/10 text-muted-foreground cursor-not-allowed"
          )}
        >
          {update.isPending ? "Saving..." : "Enter the Arena"}
          {!update.isPending && <ArrowRight className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
