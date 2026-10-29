import { renderOg } from "@/lib/ogArticle";

export const revalidate = 3600;

// 1200x630 social card; ratio variants live in ./[ratio]/route.tsx.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return renderOg((await params).slug, 630);
}
