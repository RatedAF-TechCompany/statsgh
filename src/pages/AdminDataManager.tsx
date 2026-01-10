import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Upload,
  Database,
  Building2,
  MapPin,
  TrendingUp,
  Trash2,
  Edit,
  RefreshCw,
  Loader2,
  History,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const AdminDataManager = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("indicators");

  // Auth check
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", session?.user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("has_role", {
        _user_id: session!.user.id,
        _role: "admin",
      });
      return data;
    },
    enabled: !!session?.user?.id,
  });

  useEffect(() => {
    if (session === null) {
      navigate("/auth");
    } else if (isAdmin === false) {
      navigate("/");
    }
  }, [session, isAdmin, navigate]);

  // Fetch data
  const { data: topics } = useQuery({
    queryKey: ["admin-topics"],
    queryFn: async () => {
      const { data } = await supabase.from("data_topics").select("*").order("display_order");
      return data || [];
    },
  });

  const { data: indicators } = useQuery({
    queryKey: ["admin-indicators"],
    queryFn: async () => {
      const { data } = await supabase
        .from("indicators")
        .select("*, topic:data_topics(name)")
        .order("name");
      return data || [];
    },
  });

  const { data: sources } = useQuery({
    queryKey: ["admin-sources"],
    queryFn: async () => {
      const { data } = await supabase.from("data_sources").select("*").order("name");
      return data || [];
    },
  });

  const { data: geographies } = useQuery({
    queryKey: ["admin-geographies"],
    queryFn: async () => {
      const { data } = await supabase.from("geographies").select("*").order("display_order");
      return data || [];
    },
  });

  if (!session || isAdmin === false) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-serif text-2xl font-bold">Data Manager</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="indicators" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Indicators
            </TabsTrigger>
            <TabsTrigger value="sources" className="gap-2">
              <Building2 className="h-4 w-4" />
              Sources
            </TabsTrigger>
            <TabsTrigger value="geographies" className="gap-2">
              <MapPin className="h-4 w-4" />
              Geographies
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-2">
              <Upload className="h-4 w-4" />
              Import Data
            </TabsTrigger>
            <TabsTrigger value="pipelines" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Data Pipelines
            </TabsTrigger>
          </TabsList>

          {/* Indicators Tab */}
          <TabsContent value="indicators">
            <IndicatorsManager 
              indicators={indicators || []} 
              topics={topics || []}
              geographies={geographies || []}
            />
          </TabsContent>

          {/* Sources Tab */}
          <TabsContent value="sources">
            <SourcesManager sources={sources || []} geographies={geographies || []} />
          </TabsContent>

          {/* Geographies Tab */}
          <TabsContent value="geographies">
            <GeographiesManager geographies={geographies || []} />
          </TabsContent>

          {/* Import Tab */}
          <TabsContent value="import">
            <DataImporter indicators={indicators || []} sources={sources || []} />
          </TabsContent>

          {/* Data Pipelines Tab */}
          <TabsContent value="pipelines">
            <DataPipelinesManager sources={sources || []} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

// Indicators Manager Component
const IndicatorsManager = ({ 
  indicators, 
  topics, 
  geographies 
}: { 
  indicators: any[]; 
  topics: any[];
  geographies: any[];
}) => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    short_name: "",
    description: "",
    definition: "",
    methodology: "",
    caveats: "",
    unit: "",
    unit_display: "",
    frequency: "monthly",
    topic_id: "",
    priority_tier: "tier2",
    is_ghana_core: false,
    default_geography_id: "",
    chart_type: "line",
    decimal_places: 2,
  });

  const ghanaGeo = geographies.find((g) => g.code === "GH");

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      short_name: "",
      description: "",
      definition: "",
      methodology: "",
      caveats: "",
      unit: "",
      unit_display: "",
      frequency: "monthly",
      topic_id: "",
      priority_tier: "tier2",
      is_ghana_core: false,
      default_geography_id: ghanaGeo?.id || "",
      chart_type: "line",
      decimal_places: 2,
    });
    setEditingIndicator(null);
  };

  const openEdit = (indicator: any) => {
    setEditingIndicator(indicator);
    setFormData({
      name: indicator.name,
      slug: indicator.slug,
      short_name: indicator.short_name || "",
      description: indicator.description || "",
      definition: indicator.definition || "",
      methodology: indicator.methodology || "",
      caveats: indicator.caveats || "",
      unit: indicator.unit,
      unit_display: indicator.unit_display || "",
      frequency: indicator.frequency || "monthly",
      topic_id: indicator.topic_id || "",
      priority_tier: indicator.priority_tier || "tier2",
      is_ghana_core: indicator.is_ghana_core,
      default_geography_id: indicator.default_geography_id || ghanaGeo?.id || "",
      chart_type: indicator.chart_type || "line",
      decimal_places: indicator.decimal_places || 2,
    });
    setIsDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingIndicator) {
        const { error } = await supabase
          .from("indicators")
          .update(data)
          .eq("id", editingIndicator.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("indicators").insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-indicators"] });
      toast.success(editingIndicator ? "Indicator updated" : "Indicator created");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("indicators").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-indicators"] });
      toast.success("Indicator deleted");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const slug = formData.slug || formData.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    
    saveMutation.mutate({
      ...formData,
      slug,
      topic_id: formData.topic_id || null,
      default_geography_id: formData.default_geography_id || null,
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Indicators ({indicators.length})</h2>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Indicator
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingIndicator ? "Edit Indicator" : "Create Indicator"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Name *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="GDP Growth Rate"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Short Name</label>
                  <Input
                    value={formData.short_name}
                    onChange={(e) => setFormData({ ...formData, short_name: e.target.value })}
                    placeholder="GDP Growth"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Slug</label>
                  <Input
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="gdp-growth-rate"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Unit *</label>
                  <Input
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="%"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the indicator"
                  rows={2}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Definition</label>
                <Textarea
                  value={formData.definition}
                  onChange={(e) => setFormData({ ...formData, definition: e.target.value })}
                  placeholder="Technical definition and how it's measured"
                  rows={3}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Topic</label>
                  <Select
                    value={formData.topic_id}
                    onValueChange={(v) => setFormData({ ...formData, topic_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select topic" />
                    </SelectTrigger>
                    <SelectContent>
                      {topics.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Frequency</label>
                  <Select
                    value={formData.frequency}
                    onValueChange={(v) => setFormData({ ...formData, frequency: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Priority Tier</label>
                  <Select
                    value={formData.priority_tier}
                    onValueChange={(v) => setFormData({ ...formData, priority_tier: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tier1">Tier 1 (Core)</SelectItem>
                      <SelectItem value="tier2">Tier 2 (Important)</SelectItem>
                      <SelectItem value="tier3">Tier 3 (Extended)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Checkbox
                    id="is_ghana_core"
                    checked={formData.is_ghana_core}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, is_ghana_core: !!checked })
                    }
                  />
                  <label htmlFor="is_ghana_core" className="text-sm">
                    Ghana Core Indicator
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Topic</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {indicators.map((ind) => (
              <TableRow key={ind.id}>
                <TableCell>
                  <div>
                    <span className="font-medium">{ind.name}</span>
                    {ind.is_ghana_core && (
                      <Badge variant="default" className="ml-2 text-xs">Ghana</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{ind.topic?.name || "-"}</TableCell>
                <TableCell>{ind.unit}</TableCell>
                <TableCell>
                  <Badge variant="outline">{ind.priority_tier}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(ind)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={() => {
                        if (confirm("Delete this indicator?")) {
                          deleteMutation.mutate(ind.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {indicators.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No indicators yet. Create your first one!
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

// Sources Manager Component
const SourcesManager = ({ sources, geographies }: { sources: any[]; geographies: any[] }) => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    short_name: "",
    description: "",
    source_type: "government",
    website_url: "",
    is_ghana_source: true,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("data_sources").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sources"] });
      toast.success("Source created");
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Data Sources ({sources.length})</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Source
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Data Source</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate(formData);
            }} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ghana Statistical Service"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Short Name</label>
                <Input
                  value={formData.short_name}
                  onChange={(e) => setFormData({ ...formData, short_name: e.target.value })}
                  placeholder="GSS"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <Select
                  value={formData.source_type}
                  onValueChange={(v) => setFormData({ ...formData, source_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="government">Government</SelectItem>
                    <SelectItem value="international">International</SelectItem>
                    <SelectItem value="academic">Academic</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="ngo">NGO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Website URL</label>
                <Input
                  value={formData.website_url}
                  onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                  placeholder="https://statsghana.gov.gh"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is_ghana_source"
                  checked={formData.is_ghana_source}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, is_ghana_source: !!checked })
                  }
                />
                <label htmlFor="is_ghana_source" className="text-sm">
                  Ghana Source
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  Save
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sources.map((source) => (
          <Card key={source.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-medium">{source.name}</h3>
                {source.is_ghana_source && (
                  <Badge variant="default" className="text-xs">Ghana</Badge>
                )}
              </div>
              {source.short_name && (
                <p className="text-sm text-muted-foreground mb-1">({source.short_name})</p>
              )}
              <Badge variant="outline" className="text-xs">{source.source_type}</Badge>
              {source.website_url && (
                <a 
                  href={source.website_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline block mt-2"
                >
                  {source.website_url}
                </a>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

// Geographies Manager Component
const GeographiesManager = ({ geographies }: { geographies: any[] }) => {
  const ghanaGeos = geographies.filter((g) => g.is_ghana);
  const otherGeos = geographies.filter((g) => !g.is_ghana);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Geographies ({geographies.length})</h2>

      <div className="space-y-8">
        <section>
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <Badge variant="default">Ghana</Badge>
            Ghana Geographies ({ghanaGeos.length})
          </h3>
          <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-4">
            {ghanaGeos.map((geo) => (
              <Card key={geo.id}>
                <CardContent className="p-3">
                  <p className="font-medium text-sm">{geo.name}</p>
                  <p className="text-xs text-muted-foreground">{geo.code} • {geo.type}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h3 className="font-medium mb-4">Other Geographies ({otherGeos.length})</h3>
          <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-4">
            {otherGeos.map((geo) => (
              <Card key={geo.id}>
                <CardContent className="p-3">
                  <p className="font-medium text-sm">{geo.name}</p>
                  <p className="text-xs text-muted-foreground">{geo.code} • {geo.type}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

// Data Importer Component
const DataImporter = ({ indicators, sources }: { indicators: any[]; sources: any[] }) => {
  const queryClient = useQueryClient();
  const [selectedIndicator, setSelectedIndicator] = useState("");
  const [selectedSource, setSelectedSource] = useState("");
  const [csvData, setCsvData] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = async () => {
    if (!selectedIndicator || !csvData.trim()) {
      toast.error("Select an indicator and paste CSV data");
      return;
    }

    setIsImporting(true);

    try {
      // Parse CSV (expecting: date,value format)
      const lines = csvData.trim().split("\n");
      const header = lines[0].toLowerCase();
      const hasHeader = header.includes("date") || header.includes("value");
      const dataLines = hasHeader ? lines.slice(1) : lines;

      // Get or create Ghana series
      const { data: ghanaGeo } = await supabase
        .from("geographies")
        .select("id")
        .eq("code", "GH")
        .single();

      if (!ghanaGeo) {
        throw new Error("Ghana geography not found");
      }

      // Check for existing series
      let { data: existingSeries } = await supabase
        .from("data_series")
        .select("id")
        .eq("indicator_id", selectedIndicator)
        .eq("geography_id", ghanaGeo.id)
        .eq("is_primary", true)
        .single();

      if (!existingSeries) {
        // Create series
        const { data: newSeries, error: seriesError } = await supabase
          .from("data_series")
          .insert({
            indicator_id: selectedIndicator,
            geography_id: ghanaGeo.id,
            is_primary: true,
            breakdown_type: "national",
          })
          .select()
          .single();

        if (seriesError) throw seriesError;
        existingSeries = newSeries;
      }

      // Parse and insert data points
      const dataPoints = dataLines.map((line) => {
        const [dateStr, valueStr] = line.split(",").map((s) => s.trim());
        return {
          series_id: existingSeries!.id,
          date: dateStr,
          value: parseFloat(valueStr),
          source_id: selectedSource || null,
        };
      }).filter((dp) => !isNaN(dp.value) && dp.date);

      if (dataPoints.length === 0) {
        throw new Error("No valid data points found");
      }

      // Upsert data points
      const { error: insertError } = await supabase
        .from("data_points")
        .upsert(dataPoints, { onConflict: "series_id,date" });

      if (insertError) throw insertError;

      toast.success(`Imported ${dataPoints.length} data points`);
      setCsvData("");
      queryClient.invalidateQueries({ queryKey: ["data-points"] });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Import Data</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">CSV Import</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Indicator *</label>
              <Select value={selectedIndicator} onValueChange={setSelectedIndicator}>
                <SelectTrigger>
                  <SelectValue placeholder="Select indicator" />
                </SelectTrigger>
                <SelectContent>
                  {indicators.map((ind) => (
                    <SelectItem key={ind.id} value={ind.id}>{ind.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Source</label>
              <Select value={selectedSource} onValueChange={setSelectedSource}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {sources.map((src) => (
                    <SelectItem key={src.id} value={src.id}>{src.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">CSV Data (date,value format)</label>
            <Textarea
              value={csvData}
              onChange={(e) => setCsvData(e.target.value)}
              placeholder="2024-01-01,25.5
2024-02-01,26.2
2024-03-01,24.8"
              rows={10}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              One row per data point. Dates should be YYYY-MM-DD format. Values should be numbers.
            </p>
          </div>

          <Button onClick={handleImport} disabled={isImporting || !selectedIndicator}>
            <Upload className="h-4 w-4 mr-2" />
            {isImporting ? "Importing..." : "Import Data"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

// Data Pipelines Manager Component
const DataPipelinesManager = ({ sources }: { sources: any[] }) => {
  const queryClient = useQueryClient();
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [csvData, setCsvData] = useState("");
  const [selectedSource, setSelectedSource] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Fetch ingestion runs
  const { data: ingestionRuns, isLoading: runsLoading } = useQuery({
    queryKey: ["ingestion-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ingestion_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const handleBackfill = async () => {
    setIsBackfilling(true);
    try {
      const response = await supabase.functions.invoke("cpi-ingest", {
        body: { action: "backfill" },
      });
      
      if (response.error) throw response.error;
      
      const result = response.data;
      if (result.success) {
        toast.success(`Backfill complete: ${result.stats.rowsInserted} inserted, ${result.stats.rowsUpdated} updated`);
        queryClient.invalidateQueries({ queryKey: ["ingestion-runs"] });
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast.error(`Backfill failed: ${error.message}`);
    } finally {
      setIsBackfilling(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const response = await supabase.functions.invoke("cpi-ingest", {
        body: { action: "refresh" },
      });
      
      if (response.error) throw response.error;
      
      const result = response.data;
      if (result.success) {
        toast.success(`Refresh complete: ${result.stats.rowsInserted} new, ${result.stats.rowsUpdated} updated`);
        queryClient.invalidateQueries({ queryKey: ["ingestion-runs"] });
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast.error(`Refresh failed: ${error.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleManualUpload = async () => {
    if (!csvData.trim()) {
      toast.error("Please paste CSV data");
      return;
    }

    setIsUploading(true);
    try {
      // Parse CSV
      const lines = csvData.trim().split("\n");
      const hasHeader = lines[0].toLowerCase().includes("date");
      const dataLines = hasHeader ? lines.slice(1) : lines;

      // Get CPI indicator
      const { data: indicator } = await supabase
        .from("indicators")
        .select("id")
        .eq("slug", "cpi-inflation-yoy")
        .single();

      if (!indicator) {
        throw new Error("CPI indicator not found. Run backfill first.");
      }

      // Get Ghana geography
      const { data: ghanaGeo } = await supabase
        .from("geographies")
        .select("id")
        .eq("code", "GH")
        .single();

      if (!ghanaGeo) throw new Error("Ghana geography not found");

      // Get or create series
      let { data: series } = await supabase
        .from("data_series")
        .select("id")
        .eq("indicator_id", indicator.id)
        .eq("geography_id", ghanaGeo.id)
        .eq("is_primary", true)
        .single();

      if (!series) {
        const { data: newSeries, error: seriesError } = await supabase
          .from("data_series")
          .insert({
            indicator_id: indicator.id,
            geography_id: ghanaGeo.id,
            is_primary: true,
            breakdown_type: "national",
          })
          .select()
          .single();
        if (seriesError) throw seriesError;
        series = newSeries;
      }

      // Parse data points
      const dataPoints = dataLines.map((line) => {
        const [dateStr, valueStr] = line.split(",").map((s) => s.trim());
        // Normalize date to YYYY-MM-01
        let normalizedDate = dateStr;
        if (dateStr.match(/^\d{4}-\d{2}$/)) {
          normalizedDate = `${dateStr}-01`;
        }
        return {
          series_id: series!.id,
          date: normalizedDate,
          value: parseFloat(valueStr),
          source_id: selectedSource || null,
          revision_note: "Manual upload fallback",
        };
      }).filter((dp) => !isNaN(dp.value) && dp.date);

      if (dataPoints.length === 0) throw new Error("No valid data points");

      // Create ingestion run
      await supabase.from("ingestion_runs").insert({
        indicator_slug: "cpi-inflation-yoy",
        run_type: "manual",
        status: "success",
        rows_inserted: dataPoints.length,
        finished_at: new Date().toISOString(),
      });

      // Upsert data
      const { error: upsertError } = await supabase
        .from("data_points")
        .upsert(dataPoints, { onConflict: "series_id,date" });

      if (upsertError) throw upsertError;

      toast.success(`Uploaded ${dataPoints.length} data points`);
      setCsvData("");
      queryClient.invalidateQueries({ queryKey: ["ingestion-runs"] });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Data Pipelines</h2>

      {/* CPI Inflation Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            CPI Inflation (Year-on-Year)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Data sourced from Ghana Statistical Service StatsBank (PxWeb API).
          </p>
          
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleBackfill} disabled={isBackfilling}>
              {isBackfilling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <History className="h-4 w-4 mr-2" />}
              {isBackfilling ? "Backfilling..." : "Backfill History"}
            </Button>
            <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
              {isRefreshing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              {isRefreshing ? "Refreshing..." : "Refresh Latest"}
            </Button>
          </div>

          {/* Manual CSV Upload Fallback */}
          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium mb-2">Manual CSV Upload (Fallback)</h4>
            <p className="text-xs text-muted-foreground mb-2">
              Use this if the API is unavailable. Format: date,value (one per line)
            </p>
            <div className="space-y-2">
              <Select value={selectedSource} onValueChange={setSelectedSource}>
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue placeholder="Select source (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {sources.map((src) => (
                    <SelectItem key={src.id} value={src.id}>{src.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
                placeholder="2024-01,23.5
2024-02,22.8
2024-03,21.1"
                rows={5}
                className="font-mono text-sm"
              />
              <Button variant="secondary" onClick={handleManualUpload} disabled={isUploading || !csvData.trim()}>
                <Upload className="h-4 w-4 mr-2" />
                {isUploading ? "Uploading..." : "Upload CSV"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Ingestion Runs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Ingestion Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {runsLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : ingestionRuns && ingestionRuns.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Indicator</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rows</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingestionRuns.map((run: any) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">{run.indicator_slug}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{run.run_type}</Badge>
                    </TableCell>
                    <TableCell>
                      {run.status === "success" ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="h-4 w-4" /> Success
                        </span>
                      ) : run.status === "failed" ? (
                        <span className="flex items-center gap-1 text-destructive">
                          <XCircle className="h-4 w-4" /> Failed
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" /> Running
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {run.rows_inserted || 0} / {run.rows_updated || 0}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(run.started_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">No ingestion runs yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDataManager;
