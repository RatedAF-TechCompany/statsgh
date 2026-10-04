import { Search, User, LogOut, LayoutDashboard, Menu, X } from "lucide-react";
import statsghLogoImport from "@/assets/statsgh-logo.png";
const statsghLogo: string = (statsghLogoImport as any)?.src ?? (statsghLogoImport as any);
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { logAuditEvent } from "@/lib/audit";
import { SITE_SECTIONS } from "@/lib/navigation";
import { useRef, useState } from "react";
import { DataAlertBanner } from "@/components/DataAlertBanner";
import { X_URL, WHATSAPP_CHANNEL_URL } from "@/lib/social";
import EconomicIndicatorStrip from "@/components/home/EconomicIndicatorStrip";

export const Header = ({ showTicker = false }: { showTicker?: boolean }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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
      <DataAlertBanner />
      {/* Ticker */}
      {showTicker && <EconomicIndicatorStrip />}

      {/* Masthead */}
      <div className="bg-white border-b border-[#D9D9D9]">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 flex items-center justify-between h-16 gap-6">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 hover:opacity-90 flex-shrink-0"
          >
            <img src={statsghLogo} alt="StatsGH" className="h-7" />
            <span className="font-headline text-2xl font-bold text-[#0D0D0D] tracking-tight">
              StatsGH
            </span>
          </button>

          <span className="hidden lg:block font-ui text-[11px] uppercase tracking-[0.12em] text-[#757575] whitespace-nowrap">
            {dateString}
          </span>

          <div className="flex items-center gap-2 ml-auto md:ml-6 flex-shrink-0">
            <a href={X_URL} target="_blank" rel="noopener noreferrer" className="hidden sm:inline font-ui text-[12px] font-semibold text-[#121212] hover:text-[#E3120B] px-1" aria-label="Follow StatsGH on X">Follow on X</a>
            {WHATSAPP_CHANNEL_URL && (
              <a href={WHATSAPP_CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="hidden sm:inline font-ui text-[12px] font-semibold text-[#121212] hover:text-[#E3120B] px-1">Follow on WhatsApp</a>
            )}
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
                className="bg-[#E3120B] text-white hover:bg-[#B30E08] font-ui font-semibold text-[13px] h-8 px-4 rounded-[2px]"
                onClick={() => navigate("/auth")}
              >
                Subscribe
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Section nav — scrolls horizontally; below lg a menu button lists every section */}
      <div className="bg-white border-b border-[#D9D9D9]">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 flex items-center">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="lg:hidden flex-shrink-0 flex items-center gap-1.5 h-10 pr-3 mr-1 border-r border-[#D9D9D9] font-ui text-[13px] font-semibold text-[#0D0D0D]"
            aria-expanded={menuOpen}
            aria-controls="section-menu"
            aria-label={menuOpen ? "Close sections menu" : "Open sections menu"}
          >
            {menuOpen ? <X size={16} /> : <Menu size={16} />}
            <span className="hidden sm:inline">Sections</span>
          </button>
          <div className="relative flex-1 min-w-0">
            <nav
              ref={navRef}
              aria-label="Sections"
              className="flex items-center gap-0 overflow-x-auto scrollbar-hide h-10 flex-nowrap"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                WebkitOverflowScrolling: "touch",
                whiteSpace: "nowrap",
              }}
            >
              {SITE_SECTIONS.map((section) => (
                <button
                  key={section.slug}
                  onClick={() => navigate(section.href)}
                  className={`
                    flex-shrink-0 whitespace-nowrap px-3 h-11 font-ui text-[14px] font-medium
                    border-b-[3px] transition-colors
                    ${isActiveSection(section.href)
                      ? "border-[#E3120B] text-[#0D0D0D]"
                      : "border-transparent text-[#0D0D0D] hover:text-[#E3120B]"
                    }
                  `}
                >
                  {section.label}
                </button>
              ))}
            </nav>
            {/* Fade hint that more sections are scrollable */}
            <div aria-hidden className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-white to-transparent lg:hidden" />
          </div>
        </div>
        {menuOpen && (
          <div id="section-menu" className="lg:hidden border-t border-[#D9D9D9] bg-white max-h-[70vh] overflow-y-auto">
            <ul className="max-w-[1280px] mx-auto px-4 md:px-6 py-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
              {SITE_SECTIONS.map((section) => (
                <li key={section.slug}>
                  <button
                    onClick={() => { setMenuOpen(false); navigate(section.href); }}
                    className={`w-full text-left py-2.5 font-ui text-[14px] border-b border-[#D9D9D9] ${isActiveSection(section.href) ? "text-[#E3120B] font-semibold" : "text-[#0D0D0D]"}`}
                  >
                    {section.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </header>
  );
};
