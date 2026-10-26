import { OG_HEIGHTS, renderOg } from "@/lib/ogArticle";

export const revalidate = 3600;

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; ratio: string }> }) {
  const { slug, ratio } = await params;
  const height = OG_HEIGHTS[ratio];
  if (!height) return new Response("Not found", { status: 404 });
  return renderOg(slug, height);
}
