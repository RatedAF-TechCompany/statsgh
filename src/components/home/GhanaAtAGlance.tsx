import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

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
    <div className="bg-white/80 rounded-xl border border-border/50 p-4 sm:p-5 text-left">
      {/* Big number */}
      <div className="font-serif text-xl sm:text-2xl lg:text-3xl font-bold text-ft-maroon mb-1 sm:mb-2 leading-tight">
        {card.value}
      </div>
      
      {/* Label */}
      <div className="text-xs sm:text-sm font-medium text-foreground leading-snug mb-1">
        {card.label}
      </div>
      
      {/* Sublabel with period and source */}
      <div className="text-[10px] sm:text-xs text-muted-foreground leading-snug">
        {card.sublabel || `${card.period} • ${card.source}`}
      </div>

      {/* Secondary/More Recent Data Highlight */}
      {card.secondary && (
        <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-border/40">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={10} className="text-accent-green" />
            <span className="text-[9px] sm:text-[10px] font-medium text-accent-green uppercase tracking-wide">
              Latest update
            </span>
          </div>
          <div className="font-serif text-base sm:text-lg font-bold text-foreground">
            {card.secondary.value}
          </div>
          <div className="text-[10px] sm:text-[11px] text-muted-foreground">
            {card.secondary.period} • {card.secondary.source}
          </div>
        </div>
      )}
    </div>
  );
};

const SkeletonCard = () => {
  return (
    <div className="bg-white/80 rounded-xl border border-border/50 p-4 sm:p-5">
      <Skeleton className="h-6 sm:h-8 w-16 sm:w-20 mb-2" />
      <Skeleton className="h-3 sm:h-4 w-20 sm:w-28 mb-1.5" />
      <Skeleton className="h-2 sm:h-3 w-16 sm:w-24" />
    </div>
  );
};

const INITIAL_CARDS_MOBILE = 4;

const GhanaAtAGlance = () => {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  
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

  const allCards = data?.cards || [];
  const visibleCards = showAll ? allCards : allCards.slice(0, INITIAL_CARDS_MOBILE);
  const hasMore = allCards.length > INITIAL_CARDS_MOBILE;

  return (
    <section className="bg-white py-8 border-y border-[#D9D9D9]">
      <div className="max-w-7xl mx-auto px-4">
        {/* Section header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="kicker mb-1">Markets</p>
            <h2 className="font-headline text-[22px] font-bold text-[#121212]">
              Ghana key indicators
            </h2>
            <p className="font-ui text-[12px] text-[#757575] mt-1">
              Live official stats from GSS and Bank of Ghana
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="kicker hidden sm:flex"
            onClick={() => navigate('/data')}
          >
            All data →
          </Button>
        </div>

        {/* Cards grid - 9 cards: 2 cols mobile, 3 cols tablet, 5 cols desktop with last row wrapping */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 lg:gap-4">
          {isLoading ? (
            // Skeleton loaders - show 4 on mobile, 9 on desktop
            <>
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
              <div className="hidden sm:contents">
                {Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonCard key={`desktop-${i}`} />
                ))}
              </div>
            </>
          ) : allCards.length > 0 ? (
            <>
              {/* Mobile: show limited cards initially */}
              <div className="contents sm:hidden">
                {visibleCards.map((card) => (
                  <StatCard key={card.id} card={card} />
                ))}
              </div>
              {/* Desktop: show all cards */}
              <div className="hidden sm:contents">
                {allCards.map((card) => (
                  <StatCard key={card.id} card={card} />
                ))}
              </div>
            </>
          ) : (
            // Error state - show placeholders
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white/80 rounded-xl border border-border/50 p-4 sm:p-5 text-left">
                <div className="font-serif text-xl sm:text-2xl font-bold text-muted-foreground mb-2">
                  —
                </div>
                <div className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Unable to load
                </div>
              </div>
            ))
          )}
        </div>

        {/* Show more button - mobile only */}
        {!isLoading && hasMore && (
          <div className="sm:hidden mt-3 text-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-ft-maroon hover:text-ft-maroon/80 text-xs"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? (
                <>Show less <ChevronUp size={14} className="ml-1" /></>
              ) : (
                <>View all {allCards.length} indicators <ChevronDown size={14} className="ml-1" /></>
              )}
            </Button>
          </div>
        )}

        {/* Mobile: Link to all data */}
        <div className="sm:hidden mt-3 text-center">
          <Button 
            variant="link" 
            size="sm" 
            className="text-ft-maroon hover:text-ft-maroon/80 text-xs p-0"
            onClick={() => navigate('/data')}
          >
            Explore all data →
          </Button>
        </div>
      </div>
    </section>
  );
};

export default GhanaAtAGlance;
