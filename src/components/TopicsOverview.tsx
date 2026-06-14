import { useState, useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ChevronDown, 
  ChevronUp, 
  Users, 
  Heart, 
  Zap, 
  Wheat, 
  TrendingUp, 
  DollarSign, 
  Ship, 
  Briefcase, 
  GraduationCap, 
  Home, 
  Vote,
  LucideIcon
} from "lucide-react";

// Map topic slugs to icons
const TOPIC_ICONS: Record<string, LucideIcon> = {
  "population-and-demographic-change": Users,
  "health": Heart,
  "energy-and-environment": Zap,
  "food-and-agriculture": Wheat,
  "poverty-and-economic-development": TrendingUp,
  "finance-prices-and-public-debt": DollarSign,
  "trade-and-external-sector": Ship,
  "jobs-and-wages": Briefcase,
  "education-and-knowledge": GraduationCap,
  "living-conditions-and-wellbeing": Home,
  "governance-and-elections": Vote,
};

// Map topic slugs to theme colors (for hover effects)
const TOPIC_COLORS: Record<string, string> = {
  "population-and-demographic-change": "#6366f1", // indigo
  "health": "#ef4444", // red
  "energy-and-environment": "#f59e0b", // amber
  "food-and-agriculture": "#22c55e", // green
  "poverty-and-economic-development": "#3b82f6", // blue
  "finance-prices-and-public-debt": "#8b5cf6", // violet
  "trade-and-external-sector": "#06b6d4", // cyan
  "jobs-and-wages": "#f97316", // orange
  "education-and-knowledge": "#a855f7", // purple
  "living-conditions-and-wellbeing": "#14b8a6", // teal
  "governance-and-elections": "#ec4899", // pink
};

// Topic configuration from the site spec - Updated with actual database slugs
const TOPICS_CONFIG = [
  {
    topicSlug: "population-and-demographic-change",
    topicTitle: "Population and Demographic Change",
    indicatorLinks: [
      { label: "Population Size", indicatorSlug: "population-total" },
      { label: "Population Growth", indicatorSlug: "population-growth-rate" },
      { label: "Urbanisation", indicatorSlug: "urban-population-share" },
      { label: "Age Structure", indicatorSlug: "population-age-structure" },
      { label: "Fertility Rate", indicatorSlug: "fertility-rate" },
      { label: "Life Expectancy", indicatorSlug: "life-expectancy" },
      { label: "Child Mortality", indicatorSlug: "under-5-mortality" },
      { label: "Migration", indicatorSlug: "net-migration" },
    ],
  },
  {
    topicSlug: "health",
    topicTitle: "Health",
    indicatorLinks: [
      { label: "Life Expectancy", indicatorSlug: "life-expectancy" },
      { label: "Maternal Mortality", indicatorSlug: "maternal-mortality-ratio" },
      { label: "Under 5 Mortality", indicatorSlug: "under-5-mortality" },
      { label: "Infant Mortality", indicatorSlug: "infant-mortality" },
      { label: "Skilled Birth Attendance", indicatorSlug: "skilled-birth-attendance" },
      { label: "Immunisation DTP3", indicatorSlug: "immunisation-dtp3" },
      { label: "Malaria Burden", indicatorSlug: "malaria-cases" },
      { label: "HIV Prevalence", indicatorSlug: "hiv-prevalence" },
    ],
  },
  {
    topicSlug: "energy-and-environment",
    topicTitle: "Energy and Environment",
    indicatorLinks: [
      { label: "Electricity Access", indicatorSlug: "electricity-access" },
      { label: "Electricity Generation", indicatorSlug: "electricity-generation" },
      { label: "Fuel Prices", indicatorSlug: "fuel-price-petrol" },
      { label: "CO2 Emissions", indicatorSlug: "co2-emissions" },
      { label: "Rainfall", indicatorSlug: "rainfall" },
      { label: "Deforestation", indicatorSlug: "forest-loss" },
    ],
  },
  {
    topicSlug: "food-and-agriculture",
    topicTitle: "Food and Agriculture",
    indicatorLinks: [
      { label: "Cocoa Production", indicatorSlug: "cocoa-production" },
      { label: "Cocoa Producer Price", indicatorSlug: "cocoa-producer-price" },
      { label: "Maize Production", indicatorSlug: "maize-production" },
      { label: "Rice Production", indicatorSlug: "rice-production" },
      { label: "Cassava Production", indicatorSlug: "cassava-production" },
      { label: "Food Inflation", indicatorSlug: "cpi-inflation" },
      { label: "Fertiliser Use", indicatorSlug: "fertiliser-use" },
      { label: "Agriculture Share of GDP", indicatorSlug: "gdp-share-agriculture" },
    ],
  },
  {
    topicSlug: "poverty-and-economic-development",
    topicTitle: "Poverty and Economic Development",
    indicatorLinks: [
      { label: "GDP Growth", indicatorSlug: "gdp-growth-rate" },
      { label: "Poverty Rate", indicatorSlug: "poverty-rate" },
      { label: "Extreme Poverty Rate", indicatorSlug: "extreme-poverty-rate" },
      { label: "GDP Per Capita", indicatorSlug: "gdp-per-capita" },
      { label: "Human Development Index", indicatorSlug: "hdi" },
      { label: "Inequality Gini", indicatorSlug: "gini" },
      { label: "Access to Clean Water", indicatorSlug: "basic-water-access" },
      { label: "Access to Sanitation", indicatorSlug: "basic-sanitation-access" },
    ],
  },
  {
    topicSlug: "finance-prices-and-public-debt",
    topicTitle: "Finance, Prices and Public Debt",
    indicatorLinks: [
      { label: "Inflation", indicatorSlug: "cpi-inflation" },
      { label: "Policy Rate", indicatorSlug: "policy-rate" },
      { label: "Exchange Rate GHS/USD", indicatorSlug: "exchange-rate-ghs-usd" },
      { label: "Public Debt", indicatorSlug: "public-debt-gdp" },
      { label: "Foreign Reserves", indicatorSlug: "foreign-reserves" },
      { label: "Credit to Private Sector", indicatorSlug: "credit-private-sector" },
      { label: "Tax Revenue", indicatorSlug: "tax-revenue" },
      { label: "Fiscal Balance", indicatorSlug: "fiscal-balance" },
    ],
  },
  {
    topicSlug: "trade-and-external-sector",
    topicTitle: "Trade and External Sector",
    indicatorLinks: [
      { label: "Trade Balance", indicatorSlug: "trade-balance" },
      { label: "Gold Exports", indicatorSlug: "gold-production" },
      { label: "Cocoa Exports", indicatorSlug: "cocoa-production" },
      { label: "Remittances", indicatorSlug: "remittances-inflow" },
      { label: "Foreign Reserves", indicatorSlug: "foreign-reserves" },
      { label: "Tourist Arrivals", indicatorSlug: "tourist-arrivals" },
    ],
  },
  {
    topicSlug: "jobs-and-wages",
    topicTitle: "Jobs and Wages",
    indicatorLinks: [
      { label: "Unemployment Rate", indicatorSlug: "unemployment-rate" },
      { label: "Minimum Wage", indicatorSlug: "minimum-wage-daily" },
      { label: "Labour Force Participation", indicatorSlug: "labour-force-participation" },
      { label: "Informal Employment Share", indicatorSlug: "informal-employment-share" },
      { label: "Public Sector Wage Bill", indicatorSlug: "public-sector-wage-bill" },
      { label: "Youth Unemployment", indicatorSlug: "youth-unemployment-rate" },
      { label: "Employment by Sector", indicatorSlug: "employment-by-sector" },
      { label: "Average Earnings", indicatorSlug: "average-earnings" },
    ],
  },
  {
    topicSlug: "education-and-knowledge",
    topicTitle: "Education and Knowledge",
    indicatorLinks: [
      { label: "Primary Enrolment", indicatorSlug: "primary-enrollment" },
      { label: "Literacy Rate", indicatorSlug: "literacy-rate" },
      { label: "JHS Completion", indicatorSlug: "jhs-completion" },
      { label: "SHS Enrolment", indicatorSlug: "shs-enrolment" },
      { label: "Education Spending", indicatorSlug: "education-spending" },
      { label: "Teacher-Pupil Ratio", indicatorSlug: "teacher-pupil-ratio" },
      { label: "Tertiary Enrolment", indicatorSlug: "tertiary-enrolment" },
      { label: "Internet Access", indicatorSlug: "internet-users" },
    ],
  },
  {
    topicSlug: "living-conditions-and-wellbeing",
    topicTitle: "Living Conditions and Wellbeing",
    indicatorLinks: [
      { label: "Electricity Access", indicatorSlug: "electricity-access" },
      { label: "Basic Water Access", indicatorSlug: "basic-water-access" },
      { label: "Basic Sanitation Access", indicatorSlug: "basic-sanitation-access" },
      { label: "Internet Users", indicatorSlug: "internet-users" },
      { label: "Poverty Rate", indicatorSlug: "poverty-rate" },
      { label: "Household Consumption", indicatorSlug: "household-consumption" },
      { label: "Housing Quality Proxy", indicatorSlug: "housing-quality-proxy" },
      { label: "HDI", indicatorSlug: "hdi" },
    ],
  },
  {
    topicSlug: "governance-and-elections",
    topicTitle: "Governance and Elections",
    indicatorLinks: [
      { label: "Voter Turnout", indicatorSlug: "voter-turnout" },
      { label: "Registered Voters", indicatorSlug: "registered-voters" },
      { label: "Parliament Seats by Party", indicatorSlug: "parliament-seats-by-party" },
      { label: "Tax Revenue", indicatorSlug: "tax-revenue" },
      { label: "Public Debt", indicatorSlug: "public-debt-gdp" },
      { label: "Corruption Perception", indicatorSlug: "corruption-perception-index" },
    ],
  },
];

export { TOPICS_CONFIG };

interface TopicsOverviewProps {
  showHeader?: boolean;
  maxTopics?: number;
  limitIndicators?: number;
}

const TopicsOverview = ({ showHeader = true, maxTopics, limitIndicators }: TopicsOverviewProps) => {
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [visibleTopics, setVisibleTopics] = useState<Set<string>>(new Set());
  const topicRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Fetch existing indicators to check which links should be active
  const { data: existingIndicators, isLoading } = useQuery({
    queryKey: ["all-indicator-slugs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indicators")
        .select("slug");
      if (error) throw error;
      return new Set(data?.map((i) => i.slug) || []);
    },
  });

  // Intersection Observer for scroll-reveal animations
  useEffect(() => {
    // Only set up observer after loading is complete and refs are populated
    if (isLoading) return;
    
    // Small delay to ensure refs are populated after render
    const timeoutId = setTimeout(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const topicSlug = entry.target.getAttribute('data-topic-slug');
              if (topicSlug) {
                setVisibleTopics((prev) => new Set(prev).add(topicSlug));
                observer.unobserve(entry.target);
              }
            }
          });
        },
        { threshold: 0.1, rootMargin: '50px 0px 0px 0px' }
      );

      topicRefs.current.forEach((element) => {
        observer.observe(element);
      });

      return () => observer.disconnect();
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [isLoading]);


  const toggleTopicExpanded = (topicSlug: string) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topicSlug)) {
        next.delete(topicSlug);
      } else {
        next.add(topicSlug);
      }
      return next;
    });
  };

  const displayTopics = maxTopics ? TOPICS_CONFIG.slice(0, maxTopics) : TOPICS_CONFIG;

  return (
    <section className="py-8">
      {showHeader && (
        <header className="mb-8">
          <h2 className="font-serif text-2xl md:text-3xl font-semibold text-foreground mb-2">
            All our topics
          </h2>
          <p className="text-muted-foreground">
            All our data, research, and writing — topic by topic.
          </p>
        </header>
      )}

      {isLoading ? (
        <div className="space-y-5">
          {[...Array(6)].map((_, i) => (
            <div 
              key={i} 
              className="relative overflow-hidden border-b border-border/50 pb-4 last:border-0 -mx-3 px-3 py-3 rounded-lg pl-4"
              style={{ 
                borderLeftColor: 'hsl(var(--muted))',
                borderLeftWidth: '3px',
                borderLeftStyle: 'solid',
                animationDelay: `${i * 100}ms`
              }}
            >
              {/* Topic title skeleton with icon */}
              <div className="flex items-center gap-2 mb-2">
                <div className="relative overflow-hidden h-5 w-5 rounded bg-muted">
                  <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-background/60 to-transparent" />
                </div>
                <div className="relative overflow-hidden h-6 w-48 rounded bg-muted">
                  <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-background/60 to-transparent" style={{ animationDelay: `${i * 50}ms` }} />
                </div>
              </div>
              {/* Indicator links skeleton */}
              <div className="flex flex-wrap gap-2">
                {[...Array(5)].map((_, j) => (
                  <div key={j} className="relative overflow-hidden h-4 rounded bg-muted" style={{ width: `${60 + Math.random() * 40}px` }}>
                    <div 
                      className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-background/60 to-transparent" 
                      style={{ animationDelay: `${(i * 50) + (j * 75)}ms` }} 
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {displayTopics.map((topic, topicIndex) => {
            const topicColor = TOPIC_COLORS[topic.topicSlug];
            const TopicIcon = TOPIC_ICONS[topic.topicSlug];
            return (
            <article 
              key={topic.topicSlug}
              ref={(el) => {
                if (el) topicRefs.current.set(topic.topicSlug, el);
              }}
              data-topic-slug={topic.topicSlug}
              className={`group relative overflow-hidden border-b border-border/50 pb-4 last:border-0 -mx-3 px-3 py-3 rounded-lg transition-all duration-500 hover:bg-muted/50 hover:scale-[1.01] active:scale-[0.98] active:shadow-sm pl-4 cursor-pointer ${
                visibleTopics.has(topic.topicSlug) 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-6'
              }`}
              style={{ 
                transitionDelay: visibleTopics.has(topic.topicSlug) ? `${topicIndex * 75}ms` : '0ms',
                borderLeftColor: topicColor || 'hsl(var(--primary))',
                borderLeftWidth: '3px',
                borderLeftStyle: 'solid'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderLeftWidth = '5px';
                e.currentTarget.style.boxShadow = `0 4px 20px -4px ${topicColor || 'hsl(var(--primary))'}40`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderLeftWidth = '3px';
                e.currentTarget.style.boxShadow = '';
              }}
              onClick={(e) => {
                const article = e.currentTarget;
                const rect = article.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                const ripple = document.createElement('span');
                ripple.className = 'absolute rounded-full pointer-events-none animate-[ripple_0.6s_ease-out_forwards]';
                ripple.style.cssText = `
                  left: ${x}px;
                  top: ${y}px;
                  width: 0;
                  height: 0;
                  background: ${topicColor || 'hsl(var(--primary))'}20;
                  transform: translate(-50%, -50%);
                `;
                article.appendChild(ripple);
                setTimeout(() => ripple.remove(), 600);
              }}
            >
              {(() => {
                return (
                  <h3 className="font-serif text-lg md:text-xl mb-1.5">
                    <Link
                      to={`/topics/${topic.topicSlug}`}
                      className="text-primary cursor-pointer flex items-center gap-2 w-fit transition-colors duration-200"
                      onMouseEnter={(e) => {
                        if (topicColor) {
                          e.currentTarget.style.color = topicColor;
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '';
                      }}
                    >
                      {TopicIcon && (
                        <TopicIcon
                          size={20}
                          className="flex-shrink-0"
                        />
                      )}
                      <span className="hover:underline">{topic.topicTitle}</span>
                    </Link>
                  </h3>
                );
              })()}
              <div className="leading-relaxed">
                {(() => {
                  const isExpanded = expandedTopics.has(topic.topicSlug);
                  const indicators = limitIndicators && !isExpanded 
                    ? topic.indicatorLinks.slice(0, limitIndicators) 
                    : topic.indicatorLinks;
                  const hasMore = limitIndicators && topic.indicatorLinks.length > limitIndicators;

                  return (
                    <>
                      {indicators.map((link, index) => {
                        const exists = existingIndicators?.has(link.indicatorSlug);
                        return (
                          <span key={link.indicatorSlug} className="inline">
                            {index > 0 && (
                              <span className="text-muted-foreground mx-1.5">•</span>
                            )}
                            {exists ? (
                              <Link
                                to={`/data/${link.indicatorSlug}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-foreground font-medium cursor-pointer hover:text-primary underline decoration-foreground/30 underline-offset-2 hover:decoration-primary transition-colors text-sm"
                              >
                                {link.label}
                              </Link>
                            ) : (
                              <span className="text-muted-foreground cursor-default text-sm">
                                {link.label}
                              </span>
                            )}
                          </span>
                        );
                      })}
                      {hasMore && (
                        <button
                          onClick={() => toggleTopicExpanded(topic.topicSlug)}
                          className="inline-flex items-center gap-0.5 text-sm text-muted-foreground hover:text-primary transition-colors ml-2"
                        >
                          {isExpanded ? (
                            <>
                              less <ChevronUp size={14} />
                            </>
                          ) : (
                            <>
                              +{topic.indicatorLinks.length - limitIndicators} more <ChevronDown size={14} />
                            </>
                          )}
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            </article>
          );
          })}
        </div>
      )}

      {maxTopics && maxTopics < TOPICS_CONFIG.length && (
        <div className="mt-6 pt-4 border-t border-border/50">
          <Link
            to="/topics"
            className="text-primary hover:underline text-sm font-medium"
          >
            View all topics →
          </Link>
        </div>
      )}
    </section>
  );
};

export default TopicsOverview;
