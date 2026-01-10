import { useState } from "react";
import { useNavigate } from "react-router-dom";
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

// Topic configuration from the site spec
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
      { label: "Maternal Mortality", indicatorSlug: "maternal-mortality-ratio" },
      { label: "Under 5 Mortality", indicatorSlug: "under-5-mortality" },
      { label: "Infant Mortality", indicatorSlug: "infant-mortality" },
      { label: "Life Expectancy", indicatorSlug: "life-expectancy" },
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
      { label: "Electricity Access Urban", indicatorSlug: "electricity-access-urban" },
      { label: "Electricity Access Rural", indicatorSlug: "electricity-access-rural" },
      { label: "Electricity Generation Mix", indicatorSlug: "electricity-generation-mix" },
      { label: "Fuel Prices", indicatorSlug: "fuel-prices" },
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
      { label: "Food Inflation", indicatorSlug: "inflation-food" },
      { label: "Fertiliser Use", indicatorSlug: "fertiliser-use" },
      { label: "Agriculture Share of GDP", indicatorSlug: "gdp-share-agriculture" },
    ],
  },
  {
    topicSlug: "poverty-and-economic-development",
    topicTitle: "Poverty and Economic Development",
    indicatorLinks: [
      { label: "Poverty Rate", indicatorSlug: "poverty-rate" },
      { label: "Extreme Poverty Rate", indicatorSlug: "extreme-poverty-rate" },
      { label: "GDP Growth", indicatorSlug: "gdp-growth" },
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
      { label: "Inflation Headline", indicatorSlug: "inflation-headline" },
      { label: "Inflation Food", indicatorSlug: "inflation-food" },
      { label: "Inflation Non-Food", indicatorSlug: "inflation-non-food" },
      { label: "Policy Rate", indicatorSlug: "policy-rate" },
      { label: "T-Bill Rate 91 Day", indicatorSlug: "t-bill-91" },
      { label: "Exchange Rate GHS/USD", indicatorSlug: "exchange-rate-usd" },
      { label: "Public Debt", indicatorSlug: "public-debt" },
      { label: "Fiscal Balance", indicatorSlug: "fiscal-balance" },
    ],
  },
  {
    topicSlug: "trade-and-external-sector",
    topicTitle: "Trade and External Sector",
    indicatorLinks: [
      { label: "Exports", indicatorSlug: "exports" },
      { label: "Imports", indicatorSlug: "imports" },
      { label: "Trade Balance", indicatorSlug: "trade-balance" },
      { label: "Gold Exports", indicatorSlug: "gold-exports" },
      { label: "Cocoa Exports", indicatorSlug: "cocoa-exports" },
      { label: "Oil Exports", indicatorSlug: "oil-exports" },
      { label: "Remittances", indicatorSlug: "remittances" },
      { label: "Foreign Reserves", indicatorSlug: "foreign-reserves" },
    ],
  },
  {
    topicSlug: "jobs-and-wages",
    topicTitle: "Jobs and Wages",
    indicatorLinks: [
      { label: "Unemployment Rate", indicatorSlug: "unemployment-rate" },
      { label: "Labour Force Participation", indicatorSlug: "labour-force-participation" },
      { label: "Informal Employment Share", indicatorSlug: "informal-employment-share" },
      { label: "Minimum Wage", indicatorSlug: "minimum-wage" },
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
      { label: "Literacy Rate", indicatorSlug: "literacy-rate" },
      { label: "Primary Enrolment", indicatorSlug: "primary-enrolment" },
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
      { label: "Budget Revenue", indicatorSlug: "government-revenue" },
      { label: "Budget Expenditure", indicatorSlug: "government-expenditure" },
      { label: "Fiscal Balance", indicatorSlug: "fiscal-balance" },
      { label: "Public Debt", indicatorSlug: "public-debt" },
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
  const navigate = useNavigate();
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

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

  const handleIndicatorClick = (slug: string, exists: boolean) => {
    if (exists) {
      navigate(`/data/${slug}`);
    }
  };

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
        <div className="space-y-6">
          {[...Array(6)].map((_, i) => (
            <div key={i}>
              <Skeleton className="h-6 w-48 mb-3" />
              <Skeleton className="h-5 w-full max-w-xl" />
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
              className="group border-b border-border/50 pb-4 last:border-0 animate-fade-in opacity-0 -mx-3 px-3 py-3 rounded-lg transition-all duration-200 hover:bg-muted/50 hover:shadow-md hover:scale-[1.01] active:scale-[0.98] active:shadow-sm pl-4 cursor-pointer"
              style={{ 
                animationDelay: `${topicIndex * 75}ms`,
                animationFillMode: 'forwards',
                borderLeftColor: topicColor || 'hsl(var(--primary))',
                borderLeftWidth: '3px',
                borderLeftStyle: 'solid'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderLeftWidth = '5px'}
              onMouseLeave={(e) => e.currentTarget.style.borderLeftWidth = '3px'}
            >
              {(() => {
                return (
                  <h3
                    className="font-serif text-lg md:text-xl text-primary cursor-pointer mb-1.5 flex items-center gap-2 w-fit transition-colors duration-200"
                    onClick={() => navigate(`/topics/${topic.topicSlug}`)}
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
                            <button
                              onClick={() => handleIndicatorClick(link.indicatorSlug, !!exists)}
                              className={`${
                                exists
                                  ? "text-primary cursor-pointer relative after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-[1px] after:bottom-0 after:left-0 after:bg-primary after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left"
                                  : "text-foreground/70"
                              } text-sm transition-colors`}
                            >
                              {link.label}
                            </button>
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
          <button
            onClick={() => navigate("/topics")}
            className="text-primary hover:underline text-sm font-medium"
          >
            View all topics →
          </button>
        </div>
      )}
    </section>
  );
};

export default TopicsOverview;
