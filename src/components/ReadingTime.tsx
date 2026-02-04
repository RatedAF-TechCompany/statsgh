import { Clock, Headphones } from "lucide-react";

interface ReadingTimeProps {
  content: string;
  className?: string;
}

const WORDS_PER_MINUTE_READING = 238; // Average adult reading speed
const WORDS_PER_MINUTE_LISTENING = 150; // Average speech rate at 1x speed

export const getWordCount = (html: string): number => {
  let text = "";
  if (typeof document === "undefined") {
    // SSR-safe fallback: strip tags with a simple regex.
    text = html.replace(/<[^>]*>/g, " ");
  } else {
    const div = document.createElement("div");
    div.innerHTML = html;
    text = div.textContent || div.innerText || "";
  }
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
};

export const formatTime = (minutes: number): string => {
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

export const ReadingTime = ({ content, className }: ReadingTimeProps) => {
  const wordCount = getWordCount(content);
  const readingMinutes = wordCount / WORDS_PER_MINUTE_READING;
  const listeningMinutes = wordCount / WORDS_PER_MINUTE_LISTENING;

  return (
    <div className={`flex items-center gap-3 text-xs text-muted-foreground ${className || ""}`}>
      <span className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {formatTime(readingMinutes)} read
      </span>
      <span className="flex items-center gap-1">
        <Headphones className="h-3 w-3" />
        {formatTime(listeningMinutes)} listen
      </span>
    </div>
  );
};
