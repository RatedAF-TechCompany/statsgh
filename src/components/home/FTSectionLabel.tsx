interface FTSectionLabelProps {
  label: string;
  onClick?: () => void;
}

export const FTSectionLabel = ({ label, onClick }: FTSectionLabelProps) => (
  <div className="mb-5">
    <span className="rubric-bar" />
    <h2 className="m-0 p-0">
      <button
        onClick={onClick}
        className="font-ui text-[18px] font-bold text-[#0D0D0D] hover:text-[#E3120B] transition-colors bg-transparent border-0 p-0 leading-none"
      >
        {label}
      </button>
    </h2>
  </div>
);
