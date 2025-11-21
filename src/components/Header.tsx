import { Menu, User } from "lucide-react";
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

const navigationItems = [
  { label: "Top Stories", href: "/" },
  { label: "World", href: "/?section=World" },
  { label: "Markets", href: "/?section=Markets" },
  { label: "Economy", href: "/?section=Economy" },
  { label: "Technology", href: "/?section=Technology" },
  { label: "Opinion", href: "/?section=Opinion" },
  { label: "Saved", href: "/saved" },
];

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

  return (
    <div className="sticky top-0 z-50 bg-background border-b border-border">
      <div className="max-w-[480px] mx-auto px-4 h-12 flex items-center justify-between">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-transparent">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72">
            <SheetHeader>
              <SheetTitle className="font-serif text-xl font-semibold">
                Navigation
              </SheetTitle>
            </SheetHeader>
            <nav className="mt-6 space-y-1">
              {navigationItems.map((item) => (
                <button
                  key={item.href}
                  onClick={() => {
                    navigate(item.href);
                  }}
                  className="block w-full text-left px-4 py-3 text-base hover:bg-muted transition-colors"
                >
                  {item.label}
                </button>
              ))}
              {isAdmin && (
                <button
                  onClick={() => navigate("/admin")}
                  className="block w-full text-left px-4 py-3 text-base hover:bg-muted transition-colors font-medium text-accent"
                >
                  Admin Dashboard
                </button>
              )}
            </nav>
          </SheetContent>
        </Sheet>

        <div 
          onClick={() => navigate("/")}
          className="cursor-pointer hover:opacity-90 transition-opacity"
        >
          <h1 className="font-serif text-xl font-semibold tracking-[0.125em] uppercase">
            STATS GH
          </h1>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(session ? "/saved" : "/auth")}
          className="h-9 w-9 hover:bg-transparent"
        >
          <User className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};
