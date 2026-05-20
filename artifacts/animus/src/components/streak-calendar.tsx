import { useGetMyActivity } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const DAYS_OF_WEEK = ["S", "M", "T", "W", "T", "F", "S"];

function getIntensity(count: number, correct: number): number {
  if (count === 0) return 0;
  const accuracy = correct / count;
  if (count >= 10 && accuracy >= 0.8) return 4;
  if (count >= 5 && accuracy >= 0.6) return 3;
  if (count >= 2) return 2;
  return 1;
}

const INTENSITY_CLASSES: Record<number, string> = {
  0: "bg-white/5 border border-white/5",
  1: "bg-primary/20 border border-primary/20",
  2: "bg-primary/40 border border-primary/30",
  3: "bg-primary/70 border border-primary/50 shadow-[0_0_6px_rgba(0,255,255,0.3)]",
  4: "bg-primary border border-primary shadow-[0_0_10px_rgba(0,255,255,0.5)]",
};

export function StreakCalendar() {
  const { data: activity, isLoading } = useGetMyActivity({ days: 35 });

  if (isLoading) {
    return <Skeleton className="h-24 w-full rounded-xl" />;
  }

  if (!activity || activity.length === 0) return null;

  // Pad the front so the first day lands on the correct day-of-week column
  const firstDate = new Date(activity[0].date + "T00:00:00");
  const startDow = firstDate.getDay(); // 0=Sun
  const padded = [
    ...Array(startDow).fill(null),
    ...activity,
  ];

  // How many practiced days total
  const activeDays = activity.filter((d) => d.count > 0).length;
  const totalAnswered = activity.reduce((s, d) => s + d.count, 0);

  return (
    <div className="space-y-3">
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-1 px-0.5">
        {DAYS_OF_WEEK.map((d, i) => (
          <div key={i} className="text-center text-[9px] font-mono text-muted-foreground/60 uppercase">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {padded.map((day, i) => {
          if (!day) {
            return <div key={`pad-${i}`} />;
          }
          const intensity = getIntensity(day.count, day.correct);
          const isToday = day.date === new Date().toISOString().slice(0, 10);
          return (
            <div
              key={day.date}
              title={`${day.date}: ${day.count} answered, ${day.correct} correct`}
              className={cn(
                "aspect-square rounded-sm transition-all",
                INTENSITY_CLASSES[intensity],
                isToday && "ring-1 ring-white/40"
              )}
            />
          );
        })}
      </div>

      {/* Legend & summary */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-xs font-mono text-muted-foreground">
          <span className="text-white font-bold">{activeDays}</span> active days &middot;{" "}
          <span className="text-white font-bold">{totalAnswered}</span> answered
        </p>
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-mono text-muted-foreground/60 mr-1">less</span>
          {[0, 1, 2, 3, 4].map((lvl) => (
            <div key={lvl} className={cn("w-3 h-3 rounded-sm", INTENSITY_CLASSES[lvl])} />
          ))}
          <span className="text-[9px] font-mono text-muted-foreground/60 ml-1">more</span>
        </div>
      </div>
    </div>
  );
}
