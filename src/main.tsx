import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { CanonicalManager } from "@/hooks/useCanonical";
import "./index.css";

import Home from "@/views/Home";
import Admin from "@/views/Admin";
import AdminArticleEditor from "@/views/AdminArticleEditor";
import AdminArticles from "@/views/AdminArticles";
import AdminCrawlerTest from "@/views/AdminCrawlerTest";
import AdminDataManager from "@/views/AdminDataManager";
import AdminNewsroom from "@/views/AdminNewsroom";
import AdminWhyMissed from "@/views/AdminWhyMissed";
import Analytics from "@/views/Analytics";
import ArticleDetail from "@/views/ArticleDetail";
import ArticleReader from "@/views/ArticleReader";
import AuditLog from "@/views/AuditLog";
import Auth from "@/views/Auth";
import Categories from "@/views/Categories";
import Category from "@/views/Category";
import CommodityTracker from "@/views/CommodityTracker";
import Dashboard from "@/views/Dashboard";
import Dashboards from "@/views/Dashboards";
import DataIndicators from "@/views/DataIndicators";
import EconomicCalendar from "@/views/EconomicCalendar";
import EditorialStandards from "@/views/EditorialStandards";
import GhanaFinanceDashboard from "@/views/GhanaFinanceDashboard";
import GhanaStockExchange from "@/views/GhanaStockExchange";
import IndicatorDetail from "@/views/IndicatorDetail";
import MediaLibrary from "@/views/MediaLibrary";
import News from "@/views/News";
import NotFound from "@/views/NotFound";
import Saved from "@/views/Saved";
import Search from "@/views/Search";
import SiteSettings from "@/views/SiteSettings";
import Sources from "@/views/Sources";
import TopicDashboard from "@/views/TopicDashboard";
import Topics from "@/views/Topics";
import TweetScheduler from "@/views/TweetScheduler";
import Users from "@/views/Users";
import VerifyComment from "@/views/VerifyComment";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <CanonicalManager />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/calendar" element={<EconomicCalendar />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboards" element={<Dashboards />} />
            <Route path="/dashboards/commodities" element={<CommodityTracker />} />
            <Route path="/dashboards/finance" element={<GhanaFinanceDashboard />} />
            <Route path="/dashboards/gse" element={<GhanaStockExchange />} />
            <Route path="/data" element={<DataIndicators />} />
            <Route path="/data/:slug" element={<IndicatorDetail />} />
            <Route path="/editorial-standards" element={<EditorialStandards />} />
            <Route path="/news" element={<News />} />
            <Route path="/article/:articleSlug" element={<ArticleDetail />} />
            <Route path="/reader/:slug" element={<ArticleReader />} />
            <Route path="/saved" element={<Saved />} />
            <Route path="/search" element={<Search />} />
            <Route path="/sources" element={<Sources />} />
            <Route path="/topics" element={<Topics />} />
            <Route path="/topics/:slug" element={<TopicDashboard />} />
            <Route path="/verify-comment" element={<VerifyComment />} />

            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/analytics" element={<Analytics />} />
            <Route path="/admin/articles" element={<AdminArticles />} />
            <Route path="/admin/articles/new" element={<AdminArticleEditor />} />
            <Route path="/admin/articles/:id" element={<AdminArticleEditor />} />
            <Route path="/admin/audit-log" element={<AuditLog />} />
            <Route path="/admin/categories" element={<Categories />} />
            <Route path="/admin/crawler-test" element={<AdminCrawlerTest />} />
            <Route path="/admin/data" element={<AdminDataManager />} />
            <Route path="/admin/media" element={<MediaLibrary />} />
            <Route path="/admin/newsroom" element={<AdminNewsroom />} />
            <Route path="/admin/settings" element={<SiteSettings />} />
            <Route path="/admin/tweet-scheduler" element={<TweetScheduler />} />
            <Route path="/admin/users" element={<Users />} />
            <Route path="/admin/why-missed" element={<AdminWhyMissed />} />

            <Route path="/:categorySlug" element={<Category />} />
            <Route path="/:categorySlug/:articleSlug" element={<ArticleDetail />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
        <Sonner />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);