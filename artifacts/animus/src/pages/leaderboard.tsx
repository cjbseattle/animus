import { useGetLeaderboard } from "@workspace/api-client-react";
import { Trophy, Flame, Zap, Medal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function Leaderboard() {
  const { data: leaderboard, isLoading } = useGetLeaderboard({ limit: 50 });

  return (
    <div className="flex-1 flex flex-col pt-8 pb-24 px-4 overflow-y-auto">
      <header className="mb-8 px-2">
        <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
          <Trophy className="w-8 h-8 text-yellow-500" />
          LEADERBOARD
        </h1>
        <p className="text-muted-foreground text-sm font-mono mt-2 uppercase tracking-wider">The elite few</p>
      </header>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {leaderboard?.map((entry) => {
            const isTop3 = entry.rank <= 3;
            
            return (
              <div 
                key={entry.userId}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-xl border relative overflow-hidden",
                  entry.rank === 1 ? "bg-yellow-500/10 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.1)]" :
                  entry.rank === 2 ? "bg-gray-300/10 border-gray-300/30" :
                  entry.rank === 3 ? "bg-amber-700/10 border-amber-700/30" :
                  "bg-card border-border/50"
                )}
              >
                <div className={cn(
                  "w-10 h-10 shrink-0 flex items-center justify-center font-black text-lg font-mono rounded-lg",
                  entry.rank === 1 ? "bg-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.5)]" :
                  entry.rank === 2 ? "bg-gray-300 text-black" :
                  entry.rank === 3 ? "bg-amber-700 text-white" :
                  "bg-muted/50 text-muted-foreground"
                )}>
                  {entry.rank}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white truncate flex items-center gap-2">
                    {entry.username}
                    {entry.rank === 1 && <Medal className="w-4 h-4 text-yellow-500" />}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground font-mono">
                    <span className="flex items-center gap-1">
                      <Flame className="w-3 h-3 text-accent" /> {entry.currentStreak}
                    </span>
                    <span>•</span>
                    <span>{entry.totalCorrect} solved</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 font-black font-mono text-lg text-primary">
                  {entry.currency} <Zap className="w-5 h-5 fill-current" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
