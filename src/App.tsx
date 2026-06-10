import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Category from "./pages/Category";
import ArticleDetail from "./pages/ArticleDetail";
import Auth from "./pages/Auth";
import Saved from "./pages/Saved";
import Admin from "./pages/Admin";
import AuditLog from "./pages/AuditLog";
import Dashboard from "./pages/Dashboard";
import AdminArticles from "./pages/AdminArticles";
import AdminArticleEditor from "./pages/AdminArticleEditor";
import MediaLibrary from "./pages/MediaLibrary";
import Categories from "./pages/Categories";
import Analytics from "./pages/Analytics";
import Users from "./pages/Users";
import SiteSettings from "./pages/SiteSettings";
import VerifyComment from "./pages/VerifyComment";
import Search from "./pages/Search";
import NotFound from "./pages/NotFound";
import DataIndicators from "./pages/DataIndicators";
import IndicatorDetail from "./pages/IndicatorDetail";
import TopicDashboard from "./pages/TopicDashboard";
import AdminDataManager from "./pages/AdminDataManager";
import AdminNewsroom from "./pages/AdminNewsroom";
import AdminCrawlerTest from "./pages/AdminCrawlerTest";
import GhanaFinanceDashboard from "./pages/GhanaFinanceDashboard";
import GhanaStockExchange from "./pages/GhanaStockExchange";
import Topics from "./pages/Topics";
import News from "./pages/News";
import Dashboards from "./pages/Dashboards";
import Sources from "./pages/Sources";
import ArticleReader from "./pages/ArticleReader";
import EconomicCalendar from "./pages/EconomicCalendar";
import EditorialStandards from "./pages/EditorialStandards";
import CommodityTracker from "./pages/CommodityTracker";
import TweetScheduler from "./pages/TweetScheduler";
import { CanonicalManager } from "./hooks/useCanonical";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <CanonicalManager />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/verify-comment" element={<VerifyComment />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/search" element={<Search />} />
          <Route path="/saved" element={<Saved />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin/articles" element={<AdminArticles />} />
          <Route path="/admin/articles/new" element={<AdminArticleEditor />} />
          <Route path="/admin/articles/:id" element={<AdminArticleEditor />} />
          <Route path="/admin/media" element={<MediaLibrary />} />
          <Route path="/admin/categories" element={<Categories />} />
          <Route path="/admin/analytics" element={<Analytics />} />
          <Route path="/admin/users" element={<Users />} />
          <Route path="/admin/audit-log" element={<AuditLog />} />
          <Route path="/admin/settings" element={<SiteSettings />} />
          <Route path="/admin/data" element={<AdminDataManager />} />
          <Route path="/admin/newsroom" element={<AdminNewsroom />} />
          <Route path="/admin/crawler-test" element={<AdminCrawlerTest />} />
          <Route path="/admin/tweet-scheduler" element={<TweetScheduler />} />
          {/* Primary navigation pages */}
          <Route path="/topics" element={<Topics />} />
          <Route path="/topics/:slug" element={<TopicDashboard />} />
          <Route path="/data" element={<DataIndicators />} />
          <Route path="/data/:slug" element={<IndicatorDetail />} />
          <Route path="/news" element={<News />} />
          {/* Machine-readable reader route for crawlers */}
          <Route path="/reader/:slug" element={<ArticleReader />} />
          <Route path="/dashboards" element={<Dashboards />} />
          <Route path="/dashboards/finance" element={<GhanaFinanceDashboard />} />
          <Route path="/dashboards/gse" element={<GhanaStockExchange />} />
          <Route path="/sources" element={<Sources />} />
          <Route path="/calendar" element={<EconomicCalendar />} />
          <Route path="/editorial-standards" element={<EditorialStandards />} />
          <Route path="/dashboards/commodities" element={<CommodityTracker />} />
          {/* Section routes */}
          <Route path="/economy" element={<Category />} />
          <Route path="/markets-data" element={<Category />} />
          <Route path="/business" element={<Category />} />
          <Route path="/politics-policy" element={<Category />} />
          <Route path="/energy-resources" element={<Category />} />
          <Route path="/agriculture" element={<Category />} />
          <Route path="/technology" element={<Category />} />
          <Route path="/companies" element={<Category />} />
          <Route path="/opinion-analysis" element={<Category />} />
          <Route path="/research" element={<Category />} />
          <Route path="/world" element={<Category />} />
          <Route path="/analysis" element={<Category />} />
          <Route path="/financial-literacy" element={<Category />} />
          {/* Old category slugs → new category slugs */}
          <Route path="/democracy" element={<Navigate to="/security-governance" replace />} />
          <Route path="/democracy/*" element={<Navigate to="/security-governance" replace />} />
          <Route path="/energy" element={<Navigate to="/energy-resources" replace />} />
          <Route path="/energy/*" element={<Navigate to="/energy-resources" replace />} />
          <Route path="/environment" element={<Navigate to="/environment-climate" replace />} />
          <Route path="/environment/*" element={<Navigate to="/environment-climate" replace />} />
          <Route path="/national-accounts" element={<Navigate to="/public-finance" replace />} />
          <Route path="/national-accounts/*" element={<Navigate to="/public-finance" replace />} />
          <Route path="/prices-and-consumption" element={<Navigate to="/economy-inflation" replace />} />
          <Route path="/prices-and-consumption/*" element={<Navigate to="/economy-inflation" replace />} />
          <Route path="/speeches-and-press-releases" element={<Navigate to="/top-stories" replace />} />
          <Route path="/speeches-and-press-releases/*" element={<Navigate to="/top-stories" replace />} />
          <Route path="/culture-and-leisure" element={<Navigate to="/" replace />} />
          <Route path="/culture-and-leisure/*" element={<Navigate to="/" replace />} />
          <Route path="/social-services" element={<Navigate to="/" replace />} />
          <Route path="/social-services/*" element={<Navigate to="/" replace />} />
          <Route path="/population/*" element={<Navigate to="/population" replace />} />
          {/* Old article URL patterns */}
          <Route path="/article" element={<Navigate to="/top-stories" replace />} />
          <Route path="/article/*" element={<Navigate to="/top-stories" replace />} />
          <Route path="/news/*" element={<Navigate to="/top-stories" replace />} />
          <Route path="/category" element={<Navigate to="/" replace />} />
          {/* Preserve ranking equity from legacy /category/<slug>/ URLs by mapping to current section slugs */}
          <Route path="/category/business" element={<Navigate to="/business" replace />} />
          <Route path="/category/business/*" element={<Navigate to="/business" replace />} />
          <Route path="/category/economy" element={<Navigate to="/economy" replace />} />
          <Route path="/category/economy/*" element={<Navigate to="/economy" replace />} />
          <Route path="/category/markets" element={<Navigate to="/markets-data" replace />} />
          <Route path="/category/markets/*" element={<Navigate to="/markets-data" replace />} />
          <Route path="/category/markets-data" element={<Navigate to="/markets-data" replace />} />
          <Route path="/category/markets-data/*" element={<Navigate to="/markets-data" replace />} />
          <Route path="/category/politics" element={<Navigate to="/politics-policy" replace />} />
          <Route path="/category/politics/*" element={<Navigate to="/politics-policy" replace />} />
          <Route path="/category/politics-policy" element={<Navigate to="/politics-policy" replace />} />
          <Route path="/category/politics-policy/*" element={<Navigate to="/politics-policy" replace />} />
          <Route path="/category/energy" element={<Navigate to="/energy-resources" replace />} />
          <Route path="/category/energy/*" element={<Navigate to="/energy-resources" replace />} />
          <Route path="/category/energy-resources" element={<Navigate to="/energy-resources" replace />} />
          <Route path="/category/energy-resources/*" element={<Navigate to="/energy-resources" replace />} />
          <Route path="/category/agriculture" element={<Navigate to="/agriculture" replace />} />
          <Route path="/category/agriculture/*" element={<Navigate to="/agriculture" replace />} />
          <Route path="/category/technology" element={<Navigate to="/technology" replace />} />
          <Route path="/category/technology/*" element={<Navigate to="/technology" replace />} />
          <Route path="/category/companies" element={<Navigate to="/companies" replace />} />
          <Route path="/category/companies/*" element={<Navigate to="/companies" replace />} />
          <Route path="/category/analysis" element={<Navigate to="/analysis" replace />} />
          <Route path="/category/analysis/*" element={<Navigate to="/analysis" replace />} />
          <Route path="/category/opinion" element={<Navigate to="/opinion-analysis" replace />} />
          <Route path="/category/opinion/*" element={<Navigate to="/opinion-analysis" replace />} />
          <Route path="/category/opinion-analysis" element={<Navigate to="/opinion-analysis" replace />} />
          <Route path="/category/opinion-analysis/*" element={<Navigate to="/opinion-analysis" replace />} />
          <Route path="/category/research" element={<Navigate to="/research" replace />} />
          <Route path="/category/research/*" element={<Navigate to="/research" replace />} />
          <Route path="/category/financial-literacy" element={<Navigate to="/financial-literacy" replace />} />
          <Route path="/category/financial-literacy/*" element={<Navigate to="/financial-literacy" replace />} />
          <Route path="/category/world" element={<Navigate to="/world" replace />} />
          <Route path="/category/world/*" element={<Navigate to="/world" replace />} />
          <Route path="/category/top-stories" element={<Navigate to="/top-stories" replace />} />
          <Route path="/category/top-stories/*" element={<Navigate to="/top-stories" replace />} />
          {/* Unknown legacy category → homepage as final fallback */}
          <Route path="/category/*" element={<Navigate to="/" replace />} />
          {/* New URL structure: /:categorySlug/:articleSlug */}
          <Route path="/:categorySlug/:articleSlug" element={<ArticleDetail />} />
          {/* Category pages */}
          <Route path="/:categorySlug" element={<Category />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
