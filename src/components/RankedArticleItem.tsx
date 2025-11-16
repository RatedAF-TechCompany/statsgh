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
    <div className="flex items-start py-2 cursor-pointer border-b border-[#E2D4C6] hover:opacity-70 transition-opacity" onClick={() => navigate(`/article/${article.slug}`)}>
      <div className="min-w-[32px] mr-4 text-center font-serif text-[26px] font-bold leading-none text-[#C1126B]">
        {rank}
      </div>
      <div className="flex-1">
        <div className="font-sans text-[11px] font-bold uppercase tracking-wider text-[#C1126B] mb-0.5">
          {article.section}
        </div>
        <h3 className="font-serif text-base font-semibold text-[#111111] m-0 mb-1">
          {article.title}
        </h3>
        <p className="font-sans text-sm text-[#4A3C35] m-0">
          {article.summary}
        </p>
      </div>
    </div>
  );
};
