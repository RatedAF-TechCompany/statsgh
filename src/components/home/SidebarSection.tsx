import { ReactNode } from "react";
import { Link } from "react-router-dom";

interface SidebarSectionProps {
  title: string;
  children: ReactNode;
  viewAllHref?: string;
  onViewAll?: () => void;
  viewAllLabel?: string;
}

export const SidebarSection = ({ title, children, viewAllHref, onViewAll, viewAllLabel = "View all" }: SidebarSectionProps) => {
  const viewAllClass = "font-ui text-[12px] font-medium text-[#E3120B] hover:underline";
  return (
    <section className="mb-8">
      <div className="mb-3">
        <span className="rubric-bar" />
        <div className="flex items-end justify-between">
          <h2 className="font-ui text-[16px] font-bold text-[#0D0D0D] leading-none">{title}</h2>
          {viewAllHref ? (
            <Link to={viewAllHref} className={viewAllClass}>
              {viewAllLabel} →
            </Link>
          ) : onViewAll ? (
            <button onClick={onViewAll} className={viewAllClass}>
              {viewAllLabel} →
            </button>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
};
