import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, ExternalLink } from "lucide-react";

interface ReferrerData {
  referrer: string;
  count: number;
}

interface TrafficSourcesProps {
  data: ReferrerData[];
}

const formatReferrer = (referrer: string): string => {
  if (!referrer || referrer === "null" || referrer === "undefined") {
    return "Direct";
  }
  try {
    const url = new URL(referrer);
    return url.hostname.replace("www.", "");
  } catch {
    return referrer.substring(0, 30) || "Direct";
  }
};

export const TrafficSources = ({ data }: TrafficSourcesProps) => {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-5 w-5" />
          Traffic Sources
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data && data.length > 0 ? (
          <div className="space-y-3">
            {data.slice(0, 8).map((item, index) => {
              const percentage = Math.round((item.count / total) * 100);
              const displayName = formatReferrer(item.referrer);
              
              return (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      {displayName === "Direct" ? (
                        <span className="w-4 h-4 rounded bg-muted flex items-center justify-center text-xs">→</span>
                      ) : (
                        <ExternalLink className="h-4 w-4" />
                      )}
                      <span className="truncate max-w-[200px]">{displayName}</span>
                    </span>
                    <span className="font-medium">{item.count.toLocaleString()} ({percentage}%)</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary/70 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            No referrer data available
          </div>
        )}
      </CardContent>
    </Card>
  );
};
