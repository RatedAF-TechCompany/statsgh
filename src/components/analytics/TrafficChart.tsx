import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { Activity } from "lucide-react";

interface TrafficChartProps {
  data: Array<{ date: string; day: string; views: number }>;
  title?: string;
}

export const TrafficChart = ({ data, title = "Traffic Over Time" }: TrafficChartProps) => {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="day" 
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                allowDecimals={false}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(value: number) => [`${value} views`, "Views"]}
                labelFormatter={(label: string, payload: any[]) => {
                  if (payload && payload[0]) {
                    return format(new Date(payload[0].payload.date), "EEEE, MMM d, yyyy");
                  }
                  return label;
                }}
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Area
                type="monotone"
                dataKey="views"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorViews)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[280px] flex items-center justify-center text-muted-foreground">
            No traffic data available
          </div>
        )}
      </CardContent>
    </Card>
  );
};
