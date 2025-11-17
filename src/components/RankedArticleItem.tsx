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
      className="flex items-start justify-between py-4 px-4 cursor-pointer hover:bg-gray-50 transition-colors border-b border-[#E2D4C6]" 
      onClick={() => navigate(`/article/${article.slug}`)}
      style={{ gap: '16px' }}
    >
      <div className="flex-1 min-w-0" style={{ width: '60%' }}>
        <h3 className="font-serif text-[18px] font-semibold text-[#111111] leading-[1.3]">
          {article.title}
        </h3>
        <div className="font-sans text-[13px] font-normal text-[#777777] mt-1">
          {readTime} min read
        </div>
      </div>
      
      <div className="flex-shrink-0" style={{ width: '32%', aspectRatio: '16/9' }}>
        {article.hero_image_url ? (
          <img 
            src={article.hero_image_url} 
            alt={article.title}
            className="w-full h-full object-cover"
            style={{ borderRadius: 0 }}
          />
        ) : (
          <div className="w-full h-full bg-[#D4D4D4]" />
        )}
      </div>
    </div>
  );
};
