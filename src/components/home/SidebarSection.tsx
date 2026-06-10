import { ReactNode } from "react";

interface SidebarSectionProps {
  title: string;
  children: ReactNode;
  onViewAll?: () => void;
  viewAllLabel?: string;
}

export const SidebarSection = ({ title, children, onViewAll, viewAllLabel = "View all" }: SidebarSectionProps) => {
  return (
    <section className="mb-8">
      <div className="mb-3">
        <span className="rubric-bar" />
        <div className="flex items-end justify-between">
          <h2 className="font-ui text-[16px] font-bold text-[#0D0D0D] leading-none">{title}</h2>
          {onViewAll && (
            <button onClick={onViewAll} className="font-ui text-[12px] font-medium text-[#E3120B] hover:underline">
              {viewAllLabel} →
            </button>
          )}
        </div>
      </div>
      {children}
    </section>
  );
};
