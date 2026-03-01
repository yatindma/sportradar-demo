/**
 * TracePanel — Agent execution trace viewer
 *
 * Shows every tool call, result, retry, and knowledge source in real-time.
 * Super animated with framer-motion and the fiery NBA theme.
 */
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Activity,
  Brain,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  ChevronDown,
  Wrench,
  RefreshCw,
  Zap,
  AlertTriangle,
  Database,
  Timer,
  TrendingUp,
  Shield,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import BasketballSVG from "./BasketballSVG";

/** Format a timestamp as HH:MM:SS */
function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour12: false });
}

/** Friendly display names for internal tool identifiers */
const TOOL_LABELS = {
  fetch_sports_data: "Live Sports Data",
  generate_excel: "Export Spreadsheet",
  web_search: "Web Search",
  analyze_data: "Data Analysis",
};

function StepStatusIcon({ status }) {
  switch (status) {
    case "pending":
      return (
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-3 h-3 rounded-full bg-amber-400 mt-1 shadow-[0_0_15px_rgba(251,191,36,0.8)]"
        />
      );
    case "running":
      return (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <BasketballSVG className="w-5 h-5 text-orange-500 drop-shadow-[0_0_10px_rgba(249,115,22,0.8)] mt-0.5" />
        </motion.div>
      );
    case "done":
      return (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
          <CheckCircle2 size={18} strokeWidth={3} className="text-emerald-500 mt-0.5 drop-shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
        </motion.div>
      );
    case "failed":
      return (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
          <XCircle size={18} strokeWidth={3} className="text-red-600 mt-0.5 drop-shadow-[0_0_12px_rgba(220,38,38,0.8)]" />
        </motion.div>
      );
    case "denied":
      return <Ban size={18} strokeWidth={3} className="text-zinc-500 mt-0.5" />;
    default:
      return <div className="w-3 h-3 rounded-full bg-zinc-700 mt-1 shadow-inner" />;
  }
}

function PlanStepRow({ step, traceEntries, isLast }) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (step.status === "running") setExpanded(true);
  }, [step.status]);

  const relatedTraces = traceEntries.filter((t) => t.stepId === step.id);
  const retryCount = relatedTraces.filter((t) => t.type === "tool_retry").length;

  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      className="relative mb-4"
    >
      <motion.button
        whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.03)" }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-start gap-4 px-5 py-4 rounded-2xl transition-all text-left relative overflow-hidden group border ${step.status === "running"
            ? "border-orange-500/30 bg-orange-500/10 shadow-[0_0_20px_rgba(249,115,22,0.15)]"
            : step.status === "done"
              ? "border-emerald-500/20 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.05)]"
              : step.status === "failed"
                ? "border-red-500/30 bg-red-500/10 shadow-[0_0_20px_rgba(220,38,38,0.1)]"
                : "border-white/[0.05] bg-white/[0.02]"
          }`}
      >
        {step.status === "running" && (
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-amber-500/10 animate-pulse-ring pointer-events-none" />
        )}

        <div className="flex-shrink-0 relative z-10">
          <StepStatusIcon status={step.status} />
        </div>

        <div className="flex-1 min-w-0 z-10">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span
              className={`text-[13px] font-black tracking-wide px-3 py-1 rounded-lg ${step.status === "running"
                  ? "bg-orange-500/20 text-orange-400 border border-orange-500/40 shadow-[0_0_10px_rgba(249,115,22,0.2)]"
                  : step.status === "done"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : step.status === "failed"
                      ? "bg-red-500/20 text-red-500 border border-red-500/40"
                      : "bg-zinc-800/80 text-zinc-400 border border-zinc-700/80"
                }`}
            >
              {TOOL_LABELS[step.tool] || step.tool}
            </span>
            {/* Elapsed time — show for done AND failed */}
            {step.elapsedMs != null && (step.status === "done" || step.status === "failed") && (
              <span className={`text-[11px] font-bold flex items-center gap-1.5 px-2 py-1 rounded-md border ${
                step.status === "done"
                  ? "text-zinc-500 bg-[#09090b] border-zinc-800"
                  : "text-red-400/70 bg-red-500/5 border-red-500/20"
              }`}>
                <Clock size={12} className={step.status === "done" ? "text-emerald-500" : "text-red-500"} />
                {step.elapsedMs}ms
              </span>
            )}
            {/* Retry badge on step */}
            {retryCount > 0 && (
              <span className="text-[11px] font-bold text-yellow-400 flex items-center gap-1.5 bg-yellow-500/10 px-2 py-1 rounded-md border border-yellow-500/30">
                <RefreshCw size={11} />
                {retryCount} retry{retryCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="text-[15px] font-semibold text-zinc-300 mt-1 leading-[1.4]">
            {step.description}
          </p>
          {/* Inline error message for failed steps */}
          {step.status === "failed" && step.error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 flex items-start gap-2 text-[13px] text-red-400/90 bg-red-500/5 px-3 py-2 rounded-lg border border-red-500/20"
            >
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              <span className="font-medium">{step.error}</span>
            </motion.div>
          )}
        </div>

        {relatedTraces.length > 0 && (
          <div className="text-zinc-600 group-hover:text-orange-500 transition-colors z-10 pt-2 bg-[#09090b] p-1.5 rounded-md border border-white/[0.02]">
            <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ type: "spring", stiffness: 200, damping: 20 }}>
              <ChevronDown size={18} strokeWidth={3} />
            </motion.div>
          </div>
        )}
      </motion.button>

      <AnimatePresence>
        {expanded && relatedTraces.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden ml-8 mt-2"
          >
            <div className="pl-5 border-l-4 border-zinc-800 py-3 space-y-3">
              {relatedTraces.map((trace, i) => (
                <TraceEntry
                  key={`${trace.type}-${trace.stepId ?? "na"}-${trace.timestamp ?? i}-${trace.tool ?? trace.attempt ?? i}`}
                  trace={trace}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isLast && (
        <div className="absolute left-[26px] top-[4.5rem] bottom-[-1rem] w-[4px] bg-gradient-to-b from-zinc-800 to-transparent z-0 h-8 rounded-full" />
      )}
    </motion.div>
  );
}

function TraceEntry({ trace }) {

  if (trace.type === "tool_call") {
    return (
      <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="group">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3 text-[13px] text-zinc-500 bg-[#111111] px-3 py-1.5 rounded-lg border border-white/[0.02]">
            <div className="p-1.5 rounded-md bg-orange-500/10 text-orange-500 border border-orange-500/30">
              <Wrench size={14} strokeWidth={2.5} />
            </div>
            <span className="font-bold tracking-wide">
              Running <span className="text-orange-400">{TOOL_LABELS[trace.tool] || trace.tool}</span>
            </span>
          </div>
        </div>
      </motion.div>
    );
  }

  if (trace.type === "tool_result") {
    return (
      <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
        <div className="flex items-center gap-3 text-[13px] bg-[#111111] px-3 py-2 rounded-lg border border-white/[0.02] w-fit">
          <div
            className={`p-1.5 rounded-md border shadow-lg ${trace.status === "success"
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                : "bg-red-500/10 text-red-600 border-red-500/30"
              }`}
          >
            {trace.status === "success" ? <CheckCircle2 size={14} strokeWidth={3} /> : <XCircle size={14} strokeWidth={3} />}
          </div>
          <span
            className={`font-bold tracking-wide ${trace.status === "success" ? "text-emerald-500" : "text-red-500"
              }`}
          >
            {trace.status === "success"
              ? trace.summary || "Completed"
              : trace.error || "Failed"}
          </span>
          {trace.elapsedMs != null && (
            <span className="text-zinc-600 font-bold text-[11px] bg-[#050505] px-2 py-1 rounded-md border border-zinc-800">
              {trace.elapsedMs > 1000 ? `${(trace.elapsedMs / 1000).toFixed(1)}s` : `${trace.elapsedMs}ms`}
            </span>
          )}
        </div>
      </motion.div>
    );
  }

  if (trace.type === "tool_retry") {
    return (
      <motion.div
        initial={{ x: -20, opacity: 0, scale: 0.95 }}
        animate={{ x: 0, opacity: 1, scale: 1 }}
        className="flex items-center gap-3 text-[13px] bg-yellow-500/10 px-4 py-2.5 rounded-xl border border-yellow-500/30 w-fit"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: 2, ease: "linear" }}
          className="p-1.5 rounded-lg bg-yellow-500/20 text-yellow-400 border border-yellow-500/40"
        >
          <RefreshCw size={14} strokeWidth={3} />
        </motion.div>
        <span className="font-bold text-yellow-400 tracking-wide flex items-center gap-2">
          Retrying (attempt {trace.attempt} of {trace.maxRetries})
        </span>
      </motion.div>
    );
  }

  return null;
}

/** Execution summary bar — shows aggregate metrics after execution */
function ExecutionSummary({ planSteps, traceEntries }) {
  const stats = useMemo(() => {
    const done = planSteps.filter((s) => s.status === "done").length;
    const failed = planSteps.filter((s) => s.status === "failed").length;
    const denied = planSteps.filter((s) => s.status === "denied").length;
    const totalMs = planSteps.reduce((sum, s) => sum + (s.elapsedMs || 0), 0);
    const retries = traceEntries.filter((t) => t.type === "tool_retry").length;
    return { done, failed, denied, totalMs, retries, total: planSteps.length };
  }, [planSteps, traceEntries]);

  if (stats.total === 0) return null;

  // Only show when all steps are terminal
  const allDone = planSteps.every((s) => ["done", "failed", "denied"].includes(s.status));
  if (!allDone) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-6 mb-4 px-4 py-3 rounded-xl bg-gradient-to-r from-zinc-900/80 to-zinc-800/40 border border-zinc-700/30 backdrop-blur-sm"
    >
      <div className="flex items-center gap-2 mb-2.5">
        <TrendingUp size={13} className="text-zinc-500" />
        <span className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em]">Summary</span>
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        {/* Steps completed */}
        <div className="flex items-center gap-1.5">
          <CheckCircle2 size={13} className="text-emerald-500" />
          <span className="text-[12px] font-bold text-emerald-400">{stats.done}</span>
          <span className="text-[11px] text-zinc-600">passed</span>
        </div>
        {/* Steps failed */}
        {stats.failed > 0 && (
          <div className="flex items-center gap-1.5">
            <XCircle size={13} className="text-red-500" />
            <span className="text-[12px] font-bold text-red-400">{stats.failed}</span>
            <span className="text-[11px] text-zinc-600">failed</span>
          </div>
        )}
        {/* Steps denied */}
        {stats.denied > 0 && (
          <div className="flex items-center gap-1.5">
            <Shield size={13} className="text-zinc-500" />
            <span className="text-[12px] font-bold text-zinc-400">{stats.denied}</span>
            <span className="text-[11px] text-zinc-600">denied</span>
          </div>
        )}
        {/* Retries */}
        {stats.retries > 0 && (
          <div className="flex items-center gap-1.5">
            <RefreshCw size={13} className="text-yellow-500" />
            <span className="text-[12px] font-bold text-yellow-400">{stats.retries}</span>
            <span className="text-[11px] text-zinc-600">retries</span>
          </div>
        )}
        {/* Separator */}
        <div className="w-px h-4 bg-zinc-700/50" />
        {/* Total time */}
        <div className="flex items-center gap-1.5">
          <Timer size={13} className="text-orange-500" />
          <span className="text-[12px] font-bold text-orange-400">
            {stats.totalMs > 1000 ? `${(stats.totalMs / 1000).toFixed(1)}s` : `${stats.totalMs}ms`}
          </span>
          <span className="text-[11px] text-zinc-600">total</span>
        </div>
      </div>
    </motion.div>
  );
}

/** Persistent Plan Card — shows agent's strategy/reasoning above steps */
function PlanCard({ thinking, isLive }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 overflow-hidden shadow-[0_0_20px_rgba(6,182,212,0.08)]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-cyan-500/5 transition-colors"
      >
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${isLive
          ? "bg-cyan-500/20 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.4)]"
          : "bg-cyan-500/10 border-cyan-500/20"
        }`}>
          <Brain size={14} className={`text-cyan-400 ${isLive ? "animate-pulse" : ""}`} />
        </div>
        <span className="text-[12px] font-black uppercase tracking-[0.2em] text-cyan-400 flex-1 text-left">
          Agent Plan
        </span>
        {isLive && (
          <span className="text-[10px] font-bold text-cyan-500 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/25 uppercase tracking-wider">
            Live
          </span>
        )}
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={14} className="text-cyan-500/60" />
        </motion.div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 text-[13px] text-cyan-100/70 leading-relaxed max-h-48 overflow-y-auto custom-scrollbar">
              {thinking}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function TracePanel({ planSteps, traceEntries, isStreaming, planningPhase = null, planningThinking = null, knowledgeSources = [] }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isNearBottom = distanceFromBottom < 120;
    const hasNoOverflow = el.scrollHeight <= el.clientHeight + 8;

    // Keep autoscroll when user is already near bottom; avoid snapping while inspecting older traces.
    if (isNearBottom || hasNoOverflow || (isStreaming && planningPhase === "thinking")) {
      el.scrollTop = el.scrollHeight;
    }
  }, [planSteps, traceEntries, planningPhase, planningThinking, isStreaming]);

  return (
    <div className="flex flex-col h-full bg-[#09090b] relative overflow-hidden text-white border-l border-white/[0.02]">
      {/* Background glow effects */}
      <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-600/5 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-5 border-b border-orange-500/10 bg-[#09090b]/95 backdrop-blur-3xl sticky top-0 z-20">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
          <Activity size={18} strokeWidth={2.5} className="text-amber-500" />
        </div>
        <h2 className="text-[15px] font-black uppercase tracking-[0.15em] bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-orange-500">
          Activity
        </h2>
        <AnimatePresence>
          {isStreaming && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="ml-auto flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/20 border border-orange-500/40 shadow-[0_0_15px_rgba(249,115,22,0.3)]"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,1)]" />
              <span className="text-[11px] text-orange-400 font-black tracking-widest uppercase">
                {planningPhase === "thinking" && planSteps.length === 0 ? "THINKING" : "LIVE"}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Step counter when steps exist */}
        {planSteps.length > 0 && !isStreaming && (
          <div className="ml-auto text-[11px] font-bold text-zinc-600 bg-zinc-800/50 px-2.5 py-1 rounded-md border border-zinc-700/50">
            {planSteps.filter((s) => s.status === "done").length}/{planSteps.length} steps
          </div>
        )}
      </div>

      {/* Steps */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8 scroll-smooth custom-scrollbar relative z-10">
        <AnimatePresence>
          {planSteps.length === 0 && !planningPhase && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center h-full text-center"
            >
              <motion.div
                animate={{
                  boxShadow: [
                    "0 0 20px rgba(245,158,11,0.1)",
                    "0 0 40px rgba(245,158,11,0.3)",
                    "0 0 20px rgba(245,158,11,0.1)",
                  ],
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className="w-24 h-24 rounded-3xl bg-[#111111] border border-white/[0.02] flex items-center justify-center mb-6 shadow-2xl"
              >
                <Activity size={48} strokeWidth={1.5} className="text-amber-600/50" />
              </motion.div>
              <h3 className="text-2xl font-black text-white mb-3 tracking-tight">Ready</h3>
              <p className="text-zinc-500 text-[15px] max-w-[220px] leading-relaxed font-semibold">
                Activity and progress will appear here.
              </p>
            </motion.div>
          )}

          {/* Knowledge sources card — shows when agent has active knowledge */}
          {knowledgeSources.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="mb-5"
            >
              <div className="rounded-2xl border border-violet-500/25 bg-gradient-to-r from-violet-500/8 to-indigo-500/8 p-4 shadow-[0_0_20px_rgba(139,92,246,0.1)]">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shadow-[0_0_12px_rgba(139,92,246,0.3)]">
                    <Database size={13} className="text-violet-400" />
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-violet-400">
                    Knowledge Active
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {knowledgeSources.map((src, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-[12px] text-violet-300/80 bg-violet-500/10 px-3 py-1.5 rounded-lg border border-violet-500/20">
                      {src.type === "search_history" ? <Database size={11} /> : <Clock size={11} />}
                      <span className="font-bold">{src.label}</span>
                      {src.count && <span className="text-violet-500">({src.count})</span>}
                      {src.items && src.items.length > 0 && (
                        <span className="text-violet-500/60 text-[10px]">· {src.items.slice(0, 3).join(", ")}{src.items.length > 3 ? "..." : ""}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Agent thinking card — visible when agent is reasoning (live) */}
          {planningPhase === "thinking" && planSteps.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6"
            >
              <div className="rounded-2xl border border-cyan-500/25 bg-gradient-to-r from-cyan-500/8 to-blue-500/8 p-5 shadow-[0_0_25px_rgba(6,182,212,0.12)]">
                <div className="flex items-center gap-3 mb-3">
                  <motion.div
                    animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                  >
                    <Zap size={16} className="text-cyan-400" />
                  </motion.div>
                  <span className="text-[13px] font-black uppercase tracking-[0.2em] text-cyan-400">
                    Thinking
                  </span>
                </div>
                <p className="text-sm text-zinc-300 font-medium mb-2">
                  Analyzing your question and preparing the best approach...
                </p>
                <div className="mt-3 h-1.5 rounded-full bg-zinc-900/90 border border-zinc-800 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-400 rounded-full"
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    style={{ width: "40%" }}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Persistent Plan Card — stays visible during & after execution */}
          {planningThinking && planSteps.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5"
            >
              <PlanCard thinking={planningThinking} isLive={planningPhase === "thinking"} />
            </motion.div>
          )}

          {planSteps.map((step, i) => (
            <PlanStepRow
              key={step.id}
              step={step}
              traceEntries={traceEntries}
              isLast={i === planSteps.length - 1}
            />
          ))}
        </AnimatePresence>

        {/* Execution summary after all steps finish */}
        <ExecutionSummary planSteps={planSteps} traceEntries={traceEntries} />

        <div className="h-6" />
      </div>
    </div>
  );
}
