import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

interface Article {
  title: string;
  views: number;
  slug?: string;
  category_slug?: string;
}

interface TopArticlesTableProps {
  articles: Article[];
}

export const TopArticlesTable = ({ articles }: TopArticlesTableProps) => {
  const maxViews = articles.length > 0 ? Math.max(...articles.map(a => a.views)) : 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-5 w-5" />
          Top Performing Articles
        </CardTitle>
      </CardHeader>
      <CardContent>
        {articles && articles.length > 0 ? (
          <div className="space-y-4">
            {articles.map((article, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      {article.slug && article.category_slug ? (
                        <Link 
                          to={`/${article.category_slug}/${article.slug}`}
                          className="text-sm font-medium hover:text-primary transition-colors line-clamp-2 flex items-center gap-1"
                        >
                          {article.title}
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </Link>
                      ) : (
                        <p className="text-sm font-medium line-clamp-2">{article.title}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary" className="flex-shrink-0">
                    {article.views.toLocaleString()} views
                  </Badge>
                </div>
                <div className="ml-9">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${(article.views / maxViews) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">No article data yet</p>
        )}
      </CardContent>
    </Card>
  );
};
