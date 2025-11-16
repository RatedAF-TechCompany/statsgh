import { useNavigate } from "react-router-dom";

interface RankedArticleItemProps {
  article: {
    id: string;
    title: string;
    summary: string;
    section: string;
    slug: string;
  };
  rank: number;
}

export const RankedArticleItem = ({ article, rank }: RankedArticleItemProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex gap-4 py-2 border-b border-divider cursor-pointer hover:opacity-70 transition-opacity" onClick={() => navigate(`/article/${article.slug}`)}>
      <div className="flex-shrink-0 w-8 flex items-start justify-center">
        <span className="font-serif text-[26px] font-bold text-[#C1126B] leading-none">
          {rank}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-bold uppercase text-[#C1126B] mb-0.5 font-sans">
          {article.section}
        </div>
        <h3 className="font-serif text-base font-semibold text-foreground leading-tight mb-1">
          {article.title}
        </h3>
        <p className="font-sans text-sm text-muted-text leading-relaxed line-clamp-2">
          {article.summary}
        </p>
      </div>
    </div>
  );
};
