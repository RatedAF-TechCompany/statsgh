import { SecondaryStory } from "./SecondaryStory";

interface Article {
  id: string;
  title: string;
  summary: string;
  slug: string;
  category_slug: string;
  hero_image_url?: string | null;
  published_at?: string | null;
}

interface LatestNewsListProps {
  articles: Article[];
  title?: string;
}

export const LatestNewsList = ({ articles, title = "Latest" }: LatestNewsListProps) => {
  if (articles.length === 0) return null;

  return (
    <section className="border-t-2 border-ft-maroon pt-3">
      <h2 className="font-serif text-base font-bold text-foreground mb-3">
        {title}
      </h2>
      <div className="space-y-0">
        {articles.map((article, index) => (
          <SecondaryStory 
            key={article.id} 
            article={article} 
            variant="horizontal"
            showImage={index < 3}
          />
        ))}
      </div>
    </section>
  );
};
