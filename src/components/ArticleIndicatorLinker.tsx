import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { toast } from "sonner";
import { Plus, Trash2, TrendingUp, ExternalLink, Database } from "lucide-react";

interface LinkedIndicator {
  id: string;
  indicator_id: string;
  cited_value: number | null;
  cited_date: string | null;
  cited_geography_id: string | null;
  context_note: string | null;
  display_order: number;
  indicator?: {
    id: string;
    name: string;
    slug: string;
    unit: string;
  };
  geography?: {
    id: string;
    name: string;
    code: string | null;
  };
}

interface LinkedSource {
  id: string;
  source_id: string;
  citation_text: string | null;
  display_order: number;
  source?: {
    id: string;
    name: string;
    short_name: string | null;
    website_url: string | null;
  };
}

interface Props {
  articleId: string | null; // null for new articles
  onIndicatorsChange?: (indicators: LinkedIndicator[]) => void;
  onSourcesChange?: (sources: LinkedSource[]) => void;
}

export const ArticleIndicatorLinker = ({ articleId, onIndicatorsChange, onSourcesChange }: Props) => {
  const queryClient = useQueryClient();
  const [linkedIndicators, setLinkedIndicators] = useState<LinkedIndicator[]>([]);
  const [linkedSources, setLinkedSources] = useState<LinkedSource[]>([]);
  const [isIndicatorDialogOpen, setIsIndicatorDialogOpen] = useState(false);
  const [isSourceDialogOpen, setIsSourceDialogOpen] = useState(false);

  // Form state for adding indicator
  const [selectedIndicator, setSelectedIndicator] = useState("");
  const [citedValue, setCitedValue] = useState("");
  const [citedDate, setCitedDate] = useState("");
  const [selectedGeography, setSelectedGeography] = useState("");
  const [contextNote, setContextNote] = useState("");

  // Form state for adding source
  const [selectedSource, setSelectedSource] = useState("");
  const [citationText, setCitationText] = useState("");

  // Fetch available indicators
  const { data: indicators } = useQuery({
    queryKey: ["indicators-for-linking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indicators")
        .select("id, name, slug, unit, is_ghana_core")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch available sources
  const { data: sources } = useQuery({
    queryKey: ["sources-for-linking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_sources")
        .select("id, name, short_name, website_url, is_ghana_source")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch geographies (Ghana first)
  const { data: geographies } = useQuery({
    queryKey: ["geographies-for-linking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("geographies")
        .select("id, name, code, is_ghana")
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });

  // Fetch existing linked indicators for this article
  const { data: existingIndicators } = useQuery({
    queryKey: ["article-indicators", articleId],
    queryFn: async () => {
      if (!articleId) return [];
      const { data, error } = await supabase
        .from("article_indicators")
        .select(`
          id, indicator_id, cited_value, cited_date, cited_geography_id, context_note, display_order,
          indicator:indicators(id, name, slug, unit),
          geography:geographies(id, name, code)
        `)
        .eq("article_id", articleId)
        .order("display_order");
      if (error) throw error;
      return data as LinkedIndicator[];
    },
    enabled: !!articleId,
  });

  // Fetch existing linked sources for this article
  const { data: existingSources } = useQuery({
    queryKey: ["article-sources", articleId],
    queryFn: async () => {
      if (!articleId) return [];
      const { data, error } = await supabase
        .from("article_sources")
        .select(`
          id, source_id, citation_text, display_order,
          source:data_sources(id, name, short_name, website_url)
        `)
        .eq("article_id", articleId)
        .order("display_order");
      if (error) throw error;
      return data as LinkedSource[];
    },
    enabled: !!articleId,
  });

  // Sync with existing data
  useEffect(() => {
    if (existingIndicators) {
      setLinkedIndicators(existingIndicators);
      onIndicatorsChange?.(existingIndicators);
    }
  }, [existingIndicators]);

  useEffect(() => {
    if (existingSources) {
      setLinkedSources(existingSources);
      onSourcesChange?.(existingSources);
    }
  }, [existingSources]);

  // Get Ghana geography as default
  const ghanaGeo = geographies?.find((g) => g.code === "GH");

  // Add indicator mutation
  const addIndicatorMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!articleId) {
        // For new articles, just add to local state
        return data;
      }
      const { data: result, error } = await supabase
        .from("article_indicators")
        .insert({
          article_id: articleId,
          indicator_id: data.indicator_id,
          cited_value: data.cited_value || null,
          cited_date: data.cited_date || null,
          cited_geography_id: data.cited_geography_id || null,
          context_note: data.context_note || null,
          display_order: linkedIndicators.length,
        })
        .select(`
          id, indicator_id, cited_value, cited_date, cited_geography_id, context_note, display_order,
          indicator:indicators(id, name, slug, unit),
          geography:geographies(id, name, code)
        `)
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      if (articleId) {
        queryClient.invalidateQueries({ queryKey: ["article-indicators", articleId] });
      } else {
        // For new articles, add to local state
        const indicator = indicators?.find((i) => i.id === selectedIndicator);
        const geography = geographies?.find((g) => g.id === selectedGeography);
        const newItem: LinkedIndicator = {
          id: `temp-${Date.now()}`,
          indicator_id: selectedIndicator,
          cited_value: citedValue ? parseFloat(citedValue) : null,
          cited_date: citedDate || null,
          cited_geography_id: selectedGeography || null,
          context_note: contextNote || null,
          display_order: linkedIndicators.length,
          indicator: indicator ? {
            id: indicator.id,
            name: indicator.name,
            slug: indicator.slug,
            unit: indicator.unit,
          } : undefined,
          geography: geography ? {
            id: geography.id,
            name: geography.name,
            code: geography.code,
          } : undefined,
        };
        const updated = [...linkedIndicators, newItem];
        setLinkedIndicators(updated);
        onIndicatorsChange?.(updated);
      }
      toast.success("Indicator linked");
      setIsIndicatorDialogOpen(false);
      resetIndicatorForm();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Remove indicator mutation
  const removeIndicatorMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!articleId || id.startsWith("temp-")) {
        return id;
      }
      const { error } = await supabase
        .from("article_indicators")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      const updated = linkedIndicators.filter((i) => i.id !== id);
      setLinkedIndicators(updated);
      onIndicatorsChange?.(updated);
      if (articleId) {
        queryClient.invalidateQueries({ queryKey: ["article-indicators", articleId] });
      }
      toast.success("Indicator removed");
    },
  });

  // Add source mutation
  const addSourceMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!articleId) {
        return data;
      }
      const { data: result, error } = await supabase
        .from("article_sources")
        .insert({
          article_id: articleId,
          source_id: data.source_id,
          citation_text: data.citation_text || null,
          display_order: linkedSources.length,
        })
        .select(`
          id, source_id, citation_text, display_order,
          source:data_sources(id, name, short_name, website_url)
        `)
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      if (articleId) {
        queryClient.invalidateQueries({ queryKey: ["article-sources", articleId] });
      } else {
        const source = sources?.find((s) => s.id === selectedSource);
        const newItem: LinkedSource = {
          id: `temp-${Date.now()}`,
          source_id: selectedSource,
          citation_text: citationText || null,
          display_order: linkedSources.length,
          source: source ? {
            id: source.id,
            name: source.name,
            short_name: source.short_name,
            website_url: source.website_url,
          } : undefined,
        };
        const updated = [...linkedSources, newItem];
        setLinkedSources(updated);
        onSourcesChange?.(updated);
      }
      toast.success("Source linked");
      setIsSourceDialogOpen(false);
      resetSourceForm();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Remove source mutation
  const removeSourceMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!articleId || id.startsWith("temp-")) {
        return id;
      }
      const { error } = await supabase
        .from("article_sources")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      const updated = linkedSources.filter((s) => s.id !== id);
      setLinkedSources(updated);
      onSourcesChange?.(updated);
      if (articleId) {
        queryClient.invalidateQueries({ queryKey: ["article-sources", articleId] });
      }
      toast.success("Source removed");
    },
  });

  const resetIndicatorForm = () => {
    setSelectedIndicator("");
    setCitedValue("");
    setCitedDate("");
    setSelectedGeography(ghanaGeo?.id || "");
    setContextNote("");
  };

  const resetSourceForm = () => {
    setSelectedSource("");
    setCitationText("");
  };

  const handleAddIndicator = () => {
    if (!selectedIndicator) {
      toast.error("Please select an indicator");
      return;
    }
    addIndicatorMutation.mutate({
      indicator_id: selectedIndicator,
      cited_value: citedValue ? parseFloat(citedValue) : null,
      cited_date: citedDate || null,
      cited_geography_id: selectedGeography || null,
      context_note: contextNote || null,
    });
  };

  const handleAddSource = () => {
    if (!selectedSource) {
      toast.error("Please select a source");
      return;
    }
    addSourceMutation.mutate({
      source_id: selectedSource,
      citation_text: citationText || null,
    });
  };

  // Set default geography to Ghana when dialog opens
  useEffect(() => {
    if (isIndicatorDialogOpen && ghanaGeo && !selectedGeography) {
      setSelectedGeography(ghanaGeo.id);
    }
  }, [isIndicatorDialogOpen, ghanaGeo]);

  return (
    <div className="space-y-4">
      {/* Linked Indicators Section */}
      <div className="p-4 border border-border rounded-md space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Linked Indicators
          </h3>
          <Dialog open={isIndicatorDialogOpen} onOpenChange={setIsIndicatorDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Link Indicator to Article</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <label className="text-sm font-medium">Indicator *</label>
                  <Select value={selectedIndicator} onValueChange={setSelectedIndicator}>
                    <SelectTrigger>
                      <SelectValue placeholder="Search and select indicator" />
                    </SelectTrigger>
                    <SelectContent>
                      {indicators?.map((ind) => (
                        <SelectItem key={ind.id} value={ind.id}>
                          <div className="flex items-center gap-2">
                            {ind.name}
                            {ind.is_ghana_core && (
                              <Badge variant="secondary" className="text-xs">Ghana</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-4 grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Cited Value</label>
                    <Input
                      type="number"
                      step="any"
                      value={citedValue}
                      onChange={(e) => setCitedValue(e.target.value)}
                      placeholder="e.g., 23.5"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Cited Date</label>
                    <Input
                      type="date"
                      value={citedDate}
                      onChange={(e) => setCitedDate(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Geography</label>
                  <Select value={selectedGeography} onValueChange={setSelectedGeography}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select geography (default: Ghana)" />
                    </SelectTrigger>
                    <SelectContent>
                      {geographies?.map((geo) => (
                        <SelectItem key={geo.id} value={geo.id}>
                          {geo.name} {geo.is_ghana && "(Ghana)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Context Note</label>
                  <Input
                    value={contextNote}
                    onChange={(e) => setContextNote(e.target.value)}
                    placeholder="e.g., Year-on-year change"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setIsIndicatorDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddIndicator} disabled={addIndicatorMutation.isPending}>
                    {addIndicatorMutation.isPending ? "Adding..." : "Link Indicator"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {linkedIndicators.length > 0 ? (
          <div className="space-y-2">
            {linkedIndicators.map((item) => (
              <div 
                key={item.id} 
                className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.indicator?.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {item.cited_value !== null && (
                      <span className="font-mono">
                        {item.cited_value} {item.indicator?.unit}
                      </span>
                    )}
                    {item.cited_date && (
                      <span>• {new Date(item.cited_date).toLocaleDateString()}</span>
                    )}
                    {item.geography && (
                      <span>• {item.geography.name}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => window.open(`/data/${item.indicator?.slug}`, "_blank")}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => removeIndicatorMutation.mutate(item.id)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No indicators linked. Add Ghana data citations for transparency.
          </p>
        )}
      </div>

      {/* Linked Sources Section */}
      <div className="p-4 border border-border rounded-md space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Database className="h-4 w-4" />
            Data Sources
          </h3>
          <Dialog open={isSourceDialogOpen} onOpenChange={setIsSourceDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Link Data Source</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <label className="text-sm font-medium">Source *</label>
                  <Select value={selectedSource} onValueChange={setSelectedSource}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select data source" />
                    </SelectTrigger>
                    <SelectContent>
                      {sources?.map((src) => (
                        <SelectItem key={src.id} value={src.id}>
                          <div className="flex items-center gap-2">
                            {src.name}
                            {src.short_name && (
                              <span className="text-muted-foreground">({src.short_name})</span>
                            )}
                            {src.is_ghana_source && (
                              <Badge variant="secondary" className="text-xs">Ghana</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Citation Note</label>
                  <Input
                    value={citationText}
                    onChange={(e) => setCitationText(e.target.value)}
                    placeholder="e.g., CPI Bulletin, January 2025"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setIsSourceDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddSource} disabled={addSourceMutation.isPending}>
                    {addSourceMutation.isPending ? "Adding..." : "Link Source"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {linkedSources.length > 0 ? (
          <div className="space-y-2">
            {linkedSources.map((item) => (
              <div 
                key={item.id} 
                className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {item.source?.name}
                    {item.source?.short_name && (
                      <span className="text-muted-foreground ml-1">
                        ({item.source.short_name})
                      </span>
                    )}
                  </p>
                  {item.citation_text && (
                    <p className="text-xs text-muted-foreground">{item.citation_text}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {item.source?.website_url && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => window.open(item.source?.website_url!, "_blank")}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => removeSourceMutation.mutate(item.id)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No sources linked. Cite Ghana data sources (GSS, BoG, MoF, etc.).
          </p>
        )}
      </div>
    </div>
  );
};
