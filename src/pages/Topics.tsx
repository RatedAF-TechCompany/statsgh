import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Skeleton } from "@/components/ui/skeleton";

// Topic configuration from the site spec
const TOPICS_CONFIG = [
  {
    topicSlug: "population-and-demographic-change",
    topicTitle: "Population And Demographic Change",
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
    topicTitle: "Energy And Environment",
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
    topicTitle: "Food And Agriculture",
    indicatorLinks: [
      { label: "Cocoa Production", indicatorSlug: "cocoa-production" },
      { label: "Cocoa Producer Price", indicatorSlug: "cocoa-producer-price" },
      { label: "Maize Production", indicatorSlug: "maize-production" },
      { label: "Rice Production", indicatorSlug: "rice-production" },
      { label: "Cassava Production", indicatorSlug: "cassava-production" },
      { label: "Food Inflation", indicatorSlug: "inflation-food" },
      { label: "Fertiliser Use", indicatorSlug: "fertiliser-use" },
      { label: "Agriculture Share Of GDP", indicatorSlug: "gdp-share-agriculture" },
    ],
  },
  {
    topicSlug: "poverty-and-economic-development",
    topicTitle: "Poverty And Economic Development",
    indicatorLinks: [
      { label: "Poverty Rate", indicatorSlug: "poverty-rate" },
      { label: "Extreme Poverty Rate", indicatorSlug: "extreme-poverty-rate" },
      { label: "GDP Growth", indicatorSlug: "gdp-growth" },
      { label: "GDP Per Capita", indicatorSlug: "gdp-per-capita" },
      { label: "Human Development Index", indicatorSlug: "hdi" },
      { label: "Inequality Gini", indicatorSlug: "gini" },
      { label: "Access To Clean Water", indicatorSlug: "basic-water-access" },
      { label: "Access To Sanitation", indicatorSlug: "basic-sanitation-access" },
    ],
  },
  {
    topicSlug: "finance-prices-and-public-debt",
    topicTitle: "Finance Prices And Public Debt",
    indicatorLinks: [
      { label: "Inflation Headline", indicatorSlug: "inflation-headline" },
      { label: "Inflation Food", indicatorSlug: "inflation-food" },
      { label: "Inflation Non Food", indicatorSlug: "inflation-non-food" },
      { label: "Policy Rate", indicatorSlug: "policy-rate" },
      { label: "T Bill Rate 91 Day", indicatorSlug: "t-bill-91" },
      { label: "Exchange Rate GHS Per USD", indicatorSlug: "exchange-rate-usd" },
      { label: "Public Debt", indicatorSlug: "public-debt" },
      { label: "Fiscal Balance", indicatorSlug: "fiscal-balance" },
    ],
  },
  {
    topicSlug: "trade-and-external-sector",
    topicTitle: "Trade And External Sector",
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
    topicTitle: "Jobs And Wages",
    indicatorLinks: [
      { label: "Unemployment Rate", indicatorSlug: "unemployment-rate" },
      { label: "Labour Force Participation", indicatorSlug: "labour-force-participation" },
      { label: "Informal Employment Share", indicatorSlug: "informal-employment-share" },
      { label: "Minimum Wage", indicatorSlug: "minimum-wage" },
      { label: "Public Sector Wage Bill", indicatorSlug: "public-sector-wage-bill" },
      { label: "Youth Unemployment", indicatorSlug: "youth-unemployment-rate" },
      { label: "Employment By Sector", indicatorSlug: "employment-by-sector" },
      { label: "Average Earnings", indicatorSlug: "average-earnings" },
    ],
  },
  {
    topicSlug: "education-and-knowledge",
    topicTitle: "Education And Knowledge",
    indicatorLinks: [
      { label: "Literacy Rate", indicatorSlug: "literacy-rate" },
      { label: "Primary Enrolment", indicatorSlug: "primary-enrolment" },
      { label: "JHS Completion", indicatorSlug: "jhs-completion" },
      { label: "SHS Enrolment", indicatorSlug: "shs-enrolment" },
      { label: "Education Spending", indicatorSlug: "education-spending" },
      { label: "Teacher Pupil Ratio", indicatorSlug: "teacher-pupil-ratio" },
      { label: "Tertiary Enrolment", indicatorSlug: "tertiary-enrolment" },
      { label: "Internet Access", indicatorSlug: "internet-users" },
    ],
  },
  {
    topicSlug: "living-conditions-and-wellbeing",
    topicTitle: "Living Conditions And Wellbeing",
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
    topicTitle: "Governance And Elections",
    indicatorLinks: [
      { label: "Voter Turnout", indicatorSlug: "voter-turnout" },
      { label: "Registered Voters", indicatorSlug: "registered-voters" },
      { label: "Parliament Seats By Party", indicatorSlug: "parliament-seats-by-party" },
      { label: "Budget Revenue", indicatorSlug: "government-revenue" },
      { label: "Budget Expenditure", indicatorSlug: "government-expenditure" },
      { label: "Fiscal Balance", indicatorSlug: "fiscal-balance" },
      { label: "Public Debt", indicatorSlug: "public-debt" },
      { label: "Corruption Perception", indicatorSlug: "corruption-perception-index" },
    ],
  },
];

const Topics = () => {
  const navigate = useNavigate();

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

  // Fetch related articles count per topic (optional enhancement)
  const { data: topicArticleCounts } = useQuery({
    queryKey: ["topic-article-counts"],
    queryFn: async () => {
      const { data: topics } = await supabase
        .from("data_topics")
        .select("id, slug");
      
      if (!topics) return {};
      
      // For now, return empty counts - can enhance later
      return {};
    },
  });

  const handleIndicatorClick = (slug: string, exists: boolean) => {
    if (exists) {
      navigate(`/data/${slug}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Page Header */}
        <header className="mb-10">
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-3">
            All Topics
          </h1>
          <p className="text-muted-foreground text-lg">
            Ghana data, research, and writing — topic by topic.
          </p>
        </header>

        {/* Topics List */}
        {isLoading ? (
          <div className="space-y-8">
            {[...Array(6)].map((_, i) => (
              <div key={i}>
                <Skeleton className="h-7 w-48 mb-3" />
                <Skeleton className="h-5 w-full max-w-xl" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {TOPICS_CONFIG.map((topic) => (
              <article key={topic.topicSlug} className="border-b border-border pb-6 last:border-0">
                <h2
                  className="font-serif text-xl md:text-2xl font-semibold text-foreground mb-2 cursor-pointer hover:text-primary transition-colors"
                  onClick={() => navigate(`/topics/${topic.topicSlug}`)}
                >
                  {topic.topicTitle}
                </h2>
                <nav className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
                  {topic.indicatorLinks.map((link, index) => {
                    const exists = existingIndicators?.has(link.indicatorSlug);
                    return (
                      <span key={link.indicatorSlug} className="inline-flex items-center">
                        <button
                          onClick={() => handleIndicatorClick(link.indicatorSlug, !!exists)}
                          className={`${
                            exists
                              ? "text-primary hover:underline cursor-pointer"
                              : "text-muted-foreground cursor-default"
                          } transition-colors`}
                          disabled={!exists}
                        >
                          {link.label}
                        </button>
                        {index < topic.indicatorLinks.length - 1 && (
                          <span className="text-muted-foreground mx-1.5">·</span>
                        )}
                      </span>
                    );
                  })}
                </nav>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Topics;
