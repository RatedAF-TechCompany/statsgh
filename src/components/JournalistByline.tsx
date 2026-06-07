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
}

export const JournalistByline = ({ name }: Props) => {
  const display = name || "StatsGH Newsroom";

  const { data: journalist } = useQuery({
    queryKey: ["journalist-bio", display],
    queryFn: async () => {
      const { data } = await supabase
        .from("journalists")
        .select("byline_name, specialization, bio")
        .eq("byline_name", display)
        .maybeSingle();
      return data;
    },
  });

  if (!journalist) {
    return <span>{display}</span>;
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="underline decoration-dotted decoration-[#cbb89a] underline-offset-2 hover:text-[#0D7680] transition-colors"
          >
            {journalist.byline_name}
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs bg-[#33302E] text-white font-ui text-[12px] leading-snug px-3 py-2">
          <div className="font-semibold mb-1">
            {journalist.byline_name}
            <span className="text-[#C9A84C] font-normal ml-1.5">
              · {journalist.specialization}
            </span>
          </div>
          <div className="opacity-90">{journalist.bio}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
