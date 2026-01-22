import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, AlertCircle, CheckCircle, XCircle, Clock, Filter } from "lucide-react";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const REJECTION_CODE_LABELS: Record<string, { label: string; color: string }> = {
  OUTSIDE_TIME_WINDOW: { label: "Too Old", color: "bg-gray-100 text-gray-700" },
  PUBDATE_PARSE_FAILED: { label: "Bad Date", color: "bg-orange-100 text-orange-700" },
  NOT_BUSINESS: { label: "Not Business", color: "bg-blue-100 text-blue-700" },
  CRIME_FILTER: { label: "Crime", color: "bg-red-100 text-red-700" },
  POLITICAL_GOSSIP: { label: "Gossip", color: "bg-purple-100 text-purple-700" },
  NO_NUMBERS_IN_RSS: { label: "No Numbers (RSS)", color: "bg-amber-100 text-amber-700" },
  NO_NUMBERS_IN_FULL_PAGE: { label: "No Numbers", color: "bg-amber-100 text-amber-700" },
  DEDUPED_NEWSROOM: { label: "Duplicate", color: "bg-gray-100 text-gray-700" },
  DEDUPED_ARTICLES: { label: "Already Published", color: "bg-green-100 text-green-700" },
  AI_JSON_INVALID: { label: "AI Error", color: "bg-red-100 text-red-700" },
  AI_REJECTED_NO_NUMBERS: { label: "AI: No Numbers", color: "bg-amber-100 text-amber-700" },
  HEADLINE_NO_NUMBER: { label: "Headline Missing #", color: "bg-amber-100 text-amber-700" },
  INSUFFICIENT_NUMBERS: { label: "< 3 Numbers", color: "bg-amber-100 text-amber-700" },
  FULL_PAGE_FETCH_FAILED: { label: "Fetch Failed", color: "bg-red-100 text-red-700" },
};

export default function AdminWhyMissed() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDecision, setFilterDecision] = useState<string>("all");
  const [filterCode, setFilterCode] = useState<string>("all");

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: isAdmin } = useQuery({
    queryKey: ["isAdmin", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .in("role", ["admin", "editor"])
        .limit(1);
      return data && data.length > 0;
    },
    enabled: !!session?.user?.id,
  });

  const { data: candidates, isLoading } = useQuery({
    queryKey: ["newsroom-candidates", searchQuery, filterDecision, filterCode],
    queryFn: async () => {
      let query = supabase
        .from("newsroom_candidates")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (searchQuery) {
        query = query.or(`headline.ilike.%${searchQuery}%,source_url.ilike.%${searchQuery}%`);
      }
      if (filterDecision !== "all") {
        query = query.eq("decision", filterDecision);
      }
      if (filterCode !== "all") {
        query = query.eq("rejection_code", filterCode);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin,
  });

  const rejectionCodes = Object.keys(REJECTION_CODE_LABELS);

  if (!session || !isAdmin) {
    return (
      <>
        <Header />
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-muted-foreground">You must be an admin or editor to access this page.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertCircle className="h-6 w-6" />
            Why Missed? - Candidate Audit
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Search for any story to see exactly why it was accepted or rejected
          </p>
        </div>

        {/* Search & Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search headline or URL..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterDecision} onValueChange={setFilterDecision}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Decision" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Decisions</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="needs_review">Needs Review</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterCode} onValueChange={setFilterCode}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Rejection Code" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Codes</SelectItem>
                  {rejectionCodes.map(code => (
                    <SelectItem key={code} value={code}>
                      {REJECTION_CODE_LABELS[code]?.label || code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : candidates && candidates.length > 0 ? (
          <div className="space-y-3">
            {candidates.map((candidate: any) => (
              <Card key={candidate.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {candidate.decision === "accepted" ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" /> Accepted
                          </Badge>
                        ) : candidate.decision === "needs_review" ? (
                          <Badge className="bg-amber-100 text-amber-800">
                            <Clock className="w-3 h-3 mr-1" /> Needs Review
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800">
                            <XCircle className="w-3 h-3 mr-1" /> Rejected
                          </Badge>
                        )}
                        {candidate.rejection_code && (
                          <Badge className={REJECTION_CODE_LABELS[candidate.rejection_code]?.color || "bg-gray-100"}>
                            {REJECTION_CODE_LABELS[candidate.rejection_code]?.label || candidate.rejection_code}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {candidate.source_name}
                        </span>
                      </div>
                      <h3 className="font-medium text-sm line-clamp-2 mb-1">{candidate.headline}</h3>
                      {candidate.rejection_detail && (
                        <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 mb-2">
                          {candidate.rejection_detail}
                        </p>
                      )}
                      {candidate.numbers_found && candidate.numbers_found.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Numbers found: {candidate.numbers_found.slice(0, 5).join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-xs text-muted-foreground shrink-0">
                      {candidate.created_at && format(new Date(candidate.created_at), "MMM d, h:mm a")}
                      {candidate.source_url && (
                        <a
                          href={candidate.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-blue-600 hover:underline mt-1"
                        >
                          View Source →
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Filter className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No candidates found. Run a newsroom scan to populate this list.</p>
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
