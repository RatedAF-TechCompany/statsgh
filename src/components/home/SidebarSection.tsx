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
    <section className="border-t-2 border-ft-maroon pt-3">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-serif text-base font-bold text-foreground">
          {title}
        </h2>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-xs text-ft-maroon hover:underline flex items-center gap-1 font-medium"
          >
            {viewAllLabel}
            <ArrowRight size={12} />
          </button>
        )}
      </div>
      {children}
    </section>
  );
};
