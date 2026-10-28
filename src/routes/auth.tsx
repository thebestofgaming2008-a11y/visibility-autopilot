import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — OmniVisibility Autopilot" },
      { name: "description", content: "Sign in to your agency visibility command center." },
      { property: "og:title", content: "Sign in — OmniVisibility Autopilot" },
      { property: "og:description", content: "Sign in to your agency visibility command center." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up" | "request_reset" | "recover">("in");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (
      window.location.hash.includes("type=recovery") ||
      new URLSearchParams(window.location.search).get("type") === "recovery"
    )
      setMode("recover");
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("recover");
    });
    return () => data.subscription.unsubscribe();
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "request_reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        setMsg(error ? error.message : "Check your email for a password reset link.");
      } else if (mode === "recover") {
        const { error } = await supabase.auth.updateUser({ password: pw });
        if (error) setMsg(error.message);
        else {
          setMsg("Password updated. You can now use this password to sign in.");
          setMode("in");
          setPw("");
        }
      } else if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) setMsg(error.message);
        else nav({ to: "/overview" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: pw,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) setMsg(error.message);
        else if (data.session) nav({ to: "/overview" });
        else setMsg("Check your email to confirm your account.");
      }
    } catch (error) {
      setMsg((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="min-h-screen grid place-items-center bg-background px-4">
      <div className="w-full max-w-sm border bg-card rounded-lg p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-6 w-6 rounded bg-teal" />
          <span className="font-semibold">OmniVisibility Autopilot</span>
        </div>
        <h1 className="text-lg font-semibold mb-4">
          {mode === "in"
            ? "Sign in"
            : mode === "up"
              ? "Create account"
              : mode === "request_reset"
                ? "Reset password"
                : "Set new password"}
        </h1>
        <form onSubmit={submit} className="space-y-3">
          {mode !== "recover" && (
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          )}
          {mode !== "request_reset" && (
            <div>
              <Label htmlFor="pw">Password</Label>
              <Input
                id="pw"
                type="password"
                minLength={8}
                required
                value={pw}
                onChange={(e) => setPw(e.target.value)}
              />
            </div>
          )}
          {msg && (
            <p role="status" className="text-sm text-muted-foreground">
              {msg}
            </p>
          )}
          <Button className="w-full" disabled={busy}>
            {busy
              ? "…"
              : mode === "in"
                ? "Sign in"
                : mode === "up"
                  ? "Sign up"
                  : mode === "request_reset"
                    ? "Send reset link"
                    : "Save new password"}
          </Button>
        </form>
        {(mode === "in" || mode === "up") && (
          <Button
            variant="outline"
            className="w-full mt-3"
            onClick={async () => {
              const r = await lovable.auth.signInWithOAuth("google", {
                redirect_uri: window.location.origin,
              });
              if (r.error) setMsg(String(r.error.message ?? r.error));
              else if (!r.redirected) nav({ to: "/overview" });
            }}
          >
            Continue with Google
          </Button>
        )}
        {mode === "in" && (
          <button
            className="mt-4 block text-sm text-accent-foreground underline"
            onClick={() => {
              setMode("request_reset");
              setMsg(null);
            }}
          >
            Forgot password?
          </button>
        )}
        {mode !== "recover" && (
          <button
            className="mt-4 text-sm text-accent-foreground underline"
            onClick={() => {
              setMode(mode === "in" ? "up" : "in");
              setMsg(null);
            }}
          >
            {mode === "in" ? "No account? Sign up" : "Back to sign in"}
          </button>
        )}
      </div>
    </main>
  );
}
