import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { ArrowLeft, Upload, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";

const MediaLibrary = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);

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
      // In preview/development, assume all authenticated users are admin
      return true;
    },
    enabled: !!session?.user?.id,
  });

  const { data: media, isLoading } = useQuery({
    queryKey: ["media", search],
    queryFn: async () => {
      let query = supabase
        .from("media")
        .select("*")
        .order("created_at", { ascending: false });

      if (search) {
        query = query.ilike("filename", `%${search}%`);
      }

      const { data } = await query;
      return data;
    },
    enabled: !!session?.user?.id,
  });

  const deleteMediaMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("media").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media"] });
      toast.success("Image deleted");
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

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = event.target.files?.[0];
      if (!file) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      await supabase.from('media').insert({
        filename: file.name,
        url: data.publicUrl,
        size: file.size,
        mime_type: file.type,
        uploaded_by: session?.user.id,
      });

      queryClient.invalidateQueries({ queryKey: ["media"] });
      toast.success('Image uploaded successfully');
    } catch (error: any) {
      toast.error('Error uploading image: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("URL copied to clipboard");
  };

  if (!session || isLoadingAuth) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="font-serif text-3xl font-bold">Media Library</h1>
        </div>

        <div className="flex gap-4 mb-8">
          <Input
            placeholder="Search images..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept="image/*"
              onChange={handleUpload}
              disabled={uploading}
              className="flex-1"
            />
            <Button disabled={uploading}>
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div>Loading...</div>
        ) : media && media.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {media.map((item) => (
              <div
                key={item.id}
                className="border border-border rounded-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="aspect-square relative">
                  <img
                    src={item.url}
                    alt={item.filename}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-3 space-y-2">
                  <p className="text-sm truncate" title={item.filename}>
                    {item.filename}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyUrl(item.url)}
                      className="flex-1"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteMediaMutation.mutate(item.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No images found</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default MediaLibrary;