"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  X, 
  Sparkles, 
  ChevronRight, 
  PenTool, 
  Code, 
  FileText, 
  Cpu, 
  Bookmark, 
  Type, 
  BarChart3, 
  Info,
  Zap,
  CheckCircle2,
  AlertCircle,
  Network,
  MessageSquare,
  User,
  Bot,
  Terminal,
  Search
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// --- 1. Doodle Background Pattern (DENSE & RANDOM) ---
function DoodleBackground() {
  return (
    <div className="absolute inset-0 z-0 opacity-[0.07] pointer-events-none overflow-hidden select-none">
      <svg width="100%" height="100%">
        <pattern id="doodle-pattern" x="0" y="0" width="350" height="350" patternUnits="userSpaceOnUse">
          {/* Group 1: Pens & Pencils (Varying Sizes) */}
          <g transform="translate(30, 40) rotate(-15) scale(0.8)">
            <path d="M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l5.5 14.5L13 18z" stroke="currentColor" fill="none" strokeWidth="1.5" />
          </g>
          <g transform="translate(240, 50) rotate(115) scale(0.5)">
            <path d="M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l5.5 14.5L13 18z" stroke="currentColor" fill="none" strokeWidth="2" />
          </g>
          <g transform="translate(160, 280) rotate(-45) scale(0.7)">
            <path d="M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l5.5 14.5L13 18z" stroke="currentColor" fill="none" strokeWidth="1.5" />
          </g>

          {/* Group 2: Paperclips (Highly Random) */}
          <g transform="translate(110, 20) rotate(25) scale(0.6)">
            <path d="M6 7.91V16a6 6 0 0 0 12 0V6a4 4 0 0 0-8 0v10a2 2 0 0 0 4 0V7.91" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" />
          </g>
          <g transform="translate(280, 160) rotate(-70) scale(0.4)">
            <path d="M6 7.91V16a6 6 0 0 0 12 0V6a4 4 0 0 0-8 0v10a2 2 0 0 0 4 0V7.91" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" />
          </g>
          <g transform="translate(40, 240) rotate(50) scale(0.55)">
            <path d="M6 7.91V16a6 6 0 0 0 12 0V6a4 4 0 0 0-8 0v10a2 2 0 0 0 4 0V7.91" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" />
          </g>

          {/* Group 3: Diaries & Notebooks (The Large "Anchor" Doodles) */}
          <g transform="translate(180, 80) rotate(12) scale(0.85)">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" fill="none" strokeWidth="1.2" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" fill="none" strokeWidth="1.2" />
          </g>
          <g transform="translate(20, 140) rotate(-8) scale(0.45)">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" fill="none" strokeWidth="2" />
            <path d="M14 2v6h6" stroke="currentColor" fill="none" strokeWidth="2" />
          </g>
          <g transform="translate(260, 260) rotate(20) scale(0.7)">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" fill="none" strokeWidth="1.5" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" fill="none" strokeWidth="1.5" />
          </g>

          {/* Group 4: Inkpots & Brushes (Medium scale) */}
          <g transform="translate(120, 180) rotate(-12) scale(0.65)">
            <path d="M7 12h10v8a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-8z" stroke="currentColor" fill="none" strokeWidth="1.5" />
            <path d="M9 12V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v3" stroke="currentColor" fill="none" strokeWidth="1.5" />
          </g>
          <g transform="translate(210, 190) rotate(35) scale(0.5)">
            <path d="m14.622 17.897-10.68-10.697" stroke="currentColor" fill="none" strokeWidth="2" />
            <path d="M18.387 11.48a2.182 2.182 0 0 0-3.06-3.06l-1.42 1.42 3.06 3.06z" stroke="currentColor" fill="none" strokeWidth="2" />
          </g>
          <g transform="translate(40, 310) scale(0.4)">
            <path d="M7 12h10v8a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-8z" stroke="currentColor" fill="none" strokeWidth="2" />
          </g>

          {/* Filler Details */}
          <circle cx="80" cy="100" r="2" fill="currentColor" />
          <circle cx="200" cy="30" r="1.5" fill="currentColor" />
          <circle cx="310" cy="220" r="1.8" fill="currentColor" />
          <circle cx="130" cy="320" r="2" fill="currentColor" />
          
          <path d="M50 50l6 6M56 50l-6 6" stroke="currentColor" strokeWidth="1" />
          <path d="M280 40l7 7M287 40l-7 7" stroke="currentColor" strokeWidth="1" />
          <path d="M140 230l4 4M144 230l-4 4" stroke="currentColor" strokeWidth="1" />
          
          {/* Group 5: Small Code Doodles */}
          <g transform="translate(150, 15) scale(0.4)" opacity="0.6">
            <path d="m18 16 4-4-4-4M6 8l-4 4 4 4M14.5 4l-5 16" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" />
          </g>
          <g transform="translate(290, 300) scale(0.5)" opacity="0.6">
            <path d="m18 16 4-4-4-4M6 8l-4 4 4 4M14.5 4l-5 16" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" />
          </g>
        </pattern>
        <rect width="100%" height="100%" fill="url(#doodle-pattern)" />
      </svg>
    </div>
  );
}

// --- 2. Simulation Overlay (Matrix Scanning) ---
function SimulationOverlay({ step }: { step: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[250] flex flex-col items-center justify-center bg-background/90 backdrop-blur-xl"
    >
      <div className="relative mb-12 h-32 w-32">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full border-2 border-dashed border-primary/30"
        />
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-4 rounded-full bg-primary/10"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Cpu className="text-primary" size={40} />
        </div>
        
        {/* Matrix Scanning Line */}
        <motion.div 
          animate={{ top: ["0%", "100%", "0%"] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-0 right-0 h-0.5 bg-primary shadow-[0_0_15px_rgba(249,115,22,0.8)] z-10"
        />
      </div>

      <div className="flex flex-col items-center gap-3">
        <h2 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-3">
          <Terminal size={20} className="text-primary" />
          {step}
        </h2>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              className="h-1.5 w-1.5 rounded-full bg-primary"
            />
          ))}
        </div>
      </div>

      {/* Background Data Stream (Matrix style) */}
      <div className="absolute inset-0 -z-10 opacity-[0.05] overflow-hidden flex flex-wrap gap-4 p-4 font-mono text-[10px]">
        {Array.from({ length: 50 }).map((_, i) => (
          <div key={i} className="whitespace-nowrap">
            {Math.random().toString(36).substring(2, 15)}
            {Math.random().toString(36).substring(2, 15)}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// --- 3. Simulation Result (Mock ChatGPT) ---
function SimulationResult({ topic, content, onClose }: { topic: string; content: string; onClose: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="absolute inset-0 z-[260] flex items-center justify-center p-6 bg-foreground/5 backdrop-blur-md"
    >
      <div className="flex h-[600px] w-full max-w-2xl flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-border bg-secondary/30 px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#10A37F] text-white">
              <Bot size={16} />
            </div>
            <span className="text-sm font-bold text-foreground">GPT-4o Simulation</span>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Chat Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#F9F9F9]">
          {/* User Message */}
          <div className="flex gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User size={16} />
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-xs font-bold text-foreground">You</p>
              <p className="text-sm text-foreground/80 leading-relaxed">
                What are the latest updates on {topic || "this topic"} and why should brands care?
              </p>
            </div>
          </div>

          {/* AI Response */}
          <div className="flex gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#10A37F] text-white">
              <Bot size={16} />
            </div>
            <div className="flex-1 space-y-3">
              <p className="text-xs font-bold text-foreground">ChatGPT</p>
              <div className="text-sm text-foreground/90 leading-relaxed space-y-4">
                <p>Based on recent analysis of emerging market trends, {topic} is undergoing a significant shift.</p>
                
                {/* The "Citation" Highlight */}
                <div className="relative group">
                  <div className="absolute -left-2 inset-y-0 w-1 bg-primary rounded-full opacity-50" />
                  <p className="bg-primary/5 p-3 rounded-lg border border-primary/10">
                    "Brands must focus on engineering content that AI loves to cite. A key strategy involves 
                    <span className="font-bold text-primary underline decoration-2 underline-offset-4 cursor-help"> injecting high-trust entity data</span> 
                    and ensuring direct answer structures."
                  </p>
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-primary uppercase tracking-wider">
                    <CheckCircle2 size={10} />
                    Source: Your Studio Draft
                  </div>
                </div>

                <p>By implementing these structures, organizations can increase their citation probability by up to 40% in AI Overviews and conversational agents.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4 bg-white">
          <div className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 bg-secondary/20">
            <p className="text-xs text-muted-foreground italic">Simulation complete. Your content was successfully cited.</p>
            <Sparkles size={12} className="ml-auto text-primary" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// --- 4. AI Intelligence Panel (The Judge) ---
function AIJudgePanel({ content, onSimulate }: { content: string; onSimulate: () => void }) {
  const [citationScore, setCitationScore] = useState(64);
  
  useEffect(() => {
    const score = Math.min(40 + Math.floor(content.length / 20), 98);
    setCitationScore(score);
  }, [content]);

  return (
    <div className="flex h-full w-[380px] flex-col border-l border-border bg-card/80 backdrop-blur-md z-10">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-primary fill-primary/20" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">AI Intelligence</h3>
        </div>
        <p className="text-[11px] text-sidebar-muted">Real-time Answer Engine optimization</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Citation Probability</span>
            <span className="text-xs font-mono text-primary font-bold">{citationScore}%</span>
          </div>
          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
            <motion.div 
              animate={{ width: `${citationScore}%` }}
              className="h-full bg-primary"
            />
          </div>
          <p className="text-[11px] leading-relaxed text-sidebar-muted">
            Probability that an LLM (ChatGPT/Gemini) will use this content as a primary source for related queries.
          </p>
        </div>

        <div className="space-y-4">
          <h4 className="text-[11px] font-bold uppercase text-foreground/50 tracking-wider">Recommendations</h4>
          
          <div className="space-y-3">
            <div className="group flex gap-3 p-3 rounded-xl border border-border bg-background hover:border-primary/30 transition-all cursor-pointer">
              <Zap size={14} className="text-warning mt-0.5 shrink-0" />
              <div>
                <p className="text-[12px] font-bold text-foreground">Inject Entity Data</p>
                <p className="text-[11px] text-sidebar-muted mt-1">Perplexity values specific pricing. Add a "Starter Plan" mention to increase relevance.</p>
              </div>
            </div>

            <div className="group flex gap-3 p-3 rounded-xl border border-border bg-background hover:border-primary/30 transition-all cursor-pointer">
              <CheckCircle2 size={14} className="text-success mt-0.5 shrink-0" />
              <div>
                <p className="text-[12px] font-bold text-foreground">Structure Confirmed</p>
                <p className="text-[11px] text-sidebar-muted mt-1">H2 headers are formatted as direct answers. Perfect for GPT-4o citation.</p>
              </div>
            </div>

            <div className="group flex gap-3 p-3 rounded-xl border border-dashed border-border bg-secondary/20 hover:border-primary/30 transition-all cursor-pointer">
              <AlertCircle size={14} className="text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-[12px] font-bold text-foreground">Missing Citation Source</p>
                <p className="text-[11px] text-sidebar-muted mt-1">Reference a study or expert to boost "Trust Score" for Gemini.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 border-t border-border bg-secondary/10">
        <button 
          onClick={onSimulate}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-foreground text-background text-sm font-bold hover:scale-[1.02] active:scale-[0.98] transition-all group"
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Zap size={16} className="text-primary fill-primary" />
          </motion.div>
          Simulate AI Response
        </button>
      </div>
    </div>
  );
}

// --- 5. Main Studio Component ---
export function AEOStudio({ isOpen, onClose, initialTopic = "" }: { isOpen: boolean; onClose: () => void; initialTopic?: string }) {
  const [content, setContent] = useState("");
  const [title, setTitle] = useState(initialTopic);
  
  // Simulation States
  const [simState, setSimState] = useState<"idle" | "processing" | "result">("idle");
  const [simStep, setSimStep] = useState("");

  const runSimulation = () => {
    setSimState("processing");
    
    // Staggered simulation steps
    setTimeout(() => setSimStep("Scanning Content Semantics..."), 0);
    setTimeout(() => setSimStep("Extracting Named Entities..."), 1500);
    setTimeout(() => setSimStep("Simulating LLM Attention Weights..."), 3000);
    setTimeout(() => setSimStep("Synthesizing Final Response..."), 4500);
    
    setTimeout(() => {
      setSimState("result");
    }, 6000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="fixed inset-0 z-[200] flex flex-col bg-background"
        >
          <DoodleBackground />

          {/* Simulation Layers */}
          <AnimatePresence>
            {simState === "processing" && <SimulationOverlay step={simStep} />}
            {simState === "result" && (
              <SimulationResult 
                topic={title} 
                content={content} 
                onClose={() => setSimState("idle")} 
              />
            )}
          </AnimatePresence>

          {/* Studio Top Bar */}
          <header className="relative z-10 flex h-16 items-center justify-between border-b border-border bg-card/50 backdrop-blur-md px-6">
            <div className="flex items-center gap-4">
              <button 
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-secondary transition-colors"
              >
                <X size={20} />
              </button>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-widest text-sidebar-muted">AEO Studio Mode</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-sidebar-muted hover:bg-secondary transition-all">
                Save Draft
              </button>
              <button className="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
                Push to Live
                <ChevronRight size={14} />
              </button>
            </div>
          </header>

          <div className="relative z-10 flex flex-1 overflow-hidden">
            {/* Editor Canvas */}
            <main className="flex-1 overflow-y-auto p-12 lg:p-24">
              <div className="mx-auto max-w-3xl space-y-8">
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Article Title..."
                  className="w-full bg-transparent text-5xl font-extrabold tracking-tight text-foreground outline-none placeholder:text-foreground/10"
                />
                
                <div className="flex items-center gap-6 border-y border-border/50 py-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-sidebar-muted hover:text-primary transition-colors cursor-pointer">
                    <Type size={14} />
                    <span>Body Text</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-sidebar-muted hover:text-primary transition-colors cursor-pointer">
                    <PenTool size={14} />
                    <span>Normal</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-sidebar-muted hover:text-primary transition-colors cursor-pointer">
                    <Code size={14} />
                    <span>Markdown</span>
                  </div>
                </div>

                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Start engineering content that AI loves to cite..."
                  className="min-h-[500px] w-full resize-none bg-transparent text-[18px] leading-relaxed text-sidebar-muted outline-none placeholder:text-foreground/5"
                />
              </div>
            </main>

            {/* AI Intelligence Panel */}
            <AIJudgePanel content={content} onSimulate={runSimulation} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
