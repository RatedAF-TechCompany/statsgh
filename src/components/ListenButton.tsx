import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, Pause, Square } from "lucide-react";
import { toast } from "sonner";
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
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

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

    const text = getCleanText();
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
    };

    utterance.onerror = (event) => {
      if (event.error !== "canceled") {
        toast.error("Error playing audio");
      }
      setIsPlaying(false);
      setIsPaused(false);
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

  return (
    <div className={`inline-flex items-center gap-1 ${className || ""}`}>
      {!isPlaying && !isPaused && (
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

      {(isPlaying || isPaused) && (
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
        </>
      )}
    </div>
  );
};
