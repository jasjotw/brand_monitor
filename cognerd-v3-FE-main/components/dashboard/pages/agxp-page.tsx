"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  connectCloudflare,
  getZones,
  createDeployment,
  getDeployments,
  deleteDeployment,
  getAnalytics,
  createVariant,
  autoGenerateVariant,
} from "@/lib/services/agxp-api";
import { cn } from "@/lib/utils";
import { MetricCard } from "../metric-card";
import { Cloud, Zap, CheckCircle2, Server, Activity, Bot, AlertCircle, RefreshCw, Sparkles, Info, Plus, ChevronRight, LayoutTemplate, Trash2 } from "lucide-react";

const normalizeSourceUrl = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  let normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const match = normalized.match(/^(https?:\/\/)(.*)$/i);
  if (match) {
    const [, protocol, rest] = match;
    normalized = rest.toLowerCase().startsWith("www.") ? normalized : `${protocol}www.${rest}`;
  }
  return normalized;
};

const normalizeVariantPath = (raw: string) => {
  let path = raw.trim();
  if (!path) return "/";
  if (/^https?:\/\//i.test(path)) {
    try {
      const url = new URL(path);
      path = url.pathname + url.search + url.hash;
    } catch {
      path = path.replace(/^https?:\/\//i, "");
    }
  }
  if (!path.startsWith("/") && /[.]/.test(path.split("/")[0])) {
    const firstSlash = path.indexOf("/");
    path = firstSlash === -1 ? "" : path.slice(firstSlash);
  }
  if (!path.startsWith("/")) path = `/${path}`;
  return path || "/";
};

// Reusable basic UI components with premium interactions
const Button = ({
  className,
  variant = "default",
  size = "default",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "outline" | "ghost" | "premium", size?: "sm" | "default" | "lg" | "icon" }) => {
  const isPremium = variant === "premium";
  
  return (
    <button
      className={cn(
        "relative inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] overflow-hidden",
        {
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow": variant === "default",
          "border border-border/80 bg-background/50 backdrop-blur-sm shadow-sm hover:bg-accent hover:text-accent-foreground hover:border-border": variant === "outline",
          "hover:bg-accent hover:text-accent-foreground": variant === "ghost",
          "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md hover:shadow-lg hover:shadow-primary/20 hover:opacity-95 border border-primary/20": variant === "premium",
          "h-9 px-4 py-2": size === "default",
          "h-8 rounded-md px-3 text-xs": size === "sm",
          "h-10 rounded-md px-8": size === "lg",
          "h-9 w-9": size === "icon",
        },
        className
      )}
      {...props}
    >
      {isPremium && (
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent hover-shimmer animate-[shimmer_2s_infinite]" />
      )}
      <span className="relative z-10 flex items-center justify-center">{children}</span>
    </button>
  );
};

const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={cn(
      "flex h-9 w-full rounded-lg border border-border/60 bg-background/50 backdrop-blur-sm px-3 py-1 text-sm shadow-inner transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary hover:border-border disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
);



export function AgxpPage() {
  const [token, setToken] = useState("");
  const [zones, setZones] = useState<any[]>([]);
  const [deployments, setDeployments] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const [selectedZone, setSelectedZone] = useState("");
  const [siteId, setSiteId] = useState("");
  const [showDeployForm, setShowDeployForm] = useState(false);
  const [notification, setNotification] = useState("");
  const [expandedDeploymentId, setExpandedDeploymentId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deploymentToDelete, setDeploymentToDelete] = useState<any | null>(null);

  // Variant creation state
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [variantPath, setVariantPath] = useState("");
  const [variantContent, setVariantContent] = useState("");
  const [autoMode, setAutoMode] = useState<"manual" | "auto">("manual");
  const [sourceUrl, setSourceUrl] = useState("");
  const [instructions, setInstructions] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedPreview, setGeneratedPreview] = useState<{ path: string; content: string; variantId?: number } | null>(null);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { zones } = await getZones();
        if (zones && zones.length > 0) {
          setZones(zones);
          setIsConnected(true);
          loadDeployments();
        } else {
          setIsConnected(false);
        }
      } catch (err) {
        setIsConnected(false);
      }
    };
    checkConnection();
  }, []);

  const loadDeployments = async () => {
    try {
      const { deployments } = await getDeployments();
      const validDeployments = deployments?.length > 0 ? deployments : [];
      setDeployments(validDeployments);
      
      if (validDeployments.length > 0) {
        try {
          const analyticsPromises = validDeployments.map((d: any) => getAnalytics(d.id).catch(() => null));
          const analyticsResults = await Promise.all(analyticsPromises);

          const aggregated = {
            totalRequests: 0,
            variantsServed: 0,
            botTypes: {} as Record<string, number>,
            topPathsMap: {} as Record<string, number>,
            topPaths: [] as any[],
          };

          analyticsResults.forEach(res => {
            if (!res) return;
            aggregated.totalRequests += (res.totalRequests || 0);
            aggregated.variantsServed += (res.variantsServed || 0);

            if (res.botTypes) {
              Object.entries(res.botTypes).forEach(([bot, count]) => {
                aggregated.botTypes[bot] = (aggregated.botTypes[bot] || 0) + (count as number);
              });
            }

            if (res.topPaths) {
              res.topPaths.forEach((tp: any) => {
                aggregated.topPathsMap[tp.path] = (aggregated.topPathsMap[tp.path] || 0) + tp.count;
              });
            }
          });

          aggregated.topPaths = Object.entries(aggregated.topPathsMap)
            .map(([path, count]) => ({ path, count }))
            .sort((a, b) => (b.count as number) - (a.count as number))
            .slice(0, 5);

          setAnalytics(aggregated);
        } catch (err) {
          console.error("Failed to fetch analytics", err);
          setAnalytics(null);
        }
      } else {
        setAnalytics(null);
      }
    } catch {
      setDeployments([]);
      setAnalytics(null);
    }
  };

  const handleConnect = async () => {
    if (!token) return;
    try {
      const connectResult = await connectCloudflare(token);
      
      // If the backend returns an error (like { success: false, error: '...' })
      if (!connectResult || connectResult.success === false) {
        throw new Error(connectResult?.error || "Failed to connect to Cloudflare");
      }

      const { zones } = await getZones();
      setZones(zones?.length > 0 ? zones : []);
      setIsConnected(true);
      loadDeployments();
      setNotification("Connected to Cloudflare!");
      setTimeout(() => setNotification(""), 3000);
    } catch (err: any) {
      console.error(err);
      setNotification(err.message || "Failed to connect to Cloudflare");
      setTimeout(() => setNotification(""), 3000);
      setIsConnected(false);
    }
  };

  const handleDeploy = async () => {
    const zoneName = zones.find((z) => z.id === selectedZone)?.name;
    if (!zoneName || !siteId) return;
    try {
      await createDeployment(selectedZone, zoneName, siteId);
      setNotification("Successfully deployed worker!");
      setTimeout(() => setNotification(""), 3000);
      loadDeployments();
      setShowDeployForm(false);
      setSiteId("");
      setSelectedZone("");
    } catch (err: any) {
      console.error(err);
      setNotification("Deployment failed!");
      setTimeout(() => setNotification(""), 3000);
    }
  };

  const confirmDeleteDeployment = (e: React.MouseEvent, deployment: any) => {
    e.stopPropagation();
    setDeploymentToDelete(deployment);
  };

  const executeDeleteDeployment = async () => {
    if (!deploymentToDelete) return;
    
    setDeletingId(deploymentToDelete.id);
    try {
      await deleteDeployment(deploymentToDelete.id);
      setNotification("Deployment deleted and cleaned up!");
      setTimeout(() => setNotification(""), 3000);
      
      // Optimistically remove the deployment from the state
      setDeployments(prev => prev.filter(d => d.id !== deploymentToDelete.id));
      
      if (expandedDeploymentId === deploymentToDelete.id) {
        setExpandedDeploymentId(null);
      }
      
      // We purposefully do not await `getDeployments` immediately 
      // here because D1 replication takes ~50ms. We just let the optimistic update stand.
      setTimeout(() => {
        loadDeployments(); 
      }, 500);

    } catch (err: any) {
      console.error(err);
      setNotification(err.message || "Failed to delete deployment");
      // If it failed, revert the optimistic update by reloading real data
      loadDeployments();
    } finally {
      setDeletingId(null);
      setDeploymentToDelete(null);
    }
  };

  const handleCreateVariant = async () => {
    if (!expandedDeploymentId || !variantPath) return;
    const normalizedPath = normalizeVariantPath(variantPath);
    setVariantPath(normalizedPath);
    setIsSubmitting(true);
    try {
      if (autoMode === "manual") {
        if (!variantContent) return setIsSubmitting(false);
        await createVariant(expandedDeploymentId, normalizedPath, variantContent);
        setNotification("Variant created successfully!");
        setTimeout(() => setNotification(""), 3000);
        setShowVariantForm(false);
        setVariantPath("");
        setVariantContent("");
        setSourceUrl("");
        setInstructions("");
      } else {
        if (!sourceUrl) return setIsSubmitting(false);
        const normalizedSourceUrl = normalizeSourceUrl(sourceUrl);
        setSourceUrl(normalizedSourceUrl);
        const result = await autoGenerateVariant(
          expandedDeploymentId,
          normalizedPath,
          normalizedSourceUrl,
          instructions || undefined
        );
        if (!result.success) {
          console.error("Auto generation failed:", result.error);
          setNotification("Variant auto-generation failed.");
          setTimeout(() => setNotification(""), 3000);
          return;
        }
        setGeneratedPreview({ path: variantPath, content: result.contentPreview || "Preview unavailable", variantId: result.variantId });
        setNotification("Variant auto-generated! Review preview below.");
        setTimeout(() => setNotification(""), 3000);
      }
    } catch (err: any) {
      console.error(err);
      setNotification("Action failed! Check console.");
      setTimeout(() => setNotification(""), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stagger variants for initial load
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col gap-6 relative min-h-[80vh] items-center justify-center">
        <AnimatePresence>
          {notification && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-4 right-4 z-50 rounded-lg bg-primary/95 backdrop-blur-md px-4 py-3 text-sm font-medium text-primary-foreground shadow-2xl flex items-center gap-2 border border-primary/50"
            >
              <CheckCircle2 size={16} />
              <span>{notification}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-10 shadow-xl shadow-black/5 max-w-2xl mx-auto w-full relative overflow-hidden"
        >
          {/* Subtle background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-48 bg-primary/10 blur-[80px] pointer-events-none rounded-full" />
          
          <div className="mb-8 text-center relative z-10">
            <motion.div 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 mb-5 shadow-inner border border-primary/10"
            >
              <Cloud className="text-primary h-8 w-8 drop-shadow-sm" />
            </motion.div>
            <h2 className="text-2xl font-bold text-foreground tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/70">Connect Cloudflare</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
              Link your Cloudflare account to enable Edge Delivery. Serve hyper-fast, AI-optimized page variants directly at the edge.
            </p>
          </div>

          <div className="space-y-6 relative z-10">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground ml-1">API Token</label>
              <Input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter your Cloudflare API token..."
                type="password"
                className="h-12 shadow-inner bg-background/50 text-base px-4"
              />
              <div className="flex flex-col gap-2 mt-3 px-1">
                <details className="group [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors select-none">
                    <Info size={14} className="text-primary/70" />
                    How to create a Cloudflare API token
                    <ChevronRight size={14} className="transition-transform group-open:rotate-90 ml-auto opacity-50" />
                  </summary>
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-3 rounded-xl border border-border/50 bg-muted/20 backdrop-blur-sm p-5 text-sm text-muted-foreground shadow-sm"
                  >
                    <ol className="list-decimal space-y-3 pl-4 marker:text-muted-foreground/50">
                      <li>Log in to your <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium">Cloudflare Dashboard</a> and go to <strong>API Tokens</strong>.</li>
                      <li>Click <strong>Create Token</strong>, then <strong>Create Custom Token</strong>.</li>
                      <li>Under <strong>Permissions</strong>, add these two rows:
                        <ul className="mt-2 list-disc space-y-1.5 pl-4 marker:text-muted-foreground/30 text-[13px]">
                          <li><span className="font-medium text-foreground">Zone</span> — <span className="font-medium text-foreground">Zone Settings</span> — <span className="font-medium text-foreground">Read</span></li>
                          <li><span className="font-medium text-foreground">Account</span> — <span className="font-medium text-foreground">Workers Scripts</span> — <span className="font-medium text-foreground">Edit</span></li>
                        </ul>
                      </li>
                      <li>Click <strong>Continue to summary</strong> and <strong>Create Token</strong>.</li>
                    </ol>
                  </motion.div>
                </details>
              </div>
            </div>
            <Button onClick={handleConnect} disabled={!token} variant="premium" className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20">
              Connect Account
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-8 relative pb-12"
    >
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2.5s infinite;
        }
      `}} />
      
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-4 right-4 z-50 rounded-lg bg-primary/95 backdrop-blur-md px-4 py-3 text-sm font-medium text-primary-foreground shadow-2xl flex items-center gap-2 border border-primary/50"
          >
            <CheckCircle2 size={16} />
            <span>{notification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Analytics Section --- */}
      <motion.section variants={itemVariants} className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <span className="relative flex h-3 w-3 mr-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
              </span>
              Edge Delivery Overview
            </h2>
            <p className="text-sm text-muted-foreground mt-1 ml-5">Combined performance across all active zones</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadDeployments} className="h-8 hover:bg-muted/50">
            <RefreshCw size={14} className="mr-2 opacity-70" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
            <MetricCard
              label="Total Requests"
              value={analytics?.totalRequests?.toLocaleString() || "0"}
              icon={<Activity size={18} strokeWidth={1.5} />}
              accent="primary"
              change={12}
            />
          </motion.div>
          <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
            <MetricCard
              label="Variants Served"
              value={analytics?.variantsServed?.toLocaleString() || "0"}
              icon={<Zap size={18} strokeWidth={1.5} />}
              accent="success"
              change={24}
            />
          </motion.div>
          <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
            <MetricCard
              label="Conversion Rate"
              value={`${analytics?.totalRequests > 0 ? Math.round((analytics.variantsServed / analytics.totalRequests) * 100) : 0}%`}
              icon={<Server size={18} strokeWidth={1.5} />}
              accent="warning"
              change={5}
            />
          </motion.div>
          <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
            <MetricCard
              label="Unique Bots"
              value={Object.keys(analytics?.botTypes || {}).length.toString()}
              icon={<Bot size={18} strokeWidth={1.5} />}
              accent="muted"
            />
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bot Types Distribution */}
          <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
            <h3 className="text-sm font-semibold tracking-tight text-foreground mb-6 flex items-center gap-2">
              <Bot size={16} className="text-primary/80" />
              Bot Distribution
            </h3>
            <div className="space-y-5">
              {Object.entries(analytics?.botTypes || {})
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([bot, count], idx) => {
                  const percentage = ((count as number) / analytics.totalRequests) * 100;
                  return (
                    <div key={bot} className="space-y-1.5 group">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground/80 group-hover:text-foreground transition-colors">{bot}</span>
                        <span className="text-muted-foreground tabular-nums group-hover:text-foreground transition-colors">{count as number}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/60">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 1.2, delay: idx * 0.15, ease: [0.16, 1, 0.3, 1] }}
                          className="h-full bg-gradient-to-r from-primary/80 to-primary rounded-full relative shadow-[0_0_10px_rgba(var(--primary),0.3)]"
                        >
                          <div className="absolute inset-0 bg-white/20 w-full h-full animate-pulse rounded-full" />
                        </motion.div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Top Pages Table */}
          <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm p-6 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col">
            <h3 className="text-sm font-semibold tracking-tight text-foreground mb-6 flex items-center gap-2">
              <LayoutTemplate size={16} className="text-primary/80" />
              Top Served Paths
            </h3>
            <div className="rounded-xl border border-border/60 overflow-hidden flex-1 bg-background/30 backdrop-blur-md">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/30 text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
                  <tr>
                    <th className="px-5 py-4 border-b border-border/60">Rank</th>
                    <th className="px-5 py-4 border-b border-border/60">Path</th>
                    <th className="px-5 py-4 border-b border-border/60 text-right">Requests</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {analytics?.topPaths?.map((item: any, idx: number) => (
                    <tr key={item.path} className="hover:bg-muted/40 transition-colors duration-200 group">
                      <td className="px-5 py-3.5 text-muted-foreground/70 w-12 text-xs font-medium">{(idx + 1).toString().padStart(2, '0')}</td>
                      <td className="px-5 py-3.5 font-mono text-xs text-foreground/80 group-hover:text-primary transition-colors">{item.path}</td>
                      <td className="px-5 py-3.5 text-right font-medium tabular-nums text-foreground/90">{item.count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Elegant Divider */}
      <motion.div variants={itemVariants} className="relative py-4 my-2">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-border/40"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-4 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest backdrop-blur-sm">
            Configuration
          </span>
        </div>
      </motion.div>

      {/* --- Deployments Section --- */}
      <motion.section variants={itemVariants} className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Server className="text-primary" size={20} />
              Edge Deployments
            </h2>
            <p className="text-sm text-muted-foreground mt-1 ml-7">Manage Cloudflare workers and AI variants</p>
          </div>
          <Button onClick={() => setShowDeployForm(!showDeployForm)} variant={showDeployForm ? "outline" : "premium"} className="shadow-sm">
            {showDeployForm ? "Cancel" : <><Plus size={16} className="mr-1.5" /> New Deployment</>}
          </Button>
        </div>

        <AnimatePresence>
          {showDeployForm && (
            <motion.div 
              initial={{ opacity: 0, height: 0, scale: 0.98 }}
              animate={{ opacity: 1, height: "auto", scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.98 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="rounded-2xl border border-primary/20 bg-primary/[0.02] backdrop-blur-sm p-6 shadow-inner mb-4 mt-2">
                <h3 className="text-sm font-semibold mb-5 text-foreground flex items-center gap-2">
                   <Zap size={16} className="text-primary/70" />
                   Deploy New Edge Worker
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Select Zone</label>
                    <div className="relative">
                      <select
                        value={selectedZone}
                        onChange={(e) => setSelectedZone(e.target.value)}
                        className="flex h-11 w-full rounded-xl border border-border/80 bg-background/50 backdrop-blur-sm px-4 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary appearance-none transition-all hover:border-border"
                      >
                        <option value="" disabled>Choose a domain...</option>
                        {zones.map((zone: any) => (
                          <option key={zone.id} value={zone.id}>
                            {zone.name}
                          </option>
                        ))}
                      </select>
                      <ChevronRight size={14} className="absolute right-4 top-4 rotate-90 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Site Identifier <span className="normal-case tracking-normal opacity-70 font-normal">(for worker name)</span></label>
                    <Input
                      value={siteId}
                      onChange={(e) => setSiteId(e.target.value)}
                      placeholder="e.g., brand-prod-1"
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button onClick={handleDeploy} disabled={!selectedZone || !siteId} variant="premium" className="px-6 h-10">
                    Deploy Worker
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div layout className="grid gap-3">
          <AnimatePresence>
            {deployments.map((d: any) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={d.id}
                className={cn(
                  "rounded-2xl border bg-card/60 backdrop-blur-sm transition-all duration-300 overflow-hidden",
                  expandedDeploymentId === d.id ? "border-primary/40 shadow-lg ring-1 ring-primary/20" : "border-border/60 hover:border-border hover:shadow-md"
                )}
              >
                <div
                  className="p-5 cursor-pointer flex items-center justify-between group"
                  onClick={() => {
                    setExpandedDeploymentId(expandedDeploymentId === d.id ? null : d.id);
                    if (expandedDeploymentId !== d.id) {
                      setShowVariantForm(false);
                      setGeneratedPreview(null);
                    }
                  }}
                >
                  <div>
                    <h3 className="text-[15px] font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                      {d.zoneName}
                    </h3>
                    <div className="flex items-center gap-2.5 mt-2">
                      <p className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md border border-border/40">{d.workerName}</p>
                      <span className="w-1 h-1 rounded-full bg-border" />
                      <p className="text-[11px] text-muted-foreground font-medium">
                        Deployed {new Date(d.deployedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest",
                        d.status === "active"
                          ? "bg-success/10 text-success border border-success/20"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {d.status === "active" && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-success animate-pulse shadow-[0_0_5px_rgba(var(--success),0.5)]"></span>}
                      {d.status}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => confirmDeleteDeployment(e, d)}
                        disabled={deletingId === d.id}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        title="Delete Deployment"
                      >
                        {deletingId === d.id ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      </button>
                      <div className={cn("p-1.5 rounded-lg transition-all duration-300", expandedDeploymentId === d.id ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground group-hover:bg-muted group-hover:text-foreground")}>
                         <ChevronRight size={16} className={cn("transition-transform duration-300", expandedDeploymentId === d.id ? "rotate-90" : "")} />
                      </div>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedDeploymentId === d.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border/50 bg-muted/10 p-6 backdrop-blur-md" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                          <h4 className="font-semibold text-foreground flex items-center gap-2 text-sm tracking-tight">
                            <Sparkles className="text-primary" size={16} />
                            Content Variants Map
                          </h4>
                          <Button
                            onClick={() => setShowVariantForm(!showVariantForm)}
                            size="sm"
                            variant={showVariantForm ? "outline" : "default"}
                            className="h-8 shadow-sm"
                          >
                            {showVariantForm ? "Cancel" : <><Plus size={14} className="mr-1.5" /> New Variant</>}
                          </Button>
                        </div>

                        <AnimatePresence>
                          {showVariantForm && (
                            <motion.div 
                              initial={{ opacity: 0, y: -10, scale: 0.99 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.98, height: 0 }}
                              transition={{ duration: 0.3 }}
                              className="rounded-2xl border border-border/80 bg-card p-6 mb-6 shadow-md"
                            >
                              <div className="flex rounded-xl border border-border/60 p-1 bg-muted/40 mb-6 max-w-sm">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAutoMode("manual");
                                    setGeneratedPreview(null);
                                  }}
                                  className={cn(
                                    "flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-300",
                                    autoMode === "manual" ? "bg-background shadow-sm text-foreground ring-1 ring-border/50" : "text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  Manual HTML
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setAutoMode("auto")}
                                  className={cn(
                                    "flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-300 flex items-center justify-center gap-1.5",
                                    autoMode === "auto" ? "bg-background shadow-sm text-foreground ring-1 ring-border/50" : "text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  <Sparkles size={12} className={autoMode === "auto" ? "text-primary animate-pulse" : "opacity-70"} />
                                  AI Auto-Generate
                                </button>
                              </div>

                              <div className="space-y-6">
                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Target URL Path</label>
                                  <Input
                                    value={variantPath}
                                    onChange={(e) => setVariantPath(e.target.value)}
                                    placeholder="/pricing"
                                    className="font-mono text-sm shadow-inner h-11"
                                  />
                                </div>

                                {autoMode === "manual" ? (
                                  <div className="space-y-2">
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">HTML Content</label>
                                    <textarea
                                      value={variantContent}
                                      onChange={(e) => setVariantContent(e.target.value)}
                                      placeholder="<html>...</html>"
                                      className="flex min-h-[200px] w-full rounded-xl border border-border/80 bg-background/50 backdrop-blur-sm px-4 py-3 text-sm font-mono shadow-inner focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-all hover:border-border"
                                    />
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                      <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Source URL</label>
                                      <Input
                                        value={sourceUrl}
                                        onChange={(e) => setSourceUrl(e.target.value)}
                                        onBlur={(e) => setSourceUrl(normalizeSourceUrl(e.target.value))}
                                        placeholder="https://example.com/landing"
                                        className="font-mono text-sm shadow-inner h-11"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">AI Instructions (Optional)</label>
                                      <textarea
                                        value={instructions}
                                        onChange={(e) => setInstructions(e.target.value)}
                                        placeholder="Tone, specific keywords, structural focus..."
                                        className="flex min-h-[44px] w-full rounded-xl border border-border/80 bg-background/50 backdrop-blur-sm px-4 py-2.5 text-sm shadow-inner focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary transition-all hover:border-border"
                                      />
                                    </div>
                                  </div>
                                )}

                                <div className="pt-3 flex justify-end">
                                  <Button
                                    onClick={handleCreateVariant}
                                    disabled={isSubmitting || !variantPath || (autoMode === "manual" ? !variantContent : !sourceUrl)}
                                    variant={autoMode === "auto" ? "premium" : "default"}
                                    className="h-10 px-6"
                                  >
                                    {isSubmitting ? (
                                      <>
                                        <RefreshCw size={16} className="mr-2 animate-spin" />
                                        Processing...
                                      </>
                                    ) : autoMode === "manual" ? "Deploy Variant" : <><Sparkles size={16} className="mr-2" /> Generate & Preview</>}
                                  </Button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <AnimatePresence>
                          {generatedPreview && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.98, y: 10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.98, height: 0 }}
                              transition={{ duration: 0.4, type: "spring" }}
                              className="rounded-2xl border border-primary/20 bg-card p-1 overflow-hidden shadow-xl shadow-primary/5 relative"
                            >
                              {/* Animated background glow for the preview pane */}
                              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5 animate-pulse pointer-events-none" />
                              
                              <div className="bg-card rounded-xl p-6 relative z-10 border border-background/50">
                                <div className="flex items-center justify-between mb-6 pb-5 border-b border-border/60">
                                  <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl border border-primary/10 shadow-inner">
                                      <Sparkles className="text-primary" size={20} />
                                    </div>
                                    <div>
                                      <h4 className="font-semibold text-foreground tracking-tight text-[15px]">Generated Variant Ready</h4>
                                      <p className="text-xs text-muted-foreground font-mono mt-1 bg-muted/40 px-2 py-0.5 rounded-md inline-block">{generatedPreview.path}</p>
                                    </div>
                                  </div>
                                  <div className="flex gap-3">
                                    <Button variant="ghost" size="sm" onClick={() => setGeneratedPreview(null)} className="h-9 px-4">
                                      Discard
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="premium"
                                      className="h-9 px-5 shadow-lg shadow-primary/20"
                                      disabled={isSubmitting}
                                      onClick={async () => {
                                        setIsSubmitting(true);
                                        try {
                                          await createVariant(d.id, generatedPreview.path, generatedPreview.content);
                                          setNotification("Variant deployed to edge!");
                                          setTimeout(() => setNotification(""), 3000);
                                          setGeneratedPreview(null);
                                          setShowVariantForm(false);
                                        } catch (err: any) {
                                          console.error(err);
                                          setNotification("Failed to deploy variant to edge.");
                                          setTimeout(() => setNotification(""), 3000);
                                        } finally {
                                          setIsSubmitting(false);
                                        }
                                      }}
                                    >
                                      {isSubmitting ? <RefreshCw size={16} className="animate-spin" /> : "Deploy to Edge"}
                                    </Button>
                                  </div>
                                </div>
                                
                                <div className="grid gap-6 md:grid-cols-2">
                                  <div className="flex flex-col gap-3">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">HTML Source</span>
                                      <span className="flex h-2 w-2 rounded-full bg-primary/50" />
                                    </div>
                                    <textarea
                                      value={generatedPreview.content}
                                      onChange={(e) => setGeneratedPreview(prev => prev ? { ...prev, content: e.target.value } : prev)}
                                      className="flex-1 w-full rounded-xl border border-border/80 bg-muted/20 backdrop-blur-sm p-5 font-mono text-[11px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary min-h-[350px] shadow-inner leading-relaxed transition-colors hover:border-border"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-3">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Live Preview</span>
                                      <span className="flex h-2 w-2 rounded-full bg-success/80 animate-pulse" />
                                    </div>
                                    <div className="flex-1 rounded-xl border border-border/80 bg-white overflow-hidden text-black min-h-[350px] shadow-sm relative">
                                      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary/40 via-primary/20 to-transparent" />
                                      <iframe 
                                        srcDoc={generatedPreview.content}
                                        className="w-full h-full border-0"
                                        title="Variant Preview"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        
                        {!showVariantForm && !generatedPreview && (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-14 border border-dashed border-border/80 rounded-2xl bg-card/20 backdrop-blur-sm transition-all duration-300 hover:bg-card/40 hover:border-primary/30 group"
                          >
                            <div className="mx-auto h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary/10 transition-all duration-300">
                              <LayoutTemplate className="h-6 w-6 text-muted-foreground/50 group-hover:text-primary/70 transition-colors" />
                            </div>
                            <p className="text-sm font-semibold text-foreground tracking-tight">No variants configured for this path yet</p>
                            <p className="text-[13px] text-muted-foreground mt-1.5 mb-6 max-w-xs mx-auto leading-relaxed">Create AI-optimized HTML to intercept bot traffic and boost AI visibility.</p>
                            <Button size="sm" variant="outline" onClick={() => setShowVariantForm(true)} className="rounded-full px-5 h-9 group-hover:border-primary/30 group-hover:text-primary">
                              <Plus size={14} className="mr-1.5" /> Create First Variant
                            </Button>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </motion.section>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deploymentToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="fixed inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setDeploymentToDelete(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative z-50 w-full max-w-md overflow-hidden rounded-2xl border border-border/60 bg-card p-6 shadow-2xl"
            >
              <div className="mb-6 flex flex-col items-center text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">Delete Deployment?</h2>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Are you sure you want to delete <span className="font-semibold text-foreground">{deploymentToDelete.zoneName}</span>? This will permanently remove the Edge Worker, KV variants, and all routing rules from Cloudflare.
                </p>
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={() => setDeploymentToDelete(null)}
                  disabled={deletingId === deploymentToDelete.id}
                >
                  Cancel
                </Button>
                <Button 
                  variant="default" 
                  className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm shadow-destructive/20" 
                  onClick={executeDeleteDeployment}
                  disabled={deletingId === deploymentToDelete.id}
                >
                  {deletingId === deploymentToDelete.id ? (
                    <><RefreshCw size={16} className="mr-2 animate-spin" /> Deleting...</>
                  ) : (
                    "Yes, Delete it"
                  )}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
