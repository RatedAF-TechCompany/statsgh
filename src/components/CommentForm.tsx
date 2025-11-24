import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CommentFormProps {
  articleId: string;
  onCommentSubmitted: () => void;
}

export const CommentForm = ({ articleId, onCommentSubmitted }: CommentFormProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!body.trim() || !email.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (body.length > 1000) {
      toast.error("Comment must be less than 1000 characters");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("submit-comment", {
        body: {
          articleId,
          name: name.trim() || "Anonymous",
          email: email.trim(),
          body: body.trim(),
        },
      });

      if (error) throw error;

      toast.success("Comment submitted! Please check your email to verify.");
      setName("");
      setEmail("");
      setBody("");
      onCommentSubmitted();
    } catch (error: any) {
      console.error("Error submitting comment:", error);
      toast.error(error.message || "Failed to submit comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border-t border-border pt-6">
      <h3 className="font-serif text-xl font-bold">Leave a Comment</h3>
      
      <div className="space-y-2">
        <Label htmlFor="name">Name (optional)</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={100}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">
          Email <span className="text-destructive">*</span>
        </Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          maxLength={255}
        />
        <p className="text-xs text-muted-foreground">
          Your email will not be published. We'll send you a verification link.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="body">
          Comment <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share your thoughts..."
          required
          maxLength={1000}
          className="min-h-[120px]"
        />
        <p className="text-xs text-muted-foreground text-right">
          {body.length}/1000
        </p>
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Submitting..." : "Submit Comment"}
      </Button>
    </form>
  );
};