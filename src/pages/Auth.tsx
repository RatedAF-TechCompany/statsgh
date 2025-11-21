import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { logAuditEvent } from "@/lib/audit";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const [isLogin, setIsLogin] = useState(!inviteToken);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Fetch invitation details if token is present
  const { data: invitation } = useQuery({
    queryKey: ["invitation", inviteToken],
    queryFn: async () => {
      if (!inviteToken) return null;
      const { data } = await supabase
        .from("user_invitations")
        .select("*")
        .eq("invite_token", inviteToken)
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      return data;
    },
    enabled: !!inviteToken,
  });

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  useEffect(() => {
    if (invitation) {
      setEmail(invitation.email);
      setFullName(invitation.full_name);
    }
  }, [invitation]);

  useEffect(() => {
    if (session) {
      navigate("/");
    }
  }, [session, navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // Update last login
        if (data.user) {
          await supabase
            .from("profiles")
            .update({ last_login_at: new Date().toISOString() })
            .eq("id", data.user.id);

          await logAuditEvent({
            actionType: "LOGIN",
            description: "User logged in",
          });
        }

        toast.success("Logged in successfully!");
        navigate("/");
      } else if (invitation) {
        // Accept invitation and create account
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              full_name: fullName,
            },
          },
        });

        if (error) throw error;

        if (data.user) {
          // Update profile
          await supabase
            .from("profiles")
            .update({ full_name: fullName })
            .eq("id", data.user.id);

          // Assign role
          await supabase.from("user_roles").insert({
            user_id: data.user.id,
            role: invitation.role,
          });

          // Mark invitation as accepted
          await supabase
            .from("user_invitations")
            .update({ accepted_at: new Date().toISOString() })
            .eq("id", invitation.id);

          await logAuditEvent({
            actionType: "INVITE_ACCEPTED",
            targetType: "invitation",
            targetId: invitation.id,
            description: `${fullName} accepted invitation and created account`,
          });

          await logAuditEvent({
            actionType: "USER_CREATED",
            targetType: "user",
            targetId: data.user.id,
            description: `User account created via invitation: ${fullName} (${email})`,
          });

          toast.success("Account created successfully!");
          navigate("/");
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) throw error;

        toast.success("Check your email to confirm your account!");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-serif text-4xl font-semibold mb-2">StatsGH</h1>
          <p className="text-muted-foreground">
            {invitation
              ? `Accept Invitation - ${invitation.role}`
              : isLogin
              ? "Welcome back"
              : "Create your account"}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {invitation && (
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={!!invitation}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={invitation ? "Set your password" : "••••••••"}
              required
              minLength={6}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? "Please wait..."
              : invitation
              ? "Accept & Create Account"
              : isLogin
              ? "Log In"
              : "Sign Up"}
          </Button>
        </form>

        {!invitation && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-accent hover:underline"
            >
              {isLogin
                ? "Don't have an account? Sign up"
                : "Already have an account? Log in"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Auth;
