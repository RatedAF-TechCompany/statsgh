import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, Pause, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ListenButtonProps {
  title: string;
  content: string;
  className?: string;
}

export const ListenButton = ({ title, content, className }: ListenButtonProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

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

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const text = getCleanText();
    const utterance = new SpeechSynthesisUtterance(text);

    // Get available voices and prefer a natural-sounding English voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (v) => v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Natural"))
    ) || voices.find((v) => v.lang.startsWith("en-"));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.rate = 0.95;
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

      {isPlaying && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePause}
            className="gap-2"
          >
            <Pause className="h-4 w-4" />
            <span className="hidden sm:inline">Pause</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStop}
          >
            <Square className="h-4 w-4" />
          </Button>
        </>
      )}

      {isPaused && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePlay}
            className="gap-2"
          >
            <Volume2 className="h-4 w-4" />
            <span className="hidden sm:inline">Resume</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStop}
          >
            <Square className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
};
