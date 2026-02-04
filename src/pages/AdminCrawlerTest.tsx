import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, XCircle, Globe, FileText, Search, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

interface CrawlerTestResult {
  url: string;
  status: number;
  htmlLength: number;
  passed: boolean;
  checks: {
    headline: { found: boolean; value: string | null };
    body: { found: boolean; length: number; preview: string };
    semanticHtml: {
      hasMain: boolean;
      hasArticle: boolean;
      hasTimeElement: boolean;
      dateValue: string | null;
    };
    seo: {
      canonicalUrl: string | null;
      ogTitle: string | null;
      metaDescription: string | null;
    };
  };
  summary: string;
}

const AdminCrawlerTest = () => {
  const [testUrl, setTestUrl] = useState("");
  const [selectedArticleSlug, setSelectedArticleSlug] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<CrawlerTestResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch recent articles for quick testing
  const { data: recentArticles } = useQuery({
    queryKey: ["recent-articles-crawler"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("id, title, slug, category_slug, published_at")
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const runCrawlerTest = async (url: string) => {
    setIsLoading(true);
    setError(null);
    setTestResult(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("crawler-test", {
        body: { url },
      });

      if (fnError) throw fnError;
      setTestResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run crawler test");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestUrl = () => {
    if (testUrl) {
      runCrawlerTest(testUrl);
    }
  };

  const handleTestArticle = (categorySlug: string, slug: string) => {
    const readerUrl = `https://ofhejtwaigiqyejbvncz.supabase.co/functions/v1/article-reader?slug=${slug}`;
    setTestUrl(readerUrl);
    setSelectedArticleSlug(slug);
    runCrawlerTest(readerUrl);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Globe className="h-6 w-6 text-primary" />
          <h1 className="font-serif text-2xl font-bold">Crawler Test</h1>
        </div>

        <p className="text-muted-foreground mb-6">
          Test if article pages are machine-readable. This simulates a basic web crawler 
          (like Googlebot) fetching your page without JavaScript.
        </p>

        {/* Manual URL Test */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Test Custom URL</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Enter URL to test (e.g., reader endpoint)"
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleTestUrl} disabled={!testUrl || isLoading}>
                <Search className="h-4 w-4 mr-2" />
                Test
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Test Recent Articles */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Quick Test Recent Articles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentArticles?.map((article) => (
                <div
                  key={article.id}
                  className={`flex items-center justify-between p-3 border rounded-lg ${
                    selectedArticleSlug === article.slug ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{article.title}</p>
                    <p className="text-xs text-muted-foreground">
                      /{article.category_slug}/{article.slug}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTestArticle(article.category_slug, article.slug)}
                      disabled={isLoading}
                    >
                      Test Reader
                    </Button>
                    <a
                      href={`https://ofhejtwaigiqyejbvncz.supabase.co/functions/v1/article-reader?slug=${article.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="sm" variant="ghost">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isLoading && (
          <Card>
            <CardContent className="py-8">
              <div className="space-y-3">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="py-6">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                <span className="font-medium">Error: {error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Test Results */}
        {testResult && (
          <Card className={testResult.passed ? "border-green-500" : "border-destructive"}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {testResult.passed ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                {testResult.passed ? "Test Passed" : "Test Failed"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary */}
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-mono text-sm">{testResult.summary}</p>
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">HTTP Status</p>
                  <Badge variant={testResult.status === 200 ? "default" : "destructive"}>
                    {testResult.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">HTML Length</p>
                  <p className="font-mono text-sm">{testResult.htmlLength.toLocaleString()} bytes</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Body Length</p>
                  <p className="font-mono text-sm">{testResult.checks.body.length.toLocaleString()} chars</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Headline Found</p>
                  <Badge variant={testResult.checks.headline.found ? "default" : "destructive"}>
                    {testResult.checks.headline.found ? "Yes" : "No"}
                  </Badge>
                </div>
              </div>

              {/* Headline */}
              {testResult.checks.headline.value && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Headline (H1)</p>
                  <p className="font-serif text-lg">{testResult.checks.headline.value}</p>
                </div>
              )}

              {/* Body Preview */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Body Preview</p>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                  {testResult.checks.body.preview || "No body content found"}
                </p>
              </div>

              {/* Semantic HTML Checks */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Semantic HTML</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={testResult.checks.semanticHtml.hasMain ? "default" : "secondary"}>
                    {testResult.checks.semanticHtml.hasMain ? "✓" : "✗"} &lt;main&gt;
                  </Badge>
                  <Badge variant={testResult.checks.semanticHtml.hasArticle ? "default" : "secondary"}>
                    {testResult.checks.semanticHtml.hasArticle ? "✓" : "✗"} &lt;article&gt;
                  </Badge>
                  <Badge variant={testResult.checks.semanticHtml.hasTimeElement ? "default" : "secondary"}>
                    {testResult.checks.semanticHtml.hasTimeElement ? "✓" : "✗"} &lt;time&gt;
                  </Badge>
                </div>
                {testResult.checks.semanticHtml.dateValue && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Date: {testResult.checks.semanticHtml.dateValue}
                  </p>
                )}
              </div>

              {/* SEO Checks */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">SEO Metadata</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <Badge variant={testResult.checks.seo.canonicalUrl ? "default" : "secondary"} className="shrink-0">
                      canonical
                    </Badge>
                    <span className="text-muted-foreground truncate">
                      {testResult.checks.seo.canonicalUrl || "Not found"}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant={testResult.checks.seo.ogTitle ? "default" : "secondary"} className="shrink-0">
                      og:title
                    </Badge>
                    <span className="text-muted-foreground truncate">
                      {testResult.checks.seo.ogTitle || "Not found"}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant={testResult.checks.seo.metaDescription ? "default" : "secondary"} className="shrink-0">
                      description
                    </Badge>
                    <span className="text-muted-foreground truncate">
                      {testResult.checks.seo.metaDescription || "Not found"}
                    </span>
                  </div>
                </div>
              </div>

              {/* URL Tested */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">URL Tested</p>
                <a 
                  href={testResult.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline break-all"
                >
                  {testResult.url}
                </a>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Help Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              This tool simulates a basic web crawler (no JavaScript execution) to verify that 
              article content is accessible to search engines and other automated tools.
            </p>
            <div>
              <p className="font-medium text-foreground mb-2">Pass Criteria:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Headline (&lt;h1&gt;) must be present in HTML</li>
                <li>Article body must contain at least 300 characters</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground mb-2">Reader Endpoint:</p>
              <p>
                Each article has a reader-friendly version at:
                <code className="bg-muted px-2 py-1 rounded ml-2 text-xs">
                  /functions/v1/article-reader?slug=article-slug
                </code>
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminCrawlerTest;
