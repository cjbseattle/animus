import { Link, useLocation } from "wouter";
import { Home, Trophy, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const [location] = useLocation();

  const links = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/leaderboard", icon: Trophy, label: "Leaderboard" },
    { href: "/stats", icon: BarChart2, label: "Stats" },
  ];

  if (location === "/challenge" || location === "/break") return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-t border-border pb-safe">
      <nav className="flex items-center justify-around h-16 max-w-md mx-auto px-4">
        {links.map((link) => {
          const isActive = location === link.href;
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href} className="flex-1 flex justify-center">
              <div
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("w-6 h-6", isActive && "drop-shadow-[0_0_8px_rgba(0,255,255,0.5)]")} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium tracking-wide uppercase">{link.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
