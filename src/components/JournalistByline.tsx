import { useEffect, useState, type ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { BylineJournalist } from "@/components/JournalistBylineTooltip";

interface Props {
  name: string | null | undefined;
  showAvatar?: boolean;
  avatarSize?: number;
}

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const dicebearUrl = (name: string) =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(slugify(name))}`;

type TooltipView = ComponentType<{ journalist: BylineJournalist; avatar: string; showAvatar: boolean; avatarSize: number }>;

export const JournalistByline = ({ name, showAvatar = true, avatarSize = 24 }: Props) => {
  const display = name || "Abubakar Saddique";

  const { data: journalist } = useQuery({
    queryKey: ["journalist-bio", display],
    queryFn: async () => {
      const { data: rows } = await supabase.rpc("get_journalist_byline" as any, { p_name: display });
      const data = Array.isArray(rows) ? rows[0] ?? null : null;
      return data as unknown as BylineJournalist | null;
    },
  });

  // The hover card (Radix Tooltip) loads in parallel with the bio lookup, after hydration.
  const [View, setView] = useState<TooltipView | null>(null);
  useEffect(() => {
    let alive = true;
    import("@/components/JournalistBylineTooltip").then((m) => { if (alive) setView(() => m.default); });
    return () => { alive = false; };
  }, []);

  if (!journalist || !View) {
    return <span>{journalist?.byline_name || display}</span>;
  }

  const avatar = journalist.photo_url || dicebearUrl(journalist.byline_name);
  return <View journalist={journalist} avatar={avatar} showAvatar={showAvatar} avatarSize={avatarSize} />;
};
