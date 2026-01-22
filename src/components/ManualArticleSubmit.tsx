import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Send, ExternalLink, Copy, CalendarIcon, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export const ManualArticleSubmit = () => {
  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [result, setResult] = useState<{
    success: boolean;
    article?: { id: string; title: string; slug: string; category: string; url: string };
    tweet?: string;
    scheduled?: boolean;
    scheduled_at?: string;
    error?: string;
  } | null>(null);
  const navigate = useNavigate();

  const getScheduledDateTime = (): string | null => {
    if (!scheduleEnabled || !scheduledDate) return null;
    
    const [hours, minutes] = scheduledTime.split(":").map(Number);
    const dateTime = new Date(scheduledDate);
    dateTime.setHours(hours, minutes, 0, 0);
    
    // Ensure it's in the future
    if (dateTime <= new Date()) {
      return null;
    }
    
    return dateTime.toISOString();
  };

  const handleSubmit = async () => {
    if (!input.trim() || input.trim().length < 20) {
      toast.error("Please enter at least 20 characters (URL or article text)");
      return;
    }

    // Validate scheduled time if enabled
    if (scheduleEnabled) {
      if (!scheduledDate) {
        toast.error("Please select a date for scheduling");
        return;
      }
      const scheduledDateTime = getScheduledDateTime();
      if (!scheduledDateTime) {
        toast.error("Scheduled time must be in the future");
        return;
      }
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Please log in to submit articles");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manual-article-submit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ 
            input: input.trim(),
            scheduled_at: getScheduledDateTime(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setResult({ success: false, error: data.error || "Failed to process article" });
        toast.error(data.error || "Failed to process article");
        return;
      }

      setResult({ success: true, ...data });
      
      if (data.scheduled) {
        toast.success(`Article scheduled for ${format(new Date(data.scheduled_at), "PPP 'at' p")}`);
      } else {
        toast.success("Article published successfully!");
      }
      
      setInput("");
      setScheduleEnabled(false);
      setScheduledDate(undefined);
      setScheduledTime("09:00");
    } catch (error) {
      console.error("Submit error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to submit article";
      setResult({ success: false, error: errorMessage });
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyTweet = () => {
    if (result?.tweet) {
      navigator.clipboard.writeText(result.tweet);
      toast.success("Tweet copied to clipboard");
    }
  };

  return (
    <Card className="border-ft-maroon/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5 text-ft-maroon" />
          Quick Publish
        </CardTitle>
        <CardDescription>
          Paste a URL or article text. The editorial AI will apply StatsGH format and publish automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="Paste article URL (e.g., https://example.com/news-story) or paste the full article text here..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="min-h-[120px] resize-none"
          disabled={isSubmitting}
        />

        {/* Schedule Toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="schedule-toggle" className="text-sm font-medium cursor-pointer">
              Schedule for later
            </Label>
          </div>
          <Switch
            id="schedule-toggle"
            checked={scheduleEnabled}
            onCheckedChange={setScheduleEnabled}
            disabled={isSubmitting}
          />
        </div>

        {/* Schedule Date/Time Picker */}
        {scheduleEnabled && (
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-border bg-muted/30">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !scheduledDate && "text-muted-foreground"
                    )}
                    disabled={isSubmitting}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduledDate ? format(scheduledDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={scheduledDate}
                    onSelect={setScheduledDate}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Time</Label>
              <Input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                disabled={isSubmitting}
                className="w-full"
              />
            </div>
          </div>
        )}
        
        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !input.trim()}
            className="flex-1"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : scheduleEnabled ? (
              <>
                <Clock className="h-4 w-4 mr-2" />
                Schedule Article
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Apply Editorial & Publish
              </>
            )}
          </Button>
        </div>

        {result && (
          <div className={`p-4 rounded-lg border ${result.success ? 'bg-accent/50 border-accent' : 'bg-destructive/10 border-destructive/30'}`}>
            {result.success && result.article ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">
                      {result.scheduled ? "📅 Scheduled:" : "✓ Published:"} {result.article.title}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Category: {result.article.category}
                      {result.scheduled && result.scheduled_at && (
                        <span className="ml-2">• Publishes: {format(new Date(result.scheduled_at), "PPP 'at' p")}</span>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(result.article!.url)}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    {result.scheduled ? "Preview" : "View"}
                  </Button>
                </div>
                
                {result.tweet && (
                  <div className="pt-3 border-t border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground">SUGGESTED TWEET</span>
                      <Button variant="ghost" size="sm" onClick={copyTweet}>
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <p className="text-sm italic">"{result.tweet}"</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-destructive">{result.error}</p>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          <strong>Requirements:</strong> Articles must contain at least 3 meaningful numbers. 
          If the source lacks numbers, the AI will add contextual data (GDP, population, trade figures, etc.).
        </p>
      </CardContent>
    </Card>
  );
};
