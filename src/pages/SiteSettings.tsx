import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const SiteSettings = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [siteName, setSiteName] = useState("");
  const [footerText, setFooterText] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [defaultSeoDescription, setDefaultSeoDescription] = useState("");

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

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!isAdmin,
  });

  useEffect(() => {
    if (settings) {
      setSiteName(settings.site_name || "");
      setFooterText(settings.footer_text || "");
      setLogoUrl(settings.logo_url || "");
      setDefaultSeoDescription(settings.default_seo_description || "");
    }
  }, [settings]);

  const saveSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      if (settings?.id) {
        const { error } = await supabase
          .from("site_settings")
          .update({ ...data, updated_by: session?.user.id })
          .eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("site_settings")
          .insert({ ...data, updated_by: session?.user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings saved");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    if (!isLoadingAuth && !isAdmin) {
      toast.error("Access denied");
      navigate("/");
    }
  }, [isAdmin, isLoadingAuth, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettingsMutation.mutate({
      site_name: siteName,
      footer_text: footerText,
      logo_url: logoUrl,
      default_seo_description: defaultSeoDescription,
    });
  };

  if (isLoadingAuth || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="font-serif text-3xl font-bold">Site Settings</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="siteName">Site Name</Label>
            <Input
              id="siteName"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="STATS GH"
            />
          </div>

          <div>
            <Label htmlFor="footerText">Footer Text</Label>
            <Input
              id="footerText"
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder="ft.com"
            />
          </div>

          <div>
            <Label htmlFor="logoUrl">Logo URL</Label>
            <Input
              id="logoUrl"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div>
            <Label htmlFor="seoDescription">Default SEO Description</Label>
            <Textarea
              id="seoDescription"
              value={defaultSeoDescription}
              onChange={(e) => setDefaultSeoDescription(e.target.value)}
              placeholder="Your trusted source for news and analysis"
            />
          </div>

          <Button type="submit" disabled={saveSettingsMutation.isPending}>
            {saveSettingsMutation.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </form>
      </main>
    </div>
  );
};

export default SiteSettings;