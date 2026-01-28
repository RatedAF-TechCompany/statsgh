import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { FolderOpen } from "lucide-react";

interface CategoryData {
  category: string;
  views: number;
}

interface CategoryPerformanceProps {
  data: CategoryData[];
}

const formatCategoryName = (slug: string): string => {
  return slug
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export const CategoryPerformance = ({ data }: CategoryPerformanceProps) => {
  const formattedData = data.map(item => ({
    ...item,
    displayName: formatCategoryName(item.category),
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <FolderOpen className="h-5 w-5" />
          Views by Category
        </CardTitle>
      </CardHeader>
      <CardContent>
        {formattedData && formattedData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={formattedData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis 
                type="number"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                type="category"
                dataKey="displayName"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={120}
              />
              <Tooltip
                formatter={(value: number) => [`${value.toLocaleString()} views`, "Views"]}
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Bar 
                dataKey="views" 
                fill="hsl(var(--chart-2))" 
                radius={[0, 4, 4, 0]}
                maxBarSize={24}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            No category data available
          </div>
        )}
      </CardContent>
    </Card>
  );
};
