import { Card, CardContent } from "@/components/ui/card";
import { Eye, TrendingUp, TrendingDown, Users, Clock } from "lucide-react";

interface SummaryCardsProps {
  totalViews: number;
  todayViews: number;
  weekViews: number;
  lastWeekViews: number;
  uniqueVisitors: number;
}

export const AnalyticsSummaryCards = ({
  totalViews,
  todayViews,
  weekViews,
  lastWeekViews,
  uniqueVisitors,
}: SummaryCardsProps) => {
  const weekGrowth = lastWeekViews > 0 
    ? Math.round(((weekViews - lastWeekViews) / lastWeekViews) * 100) 
    : 0;

  const isGrowthPositive = weekGrowth >= 0;

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Views</p>
              <p className="text-2xl font-bold mt-1">{totalViews.toLocaleString()}</p>
            </div>
            <Eye className="h-8 w-8 text-muted-foreground/50" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Today</p>
              <p className="text-2xl font-bold mt-1">{todayViews.toLocaleString()}</p>
            </div>
            <Clock className="h-8 w-8 text-muted-foreground/50" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">This Week</p>
              <p className="text-2xl font-bold mt-1">{weekViews.toLocaleString()}</p>
            </div>
            <Users className="h-8 w-8 text-muted-foreground/50" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Last Week</p>
              <p className="text-2xl font-bold mt-1">{lastWeekViews.toLocaleString()}</p>
            </div>
            <Users className="h-8 w-8 text-muted-foreground/50" />
          </div>
        </CardContent>
      </Card>

      <Card className={isGrowthPositive ? "border-primary/20 bg-primary/5" : "border-destructive/20 bg-destructive/5"}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Week Growth</p>
              <p className={`text-2xl font-bold mt-1 ${isGrowthPositive ? "text-primary" : "text-destructive"}`}>
                {isGrowthPositive ? "+" : ""}{weekGrowth}%
              </p>
            </div>
            {isGrowthPositive ? (
              <TrendingUp className="h-8 w-8 text-primary" />
            ) : (
              <TrendingDown className="h-8 w-8 text-destructive" />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
