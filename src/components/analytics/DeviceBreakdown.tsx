import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Smartphone, Monitor, Tablet } from "lucide-react";

interface DeviceData {
  device: string;
  count: number;
}

interface DeviceBreakdownProps {
  data: DeviceData[];
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

const getDeviceIcon = (device: string) => {
  const lowerDevice = device.toLowerCase();
  if (lowerDevice.includes("mobile") || lowerDevice.includes("phone")) {
    return <Smartphone className="h-4 w-4" />;
  }
  if (lowerDevice.includes("tablet") || lowerDevice.includes("ipad")) {
    return <Tablet className="h-4 w-4" />;
  }
  return <Monitor className="h-4 w-4" />;
};

export const DeviceBreakdown = ({ data }: DeviceBreakdownProps) => {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Monitor className="h-5 w-5" />
          Device Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data && data.length > 0 ? (
          <div className="flex flex-col lg:flex-row items-center gap-4">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="count"
                  nameKey="device"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number, name: string) => [`${value} (${Math.round((value / total) * 100)}%)`, name]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3 w-full lg:w-auto">
              {data.map((item, index) => (
                <div key={item.device} className="flex items-center justify-between gap-4 min-w-[160px]">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="flex items-center gap-1.5 text-sm">
                      {getDeviceIcon(item.device)}
                      {item.device}
                    </span>
                  </div>
                  <span className="text-sm font-medium">
                    {Math.round((item.count / total) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            No device data available
          </div>
        )}
      </CardContent>
    </Card>
  );
};
