import { Search, User, LogOut, LayoutDashboard } from "lucide-react";
import statsghLogo from "@/assets/statsgh-logo.png";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { logAuditEvent } from "@/lib/audit";
import { SITE_SECTIONS } from "@/lib/navigation";
import { useRef } from "react";
import EconomicIndicatorStrip from "@/components/home/EconomicIndicatorStrip";

export const Header = ({ showTicker = false }: { showTicker?: boolean }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef<HTMLDivElement>(null);

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: hasDashboardAccess } = useQuery({
    queryKey: ["hasDashboardAccess", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .in("role", ["admin", "editor"])
        .maybeSingle();
      return !!data;
    },
    enabled: !!session?.user?.id,
  });

  const handleLogout = async () => {
    try {
      await logAuditEvent({ actionType: "LOGOUT", description: "User logged out" });
      await supabase.auth.signOut();
      toast.success("Logged out successfully");
      navigate("/auth");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout");
    }
  };

  const isActiveSection = (href: string) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href);
  };

  const today = new Date();
  const dateString = today.toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="sticky top-0 z-50">
      {/* Ticker */}
      {showTicker && <EconomicIndicatorStrip />}

      {/* Masthead */}
      <div className="bg-white border-b border-[#E5E2DC]">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 flex items-center justify-between h-16 relative">
          <span className="hidden md:block font-ui text-[11px] uppercase tracking-[0.12em] text-[#8A8A8A] whitespace-nowrap">
            {dateString}
          </span>
          <div className="md:hidden w-10" />

          <button
            onClick={() => navigate("/")}
            className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 hover:opacity-90"
          >
            <img src={statsghLogo} alt="StatsGH" className="h-7" />
            <span className="font-headline text-2xl font-bold text-[#121212]">
              StatsGH
            </span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/search")}
              className="p-2 hover:opacity-80"
              aria-label="Search"
            >
              <Search size={18} className="text-[#121212]" />
            </button>

            {session ? (
              <>
                {hasDashboardAccess && (
                  <button
                    onClick={() => navigate("/dashboard")}
                    className="p-2 hover:opacity-80"
                    title="Dashboard"
                    aria-label="Open dashboard"
                  >
                    <LayoutDashboard size={18} className="text-[#121212]" />
                  </button>
                )}
                <button
                  onClick={() => navigate("/saved")}
                  className="p-2 hover:opacity-80"
                  aria-label="Saved articles and account"
                >
                  <User size={18} className="text-[#121212]" />
                </button>
                <button
                  onClick={handleLogout}
                  className="p-2 hover:opacity-80"
                  aria-label="Log out"
                >
                  <LogOut size={16} className="text-[#121212]" />
                </button>
              </>
            ) : (
              <Button
                size="sm"
                className="bg-[#8B0000] text-white hover:bg-[#6d0000] font-ui text-xs uppercase tracking-[0.1em] h-8 px-4 rounded-[2px]"
                onClick={() => navigate("/auth")}
              >
                Subscribe
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Section nav */}
      <div className="bg-white border-b border-[#E5E2DC]">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6">
          <nav
            ref={navRef}
            className="flex items-center gap-0 overflow-x-auto scrollbar-hide h-10 -mx-2"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {SITE_SECTIONS.map((section) => (
              <button
                key={section.slug}
                onClick={() => navigate(section.href)}
                className={`
                  flex-shrink-0 px-3 h-10 font-ui text-[13px] font-medium
                  border-b-2 transition-colors
                  ${isActiveSection(section.href)
                    ? "border-[#8B0000] text-[#8B0000]"
                    : "border-transparent text-[#121212] hover:text-[#8B0000]"
                  }
                `}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
};
