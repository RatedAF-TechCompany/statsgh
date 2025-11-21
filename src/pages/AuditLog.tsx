import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AuditLog = () => {
  const navigate = useNavigate();
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [targetFilter, setTargetFilter] = useState<string>("all");

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
      return true;
    },
    enabled: !!session?.user?.id,
  });

  const { data: auditEvents, isLoading } = useQuery({
    queryKey: ["audit-events", actionFilter, targetFilter],
    queryFn: async () => {
      let query = supabase
        .from("audit_events")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(100);

      if (actionFilter !== "all") {
        query = query.eq("action_type", actionFilter);
      }

      if (targetFilter !== "all") {
        query = query.eq("target_type", targetFilter);
      }

      const { data } = await query;
      return data;
    },
    enabled: !!isAdmin,
  });

  useEffect(() => {
    if (!session && !isLoadingAuth) {
      navigate("/auth");
    } else if (!isAdmin && !isLoadingAuth) {
      navigate("/dashboard");
    }
  }, [session, isAdmin, isLoadingAuth, navigate]);

  if (!session || !isAdmin || isLoadingAuth) {
    return null;
  }

  const getActionBadgeColor = (action: string) => {
    if (action.includes("DELETE")) return "destructive";
    if (action.includes("CREATE")) return "default";
    if (action.includes("UPDATE")) return "secondary";
    if (action.includes("LOGIN") || action.includes("LOGOUT")) return "outline";
    return "default";
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="font-serif text-3xl font-bold">Audit Log</h1>
        </div>

        <div className="flex gap-4 mb-6">
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="ARTICLE_CREATED">Article Created</SelectItem>
              <SelectItem value="ARTICLE_UPDATED">Article Updated</SelectItem>
              <SelectItem value="ARTICLE_PUBLISHED">Article Published</SelectItem>
              <SelectItem value="ARTICLE_DELETED">Article Deleted</SelectItem>
              <SelectItem value="USER_CREATED">User Created</SelectItem>
              <SelectItem value="LOGIN">Login</SelectItem>
              <SelectItem value="LOGOUT">Logout</SelectItem>
            </SelectContent>
          </Select>

          <Select value={targetFilter} onValueChange={setTargetFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by target" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Targets</SelectItem>
              <SelectItem value="article">Articles</SelectItem>
              <SelectItem value="user">Users</SelectItem>
              <SelectItem value="invitation">Invitations</SelectItem>
              <SelectItem value="setting">Settings</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div>Loading...</div>
        ) : auditEvents && auditEvents.length > 0 ? (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-mono text-sm">
                      {format(new Date(event.timestamp), "MMM dd, yyyy HH:mm:ss")}
                    </TableCell>
                    <TableCell className="text-sm">{event.user_email}</TableCell>
                    <TableCell>
                      <Badge variant={getActionBadgeColor(event.action_type)}>
                        {event.action_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {event.target_type || "-"}
                    </TableCell>
                    <TableCell className="text-sm max-w-md truncate">
                      {event.description}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No audit events found</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default AuditLog;
