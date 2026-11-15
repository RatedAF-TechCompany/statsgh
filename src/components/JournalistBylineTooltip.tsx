"use client";
// Hover card for the article byline. Split from JournalistByline so Radix Tooltip and its
// positioning library are not in the article page's initial JS; loaded after hydration.
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type BylineJournalist = { byline_name: string; specialization: string | null; bio: string | null; photo_url: string | null };

const JournalistBylineTooltip = ({ journalist, avatar, showAvatar, avatarSize }: { journalist: BylineJournalist; avatar: string; showAvatar: boolean; avatarSize: number }) => (
  <TooltipProvider delayDuration={150}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 hover:text-[#E3120B] transition-colors align-middle"
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
      <TooltipContent className="max-w-xs bg-[#121212] text-white font-ui text-[12px] leading-snug px-3 py-2">
        <div className="font-semibold mb-1">
          {journalist.byline_name}
          {journalist.specialization && (
            <span className="text-[#5B5B5B] font-normal ml-1.5">
              · {journalist.specialization}
            </span>
          )}
        </div>
        {journalist.bio && <div className="opacity-90">{journalist.bio}</div>}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);
export default JournalistBylineTooltip;
