import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Breaking "Data Alert" banner; shows the newest active alert, if any. */
export const DataAlertBanner = () => {
  const { data } = useQuery({
    queryKey: ["data-alert"],
    queryFn: async () => {
      const { data } = await supabase
        .from("data_alerts")
        .select("id, message, link_url")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    refetchInterval: 120000,
  });
  if (!data) return null;
  const inner = (
    <>
      <span className="font-ui text-[11px] font-bold uppercase tracking-[0.12em] bg-white text-[#E3120B] px-1.5 py-0.5 mr-2">Data Alert</span>
      <span className="font-ui text-[14px] font-semibold">{data.message}</span>
    </>
  );
  return (
    <div role="status" className="bg-[#E3120B] text-white">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-2">
        {data.link_url ? <a href={data.link_url} className="hover:underline">{inner} →</a> : inner}
      </div>
    </div>
  );
};
