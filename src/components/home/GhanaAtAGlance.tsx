import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp } from "lucide-react";

interface SecondaryData {
  value: string;
  period: string;
  source: string;
}

interface GlanceCard {
  id: string;
  value: string;
  unit: string;
  label: string;
  sublabel: string;
  period: string;
  source: string;
  status: 'ok' | 'unavailable';
  secondary?: SecondaryData;
}

interface GlanceResponse {
  cards: GlanceCard[];
  fetchedAt: string;
}

const StatCard = ({ card }: { card: GlanceCard }) => {
  return (
    <div className="bg-white/80 rounded-xl border border-border/50 p-5 text-left">
      {/* Big number */}
      <div className="font-serif text-2xl sm:text-3xl font-bold text-ft-maroon mb-2 leading-tight">
        {card.value}
      </div>
      
      {/* Label */}
      <div className="text-sm font-medium text-foreground leading-snug mb-1.5">
        {card.label}
      </div>
      
      {/* Sublabel with period and source */}
      <div className="text-xs text-muted-foreground leading-snug">
        {card.sublabel || `${card.period} • ${card.source}`}
      </div>

      {/* Secondary/More Recent Data Highlight */}
      {card.secondary && (
        <div className="mt-3 pt-3 border-t border-border/40">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={12} className="text-accent-green" />
            <span className="text-[10px] font-medium text-accent-green uppercase tracking-wide">
              Latest update
            </span>
          </div>
          <div className="font-serif text-lg font-bold text-foreground">
            {card.secondary.value}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {card.secondary.period} • {card.secondary.source}
          </div>
        </div>
      )}
    </div>
  );
};

const SkeletonCard = () => {
  return (
    <div className="bg-white/80 rounded-xl border border-border/50 p-5">
      <Skeleton className="h-8 w-20 mb-2" />
      <Skeleton className="h-4 w-28 mb-1.5" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
};

const GhanaAtAGlance = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["ghana-at-glance"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<GlanceResponse>("ghana-at-glance");
      
      if (error) {
        console.error("Ghana At A Glance fetch error:", error);
        throw error;
      }
      
      return data;
    },
    staleTime: 6 * 60 * 60 * 1000, // Cache for 6 hours
    refetchOnWindowFocus: false,
  });

  return (
    <section className="bg-muted/50 py-6 border-y border-border">
      <div className="max-w-7xl mx-auto px-4">
        {/* Section header */}
        <div className="mb-5">
          <h2 className="font-serif text-lg sm:text-xl font-semibold text-ft-maroon">
            Ghana key indicators
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Live official stats from GSS and Bank of Ghana
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {isLoading ? (
            // Skeleton loaders
            Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))
          ) : data?.cards ? (
            // Actual cards
            data.cards.map((card) => (
              <StatCard key={card.id} card={card} />
            ))
          ) : (
            // Error state - show placeholders
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white/80 rounded-xl border border-border/50 p-5 text-left">
                <div className="font-serif text-2xl font-bold text-muted-foreground mb-2">
                  —
                </div>
                <div className="text-sm font-medium text-muted-foreground">
                  Unable to load
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};

export default GhanaAtAGlance;
