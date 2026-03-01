"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { useState } from "react";
import { setAuthToken } from "@/lib/auth";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");

    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_BRAND_MONITOR_URL || "http://localhost:4001";
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, pwd: password }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.token) {
        throw new Error(data?.error?.message || data?.error || "Invalid credentials.");
      }

      setAuthToken(data.token);
      window.location.href = "/dashboard";
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#FFE9D5,transparent_55%)]" />
      <div className="pointer-events-none absolute -left-24 top-12 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 translate-x-1/4 rounded-full bg-chart-2/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-stretch px-6 py-12 lg:py-16">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col gap-6">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              CogNerd Studio
            </div>
            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
              Welcome back. Track your AI visibility in minutes.
            </h1>
            <p className="text-sm text-muted-foreground">
              Sign in to monitor brand mentions, citations, and sentiment across ChatGPT, Gemini, Perplexity, and more.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  title: "Real-time monitoring",
                  body: "Live sentiment shifts and competitor alerts.",
                  icon: <Zap className="h-4 w-4" />,
                },
                {
                  title: "Secure sessions",
                  body: "Enterprise-grade protection by default.",
                  icon: <ShieldCheck className="h-4 w-4" />,
                },
              ].map((item) => (
                <div key={item.title} className="card-hover rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {item.icon}
                    </span>
                    {item.title}
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">{item.body}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              New here?{" "}
              <Link className="font-semibold text-foreground hover:text-primary" href="/signup">
                Create an account
              </Link>
            </div>
          </div>

          <div className="card-hover w-full rounded-2xl border border-border bg-card/90 p-6 shadow-sm backdrop-blur sm:p-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Sign in</h2>
                <p className="text-xs text-muted-foreground">Use your work email to continue.</p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold text-primary">
                Secure
              </span>
            </div>

            <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
              <label className="flex flex-col gap-2 text-xs font-medium text-foreground">
                Email address
                <input
                  type="email"
                  name="email"
                  placeholder="you@company.com"
                  className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
              </label>

              <label className="flex flex-col gap-2 text-xs font-medium text-foreground">
                Password
                <input
                  type="password"
                  name="password"
                  placeholder="********"
                  className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
              </label>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="h-4 w-4 rounded border-border" />
                  Remember me
                </label>
                <button type="button" className="font-semibold text-foreground hover:text-primary">
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Signing in..." : "Continue"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            {error && (
              <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            <div className="mt-6 border-t border-border/60 pt-4 text-center text-[11px] text-muted-foreground">
              By continuing you agree to the Terms and Privacy Policy.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
