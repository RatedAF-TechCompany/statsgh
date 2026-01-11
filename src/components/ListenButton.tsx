import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, Pause, Square } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ListenButtonProps {
  title: string;
  content: string;
  className?: string;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export const ListenButton = ({ title, content, className }: ListenButtonProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const textLengthRef = useRef(0);

  // Strip HTML tags and get clean text
  const getCleanText = useCallback(() => {
    const div = document.createElement("div");
    div.innerHTML = content;
    const text = div.textContent || div.innerText || "";
    return `${title}. ${text}`;
  }, [title, content]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) {
      setIsSupported(false);
    }

    // Cleanup on unmount
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const startSpeech = useCallback((rate: number) => {
    window.speechSynthesis.cancel();
    setProgress(0);

    const text = getCleanText();
    textLengthRef.current = text.length;
    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;

    // Get available voices and prefer a natural-sounding English voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (v) => v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Natural"))
    ) || voices.find((v) => v.lang.startsWith("en-"));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.rate = rate;
    utterance.pitch = 1;

    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setProgress(100);
    };

    utterance.onerror = (event) => {
      if (event.error !== "canceled") {
        toast.error("Error playing audio");
      }
      setIsPlaying(false);
      setIsPaused(false);
      setProgress(0);
    };

    // Track progress using boundary events
    utterance.onboundary = (event) => {
      if (textLengthRef.current > 0) {
        const percent = Math.min(100, (event.charIndex / textLengthRef.current) * 100);
        setProgress(percent);
      }
    };

    window.speechSynthesis.speak(utterance);
  }, [getCleanText]);

  const handlePlay = () => {
    if (!isSupported) {
      toast.error("Text-to-speech is not supported in your browser");
      return;
    }

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    startSpeech(speed);
  };

  const handlePause = () => {
    window.speechSynthesis.pause();
    setIsPaused(true);
    setIsPlaying(false);
  };

  const handleStop = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
  };

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    // If currently playing, restart with new speed
    if (isPlaying || isPaused) {
      startSpeech(newSpeed);
    }
  };

  if (!isSupported) {
    return null;
  }

  const isActive = isPlaying || isPaused;

  return (
    <div className={`inline-flex flex-col gap-1.5 ${className || ""}`}>
      <div className="inline-flex items-center gap-1">
        {!isActive && (
          <Button
            variant="outline"
            size="sm"
            onClick={handlePlay}
            className="gap-2"
          >
            <Volume2 className="h-4 w-4" />
            <span className="hidden sm:inline">Listen</span>
          </Button>
        )}

        {isActive && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={isPaused ? handlePlay : handlePause}
              className="gap-2"
            >
              {isPaused ? (
                <>
                  <Volume2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Resume</span>
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4" />
                  <span className="hidden sm:inline">Pause</span>
                </>
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="px-2 text-xs font-medium">
                  {speed}x
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                {SPEED_OPTIONS.map((s) => (
                  <DropdownMenuItem
                    key={s}
                    onClick={() => handleSpeedChange(s)}
                    className={speed === s ? "bg-accent" : ""}
                  >
                    {s}x
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="sm" onClick={handleStop}>
              <Square className="h-4 w-4" />
            </Button>

            <span className="text-xs text-muted-foreground ml-1 min-w-[3ch]">
              {Math.round(progress)}%
            </span>
          </>
        )}
      </div>

      {isActive && (
        <Progress value={progress} className="h-1 w-full" />
      )}
    </div>
  );
};
