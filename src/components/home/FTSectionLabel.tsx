interface FTSectionLabelProps {
  label: string;
  onClick?: () => void;
}

export const FTSectionLabel = ({ label, onClick }: FTSectionLabelProps) => (
  <div className="border-t border-[#121212] pt-3 mb-6">
    <h2 className="m-0 p-0">
      <button
        onClick={onClick}
        className="kicker bg-transparent border-0 p-0"
      >
        {label}
      </button>
    </h2>
  </div>
);
