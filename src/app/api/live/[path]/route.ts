import { getLiveStore } from "@/lib/live/store";
import { parseLivePath } from "@/lib/live/paths";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_req: Request, { params }: { params: Promise<{ path: string }> }) {
  const { path } = await params;
  if (!parseLivePath(path)) return Response.json({ error: "not found" }, { status: 404 });
  try {
    const store = await getLiveStore();
    const page = await store.getByPath(path, { includeHidden: true });
    if (!page) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json(page, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
