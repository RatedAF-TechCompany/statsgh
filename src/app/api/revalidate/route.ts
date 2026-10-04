import { revalidatePath } from "next/cache";
import { createReadOnlyServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Called by a database trigger when an article is published or updated.
// It only refreshes cached pages for a real published article looked up by id,
// so the caller cannot choose arbitrary paths.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : null;
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  const { data } = await createReadOnlyServerClient().from("articles")
    .select("slug, category_slug").eq("id", id).eq("is_published", true).maybeSingle();
  revalidatePath("/");
  if (data) {
    revalidatePath(`/${data.category_slug}`);
    revalidatePath(`/${data.category_slug}/${data.slug}`);
  }
  return Response.json({ revalidated: true, article: data ? `/${data.category_slug}/${data.slug}` : null });
}
