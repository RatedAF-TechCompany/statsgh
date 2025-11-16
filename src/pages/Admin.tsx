import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { PlusCircle, FileText, LogOut } from "lucide-react";
import { toast } from "sonner";

const Admin = () => {
  const navigate = useNavigate();

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: isAdmin, isLoading } = useQuery({
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
    if (!isLoading && !isAdmin) {
      toast.error("Access denied");
      navigate("/");
    }
  }, [isAdmin, isLoading, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/");
  };

  if (isLoading || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="font-serif text-3xl font-bold">Admin Dashboard</h1>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="p-6 border border-divider bg-surface hover:bg-muted/50 transition-colors">
            <FileText className="h-12 w-12 mb-4 text-accent" />
            <h2 className="font-serif text-2xl font-semibold mb-2">
              Manage Articles
            </h2>
            <p className="text-muted-text mb-4">
              View, edit, and manage all published articles
            </p>
            <Button onClick={() => navigate("/admin/articles")}>
              View Articles
            </Button>
          </div>

          <div className="p-6 border border-divider bg-surface hover:bg-muted/50 transition-colors">
            <PlusCircle className="h-12 w-12 mb-4 text-accent" />
            <h2 className="font-serif text-2xl font-semibold mb-2">
              Create Article
            </h2>
            <p className="text-muted-text mb-4">
              Write and publish new articles
            </p>
            <Button onClick={() => navigate("/admin/articles/new")}>
              New Article
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Admin;
