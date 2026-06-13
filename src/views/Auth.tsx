"use client";
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { logAuditEvent } from "@/lib/audit";
import statsghLogo from "@/assets/statsgh-logo.png";
import { usePageMeta } from "@/hooks/usePageMeta";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const [isLogin, setIsLogin] = useState(!inviteToken);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  usePageMeta({ robots: "noindex, nofollow" });

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

  const { data: userRole } = useQuery({
    queryKey: ["userRole", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .maybeSingle();
      return data?.role || null;
    },
    enabled: !!session?.user?.id,
  });

  useEffect(() => {
    if (session && userRole) {
      // Redirect based on role
      if (userRole === "admin" || userRole === "editor") {
        navigate("/dashboard");
      } else {
        navigate("/");
      }
    }
  }, [session, userRole, navigate]);

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

          // Check user role and redirect accordingly
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", data.user.id)
            .maybeSingle();

          toast.success("Logged in successfully!");
          
          if (roleData?.role === "admin" || roleData?.role === "editor") {
            navigate("/dashboard");
          } else {
            navigate("/");
          }
        }
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
          
          // Redirect based on assigned role
          if (invitation.role === "admin" || invitation.role === "editor") {
            navigate("/dashboard");
          } else {
            navigate("/");
          }
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
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-2">
            <img src={statsghLogo.src} alt="StatsGH" className="h-10 sm:h-12" />
            <span className="font-serif text-2xl sm:text-3xl md:text-4xl font-semibold">StatsGH</span>
          </div>
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
