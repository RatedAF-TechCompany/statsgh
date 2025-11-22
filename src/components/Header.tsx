import { Menu, User, LogOut, ExternalLink, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { logAuditEvent } from "@/lib/audit";
import { SITE_NAVIGATION } from "@/lib/navigation";

export const Header = () => {
  const navigate = useNavigate();

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
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
    enabled: !!session?.user?.id,
  });

  const handleLogout = async () => {
    try {
      await logAuditEvent({
        actionType: "LOGOUT",
        description: "User logged out",
      });
      
      await supabase.auth.signOut();
      toast.success("Logged out successfully");
      navigate("/auth");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout");
    }
  };

  return (
    <div className="sticky top-0 z-50 bg-background border-b border-border">
      <div className="max-w-[480px] mx-auto px-4 h-12 flex items-center justify-between">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-transparent">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 flex flex-col">
          <SheetHeader className="flex-shrink-0">
            <SheetTitle className="font-serif text-xl font-semibold">
              Navigation
            </SheetTitle>
          </SheetHeader>
          <nav className="mt-6 overflow-y-auto flex-1 -mx-6 px-6">
            <div className="mb-4">
              <p className="px-4 py-2 text-xs font-bold tracking-[0.15em] uppercase text-muted-foreground">
                Categories
              </p>
              <div className="space-y-1">
                {SITE_NAVIGATION.categories.map((navItem) => {
                  if (navItem.type === "external") {
                    return (
                      <a
                        key={navItem.slug}
                        href={navItem.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 w-full text-left px-4 py-3 text-base hover:bg-muted transition-colors"
                      >
                        {navItem.label}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    );
                  }
                  
                  return (
                    <button
                      key={navItem.slug}
                      onClick={() => {
                        navigate(navItem.slug === "top-stories" ? "/" : `/category/${navItem.slug}`);
                      }}
                      className="block w-full text-left px-4 py-3 text-base hover:bg-muted transition-colors"
                    >
                      {navItem.label}
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div className="border-t border-border mt-2 pt-2">
              <button
                onClick={() => navigate("/saved")}
                className="block w-full text-left px-4 py-3 text-base hover:bg-muted transition-colors"
              >
                Saved
              </button>
            </div>
          </nav>
          </SheetContent>
        </Sheet>

        <div 
          onClick={() => navigate("/")}
          className="cursor-pointer hover:opacity-90 transition-opacity"
        >
          <h1 className="font-serif text-xl font-semibold">
            StatsGH
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {session ? (
            <>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/dashboard")}
                  className="h-9 w-9 hover:bg-transparent"
                  title="Dashboard"
                >
                  <LayoutDashboard className="h-5 w-5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/saved")}
                className="h-9 w-9 hover:bg-transparent"
              >
                <User className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="h-9 gap-1"
              >
                <LogOut className="h-4 w-4" />
                <span className="text-xs">Logout</span>
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/auth")}
              className="h-9 w-9 hover:bg-transparent"
            >
              <User className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
