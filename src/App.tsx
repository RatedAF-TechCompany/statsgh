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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/category/:slug" element={<Category />} />
          <Route path="/article/:slug" element={<ArticleDetail />} />
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
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
