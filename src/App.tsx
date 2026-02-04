import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
          {/* Primary navigation pages */}
          <Route path="/topics" element={<Topics />} />
          <Route path="/topics/:slug" element={<TopicDashboard />} />
          <Route path="/data" element={<DataIndicators />} />
          <Route path="/data/:slug" element={<IndicatorDetail />} />
          <Route path="/news" element={<News />} />
          <Route path="/dashboards" element={<Dashboards />} />
          <Route path="/dashboards/finance" element={<GhanaFinanceDashboard />} />
          <Route path="/dashboards/gse" element={<GhanaStockExchange />} />
          <Route path="/sources" element={<Sources />} />
          {/* New URL structure: /:categorySlug/:articleSlug */}
          <Route path="/:categorySlug/:articleSlug" element={<ArticleDetail />} />
          {/* Legacy redirects */}
          <Route path="/article/:slug" element={<ArticleDetail />} />
          <Route path="/category/:slug" element={<Category />} />
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
