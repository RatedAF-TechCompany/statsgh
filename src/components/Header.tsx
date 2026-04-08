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

export const Header = () => {
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

  return (
    <header className="sticky top-0 z-50">
      {/* Tier 1 — Dark slate strip */}
      <div className="bg-[#33302E] text-[#FFF1E0]">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 flex items-center justify-between h-12">
          {/* Logo */}
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 hover:opacity-90"
          >
            <img src={statsghLogo} alt="StatsGH" className="h-6" />
            <span className="font-headline text-xl font-bold text-[#C9A84C]">
              StatsGH
            </span>
          </button>

          {/* Centre tagline — hidden on mobile */}
          <span className="hidden md:block font-ui text-[11px] text-[#FFF1E0]/70 tracking-wide">
            Ghana's Premier Data Journalism Platform
          </span>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/search")}
              className="p-2 hover:opacity-80"
              aria-label="Search"
            >
              <Search size={18} className="text-[#FFF1E0]" />
            </button>

            {session ? (
              <>
                {hasDashboardAccess && (
                  <button
                    onClick={() => navigate("/dashboard")}
                    className="p-2 hover:opacity-80"
                    title="Dashboard"
                  >
                    <LayoutDashboard size={18} className="text-[#FFF1E0]" />
                  </button>
                )}
                <button
                  onClick={() => navigate("/saved")}
                  className="p-2 hover:opacity-80"
                >
                  <User size={18} className="text-[#FFF1E0]" />
                </button>
                <button
                  onClick={handleLogout}
                  className="p-2 hover:opacity-80"
                >
                  <LogOut size={16} className="text-[#FFF1E0]" />
                </button>
              </>
            ) : (
              <Button
                size="sm"
                className="bg-[#0D7680] text-white hover:bg-[#0a5f67] font-ui text-xs h-8 px-4"
                onClick={() => navigate("/auth")}
              >
                Subscribe
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tier 2 — Section nav */}
      <div className="bg-[#FFF1E0] border-b border-[#E8D9C5]">
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
                    ? "border-[#0D7680] text-[#0D7680]"
                    : "border-transparent text-[#33302E] hover:text-[#0D7680]"
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
