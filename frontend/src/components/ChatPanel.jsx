/**
 * ChatPanel — Conversation thread for SportScout AI
 * The sexy fiery dark aesthetic version.
 */
import React, { useEffect, useRef, useState } from "react";
import { Brain, BookOpen, Eye, ChevronDown, ChevronUp, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import RadarChartView from "./RadarChart";
import StatsTable from "./StatsTable";
import BasketballSVG from "./BasketballSVG";

/** Shared markdown components — tight spacing, no bloat */
const markdownComponents = {
  table: ({ children }) => (
    <div className="overflow-x-auto my-2 rounded-xl border border-orange-500/15">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-orange-500/10 border-b border-orange-500/20">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-xs font-black uppercase tracking-wider text-orange-400/90 border-b border-orange-500/10">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-1.5 text-sm text-zinc-300 border-b border-white/[0.04] font-medium">{children}</td>
  ),
  tr: ({ children }) => (
    <tr className="hover:bg-orange-500/5 transition-colors">{children}</tr>
  ),
  strong: ({ children }) => (
    <strong className="font-black text-orange-400">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="text-amber-300/90 not-italic font-semibold">{children}</em>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300 mt-2 mb-1 tracking-tight">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-400 mt-1.5 mb-0.5 tracking-tight">{children}</h3>
  ),
  ul: ({ children }) => (
    <ul className="space-y-1 my-1.5 ml-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="space-y-1 my-1.5 ml-1 list-decimal list-inside">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="flex gap-2 text-zinc-300 leading-snug">
      <span className="text-orange-500 mt-0.5 flex-shrink-0">▸</span>
      <span>{children}</span>
    </li>
  ),
  hr: () => (
    <hr className="my-2 border-orange-500/15" />
  ),
  p: ({ children }) => (
    <p className="mb-1 last:mb-0 leading-snug">{children}</p>
  ),
  code: ({ inline, children }) =>
    inline ? (
      <code className="bg-orange-500/10 text-orange-300 px-1.5 py-0.5 rounded-md text-[13px] font-mono font-bold">{children}</code>
    ) : (
      <code className="block bg-[#0a0a0a] border border-white/[0.05] rounded-lg p-3 text-[13px] font-mono text-zinc-300 overflow-x-auto my-1.5">{children}</code>
    ),
};

/** Per-message reasoning block — demo-worthy, persistent on every assistant message */
function MessageReasoning({ reasoning }) {
  const [expanded, setExpanded] = useState(false);
  const { thinking, steps, sources } = reasoning;
  const passedSteps = steps.filter((s) => s.status === "done").length;
  const failedSteps = steps.filter((s) => s.status === "failed").length;
  const totalMs = steps.reduce((sum, s) => sum + (s.elapsedMs || 0), 0);

  const statusIcon = (status) => {
    if (status === "done") return <span className="text-emerald-400">✓</span>;
    if (status === "failed") return <span className="text-red-400">✗</span>;
    if (status === "denied") return <span className="text-zinc-500">⊘</span>;
    return <span className="text-amber-400">●</span>;
  };

  return (
    <div className="mt-3 rounded-xl border border-cyan-500/15 bg-gradient-to-b from-cyan-500/[0.04] to-transparent overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-cyan-500/[0.06] transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-cyan-500/15 flex items-center justify-center">
            <Brain size={11} className="text-cyan-400" />
          </div>
          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-cyan-400/80">
            Agent Reasoning
          </span>
          {steps.length > 0 && (
            <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800/80 px-2 py-0.5 rounded-full">
              {passedSteps}/{steps.length} steps · {totalMs > 0 ? `${totalMs}ms` : "< 1ms"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {sources.length > 0 && (
            <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/20">
              {sources.length} source{sources.length > 1 ? "s" : ""}
            </span>
          )}
          {expanded ? <ChevronUp size={13} className="text-cyan-500/60" /> : <ChevronDown size={13} className="text-cyan-500/60" />}
        </div>
      </button>

      {/* Expandable details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3 space-y-2.5">
              {/* Knowledge sources */}
              {sources.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {sources.map((src, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-violet-500/12 text-violet-400 border border-violet-500/25">
                      <BookOpen size={9} />
                      {src.label}{src.count ? ` (${src.count})` : ""}
                    </span>
                  ))}
                </div>
              )}

              {/* Agent thinking */}
              {thinking && (
                <div className="text-[11px] text-cyan-300/60 bg-[#080c10] border border-cyan-900/20 rounded-lg px-3 py-2 max-h-24 overflow-y-auto custom-scrollbar italic leading-relaxed">
                  <Eye size={9} className="inline mr-1.5 text-cyan-500/70" />
                  {thinking.length > 500 ? thinking.slice(0, 500) + "..." : thinking}
                </div>
              )}

              {/* Steps — rich detail with tool summaries */}
              {steps.length > 0 && (
                <div className="space-y-1.5">
                  {steps
                    .slice()
                    .sort((a, b) => a.id - b.id)
                    .map((step) => (
                      <div key={step.id} className={`rounded-lg border transition-colors ${
                        step.status === "done" ? "bg-emerald-500/[0.04] border-emerald-500/15"
                        : step.status === "failed" ? "bg-red-500/[0.04] border-red-500/15"
                        : "bg-zinc-800/20 border-zinc-800/30"
                      }`}>
                        {/* Step header */}
                        <div className="flex items-center gap-2 px-2.5 py-1.5 text-[11px]">
                          <span className="text-[10px] w-4 text-center flex-shrink-0">{statusIcon(step.status)}</span>
                          <span className="text-zinc-500 font-mono text-[10px] flex-shrink-0">#{step.id}</span>
                          {step.tool && (
                            <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 ${
                              step.tool === "fetch_sports_data" ? "text-orange-400/80 bg-orange-500/10 border border-orange-500/15"
                              : step.tool === "compare_entities" ? "text-rose-400/80 bg-rose-500/10 border border-rose-500/15"
                              : step.tool === "search_history" ? "text-violet-400/80 bg-violet-500/10 border border-violet-500/15"
                              : step.tool === "generate_excel" ? "text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/15"
                              : step.tool === "query_players" ? "text-zinc-300/80 bg-zinc-500/10 border border-zinc-500/15"
                              : "text-zinc-400/80 bg-zinc-500/10 border border-zinc-500/15"
                            }`}>
                              {step.tool.replace(/_/g, " ")}
                            </span>
                          )}
                          <span className="text-zinc-400 truncate flex-1 text-[11px]">{step.description}</span>
                          {(step.elapsedMs != null && step.elapsedMs > 0) && (
                            <span className="text-[10px] text-zinc-600 font-mono flex-shrink-0">{step.elapsedMs}ms</span>
                          )}
                        </div>
                        {/* Tool result summary — the cleaned interpretation */}
                        {step.summary && (
                          <div className="px-2.5 pb-2 pl-9">
                            <p className="text-[10.5px] text-zinc-400/80 leading-relaxed">
                              {step.summary}
                            </p>
                          </div>
                        )}
                        {/* Error detail */}
                        {step.error && (
                          <div className="px-2.5 pb-2 pl-9">
                            <p className="text-[10.5px] text-red-400/80 leading-relaxed">
                              {step.error}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}

              {/* Summary bar */}
              {steps.length > 0 && (
                <div className="flex items-center gap-3 pt-1 border-t border-white/[0.04] text-[10px] text-zinc-500 font-bold">
                  <span className="flex items-center gap-1"><span className="text-emerald-400">✓</span> {passedSteps} passed</span>
                  {failedSteps > 0 && <span className="flex items-center gap-1"><span className="text-red-400">✗</span> {failedSteps} failed</span>}
                  <span className="ml-auto">{totalMs > 0 ? `${totalMs}ms total` : "< 1ms total"}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ChatPanel({ messages, isStreaming, planSteps = [], planningPhase = null, planningThinking = null, streamingResponse = "", knowledgeSources = [] }) {
  const bottomRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const userScrolledUp = useRef(false);
  const [reasoningExpanded, setReasoningExpanded] = useState(true);

  // Detect if user has scrolled up
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      userScrolledUp.current = !atBottom;
    };
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // Only auto-scroll if user hasn't scrolled up
  useEffect(() => {
    if (!userScrolledUp.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isStreaming, planSteps, streamingResponse]);

  const totalSteps = planSteps.length;
  const completedSteps = planSteps.filter((s) => ["done", "failed", "denied"].includes(s.status)).length;
  const runningStep = planSteps.find((s) => s.status === "running");
  const pendingStep = !runningStep ? planSteps.find((s) => s.status === "pending") : null;
  const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const liveStatusTitle = planningPhase === "thinking"
    ? "Analyzing Request"
    : runningStep
      ? `Running Step ${runningStep.id}`
      : pendingStep
        ? "Queued Next Step"
        : totalSteps > 0
          ? "Executing Plan"
          : "Working";
  const liveStatusText = planningPhase === "thinking"
    ? "Reading your prompt and deciding the best tool flow."
    : runningStep
      ? `${runningStep.description}`
      : pendingStep
        ? `${pendingStep.description}`
        : "Preparing tool calls and response synthesis.";

  // Always keep reasoning expanded by default — user can manually toggle
  useEffect(() => {
    if (planningPhase === "thinking") setReasoningExpanded(true);
  }, [planningPhase]);

  return (
    <div className="flex flex-col h-full bg-[#050505] relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-orange-900/10 to-transparent pointer-events-none z-0" />
      <div className="absolute top-1/3 -left-32 w-80 h-80 bg-rose-600/5 rounded-full blur-[120px] pointer-events-none z-0" />



      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto py-8 scroll-smooth z-10 custom-scrollbar relative">
        <div className="max-w-3xl mx-auto px-6 space-y-6">
        <AnimatePresence>
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center h-[70%] text-center relative"
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-orange-600/20 blur-[60px] animate-pulse-ring rounded-full" />

              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className="relative mb-8 w-24 h-24"
              >
                <BasketballSVG className="w-full h-full text-orange-600/80 drop-shadow-[0_0_15px_rgba(234,88,12,0.6)]" />
              </motion.div>
              <h3 className="text-2xl font-black text-white mb-3 tracking-tight z-10">Lace Up.</h3>
              <p className="text-zinc-400 text-sm max-w-xs leading-relaxed font-medium z-10">
                Awaiting your first play. Ask me for stats, comparisons, or deep scouting reports.
              </p>
            </motion.div>
          )}

          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              className={`w-full ${msg.role === "user" ? "flex justify-end" : ""}`}
            >
              {msg.role === "user" ? (
                /* ── User message: right-aligned pill ── */
                <div className="max-w-[75%] px-5 py-3 rounded-2xl rounded-tr-sm bg-gradient-to-br from-orange-600 to-amber-700 text-white text-[15px] leading-snug font-medium whitespace-pre-wrap">
                  {msg.content}
                </div>
              ) : (
                /* ── Assistant message: clean, no bubble (ChatGPT style) ── */
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-[#0a0a0a] border border-orange-500/20 flex items-center justify-center">
                      <BasketballSVG className="w-4 h-4 text-orange-500" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest text-orange-500/70">SportScout</span>
                  </div>

                  {msg.isError ? (
                    <div className="text-[15px] leading-relaxed text-red-300 font-medium">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="text-[15px] leading-relaxed text-zinc-200 font-medium prose-chat">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}

                  {/* Inline Chart */}
                  {msg.chartData && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 rounded-xl border border-orange-500/15 bg-[#09090b] p-4 h-[400px] overflow-hidden"
                    >
                      <RadarChartView data={msg.chartData} />
                    </motion.div>
                  )}

                  {/* Inline Table */}
                  {msg.tableData && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 rounded-xl border border-orange-500/15 bg-[#09090b] p-4"
                    >
                      <StatsTable data={msg.tableData} />
                    </motion.div>
                  )}

                  {/* Download Button */}
                  {msg.downloadFile && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4"
                    >
                      <button
                        onClick={() => {
                          const { filename, content, mime_type } = msg.downloadFile;
                          const blob = new Blob([content], { type: mime_type || "text/plain" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = filename;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        }}
                        className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-bold tracking-wide transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] active:scale-95"
                      >
                        <Download size={16} strokeWidth={2.5} />
                        Download {msg.downloadFile.filename}
                      </button>
                    </motion.div>
                  )}

                  {/* Per-message expandable reasoning */}
                  {msg.reasoning && (msg.reasoning.thinking || msg.reasoning.steps.length > 0) && (
                    <MessageReasoning reasoning={msg.reasoning} />
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Streaming Response — shows token-by-token OR inline reasoning + bouncing dots */}
        <AnimatePresence>
          {isStreaming && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="w-full pt-2"
            >
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-[#0a0a0a] border border-orange-500/20 flex items-center justify-center">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}>
                      <BasketballSVG className="w-4 h-4 text-orange-500" />
                    </motion.div>
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest text-orange-500/70">SportScout</span>
                </div>

                    {streamingResponse ? (
                      /* Live token-by-token response */
                      <div className="text-[15px] leading-relaxed text-zinc-200 font-medium prose-chat">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{streamingResponse}</ReactMarkdown>
                        <motion.span
                          animate={{ opacity: [1, 0, 1] }}
                          transition={{ duration: 0.8, repeat: Infinity }}
                          className="inline-block w-2 h-5 bg-orange-500 ml-1 rounded-sm align-middle"
                        />
                      </div>
                    ) : (
                      /* Inline reasoning + bouncing dots */
                      <div className="min-w-[280px]">
                        <div className="flex items-center gap-3">
                          {[0, 0.2, 0.4].map((delay, idx) => (
                            <motion.div
                              key={idx}
                              animate={{ scale: [1, 1.8, 1], opacity: [0.3, 1, 0.3], backgroundColor: ["#ea580c", "#fcd34d", "#ea580c"] }}
                              transition={{ duration: 1.2, repeat: Infinity, delay }}
                              className="w-2.5 h-2.5 rounded-full shadow-[0_0_15px_rgba(249,115,22,0.8)]"
                            />
                          ))}
                          <span className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-400/90">
                            {liveStatusTitle}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm text-zinc-300 font-medium leading-snug">
                          {liveStatusText}
                        </p>

                        {/* Knowledge sources badge */}
                        {knowledgeSources.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="mt-2 flex items-center gap-2 flex-wrap"
                          >
                            {knowledgeSources.map((src, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-violet-500/15 text-violet-400 border border-violet-500/30 shadow-[0_0_10px_rgba(139,92,246,0.15)]">
                                <BookOpen size={10} />
                                {src.label}{src.count ? ` (${src.count})` : ""}
                              </span>
                            ))}
                          </motion.div>
                        )}


                        {/* Expandable reasoning details — always visible during streaming */}
                        <div className="mt-3 border-t border-white/[0.06] pt-2">
                          <button
                            onClick={() => setReasoningExpanded((prev) => !prev)}
                            className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-cyan-400/80 hover:text-cyan-300 transition-colors py-1"
                          >
                            <Brain size={12} className="text-cyan-500" />
                            {reasoningExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            {reasoningExpanded ? "Hide Reasoning" : "Show Reasoning"}
                          </button>

                          <AnimatePresence>
                            {reasoningExpanded && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                {/* Agent thinking text */}
                                {planningThinking ? (
                                  <div className="mt-2 text-[12px] text-cyan-300/70 bg-[#0a0a0a] border border-cyan-800/30 rounded-lg px-3 py-2 max-h-28 overflow-y-auto custom-scrollbar italic">
                                    <Eye size={10} className="inline mr-1.5 text-cyan-500" />
                                    {planningThinking.length > 400 ? planningThinking.slice(0, 400) + "..." : planningThinking}
                                  </div>
                                ) : planningPhase === "thinking" ? (
                                  <div className="mt-2 text-[12px] text-cyan-300/50 italic">
                                    <Eye size={10} className="inline mr-1.5 text-cyan-500 animate-pulse" />
                                    Analyzing query and deciding next action...
                                  </div>
                                ) : null}

                                {/* Plan steps list */}
                                {totalSteps > 0 && (
                                  <div className="mt-2 space-y-1.5">
                                    {planSteps
                                      .slice()
                                      .sort((a, b) => a.id - b.id)
                                      .map((step) => (
                                        <div key={step.id} className="flex items-center gap-2 text-[11px]">
                                          <span className={`w-1.5 h-1.5 rounded-full ${step.status === "done"
                                            ? "bg-emerald-500"
                                            : step.status === "running"
                                              ? "bg-orange-400 animate-pulse"
                                              : step.status === "failed"
                                                ? "bg-red-500"
                                                : step.status === "denied"
                                                  ? "bg-zinc-500"
                                                  : "bg-amber-400"
                                            }`} />
                                          <span className="text-zinc-300/90 font-semibold">Step {step.id}</span>
                                          <span className="text-zinc-500 truncate">{step.description}</span>
                                        </div>
                                      ))}
                                  </div>
                                )}

                                {/* Fallback when no thinking and no steps yet */}
                                {!planningThinking && totalSteps === 0 && planningPhase !== "thinking" && (
                                  <div className="mt-2 text-[12px] text-zinc-500 italic">
                                    Preparing tool calls...
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} className="h-6" />
        </div>
      </div>
    </div>
  );
}
