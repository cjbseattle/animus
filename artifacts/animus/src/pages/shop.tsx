import { useQueryClient } from "@tanstack/react-query";
import {
  useGetShopItems,
  usePurchaseItem,
  useGetMyPowerups,
  useGetMe,
  getGetMeQueryKey,
  getGetMyPowerupsQueryKey,
} from "@workspace/api-client-react";
import { Lightbulb, SkipForward, ShieldCheck, ShoppingBag, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, React.ElementType> = {
  Lightbulb,
  SkipForward,
  ShieldCheck,
};

const TYPE_COLORS: Record<string, string> = {
  hint: "text-yellow-400 border-yellow-400/20 bg-yellow-400/5",
  skip: "text-primary border-primary/20 bg-primary/5",
  shield: "text-accent border-accent/20 bg-accent/5",
};

const TYPE_ICON_COLORS: Record<string, string> = {
  hint: "text-yellow-400",
  skip: "text-primary",
  shield: "text-accent",
};

export default function Shop() {
  const queryClient = useQueryClient();
  const { data: items, isLoading: isLoadingItems } = useGetShopItems();
  const { data: powerups } = useGetMyPowerups();
  const { data: user } = useGetMe();
  const purchase = usePurchaseItem({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyPowerupsQueryKey() });
      },
    },
  });

  const getPowerupCount = (type: string) => {
    return powerups?.find((p) => p.type === type)?.quantity ?? 0;
  };

  const handlePurchase = (itemId: string) => {
    purchase.mutate({ data: { itemId, userId: 1 } });
  };

  const currency = user?.currency ?? 0;

  return (
    <div className="flex-1 flex flex-col pt-8 pb-24 px-6 overflow-y-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
          <ShoppingBag className="w-8 h-8 text-primary" />
          POWER-UP SHOP
        </h1>
        <p className="text-muted-foreground text-sm font-mono mt-2 uppercase tracking-wider">
          Spend your earnings. Stay ahead.
        </p>
      </header>

      {/* Currency balance */}
      <Card className="p-4 mb-8 bg-card border-border/50 flex items-center justify-between">
        <span className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Your Balance</span>
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-400" />
          <span className="text-2xl font-black text-yellow-400 font-mono">{currency}</span>
        </div>
      </Card>

      {/* Shop items */}
      {isLoadingItems ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {items?.map((item) => {
            const Icon = ICON_MAP[item.icon] ?? Lightbulb;
            const owned = getPowerupCount(item.type);
            const canAfford = currency >= item.cost;
            const colorClass = TYPE_COLORS[item.type] ?? "";
            const iconColor = TYPE_ICON_COLORS[item.type] ?? "text-primary";
            const isPending = purchase.isPending && purchase.variables?.data.itemId === item.id;

            return (
              <Card
                key={item.id}
                className={cn("p-5 border transition-all duration-200", colorClass)}
              >
                <div className="flex items-start gap-4">
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center bg-black/30 shrink-0", iconColor)}>
                    <Icon className="w-6 h-6" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-black text-white text-lg uppercase tracking-wide">{item.name}</h3>
                      {owned > 0 && (
                        <span className="text-xs font-bold font-mono bg-black/40 px-2 py-1 rounded-full text-white">
                          x{owned} owned
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">{item.description}</p>

                    <button
                      onClick={() => handlePurchase(item.id)}
                      disabled={!canAfford || isPending}
                      className={cn(
                        "w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-bold text-sm uppercase tracking-wider transition-all duration-200",
                        canAfford && !isPending
                          ? "bg-white text-black hover:bg-white/90 active:scale-95"
                          : "bg-black/30 text-muted-foreground cursor-not-allowed"
                      )}
                    >
                      <Zap className="w-4 h-4 text-yellow-400" />
                      {isPending ? "Purchasing..." : `${item.cost} currency`}
                      {!canAfford && !isPending && " — Need more"}
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Power-up guide */}
      <Card className="p-5 mt-8 bg-card border-border/50">
        <h3 className="font-bold text-white mb-4 uppercase tracking-wide text-sm">How Power-ups Work</h3>
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-3">
            <Lightbulb className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
            <span><span className="text-white font-semibold">Hint</span> — removes one wrong answer from the choices during a challenge.</span>
          </div>
          <div className="flex items-start gap-3">
            <SkipForward className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <span><span className="text-white font-semibold">Skip</span> — passes a question without counting it against your streak.</span>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            <span><span className="text-white font-semibold">Streak Shield</span> — absorbs one wrong answer so your streak stays intact.</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
