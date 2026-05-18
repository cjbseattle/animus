import { ReactNode } from "react";
import { BottomNav } from "./bottom-nav";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground flex flex-col md:max-w-md md:mx-auto md:border-x md:border-border relative overflow-x-hidden">
      <main className="flex-1 flex flex-col pb-safe w-full">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
