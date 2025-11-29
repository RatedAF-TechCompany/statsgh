import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Key, Ban, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { logAuditEvent } from "@/lib/audit";

const Users = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteRole] = useState<"editor">("editor");
  const [inviteNote, setInviteNote] = useState("");
  const [generatedInvite, setGeneratedInvite] = useState<{token: string; link: string} | null>(null);

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

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select(`
          *,
          user_roles(role)
        `)
        .order("created_at", { ascending: false });
      return data;
    },
    enabled: !!session?.user?.id,
  });

  const inviteUserMutation = useMutation({
    mutationFn: async () => {
      const inviteToken = crypto.randomUUID();
      const { data, error } = await supabase
        .from("user_invitations")
        .insert({
          email: inviteEmail,
          full_name: inviteFullName,
          role: inviteRole,
          invite_token: inviteToken,
          note: inviteNote,
          invited_by: session?.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Send invitation email
      const inviteLink = `${window.location.origin}/auth?invite=${inviteToken}`;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", session?.user?.id!)
        .single();

      try {
        await supabase.functions.invoke("send-invitation-email", {
          body: {
            email: inviteEmail,
            fullName: inviteFullName,
            role: inviteRole,
            inviteLink,
            invitedBy: profile?.full_name || profile?.email || "Admin",
            note: inviteNote,
          },
        });
        console.log("Invitation email sent successfully");
      } catch (emailError) {
        console.error("Failed to send invitation email:", emailError);
        // Don't fail the whole operation if email fails
      }

      await logAuditEvent({
        actionType: "INVITE_SENT",
        targetType: "invitation",
        targetId: data.id,
        description: `Invited ${inviteFullName} (${inviteEmail}) as ${inviteRole}`,
      });

      return { token: inviteToken, id: data.id };
    },
    onSuccess: ({ token }) => {
      const inviteLink = `${window.location.origin}/auth?invite=${token}`;
      setGeneratedInvite({ token, link: inviteLink });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Invitation created and email sent successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create invitation");
    },
  });

  const updateUserStatusMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ status })
        .eq("id", userId);

      if (error) throw error;

      await logAuditEvent({
        actionType: "USER_STATUS_CHANGED",
        targetType: "user",
        targetId: userId,
        description: `Changed user status to ${status}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User status updated");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update user status");
    },
  });

  const handleInviteSubmit = () => {
    if (!inviteEmail || !inviteFullName) {
      toast.error("Please fill in all required fields");
      return;
    }
    inviteUserMutation.mutate();
  };

  const handleCloseInviteDialog = () => {
    setInviteDialogOpen(false);
    setInviteEmail("");
    setInviteFullName("");
    
    setInviteNote("");
    setGeneratedInvite(null);
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!session && !isLoadingAuth) {
      navigate("/auth");
    }
  }, [session, isLoadingAuth, navigate]);

  if (!session || isLoadingAuth) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="font-serif text-3xl font-bold">Users</h1>
          </div>
          <Button onClick={() => setInviteDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Invite User
          </Button>
        </div>

        {isLoading ? (
          <div>Loading...</div>
        ) : users && users.length > 0 ? (
          <div className="space-y-4">
            {users.map((user) => (
              <div
                key={user.id}
                className="p-6 border border-border rounded-lg"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">
                        {user.full_name || "No name set"}
                      </h3>
                      <Badge variant={user.status === "active" ? "default" : "destructive"}>
                        {user.status || "active"}
                      </Badge>
                      <Badge variant="outline">
                        {user.user_roles?.[0]?.role || "user"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">{user.email}</p>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Joined: {format(new Date(user.created_at), "MMM dd, yyyy")}</span>
                      {user.last_login_at && (
                        <span>Last login: {format(new Date(user.last_login_at), "MMM dd, yyyy HH:mm")}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {user.status === "active" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateUserStatusMutation.mutate({ userId: user.id, status: "suspended" })}
                      >
                        <Ban className="h-4 w-4 mr-1" />
                        Suspend
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateUserStatusMutation.mutate({ userId: user.id, status: "active" })}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Activate
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No users found</p>
            <Button onClick={() => setInviteDialogOpen(true)} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Invite your first user
            </Button>
          </div>
        )}

        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {generatedInvite ? "Invitation Created" : "Invite User"}
              </DialogTitle>
              <DialogDescription>
                {generatedInvite
                  ? "Copy the invitation link below and send it to the user."
                  : "Fill in the details to invite a new user to the system."}
              </DialogDescription>
            </DialogHeader>

            {generatedInvite ? (
              <div className="space-y-4">
                <div>
                  <Label>Invitation Link</Label>
                  <div className="flex gap-2 mt-2">
                    <Input value={generatedInvite.link} readOnly />
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedInvite.link);
                        toast.success("Link copied to clipboard");
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Invitation Token</Label>
                  <Input value={generatedInvite.token} readOnly className="mt-2 font-mono text-sm" />
                </div>
                <p className="text-sm text-muted-foreground">
                  This invitation link will expire in 7 days. The user will need to set their password when they first log in.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    value={inviteFullName}
                    onChange={(e) => setInviteFullName(e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <Label>Role</Label>
                  <Input value="Editor" disabled className="mt-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    Editors can create, edit, publish and delete articles
                  </p>
                </div>
                <div>
                  <Label htmlFor="note">Note (Optional)</Label>
                  <Textarea
                    id="note"
                    value={inviteNote}
                    onChange={(e) => setInviteNote(e.target.value)}
                    placeholder="Add a note for the invitation..."
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              {generatedInvite ? (
                <Button onClick={handleCloseInviteDialog}>Close</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleInviteSubmit} disabled={inviteUserMutation.isPending}>
                    {inviteUserMutation.isPending ? "Creating..." : "Create Invitation"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default Users;