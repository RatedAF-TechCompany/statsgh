import { useNavigate } from "react-router-dom";

interface RankedArticleItemProps {
  article: {
    id: string;
    title: string;
    summary: string;
    section: string;
    slug: string;
    hero_image_url?: string | null;
  };
  rank: number;
}

export const RankedArticleItem = ({ article, rank }: RankedArticleItemProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex items-start gap-4 py-6 cursor-pointer border-b border-[#D4D4D4] hover:opacity-70 transition-opacity" onClick={() => navigate(`/article/${article.slug}`)}>
      <div className="flex-1 min-w-0">
        <h3 className="font-serif text-[22px] font-normal text-[#000000] mb-3 leading-tight">
          {article.title}
        </h3>
        <div className="font-sans text-[14px] text-[#666666]">
          5 min read
        </div>
      </div>
      <div className="flex-shrink-0 w-[270px] h-[150px] overflow-hidden bg-muted">
        {article.hero_image_url ? (
          <img 
            src={article.hero_image_url} 
            alt={article.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-200" />
        )}
      </div>
    </div>
  );
};
