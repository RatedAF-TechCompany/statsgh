import { useNavigate } from "react-router-dom";
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
} from "lucide-react";

const DASHBOARDS = [
  {
    slug: "finance",
    title: "Ghana Finance Dashboard",
    description: "GDP growth, inflation, exchange rates, and monetary policy indicators.",
    icon: TrendingUp,
    color: "bg-blue-500/10 text-blue-600",
    status: "live",
  },
  {
    slug: "inflation",
    title: "Ghana Inflation Dashboard",
    description: "CPI breakdown, food prices, fuel prices, and regional inflation data.",
    icon: ShoppingCart,
    color: "bg-red-500/10 text-red-600",
    status: "coming",
  },
  {
    slug: "budget-debt",
    title: "Ghana Budget and Debt Dashboard",
    description: "Government revenue, expenditure, fiscal deficit, and debt composition.",
    icon: Wallet,
    color: "bg-purple-500/10 text-purple-600",
    status: "coming",
  },
  {
    slug: "exchange-rate",
    title: "Ghana Exchange Rate Dashboard",
    description: "GHS/USD, GHS/EUR, GHS/GBP rates and foreign reserves.",
    icon: DollarSign,
    color: "bg-green-500/10 text-green-600",
    status: "coming",
  },
  {
    slug: "agriculture",
    title: "Ghana Agriculture and Cocoa Dashboard",
    description: "Cocoa production, food crops, producer prices, and export volumes.",
    icon: Wheat,
    color: "bg-amber-500/10 text-amber-600",
    status: "coming",
  },
  {
    slug: "trade",
    title: "Ghana Trade Dashboard",
    description: "Exports, imports, trade balance, and major trading partners.",
    icon: Ship,
    color: "bg-cyan-500/10 text-cyan-600",
    status: "coming",
  },
  {
    slug: "energy",
    title: "Ghana Energy and Fuel Dashboard",
    description: "Electricity generation, fuel prices, and energy access indicators.",
    icon: Fuel,
    color: "bg-orange-500/10 text-orange-600",
    status: "coming",
  },
  {
    slug: "jobs",
    title: "Ghana Jobs Dashboard",
    description: "Unemployment, labour force participation, wages, and informal employment.",
    icon: Briefcase,
    color: "bg-indigo-500/10 text-indigo-600",
    status: "coming",
  },
  {
    slug: "health",
    title: "Ghana Health Dashboard",
    description: "Maternal mortality, child health, disease burden, and health infrastructure.",
    icon: Heart,
    color: "bg-pink-500/10 text-pink-600",
    status: "coming",
  },
  {
    slug: "education",
    title: "Ghana Education Dashboard",
    description: "Enrolment rates, literacy, education spending, and learning outcomes.",
    icon: GraduationCap,
    color: "bg-teal-500/10 text-teal-600",
    status: "coming",
  },
  {
    slug: "living-standards",
    title: "Ghana Living Standards Dashboard",
    description: "Poverty rates, access to water, sanitation, electricity, and HDI.",
    icon: Home,
    color: "bg-slate-500/10 text-slate-600",
    status: "coming",
  },
];

const Dashboards = () => {
  const navigate = useNavigate();

  const handleDashboardClick = (dashboard: typeof DASHBOARDS[0]) => {
    if (dashboard.status === "live") {
      navigate(`/dashboards/${dashboard.slug}`);
    }
  };

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
            Each dashboard brings together 8-15 charts with narrative context.
          </p>
        </header>

        {/* Dashboards Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {DASHBOARDS.map((dashboard) => {
            const Icon = dashboard.icon;
            const isLive = dashboard.status === "live";

            return (
              <Card
                key={dashboard.slug}
                className={`relative overflow-hidden transition-all ${
                  isLive
                    ? "cursor-pointer hover:border-primary/50 hover:shadow-md"
                    : "opacity-70"
                }`}
                onClick={() => handleDashboardClick(dashboard)}
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
            );
          })}
        </div>

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
