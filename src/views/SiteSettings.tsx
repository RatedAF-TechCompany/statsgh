"use client";
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
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [telegramUrl, setTelegramUrl] = useState("");
  const [xUrl, setXUrl] = useState("");
  const [adRates, setAdRates] = useState("");

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
      setWhatsappUrl((settings as any).whatsapp_url || "");
      setTelegramUrl((settings as any).telegram_url || "");
      setXUrl((settings as any).x_url || "");
      const r = (settings as any).ad_rates;
      setAdRates(Array.isArray(r) ? r.map((x: any) => `${x.format} | ${x.price}`).join("\n") : "");
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

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!session && !isLoadingAuth) {
      navigate("/auth");
    }
  }, [session, isLoadingAuth, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const urlOk = (u: string) => !u.trim() || /^https:\/\//i.test(u.trim());
    if (![whatsappUrl, telegramUrl, xUrl].every(urlOk)) { toast.error("Channel links must start with https://"); return; }
    const rates = adRates.split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((x) => x[0] && x[1]).map(([format, price]) => ({ format, price }));
    saveSettingsMutation.mutate({
      whatsapp_url: whatsappUrl.trim() || null,
      telegram_url: telegramUrl.trim() || null,
      x_url: xUrl.trim() || null,
      ad_rates: rates.length ? rates : null,
      site_name: siteName,
      footer_text: footerText,
      logo_url: logoUrl,
      default_seo_description: defaultSeoDescription,
    });
  };

  if (!session || isLoadingAuth) {
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
              placeholder="StatsGH"
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

          <div className="border-t pt-4 space-y-4">
            <h2 className="font-semibold">Distribution channels</h2>
            <p className="text-sm text-muted-foreground">Follow buttons appear on the site only for links filled in here.</p>
            <div><Label htmlFor="wa">WhatsApp channel URL</Label><Input id="wa" value={whatsappUrl} onChange={(e) => setWhatsappUrl(e.target.value)} placeholder="https://whatsapp.com/channel/..." /></div>
            <div><Label htmlFor="tg">Telegram channel URL</Label><Input id="tg" value={telegramUrl} onChange={(e) => setTelegramUrl(e.target.value)} placeholder="https://t.me/..." /></div>
            <div><Label htmlFor="xu">X profile URL</Label><Input id="xu" value={xUrl} onChange={(e) => setXUrl(e.target.value)} placeholder="https://x.com/StatsGH" /></div>
          </div>
          <div className="border-t pt-4 space-y-2">
            <h2 className="font-semibold">Advertising rates (optional)</h2>
            <p className="text-sm text-muted-foreground">One per line: <code>Format | Price</code>, e.g. <code>Sponsored article | GH₵5,000</code>. Leave blank to show no prices on /advertise.</p>
            <Textarea value={adRates} onChange={(e) => setAdRates(e.target.value)} rows={4} />
          </div>
          <div className="border-t pt-4 text-sm"><a href="/admin/brief-preview" className="underline">Preview this morning's brief</a></div>

          <Button type="submit" disabled={saveSettingsMutation.isPending}>
            {saveSettingsMutation.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </form>
      </main>
    </div>
  );
};

export default SiteSettings;