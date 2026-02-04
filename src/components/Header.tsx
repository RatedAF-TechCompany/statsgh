"use client";

import { Menu, User, LogOut, ExternalLink, LayoutDashboard, Search } from "lucide-react";
import Image from "next/image";
import statsghLogo from "@/assets/statsgh-logo.png";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { logAuditEvent } from "@/lib/audit";
import { SITE_NAVIGATION } from "@/lib/navigation";

export const Header = () => {
  const router = useRouter();

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
      await logAuditEvent({
        actionType: "LOGOUT",
        description: "User logged out",
      });
      
      await supabase.auth.signOut();
      toast.success("Logged out successfully");
      router.push("/auth");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout");
    }
  };

  return (
    <div className="sticky top-0 z-50 bg-background border-b border-border">
      <div className="max-w-[1120px] mx-auto px-4 md:px-8">
        {/* Primary nav bar */}
        <div className="h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-transparent md:hidden">
                  <Menu className="h-[22px] w-[22px]" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 flex flex-col">
                <SheetHeader className="flex-shrink-0">
                  <SheetTitle className="font-serif text-xl font-semibold">
                    Navigation
                  </SheetTitle>
                </SheetHeader>
                <nav className="mt-6 overflow-y-auto flex-1 -mx-6 px-6">
                  {/* Primary links */}
                  <div className="mb-4">
                    <p className="px-4 py-2 text-xs font-bold tracking-[0.15em] uppercase text-muted-foreground">
                      Explore
                    </p>
                    <div className="space-y-1">
                      {SITE_NAVIGATION.primary.map((navItem) => (
                        <button
                          key={navItem.href}
                          onClick={() => router.push(navItem.href)}
                          className="block w-full text-left px-4 py-3 text-base hover:bg-muted transition-colors"
                        >
                          {navItem.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Categories */}
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
                              router.push(navItem.slug === "top-stories" ? "/" : `/${navItem.slug}`);
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
                      onClick={() => router.push("/saved")}
                      className="block w-full text-left px-4 py-3 text-base hover:bg-muted transition-colors"
                    >
                      Saved
                    </button>
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 hover:bg-transparent"
              onClick={() => router.push("/search")}
            >
              <Search className="h-[22px] w-[22px]" />
            </Button>
          </div>

          <div 
            onClick={() => router.push("/")}
            className="cursor-pointer hover:opacity-90 transition-opacity absolute left-1/2 -translate-x-1/2"
          >
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Image src={statsghLogo} alt="StatsGH" className="h-6 sm:h-8 w-auto" />
              <span className="font-serif text-base sm:text-lg md:text-xl font-medium tracking-[0.04em]">StatsGH</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {session ? (
              <>
                {hasDashboardAccess && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push("/dashboard")}
                    className="h-9 w-9 hover:bg-transparent"
                    title="Dashboard"
                  >
                    <LayoutDashboard className="h-5 w-5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.push("/saved")}
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
                  <span className="text-xs hidden sm:inline">Logout</span>
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push("/auth")}
                className="h-9 w-9 hover:bg-transparent"
              >
                <User className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>

        {/* Secondary nav - primary links on desktop */}
        <nav className="hidden md:flex items-center justify-center gap-6 h-10 border-t border-border/50 text-sm">
          {SITE_NAVIGATION.primary.map((navItem) => (
            <button
              key={navItem.href}
              onClick={() => router.push(navItem.href)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {navItem.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};