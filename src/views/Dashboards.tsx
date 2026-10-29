"use client";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  Wallet,
  ShoppingCart,
  DollarSign,
  Wheat,
  Ship,
  Fuel,
  Briefcase,
  Heart,
  GraduationCap,
  Home,
  BarChart3,
} from "lucide-react";

const DASHBOARDS = [
  {
    slug: "gse",
    href: "/markets/gse",
    title: "Ghana Stock Exchange",
    description: "Live share prices, trading volumes, and performance metrics for GSE-listed companies.",
    icon: BarChart3,
    color: "bg-emerald-500/10 text-emerald-600",
    status: "live",
  },
  {
    slug: "finance",
    href: "/dashboards/finance",
    title: "Ghana Finance Dashboard",
    description: "GDP growth, inflation, exchange rates, and monetary policy indicators.",
    icon: TrendingUp,
    color: "bg-blue-500/10 text-blue-600",
    status: "live",
  },
  {
    slug: "commodities",
    href: "/dashboards/commodities",
    title: "Commodity & Currency Tracker",
    description: "Cocoa, gold, oil prices and USD/GHS, EUR/GHS, GBP/GHS exchange rates.",
    icon: DollarSign,
    color: "bg-green-500/10 text-green-600",
    status: "live",
  },
  {
    slug: "inflation",
    href: "/trackers/cpi",
    title: "Ghana Inflation Dashboard",
    description: "Headline, food and non-food CPI inflation from Ghana Statistical Service releases, plus annual history.",
    icon: ShoppingCart,
    color: "bg-red-500/10 text-red-600",
    status: "live",
  },
  {
    slug: "budget-debt",
    href: "/dashboards/budget-and-debt",
    title: "Ghana Budget and Debt Dashboard",
    description: "Government revenue, expenditure, fiscal deficit, and debt composition.",
    icon: Wallet,
    color: "bg-purple-500/10 text-purple-600",
    status: "live",
  },
  {
    slug: "exchange-rate",
    href: "/markets/forex",
    title: "Ghana Exchange Rate Dashboard",
    description: "Official Bank of Ghana USD, GBP and EUR rates, with daily change and history.",
    icon: DollarSign,
    color: "bg-green-500/10 text-green-600",
    status: "live",
  },
  {
    slug: "agriculture",
    href: "/dashboards/agriculture",
    title: "Ghana Agriculture Dashboard",
    description: "Agriculture's share of GDP and jobs, cereal yields and food production.",
    icon: Wheat,
    color: "bg-amber-500/10 text-amber-600",
    status: "live",
  },
  {
    slug: "trade",
    href: "/dashboards/trade",
    title: "Ghana Trade Dashboard",
    description: "Exports, imports, the current account and foreign reserves.",
    icon: Ship,
    color: "bg-cyan-500/10 text-cyan-600",
    status: "live",
  },
  {
    slug: "energy",
    href: "/dashboards/energy",
    title: "Ghana Energy and Fuel Dashboard",
    description: "Electricity access, rural access and renewable energy share.",
    icon: Fuel,
    color: "bg-orange-500/10 text-orange-600",
    status: "live",
  },
  {
    slug: "jobs",
    href: "/dashboards/jobs",
    title: "Ghana Jobs Dashboard",
    description: "Unemployment, youth unemployment, participation and vulnerable employment.",
    icon: Briefcase,
    color: "bg-indigo-500/10 text-indigo-600",
    status: "live",
  },
  {
    slug: "health",
    href: "/dashboards/health",
    title: "Ghana Health Dashboard",
    description: "Maternal and under-5 mortality, life expectancy and health spending.",
    icon: Heart,
    color: "bg-pink-500/10 text-pink-600",
    status: "live",
  },
  {
    slug: "education",
    href: "/dashboards/education",
    title: "Ghana Education Dashboard",
    description: "Primary and secondary enrolment, adult literacy and education spending.",
    icon: GraduationCap,
    color: "bg-teal-500/10 text-teal-600",
    status: "live",
  },
  {
    slug: "living-standards",
    href: "/dashboards/living-standards",
    title: "Ghana Living Standards Dashboard",
    description: "Poverty rates and access to water, sanitation and electricity.",
    icon: Home,
    color: "bg-slate-500/10 text-slate-600",
    status: "live",
  },
];

const Dashboards = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <header className="mb-8">
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-3">
            Dashboards
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Interactive data dashboards for exploring Ghana's key economic and social indicators. 
            Every figure shows its official source and date.
          </p>
        </header>

        {/* Dashboards Grid */}
        <section aria-labelledby="dashboards-heading">
        <h2 id="dashboards-heading" className="sr-only">Available Dashboards</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {DASHBOARDS.map((dashboard) => {
            const Icon = dashboard.icon;
            const isLive = dashboard.status === "live";

            return (
              <Link key={dashboard.slug} to={dashboard.href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg">
              <Card
                className={`relative overflow-hidden transition-all ${
                  isLive
                    ? "cursor-pointer hover:border-primary/50 hover:shadow-md"
                    : "opacity-70"
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className={`p-2.5 rounded-lg ${dashboard.color}`}>
                      <Icon size={20} />
                    </div>
                    <Badge variant={isLive ? "default" : "secondary"} className="text-xs">
                      {isLive ? "Live" : "Coming Soon"}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg mt-3">{dashboard.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    {dashboard.description}
                  </CardDescription>
                </CardContent>
              </Card>
              </Link>
            );
          })}
        </div>
        </section>

        {/* Request Section */}
        <section className="mt-12 text-center">
          <p className="text-muted-foreground">
            Need a custom dashboard or have suggestions?{" "}
            <a href="mailto:hello@statsgh.com" className="text-primary hover:underline">
              Let us know
            </a>
          </p>
        </section>
      </main>
    </div>
  );
};

export default Dashboards;
