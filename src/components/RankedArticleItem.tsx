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

  // Calculate read time (simple estimation: ~200 words per minute)
  const wordCount = article.summary.split(/\s+/).length + article.title.split(/\s+/).length;
  const readTime = Math.max(1, Math.ceil(wordCount / 40)); // Conservative estimate

  return (
    <div 
      className="flex items-start justify-between gap-4 py-4 px-4 cursor-pointer hover:bg-gray-50 transition-colors border-b border-[#E2D4C6]" 
      onClick={() => navigate(`/article/${article.slug}`)}
    >
      <div className="flex-1 min-w-0" style={{ width: '60%' }}>
        <h3 className="font-serif text-[18px] font-semibold text-[#111111] mb-1 leading-tight">
          {article.title}
        </h3>
        <div className="font-sans text-[13px] text-[#777777]">
          {readTime} min read
        </div>
      </div>
      
      <div className="flex-shrink-0" style={{ width: '32%', aspectRatio: '16/9' }}>
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
