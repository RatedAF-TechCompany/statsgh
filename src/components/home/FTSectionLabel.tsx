import { Link } from "react-router-dom";

interface FTSectionLabelProps {
  label: string;
  to?: string;
  onClick?: () => void;
}

const labelClass =
  "font-ui text-[18px] font-bold text-[#0D0D0D] hover:text-[#E3120B] transition-colors bg-transparent border-0 p-0 leading-none";

export const FTSectionLabel = ({ label, to, onClick }: FTSectionLabelProps) => (
  <div className="mb-5">
    <span className="rubric-bar" />
    <h2 className="m-0 p-0">
      {to ? (
        <Link to={to} className={labelClass}>
          {label}
        </Link>
      ) : (
        <button onClick={onClick} className={labelClass}>
          {label}
        </button>
      )}
    </h2>
  </div>
);
