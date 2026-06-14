import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, Pause, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

interface ListenButtonProps {
  title: string;
  content: string;
  className?: string;
}

export const ListenButton = ({ title, content, className }: ListenButtonProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // Strip HTML tags and get clean text
  const getCleanText = useCallback(() => {
    const div = document.createElement("div");
    div.innerHTML = content;
    const text = div.textContent || div.innerText || "";
    return `${title}. ${text}`;
  }, [title, content]);

  // Cleanup audio URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Keyboard shortcuts when audio is active
  useEffect(() => {
    if (!isPlaying && !isPaused) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        if (isPlaying) {
          handlePause();
        } else if (isPaused) {
          handleResume();
        }
      } else if (e.code === "Escape") {
        e.preventDefault();
        handleStop();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, isPaused]);

  const handlePlay = async () => {
    // If we have existing audio that's paused, resume it
    if (isPaused && audioRef.current) {
      handleResume();
      return;
    }

    setIsLoading(true);
    setProgress(0);

    // Pre-create audio element immediately on user gesture (iOS requirement)
    // This "unlocks" the audio context before async operations
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;

    try {
      const text = getCleanText();
      
      // Call the ElevenLabs TTS edge function
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ text }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to generate audio: ${response.status}`);
      }

      // Get the audio blob
      const audioBlob = await response.blob();
      
      // Clean up previous audio URL
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      audioUrlRef.current = audioUrl;

      // Set source on the pre-created audio element
      audio.src = audioUrl;

      // Track progress
      audio.addEventListener("timeupdate", () => {
        if (audio.duration > 0) {
          setProgress((audio.currentTime / audio.duration) * 100);
        }
      });

      audio.addEventListener("ended", () => {
        setIsPlaying(false);
        setIsPaused(false);
        setProgress(100);
      });

      audio.addEventListener("error", (e) => {
        console.error("Audio playback error:", e);
        toast.error("Error playing audio");
        setIsPlaying(false);
        setIsPaused(false);
        setIsLoading(false);
        setProgress(0);
      });

      // Wait for audio to be ready
      await new Promise<void>((resolve, reject) => {
        audio.addEventListener("canplaythrough", () => resolve(), { once: true });
        audio.addEventListener("error", () => reject(new Error("Audio load failed")), { once: true });
        audio.load();
      });

      await audio.play();
      setIsPlaying(true);
      setIsLoading(false);
    } catch (error) {
      console.error("TTS error:", error);
      const message = error instanceof Error ? error.message : "Failed to generate audio";
      // More specific error for autoplay issues
      if (message.includes("not allowed") || message.includes("NotAllowedError")) {
        toast.error("Tap the button again to start audio playback");
      } else {
        toast.error(message);
      }
      setIsLoading(false);
      setProgress(0);
    }
  };

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPaused(true);
      setIsPlaying(false);
    }
  };

  const handleResume = async () => {
    if (audioRef.current) {
      try {
        await audioRef.current.play();
        setIsPaused(false);
        setIsPlaying(true);
      } catch (error) {
        console.error("Resume playback error:", error);
        toast.error("Unable to resume playback. Please try again.");
      }
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
  };

  const isActive = isPlaying || isPaused || isLoading;

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

        {isLoading && (
          <Button variant="outline" size="sm" disabled className="gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="hidden sm:inline">Loading...</span>
          </Button>
        )}

        {(isPlaying || isPaused) && !isLoading && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={isPaused ? handleResume : handlePause}
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

            <Button variant="ghost" size="sm" onClick={handleStop}>
              <Square className="h-4 w-4" />
            </Button>

            <span className="text-xs text-muted-foreground ml-1 min-w-[3ch]">
              {Math.round(progress)}%
            </span>
          </>
        )}
      </div>

      {(isPlaying || isPaused) && !isLoading && (
        <Progress value={progress} className="h-1 w-full" />
      )}
    </div>
  );
};
