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
    <div className="flex items-center py-4 cursor-pointer border-b border-[#E2D4C6] hover:opacity-70 transition-opacity" onClick={() => navigate(`/article/${article.slug}`)}>
      <div className="flex-shrink-0 w-[100px] h-[100px] mr-4 rounded-full overflow-hidden bg-muted">
        {article.hero_image_url ? (
          <img 
            src={article.hero_image_url} 
            alt={article.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-muted" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-sans text-[13px] font-bold text-[#111111] mb-1">
          {article.section}
        </div>
        <h3 className="font-serif text-[17px] font-normal text-[#111111] m-0 leading-tight">
          {article.title}
        </h3>
      </div>
    </div>
  );
};
