import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";

interface WireBadgeProps {
  className?: string;
}

export const WireBadge = ({ className }: WireBadgeProps) => {
  return (
    <Badge 
      variant="outline" 
      className={`bg-amber-50 text-amber-700 border-amber-300 text-[10px] font-semibold uppercase tracking-wide ${className}`}
    >
      <Zap className="h-2.5 w-2.5 mr-0.5" />
      Wire
    </Badge>
  );
};
