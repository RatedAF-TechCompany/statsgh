import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'sonner';
import { Upload, X } from 'lucide-react';

interface ImageUploaderProps {
  onUploadComplete: (url: string) => void;
  currentImage?: string;
  onRemove?: () => void;
}

export const ImageUploader = ({ onUploadComplete, currentImage, onRemove }: ImageUploaderProps) => {
  const [uploading, setUploading] = useState(false);

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

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      // Save to media table
      const { data: session } = await supabase.auth.getSession();
      await supabase.from('media').insert({
        filename: file.name,
        url: data.publicUrl,
        size: file.size,
        mime_type: file.type,
        uploaded_by: session.session?.user.id,
      });

      onUploadComplete(data.publicUrl);
      toast.success('Image uploaded successfully');
    } catch (error: any) {
      toast.error('Error uploading image: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {currentImage && (
        <div className="relative">
          <img
            src={currentImage}
            alt="Preview"
            className="w-full max-h-[300px] object-cover rounded-md"
          />
          {onRemove && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2"
              onClick={onRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input
          type="file"
          accept="image/*"
          onChange={handleUpload}
          disabled={uploading}
          className="flex-1"
        />
        <Button type="button" disabled={uploading} variant="secondary">
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? 'Uploading...' : 'Upload'}
        </Button>
      </div>
    </div>
  );
};