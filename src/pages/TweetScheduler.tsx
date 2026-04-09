import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Clock, Send, RotateCcw, CheckCircle2, XCircle, AlertCircle, Zap,
} from "lucide-react";
import { toast } from "sonner";

const TweetScheduler = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tweetInput, setTweetInput] = useState("");
  const [overrideQuiet, setOverrideQuiet] = useState(false);

  // ── Auth check ──
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: isAdmin, isLoading: isLoadingAuth } = useQuery({
    queryKey: ["isAdmin", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
    enabled: !!session?.user?.id,
  });

  useEffect(() => {
    if (!isLoadingAuth && !isAdmin) {
      toast.error("Access denied");
      navigate("/");
    }
  }, [isAdmin, isLoadingAuth, navigate]);

  // ── State ──
  const { data: state, refetch: refetchState } = useQuery({
    queryKey: ["tweet-scheduler-state"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tweet_scheduler_state")
        .select("*")
        .eq("id", 1)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin,
    refetchInterval: 30000,
  });

  // ── Bank items ──
  const { data: bankItems } = useQuery({
    queryKey: ["tweet-bank-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tweet_bank_items")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin,
  });

  // ── Logs ──
  const { data: logs } = useQuery({
    queryKey: ["tweet-scheduler-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tweet_scheduler_logs")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin,
    refetchInterval: 30000,
  });

  // ── Last posted tweet ──
  const lastPostedItem = bankItems?.find(
    (item: any) => item.hash === state?.last_posted_hash
  );

  // ── Mutations ──

  const saveTweetsMutation = useMutation({
    mutationFn: async (lines: string[]) => {
      const { data, error } = await supabase.functions.invoke("scheduled-tweet-poster", {
        body: { action: "save_tweets", lines },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Saved ${data.count} tweets to bank`);
      setTweetInput("");
      queryClient.invalidateQueries({ queryKey: ["tweet-bank-items"] });
      queryClient.invalidateQueries({ queryKey: ["tweet-scheduler-state"] });
    },
    onError: (err: any) => toast.error("Failed to save: " + err.message),
  });

  const postNowMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("hourly-tweet-scheduler", {
        body: { action: "post_now", override_quiet: overrideQuiet },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.skipped) {
        toast.info(`Skipped: ${data.reason}`);
      } else if (data.success) {
        toast.success("Tweet posted!");
      } else {
        toast.error("Failed: " + data.error);
      }
      queryClient.invalidateQueries({ queryKey: ["tweet-scheduler-state"] });
      queryClient.invalidateQueries({ queryKey: ["tweet-scheduler-logs"] });
    },
    onError: (err: any) => toast.error("Post failed: " + err.message),
  });

  const resetCycleMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("hourly-tweet-scheduler", {
        body: { action: "reset_cycle" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Cycle reset. Queue: ${data.queue_size}`);
      queryClient.invalidateQueries({ queryKey: ["tweet-scheduler-state"] });
      queryClient.invalidateQueries({ queryKey: ["tweet-scheduler-logs"] });
    },
    onError: (err: any) => toast.error("Reset failed: " + err.message),
  });

  const toggleEnabledMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from("tweet_scheduler_state")
        .update({ is_enabled: enabled })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchState();
      toast.success("Scheduler updated");
    },
  });

  const toggleQuietMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from("tweet_scheduler_state")
        .update({ quiet_hours_enabled: enabled })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchState();
    },
  });

  const updateQuietHoursMutation = useMutation({
    mutationFn: async ({ start, end }: { start: string; end: string }) => {
      const { error } = await supabase
        .from("tweet_scheduler_state")
        .update({ quiet_start: start, quiet_end: end })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => refetchState(),
  });

  const handleSaveTweets = () => {
    const lines = tweetInput.split("\n").filter((l) => l.trim());
    if (lines.length === 0) {
      toast.error("No tweets to save");
      return;
    }
    saveTweetsMutation.mutate(lines);
  };

  if (isLoadingAuth || !isAdmin) return null;

  const postedCount = (state?.posted_hashes as any[])?.length || 0;
  const totalCount = bankItems?.length || 0;
  const queueRemaining = (state?.queue_hashes as any[])?.length || 0;
  const failsIn24h = state?.fail_count_24h || 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="font-serif text-3xl font-bold mb-6">Tweet Scheduler</h1>

        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          {/* ── Tweet Bank Input ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tweet Bank</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                One tweet per line. Optional category tag: <code>[economy] Tweet text here.</code>
              </p>
              <Textarea
                value={tweetInput}
                onChange={(e) => setTweetInput(e.target.value)}
                placeholder={`[economy] Ghana's GDP grew 6.9% in Q3 2025.\n[markets] GSE Composite Index gained 2.3% this week.\nGeneral tweet without a category tag.`}
                className="min-h-[200px] font-mono text-sm"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {tweetInput.split("\n").filter((l) => l.trim()).length} tweets
                </span>
                <Button
                  onClick={handleSaveTweets}
                  disabled={saveTweetsMutation.isPending}
                >
                  {saveTweetsMutation.isPending ? "Saving..." : "Save to Bank"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Controls ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <Label>Enable Scheduler</Label>
                <Switch
                  checked={state?.is_enabled || false}
                  onCheckedChange={(v) => toggleEnabledMutation.mutate(v)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Quiet Hours</Label>
                <Switch
                  checked={state?.quiet_hours_enabled || false}
                  onCheckedChange={(v) => toggleQuietMutation.mutate(v)}
                />
              </div>

              {state?.quiet_hours_enabled && (
                <div className="flex gap-3 items-center">
                  <div className="space-y-1">
                    <Label className="text-xs">Start</Label>
                    <Input
                      type="time"
                      defaultValue={state?.quiet_start || "23:00"}
                      onBlur={(e) =>
                        updateQuietHoursMutation.mutate({
                          start: e.target.value,
                          end: state?.quiet_end || "06:00",
                        })
                      }
                      className="w-28"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">End</Label>
                    <Input
                      type="time"
                      defaultValue={state?.quiet_end || "06:00"}
                      onBlur={(e) =>
                        updateQuietHoursMutation.mutate({
                          start: state?.quiet_start || "23:00",
                          end: e.target.value,
                        })
                      }
                      className="w-28"
                    />
                  </div>
                </div>
              )}

              <div className="border-t pt-4 space-y-3">
                <div className="flex gap-3">
                  <Button
                    onClick={() => postNowMutation.mutate()}
                    disabled={postNowMutation.isPending}
                    variant="default"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {postNowMutation.isPending ? "Posting..." : "Post Now"}
                  </Button>
                  <Button
                    onClick={() => resetCycleMutation.mutate()}
                    disabled={resetCycleMutation.isPending}
                    variant="outline"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset Cycle
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="override-quiet"
                    checked={overrideQuiet}
                    onCheckedChange={(v) => setOverrideQuiet(v === true)}
                  />
                  <Label htmlFor="override-quiet" className="text-sm">
                    Override quiet hours for Post Now
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Status Panel ── */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6 mb-8">
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Scheduler</p>
              <Badge variant={state?.is_enabled ? "default" : "secondary"}>
                {state?.is_enabled ? "Enabled" : "Disabled"}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Last Posted</p>
              <p className="text-xs font-medium">
                {state?.last_posted_at
                  ? new Date(state.last_posted_at).toLocaleString()
                  : "Never"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Cycle Progress</p>
              <p className="text-lg font-bold">
                {postedCount} / {totalCount}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Queue</p>
              <p className="text-lg font-bold">{queueRemaining}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Fails (24h)</p>
              <p className={`text-lg font-bold ${failsIn24h > 0 ? "text-destructive" : ""}`}>
                {failsIn24h}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Bank Size</p>
              <p className="text-lg font-bold">{totalCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Last Posted ── */}
        {lastPostedItem && (
          <Card className="mb-8">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-1">Last Tweet Posted</p>
              <p className="text-sm font-medium">{lastPostedItem.text}</p>
            </CardContent>
          </Card>
        )}

        {/* ── Logs Table ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Timestamp</TableHead>
                    <TableHead>Tweet</TableHead>
                    <TableHead className="w-[90px]">Status</TableHead>
                    <TableHead>Reason / Error</TableHead>
                    <TableHead className="w-[120px]">Tweet ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs && logs.length > 0 ? (
                    logs.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs">
                          {new Date(log.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs max-w-[300px] truncate">
                          {log.tweet_text || "—"}
                        </TableCell>
                        <TableCell>
                          {log.status === "success" && (
                            <Badge variant="default" className="bg-green-600 text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              OK
                            </Badge>
                          )}
                          {log.status === "failed" && (
                            <Badge variant="destructive" className="text-xs">
                              <XCircle className="h-3 w-3 mr-1" />
                              Fail
                            </Badge>
                          )}
                          {log.status === "skipped" && (
                            <Badge variant="secondary" className="text-xs">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Skip
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {log.reason || log.error_message || "—"}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {log.tweet_id || "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No logs yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default TweetScheduler;
