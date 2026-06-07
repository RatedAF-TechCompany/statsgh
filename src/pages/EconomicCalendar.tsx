import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Clock,
  TrendingUp,
  AlertCircle,
  ChevronRight,
  ArrowLeft,
  Timer,
} from "lucide-react";
import { format, formatDistanceToNow, isPast, isToday, isTomorrow, isThisWeek } from "date-fns";
import { usePageMeta } from "@/hooks/usePageMeta";

const IMPACT_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-800 border-red-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  low: "bg-green-100 text-green-800 border-green-200",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  data_release: "Data Release",
  policy_meeting: "Policy Meeting",
  budget: "Budget",
  other: "Event",
};

const EconomicCalendar = () => {
  usePageMeta({
    title: "Economic Calendar — Ghana Data Releases | StatsGH",
    description:
      "Upcoming Ghana economic releases, central-bank meetings, and policy events. Track data drops from Bank of Ghana and Ghana Statistical Service.",
  });

  const navigate = useNavigate();

  const { data: events, isLoading } = useQuery({
    queryKey: ["economic-calendar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("economic_calendar")
        .select("*")
        .gte("scheduled_date", new Date().toISOString())
        .order("scheduled_date", { ascending: true })
        .limit(30);

      if (error) throw error;
      return data;
    },
  });

  const { data: pastEvents } = useQuery({
    queryKey: ["economic-calendar-past"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("economic_calendar")
        .select("*")
        .lt("scheduled_date", new Date().toISOString())
        .order("scheduled_date", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  const getTimeLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isPast(date)) return "Released";
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    if (isThisWeek(date)) return format(date, "EEEE");
    return formatDistanceToNow(date, { addSuffix: true });
  };

  const groupedEvents = events?.reduce((groups, event) => {
    const date = format(new Date(event.scheduled_date), "yyyy-MM-dd");
    if (!groups[date]) groups[date] = [];
    groups[date].push(event);
    return groups;
  }, {} as Record<string, typeof events>) || {};

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-10 w-64 mb-4" />
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 mb-3" />)}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Button variant="ghost" onClick={() => navigate("/dashboards")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboards
        </Button>

        <header className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="default">Calendar</Badge>
            <Badge variant="outline">Ghana</Badge>
          </div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-2">
            Economic Calendar
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Upcoming data releases, policy meetings, and economic events from GSS, Bank of Ghana, 
            NPA, and other institutions.
          </p>
        </header>

        {/* Upcoming Events */}
        <section className="mb-12">
          <h2 className="font-serif text-xl font-semibold mb-4 flex items-center gap-2">
            <Timer size={20} />
            Upcoming Events
          </h2>

          {Object.entries(groupedEvents).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No upcoming events scheduled. Check back soon.
              </CardContent>
            </Card>
          ) : (
            Object.entries(groupedEvents).map(([date, dayEvents]) => (
              <div key={date} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar size={16} className="text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    {format(new Date(date), "EEEE, d MMMM yyyy")}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {getTimeLabel(dayEvents![0].scheduled_date)}
                  </span>
                </div>

                <div className="space-y-2">
                  {dayEvents!.map((event) => (
                    <Card
                      key={event.id}
                      className={`hover:border-primary/30 transition-colors ${
                        event.indicator_slug ? "cursor-pointer" : ""
                      }`}
                      onClick={() => event.indicator_slug && navigate(`/data/${event.indicator_slug}`)}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge
                                variant="outline"
                                className={`text-xs ${IMPACT_COLORS[event.impact_level || "medium"]}`}
                              >
                                {(event.impact_level || "medium").toUpperCase()}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                              </span>
                              {event.source_name && (
                                <span className="text-xs text-muted-foreground">
                                  • {event.source_name}
                                </span>
                              )}
                            </div>
                            <h3 className="font-serif font-semibold text-foreground">
                              {event.title}
                            </h3>
                            {event.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {event.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock size={12} />
                                {format(new Date(event.scheduled_date), "HH:mm")} GMT
                              </span>
                              {event.previous_value && (
                                <span>Previous: {event.previous_value}</span>
                              )}
                              {event.is_recurring && (
                                <span className="capitalize">
                                  Recurring: {event.recurrence_rule}
                                </span>
                              )}
                            </div>
                          </div>
                          {event.indicator_slug && (
                            <ChevronRight size={20} className="text-muted-foreground mt-1" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>

        {/* Recent Releases */}
        {pastEvents && pastEvents.length > 0 && (
          <section>
            <h2 className="font-serif text-xl font-semibold mb-4 flex items-center gap-2">
              <TrendingUp size={20} />
              Recent Releases
            </h2>
            <div className="space-y-2">
              {pastEvents.map((event) => (
                <Card
                  key={event.id}
                  className={`opacity-75 hover:opacity-100 transition-opacity ${
                    event.indicator_slug ? "cursor-pointer" : ""
                  }`}
                  onClick={() => event.indicator_slug && navigate(`/data/${event.indicator_slug}`)}
                >
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-foreground text-sm">{event.title}</h3>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(event.scheduled_date), "d MMM yyyy")}
                          {event.source_name && ` • ${event.source_name}`}
                        </p>
                      </div>
                      <div className="text-right">
                        {event.actual_value ? (
                          <span className="font-mono font-semibold text-sm">{event.actual_value}</span>
                        ) : (
                          <Badge variant="outline" className="text-xs">Released</Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* About */}
        <Card className="mt-12">
          <CardContent className="py-6">
            <h3 className="font-serif font-semibold mb-2 flex items-center gap-2">
              <AlertCircle size={16} />
              About This Calendar
            </h3>
            <p className="text-sm text-muted-foreground">
              This calendar tracks scheduled data releases and policy events from Ghana's key 
              institutions including the Ghana Statistical Service (GSS), Bank of Ghana (BoG), 
              National Petroleum Authority (NPA), and Ministry of Finance (MoF). Dates are based 
              on historical release patterns and may be subject to change. Click any event linked 
              to an indicator to view the full data series.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default EconomicCalendar;
