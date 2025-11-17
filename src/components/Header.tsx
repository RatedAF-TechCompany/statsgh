import { Menu, User, Search } from "lucide-react";
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
import statsghLogo from "@/assets/statsgh-logo.jpeg";

const navigationItems = [
  { label: "Top Stories", href: "/" },
  { label: "World", href: "/?section=World" },
  { label: "Markets", href: "/?section=Markets" },
  { label: "Economy", href: "/?section=Economy" },
  { label: "Technology", href: "/?section=Technology" },
  { label: "Opinion", href: "/?section=Opinion" },
  { label: "Saved", href: "/saved" },
];

interface HeaderProps {
  onSearchToggle?: () => void;
}

export const Header = ({ onSearchToggle }: HeaderProps) => {
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
    <>
      <div className="sticky top-0 z-50">
        {/* White navigation row with responsive height */}
        <div className="bg-white border-b border-[#D4D4D4]">
          <div className="max-w-5xl mx-auto px-6 h-[80px] md:h-[120px] flex items-center justify-between gap-3">
            {/* Logo - responsive size */}
            <div 
              onClick={() => navigate("/")}
              className="w-[80px] h-[80px] md:w-[120px] md:h-[120px] cursor-pointer hover:opacity-90 transition-opacity overflow-hidden flex-shrink-0"
            >
              <img 
                src={statsghLogo} 
                alt="StatsGH" 
                className="w-full h-full object-cover"
              />
            </div>
            
            <div className="flex items-center gap-3">
            <Button
              onClick={() => navigate("/auth")}
              className="hidden sm:flex bg-[#1e3a8a] hover:bg-[#1e40af] text-white rounded-full px-6 h-9"
            >
              Subscribe
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate(session ? "/saved" : "/auth")}
              className="hidden sm:inline-flex h-9"
            >
              Log in
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-5 w-5" />
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
              {onSearchToggle && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onSearchToggle}
                  className="h-9 w-9"
                >
                  <Search className="h-5 w-5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
