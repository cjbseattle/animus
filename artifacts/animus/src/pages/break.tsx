import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetBreakContent } from "@workspace/api-client-react";
import { Timer, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Break() {
  const [location, setLocation] = useLocation();
  const [timeLeft, setTimeLeft] = useState(120); // 2 minutes
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const { data: contents, isLoading } = useGetBreakContent({ limit: 10 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setLocation("/challenge");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [setLocation]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleNext = () => {
    if (contents && currentIndex < contents.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  if (isLoading || !contents || contents.length === 0) {
    return <div className="flex-1 bg-black flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" /></div>;
  }

  const currentContent = contents[currentIndex];

  return (
    <div className="flex-1 bg-black text-white relative overflow-hidden flex flex-col h-[100dvh]">
      {/* Top HUD */}
      <div className="absolute top-0 left-0 right-0 p-4 pt-safe z-50 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-accent font-mono font-bold tracking-widest text-sm">
          <Timer className="w-4 h-4" />
          {formatTime(timeLeft)}
        </div>
        
        <button 
          onClick={() => setLocation("/challenge")}
          className="bg-black/50 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 font-bold text-sm hover:bg-white/10 transition-colors flex items-center gap-2"
        >
          BACK TO STUDYING <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content Area - Like Reels/TikTok */}
      <div 
        className="flex-1 w-full relative snap-y snap-mandatory overflow-y-hidden"
        onClick={handleNext}
      >
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          {currentContent.type === 'image' || currentContent.type === 'gif' ? (
            <img 
              src={currentContent.url} 
              alt={currentContent.caption}
              className="w-full h-full object-cover opacity-80"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-900 text-muted-foreground p-8 text-center font-mono">
              Video Player Placeholder
              <br />
              {currentContent.url}
            </div>
          )}
          
          <div className="absolute bottom-0 left-0 right-0 p-6 pt-32 bg-gradient-to-t from-black via-black/60 to-transparent pb-safe">
            <h3 className="text-xl font-bold mb-2 drop-shadow-md">{currentContent.caption}</h3>
            <p className="text-sm text-gray-300 font-mono">Tap anywhere for next</p>
          </div>
        </div>
      </div>
      
      {/* Time's Up Overlay */}
      {timeLeft === 0 && (
        <div className="absolute inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-6 text-center backdrop-blur-lg">
          <h2 className="text-4xl font-black text-accent mb-4 uppercase tracking-tighter">Break's Over</h2>
          <p className="text-lg text-gray-300 mb-8 max-w-xs">Back to the grind. Keep that streak alive.</p>
          <Button size="lg" className="bg-primary text-black font-black text-lg h-14 px-8 w-full max-w-xs rounded-xl" onClick={() => setLocation("/challenge")}>
            RESUME
          </Button>
        </div>
      )}
    </div>
  );
}
