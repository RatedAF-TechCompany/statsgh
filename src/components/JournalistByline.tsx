import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  name: string | null | undefined;
  showAvatar?: boolean;
  avatarSize?: number;
}

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const dicebearUrl = (name: string) =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(slugify(name))}`;

export const JournalistByline = ({ name, showAvatar = true, avatarSize = 24 }: Props) => {
  const display = name || "StatsGH Newsroom";

  const { data: journalist } = useQuery({
    queryKey: ["journalist-bio", display],
    queryFn: async () => {
      const { data } = await supabase
        .from("journalists")
        .select("byline_name, specialization, bio, photo_url")
        .eq("byline_name", display)
        .maybeSingle();
      return data as { byline_name: string; specialization: string | null; bio: string | null; photo_url: string | null } | null;
    },
  });

  if (!journalist) {
    return <span>{display}</span>;
  }

  const avatar = journalist.photo_url || dicebearUrl(journalist.byline_name);

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-2 hover:text-[#0D7680] transition-colors align-middle"
          >
            {showAvatar && (
              <img
                src={avatar}
                alt=""
                width={avatarSize}
                height={avatarSize}
                className="rounded-full bg-[#f3ecdf] flex-shrink-0"
                style={{ width: avatarSize, height: avatarSize }}
                loading="lazy"
              />
            )}
            <span className="underline decoration-dotted decoration-[#cbb89a] underline-offset-2">
              {journalist.byline_name}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs bg-[#33302E] text-white font-ui text-[12px] leading-snug px-3 py-2">
          <div className="font-semibold mb-1">
            {journalist.byline_name}
            {journalist.specialization && (
              <span className="text-[#C9A84C] font-normal ml-1.5">
                · {journalist.specialization}
              </span>
            )}
          </div>
          {journalist.bio && <div className="opacity-90">{journalist.bio}</div>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
