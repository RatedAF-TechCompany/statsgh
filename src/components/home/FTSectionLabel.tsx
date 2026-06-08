interface FTSectionLabelProps {
  label: string;
  onClick?: () => void;
}

export const FTSectionLabel = ({ label, onClick }: FTSectionLabelProps) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="flex-1 h-px bg-[#e8e8e8]" />
    <h2 className="m-0 p-0">
      <button
        onClick={onClick}
        className="font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-[#33302E] whitespace-nowrap hover:text-[#0D7680] transition-colors bg-transparent border-0 p-0"
      >
        {label}
      </button>
    </h2>
    <div className="flex-1 h-px bg-[#e8e8e8]" />
  </div>
);
