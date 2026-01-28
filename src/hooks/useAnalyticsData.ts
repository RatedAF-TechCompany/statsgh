import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay, startOfWeek, endOfWeek } from "date-fns";

export const useAnalyticsData = (isAdmin: boolean, userId?: string) => {
  const enabled = !!userId && isAdmin === true;

  // Total views
  const { data: totalViews = 0 } = useQuery({
    queryKey: ["analytics-total-views"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("article_views")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },
    enabled,
  });

  // Today's views
  const { data: todayViews = 0 } = useQuery({
    queryKey: ["analytics-today-views"],
    queryFn: async () => {
      const today = startOfDay(new Date());
      const { count, error } = await supabase
        .from("article_views")
        .select("*", { count: "exact", head: true })
        .gte("viewed_at", today.toISOString());
      if (error) throw error;
      return count || 0;
    },
    enabled,
  });

  // This week's views
  const { data: weekViews = 0 } = useQuery({
    queryKey: ["analytics-week-views"],
    queryFn: async () => {
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const { count, error } = await supabase
        .from("article_views")
        .select("*", { count: "exact", head: true })
        .gte("viewed_at", weekStart.toISOString());
      if (error) throw error;
      return count || 0;
    },
    enabled,
  });

  // Last week's views
  const { data: lastWeekViews = 0 } = useQuery({
    queryKey: ["analytics-last-week-views"],
    queryFn: async () => {
      const lastWeekStart = startOfWeek(subDays(new Date(), 7), { weekStartsOn: 1 });
      const lastWeekEnd = endOfWeek(subDays(new Date(), 7), { weekStartsOn: 1 });
      const { count, error } = await supabase
        .from("article_views")
        .select("*", { count: "exact", head: true })
        .gte("viewed_at", lastWeekStart.toISOString())
        .lte("viewed_at", lastWeekEnd.toISOString());
      if (error) throw error;
      return count || 0;
    },
    enabled,
  });

  // Daily views for last 14 days
  const { data: dailyViews = [] } = useQuery({
    queryKey: ["analytics-daily-views-14"],
    queryFn: async () => {
      const fourteenDaysAgo = startOfDay(subDays(new Date(), 13));
      const { data, error } = await supabase
        .from("article_views")
        .select("viewed_at")
        .gte("viewed_at", fourteenDaysAgo.toISOString());
      if (error) throw error;

      const dailyMap: Record<string, number> = {};
      for (let i = 13; i >= 0; i--) {
        const date = format(subDays(new Date(), i), "yyyy-MM-dd");
        dailyMap[date] = 0;
      }

      (data || []).forEach((view) => {
        if (view.viewed_at) {
          const date = format(new Date(view.viewed_at), "yyyy-MM-dd");
          if (dailyMap[date] !== undefined) {
            dailyMap[date]++;
          }
        }
      });

      return Object.entries(dailyMap).map(([date, views]) => ({
        date,
        day: format(new Date(date), "MMM d"),
        views,
      }));
    },
    enabled,
  });

  // Top articles
  const { data: topArticles = [] } = useQuery({
    queryKey: ["analytics-top-articles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("article_views")
        .select("article_id, articles(title, slug, category_slug)");
      if (error) throw error;

      const viewCounts = (data || []).reduce((acc: Record<string, any>, view: any) => {
        const articleId = view.article_id;
        if (!articleId || !view.articles) return acc;
        
        if (!acc[articleId]) {
          acc[articleId] = { 
            title: view.articles.title, 
            slug: view.articles.slug,
            category_slug: view.articles.category_slug,
            views: 0 
          };
        }
        acc[articleId].views += 1;
        return acc;
      }, {});

      return Object.values(viewCounts)
        .sort((a: any, b: any) => b.views - a.views)
        .slice(0, 10);
    },
    enabled,
  });

  // Device breakdown
  const { data: deviceBreakdown = [] } = useQuery({
    queryKey: ["analytics-device-breakdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("article_views")
        .select("device_type");
      if (error) throw error;

      const breakdown = (data || []).reduce((acc: Record<string, number>, view) => {
        const device = view.device_type || "Unknown";
        acc[device] = (acc[device] || 0) + 1;
        return acc;
      }, {});

      return Object.entries(breakdown)
        .map(([device, count]) => ({ device, count }))
        .sort((a, b) => b.count - a.count);
    },
    enabled,
  });

  // Traffic sources (referrers)
  const { data: trafficSources = [] } = useQuery({
    queryKey: ["analytics-traffic-sources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("article_views")
        .select("referrer");
      if (error) throw error;

      const sources = (data || []).reduce((acc: Record<string, number>, view) => {
        const referrer = view.referrer || "Direct";
        acc[referrer] = (acc[referrer] || 0) + 1;
        return acc;
      }, {});

      return Object.entries(sources)
        .map(([referrer, count]) => ({ referrer, count }))
        .sort((a, b) => b.count - a.count);
    },
    enabled,
  });

  // Hourly traffic for today
  const { data: hourlyTraffic = [] } = useQuery({
    queryKey: ["analytics-hourly-traffic"],
    queryFn: async () => {
      const today = startOfDay(new Date());
      const { data, error } = await supabase
        .from("article_views")
        .select("viewed_at")
        .gte("viewed_at", today.toISOString());
      if (error) throw error;

      const hourlyMap: Record<string, number> = {};
      for (let i = 0; i < 24; i++) {
        hourlyMap[i.toString().padStart(2, "0")] = 0;
      }

      (data || []).forEach((view) => {
        if (view.viewed_at) {
          const hour = format(new Date(view.viewed_at), "HH");
          hourlyMap[hour]++;
        }
      });

      return Object.entries(hourlyMap).map(([hour, views]) => ({
        hour,
        views,
      }));
    },
    enabled,
  });

  // Category performance
  const { data: categoryPerformance = [] } = useQuery({
    queryKey: ["analytics-category-performance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("article_views")
        .select("article_id, articles(category_slug)");
      if (error) throw error;

      const categories = (data || []).reduce((acc: Record<string, number>, view: any) => {
        const category = view.articles?.category_slug || "uncategorized";
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {});

      return Object.entries(categories)
        .map(([category, views]) => ({ category, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 8);
    },
    enabled,
  });

  // Unique visitors (approximate - based on distinct user agents)
  const { data: uniqueVisitors = 0 } = useQuery({
    queryKey: ["analytics-unique-visitors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("article_views")
        .select("user_agent");
      if (error) throw error;

      const uniqueAgents = new Set((data || []).map(v => v.user_agent).filter(Boolean));
      return uniqueAgents.size;
    },
    enabled,
  });

  return {
    totalViews,
    todayViews,
    weekViews,
    lastWeekViews,
    uniqueVisitors,
    dailyViews,
    topArticles,
    deviceBreakdown,
    trafficSources,
    hourlyTraffic,
    categoryPerformance,
  };
};
