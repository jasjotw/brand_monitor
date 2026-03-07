"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles, UserPlus } from "lucide-react";
import { useState } from "react";
import { setAuthToken } from "@/lib/auth";

export default function SignupPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "");
    const email = String(formData.get("email") || "");
    const phone = String(formData.get("phone") || "");
    const password = String(formData.get("password") || "");
    const confirm = String(formData.get("confirm") || "");
    const brandingMode = String(formData.get("brandingMode") || "");

    if (password !== confirm) {
      setLoading(false);
      setError("Passwords do not match.");
      return;
    }

    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_BRAND_MONITOR_URL || "http://localhost:4001";
      const response = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          pwd: password,
          brandingMode: brandingMode || undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error?.message || data?.error || "Sign up failed.");
      }

      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, pwd: password }),
      });
      const loginData = await loginRes.json().catch(() => ({}));
      if (!loginRes.ok || !loginData?.token) {
        throw new Error("Account created, but auto-login failed. Please sign in.");
      }

      setAuthToken(loginData.token);
      setSuccess("Account created. Redirecting...");
      window.location.href = "/dashboard";
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign up failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#FFE9D5,transparent_55%)]" />
      <div className="pointer-events-none absolute -right-24 top-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-80 w-80 -translate-x-1/4 rounded-full bg-chart-3/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-stretch px-6 py-12 lg:py-16">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="card-hover w-full rounded-2xl border border-border bg-card/90 p-6 shadow-sm backdrop-blur sm:p-8 lg:order-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Create your account</h2>
                <p className="text-xs text-muted-foreground">Start tracking your AI visibility today.</p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold text-primary">
                Free trial
              </span>
            </div>

            <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-xs font-medium text-foreground">
                  Full name
                  <input
                    type="text"
                    name="name"
                    placeholder="Alex Morgan"
                    className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  />
                </label>
                <label className="flex flex-col gap-2 text-xs font-medium text-foreground">
                  Company
                  <input
                    type="text"
                    name="company"
                    placeholder="CogNerd"
                    className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-2 text-xs font-medium text-foreground">
                Work email
                <input
                  type="email"
                  name="email"
                  placeholder="you@company.com"
                  className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-xs font-medium text-foreground">
                  Password
                  <input
                    type="password"
                    name="password"
                    placeholder="Create a password"
                    className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  />
                </label>
                <label className="flex flex-col gap-2 text-xs font-medium text-foreground">
                  Confirm
                  <input
                    type="password"
                    name="confirm"
                    placeholder="Repeat password"
                    className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-2 text-xs font-medium text-foreground">
                Phone number
                <input
                  type="tel"
                  name="phone"
                  placeholder="+1 (555) 000-0000"
                  className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
              </label>

              <fieldset className="flex flex-col gap-3 rounded-xl border border-border bg-secondary/60 p-4">
                <legend className="text-xs font-semibold text-foreground">Branding mode</legend>
                <label className="flex items-center gap-3 text-xs text-foreground">
                  <input
                    type="radio"
                    name="brandingMode"
                    value="whitelabel"
                    className="h-4 w-4 border-border text-primary"
                    defaultChecked
                  />
                  Whitelabel
                </label>
                <label className="flex items-center gap-3 text-xs text-foreground">
                  <input
                    type="radio"
                    name="brandingMode"
                    value="self-brand"
                    className="h-4 w-4 border-border text-primary"
                  />
                  Self brand
                </label>
              </fieldset>

              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" className="h-4 w-4 rounded border-border" />
                I agree to the Terms and Privacy Policy.
              </label>

              <button
                type="submit"
                disabled={loading}
                className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Creating..." : "Create account"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            {(error || success) && (
              <div
                className={`mt-4 rounded-lg border px-3 py-2 text-xs ${
                  error
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-success/40 bg-success/10 text-success"
                }`}
              >
                {error || success}
              </div>
            )}

            <div className="mt-6 border-t border-border/60 pt-4 text-center text-[11px] text-muted-foreground">
              Already have an account?{" "}
              <Link className="font-semibold text-foreground hover:text-primary" href="/login">
                Sign in
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-6 lg:order-1">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              AEO Visibility
            </div>
            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
              Build an AI-native brand presence before your competitors do.
            </h1>
            <p className="text-sm text-muted-foreground">
              CogNerd turns AI responses into actionable insights with visibility scoring, prompt analytics, and competitive baselines.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                "Track sentiment across AI engines",
                "Surface citation sources instantly",
                "Pinpoint high-impact prompts",
                "Share insights with your team",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-xl border border-border bg-card p-4 text-xs font-medium text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  {item}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <UserPlus className="h-4 w-4 text-primary" />
              Prefer a demo?{" "}
              <button type="button" className="font-semibold text-foreground hover:text-primary">
                Talk to sales
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              Average teams see a 32% lift in AI citation share within 30 days.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
