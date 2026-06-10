import { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

interface SidebarSectionProps {
  title: string;
  children: ReactNode;
  onViewAll?: () => void;
  viewAllLabel?: string;
}

export const SidebarSection = ({ title, children, onViewAll, viewAllLabel = "View all" }: SidebarSectionProps) => {
  return (
    <section className="border-t border-[#121212] pt-3 mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="kicker">{title}</h2>
        {onViewAll && (
          <button onClick={onViewAll} className="kicker flex items-center gap-1">
            {viewAllLabel} →
          </button>
        )}
      </div>
      {children}
    </section>
  );
};
