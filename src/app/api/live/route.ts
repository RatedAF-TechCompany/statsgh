import { getLiveStore } from "@/lib/live/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const store = await getLiveStore();
    const pages = await store.listLiveBanner();
    return Response.json(
      { pages },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch {
    return Response.json({ pages: [], error: "unavailable" }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}
