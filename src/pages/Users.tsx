import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const Users = () => {
  const navigate = useNavigate();

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
        .select("*, user_roles(role)")
        .order("created_at", { ascending: false });
      return data;
    },
    enabled: !!isAdmin,
  });

  useEffect(() => {
    if (!isLoadingAuth && !isAdmin) {
      toast.error("Access denied");
      navigate("/");
    }
  }, [isAdmin, isLoadingAuth, navigate]);

  if (isLoadingAuth || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="font-serif text-3xl font-bold">Users</h1>
        </div>

        {isLoading ? (
          <div>Loading...</div>
        ) : users && users.length > 0 ? (
          <div className="space-y-4">
            {users.map((user) => (
              <div
                key={user.id}
                className="p-4 border border-border rounded-md flex items-center justify-between"
              >
                <div>
                  <h3 className="font-semibold">{user.email}</h3>
                  <p className="text-sm text-muted-foreground">
                    Role: {user.user_roles?.[0]?.role || "user"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Joined: {new Date(user.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No users found</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Users;