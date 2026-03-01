/**
 * App — Root layout for SportScout AI
 *
 * Super animated NBA theme with glowing ambers, crimsons and sexy SVGs.
 */
import React, { useState, useRef, useEffect } from "react";
import { Send, X, CheckCircle2, AlertTriangle, Info, Plus, ChevronRight, Activity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import useAgentStream from "./hooks/useAgentStream";
import ChatPanel from "./components/ChatPanel";
import TracePanel from "./components/TracePanel";
import ApprovalModal from "./components/ApprovalModal";
import LandingPage from "./components/LandingPage";
import CustomCursor from "./components/CustomCursor";
import BasketballSVG from "./components/BasketballSVG";

/** Awesome SVG of a player bouncing a basketball */
const PlayerBouncingSVG = ({ className }) => (
  <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <g stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
      {/* Player silhouette */}
      <circle cx="90" cy="40" r="10" />
      <path d="M90 50 Q110 80 100 120" /> {/* Body */}
      <path d="M100 120 L80 160 M100 120 L120 160" /> {/* Legs */}
      <path d="M90 60 Q70 80 60 100" /> {/* Back arm */}

      {/* Dribbling arm - animated via framer-motion below */}
      <motion.path
        d="M90 60 Q120 70 140 100"
        animate={{ d: ["M90 60 Q120 70 140 100", "M90 60 Q120 80 140 120", "M90 60 Q120 70 140 100"] }}
        transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
      />
    </g>

    {/* The ball - animated bouncing */}
    <motion.g
      animate={{ y: [0, 40, 0] }}
      transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
    >
      <circle cx="140" cy="110" r="12" fill="currentColor" />
      <path d="M140 98 V122 M128 110 H152 M132 102 Q150 110 132 118" stroke="#050505" strokeWidth="1.5" fill="transparent" />
    </motion.g>

    {/* Floor reflection / shadow */}
    <motion.ellipse
      cx="140" cy="160" rx="15" ry="3" fill="currentColor"
      animate={{ rx: [15, 25, 15], opacity: [0.3, 0.7, 0.3] }}
      transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
    />
  </svg>
);

/** Subtle rolling-ball lane for premium motion ambience */
const RollingBallLane = () => (
  <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 hidden lg:block">
    <div className="relative h-16 overflow-hidden border-b border-orange-500/10 bg-gradient-to-r from-transparent via-orange-500/[0.03] to-transparent">
      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-transparent via-orange-500/25 to-transparent" />
      <motion.div
        aria-hidden
        animate={{ x: ["-8%", "108%"], rotate: [0, 1080] }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        className="absolute left-0 top-1/2 -translate-y-1/2"
      >
        <div className="relative">
          <div className="absolute inset-0 blur-xl bg-orange-500/25 rounded-full scale-125" />
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-rose-500 border border-orange-200/20 shadow-[0_0_30px_rgba(249,115,22,0.35)] p-1.5 relative">
            <BasketballSVG className="w-full h-full text-white/90" />
          </div>
        </div>
      </motion.div>
    </div>
  </div>
);

const EXAMPLE_PROMPTS = [
  {
    label: "Head-to-Head Duel",
    query: "Compare Nikola Jokic vs Shai Gilgeous-Alexander this season: scoring, assists, rebounds, efficiency — show me a radar chart",
  },
  {
    label: "MVP Breakdown",
    query: "Give me Luka Doncic's full season stats breakdown: scoring, shooting splits, turnovers, and double-doubles",
  },
  {
    label: "Young Guns Search",
    query: "Find all guards under 24 years old, sort by height — who are the tallest young guards in the league right now?",
  },
  {
    label: "Conference Standings",
    query: "Show me the current Western Conference standings with win-loss records and streaks",
  },
];

function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-4 right-4 z-[100] space-y-3 max-w-sm">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon =
            toast.type === "error" ? AlertTriangle : toast.type === "success" ? CheckCircle2 : Info;
          const colors =
            toast.type === "error"
              ? "bg-[#2a0e0e]/95 border-red-700/50 text-red-200 shadow-[0_0_20px_rgba(220,38,38,0.3)]"
              : toast.type === "success"
                ? "bg-[#0a1f11]/95 border-emerald-700/50 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                : "bg-[#111111]/95 border-zinc-600/50 text-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.1)]";

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, x: 20 }}
              className={`flex items-center gap-3 px-4 py-3 border backdrop-blur-md rounded-2xl ${colors}`}
            >
              <Icon size={18} className="flex-shrink-0" />
              <span className="text-sm font-semibold flex-1">{toast.message}</span>
              <button
                onClick={() => onDismiss(toast.id)}
                className="text-white/40 hover:text-white transition-colors p-1"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  const [authToken, setAuthToken] = useState(() => localStorage.getItem("sportscout_auth_token"));
  const [currentUser, setCurrentUser] = useState(() => {
    const raw = localStorage.getItem("sportscout_user");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(localStorage.getItem("sportscout_auth_token")));

  const {
    messages,
    planSteps,
    traceEntries,
    approvalRequest,
    isStreaming,
    toasts,
    planningPhase,
    planningThinking,
    streamingResponse,
    knowledgeSources,
    sendMessage,
    sendApproval,
    dismissToast,
  } = useAgentStream({ authToken });

  const [input, setInput] = useState("");
  const inputRef = useRef(null);

  const [rightPanelExpanded, setRightPanelExpanded] = useState(false);

  // Validate token with backend on mount — if invalid, stay on chat but silently clear
  // Only logout happens via explicit logout button
  useEffect(() => {
    const token = localStorage.getItem("sportscout_auth_token");
    if (!token) return;

    fetch("/api/validate-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auth_token: token }),
    })
      .then((res) => {
        if (!res.ok) {
          // Token invalid on backend — clear local state, show login
          setAuthToken(null);
          setCurrentUser(null);
          setIsLoggedIn(false);
          localStorage.removeItem("sportscout_auth_token");
          localStorage.removeItem("sportscout_user");
        }
      })
      .catch(() => {
        // Backend unreachable — keep user on chat screen (don't log out)
        // They'll see errors when they try to send a message
      });
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      inputRef.current?.focus();
    }
  }, [isLoggedIn]);

  const handleAuth = async ({ mode, username, password }) => {
    const endpoint = mode === "register" ? "/api/register" : "/api/login";
    let response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
    } catch {
      throw new Error("Cannot connect to server. Is the backend running?");
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(`Server error (${response.status}). Is the backend running?`);
    }
    if (!response.ok) {
      throw new Error(data?.detail || "Authentication failed");
    }
    setAuthToken(data.token);
    setCurrentUser(data.user);
    setIsLoggedIn(true);
    localStorage.setItem("sportscout_auth_token", data.token);
    localStorage.setItem("sportscout_user", JSON.stringify(data.user));
  };

  const handleLogout = () => {
    // Invalidate token on backend too
    const token = localStorage.getItem("sportscout_auth_token");
    if (token) {
      fetch("/api/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auth_token: token }),
      }).catch(() => {}); // fire-and-forget
    }
    setAuthToken(null);
    setCurrentUser(null);
    setIsLoggedIn(false);
    localStorage.removeItem("sportscout_auth_token");
    localStorage.removeItem("sportscout_user");
    window.location.reload();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    sendMessage(input.trim());
    setInput("");
  };

  const hasConversation = messages.length > 0;

  if (!isLoggedIn) {
    return (
      <>
        <CustomCursor />
        <LandingPage onLogin={handleAuth} />
      </>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#050505] text-white overflow-hidden selection:bg-orange-500/30">
      <CustomCursor />
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <motion.header
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex items-center justify-between px-6 py-4 border-b border-orange-500/10 bg-[#050505]/80 backdrop-blur-2xl z-30 sticky top-0"
      >
        <div className="flex items-center gap-4">
          <motion.div
            whileHover={{ scale: 1.1, rotate: 180 }}
            whileTap={{ scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 via-amber-600 to-rose-600 flex items-center justify-center shadow-[0_0_25px_rgba(249,115,22,0.4)]"
          >
            <BasketballSVG className="w-6 h-6 text-white drop-shadow-md" />
          </motion.div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-orange-200">
              SportScout Ultra
            </h1>
            <p className="text-[11px] text-orange-500 font-bold tracking-[0.2em] uppercase mt-0.5">
              Elite NBA Agent
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <AnimatePresence>
            {isStreaming && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: -20 }}
                className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.2)]"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-3.5 h-3.5"
                >
                  <BasketballSVG className="w-full h-full text-orange-400" />
                </motion.div>
                <span className="text-xs text-orange-400 font-bold tracking-widest uppercase">
                  Analyzing
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider hidden sm:block">
            {currentUser?.username || "User"} <span className="text-zinc-700">|</span> Sportradar AI
          </div>
          <button
            onClick={handleLogout}
            className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors"
          >
            Logout
          </button>
        </div>
      </motion.header>

      {/* ── Main 3-Panel Layout ─────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">
        {hasConversation && <RollingBallLane />}
        <AnimatePresence mode="wait">
          {!hasConversation ? (
            <motion.div
              key="empty-state"
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -30, scale: 0.95 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="absolute inset-0 flex items-center justify-center p-6 z-10 overflow-hidden"
            >
              {/* Massive background glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] h-[100vh] bg-gradient-to-br from-orange-600/5 via-rose-600/5 to-amber-600/5 blur-[120px] pointer-events-none z-0" />

              {/* HUGE Full-Screen Running Player Background */}
              <div className="absolute inset-0 z-0 flex items-center justify-center opacity-10 text-orange-500 pointer-events-none">
                <motion.div
                  animate={{ x: ["-80vw", "120vw"] }}
                  transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                  className="absolute top-1/2 -translate-y-1/2 flex items-center"
                >
                  <PlayerBouncingSVG className="w-[90vh] h-[90vh]" />
                </motion.div>
              </div>

              <div className="text-center max-w-5xl px-6 md:px-10 py-8 md:py-10 relative z-10">
                <div className="relative inline-block mb-4">
                  <motion.h2
                    animate={{
                      backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                      textShadow: [
                        "0 0 0px rgba(251,191,36,0)",
                        "0 0 20px rgba(251,191,36,0.4)",
                        "0 0 0px rgba(251,191,36,0)",
                      ],
                    }}
                    transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                    style={{ backgroundSize: "220% 220%" }}
                    className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 via-orange-100 to-orange-400 tracking-tight relative z-10"
                  >
                    Welcome to the Court
                  </motion.h2>
                  <motion.span
                    aria-hidden
                    animate={{ backgroundPosition: ["-150% 50%", "180% 50%"] }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: "linear", repeatDelay: 1.2 }}
                    style={{ backgroundSize: "240% 100%" }}
                    className="absolute inset-0 text-4xl md:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-transparent via-white/95 to-transparent pointer-events-none"
                  >
                    Welcome to the Court
                  </motion.span>
                </div>
                <p className="text-base md:text-lg text-zinc-300 mb-7 leading-relaxed max-w-2xl mx-auto font-medium relative z-10 drop-shadow-md">
                  NBA intelligence powered by Sportradar data.
                </p>

                <div className="mb-3 flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.2em] text-orange-400/80 font-black">
                  <span className="h-px w-8 bg-orange-500/30" />
                  Recommended Starters
                  <span className="h-px w-8 bg-orange-500/30" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 relative z-10">
                  {EXAMPLE_PROMPTS.map((prompt, i) => (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 * i, type: "spring" }}
                      whileHover={{ scale: 1.02, backgroundColor: "rgba(249,115,22,0.18)", borderColor: "rgba(249,115,22,0.45)", boxShadow: "0 14px 36px rgba(249,115,22,0.16)" }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => !isStreaming && sendMessage(prompt.query)}
                      className="text-left px-4 py-3.5 rounded-2xl bg-[#101014]/90 border border-white/[0.08] text-[14px] font-semibold text-zinc-100 hover:text-white transition-all flex items-start gap-3.5 group shadow-[0_10px_26px_rgba(0,0,0,0.32)] backdrop-blur-md min-h-[96px]"
                    >
                      <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/20 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white text-orange-400 transition-all duration-300 shadow-inner group-hover:shadow-[0_0_15px_rgba(249,115,22,0.6)]">
                        <Plus size={16} strokeWidth={3} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-orange-400/90 mb-1">
                          {prompt.label}
                        </div>
                        <div className="text-[13px] md:text-[14px] leading-[1.35] font-semibold text-zinc-100">
                          {prompt.query}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="workspace"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="flex w-full h-full overflow-hidden"
            >
              {/* LEFT — Chat (Thread) - Takes maximum space */}
              <motion.div
                layout
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 25 }}
                className="flex-1 min-w-0 md:min-w-[400px] border-r border-orange-500/10 bg-[#050505] shadow-[20px_0_30px_rgba(0,0,0,0.5)] z-20 relative flex flex-col"
              >
                <ChatPanel messages={messages} isStreaming={isStreaming} planSteps={planSteps} planningPhase={planningPhase} planningThinking={planningThinking} streamingResponse={streamingResponse} knowledgeSources={knowledgeSources} />
              </motion.div>

              {/* RIGHT — Collapsible Sidebar for Trace */}
              <motion.div
                layout
                initial={{ width: 64 }}
                animate={{ width: rightPanelExpanded ? "min(500px, 92vw)" : 64 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="flex flex-col bg-[#09090b] z-30 border-l border-white/[0.02] relative overflow-hidden flex-shrink-0"
              >
                {/* Collapsed State Icon */}
                <AnimatePresence>
                  {!rightPanelExpanded && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex flex-col items-center py-6 gap-6 w-16 bg-[#09090b] z-40 border-l border-orange-500/10 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]"
                    >
                      <button
                        onClick={() => setRightPanelExpanded(true)}
                        className="p-3 rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)] group relative"
                        title="Open Playbook Trace"
                      >
                        <Activity size={22} strokeWidth={2.5} className="group-hover:scale-110 transition-transform" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Expanded State */}
                <div className="flex flex-col h-full w-full">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-orange-500/10 bg-[#050505]/95 backdrop-blur-3xl shrink-0">
                    <div className="flex">
                      <div className="px-6 py-4 text-[13px] font-black uppercase tracking-[0.15em] text-amber-500 border-b-2 border-amber-500 bg-amber-500/5 shadow-[inset_0_-2px_10px_rgba(245,158,11,0.1)] flex items-center gap-2">
                        <Activity size={16} /> Trace
                      </div>
                    </div>
                    <button
                      onClick={() => setRightPanelExpanded(false)}
                      className="px-4 text-zinc-500 hover:text-white transition-colors"
                      title="Collapse Panel"
                    >
                      <ChevronRight size={22} className="hover:-translate-x-0.5 transition-transform" />
                    </button>
                  </div>

                  {/* Panel Content */}
                  <div className="flex-1 overflow-hidden relative bg-[#09090b]">
                    <TracePanel
                      planSteps={planSteps}
                      traceEntries={traceEntries}
                      isStreaming={isStreaming}
                      planningPhase={planningPhase}
                      planningThinking={planningThinking}
                      knowledgeSources={knowledgeSources}
                    />
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Input Bar ───────────────────────────────────────────────────── */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 250, damping: 30 }}
        className="border-t border-orange-500/10 bg-[#09090b]/95 backdrop-blur-2xl px-6 py-5 z-40 relative shadow-[0_-20px_40px_rgba(0,0,0,0.5)]"
      >
        <form onSubmit={handleSubmit} className="max-w-6xl mx-auto flex items-center gap-5 relative">
          <div className="flex-1 relative group z-10">
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 via-rose-500 to-amber-500 rounded-2xl opacity-20 group-hover:opacity-100 blur-lg transition duration-700 group-focus-within:opacity-100"></div>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isStreaming
                  ? "Agent is compiling data..."
                  : "Ask about NBA stats, historical matchups, or scouting info..."
              }
              disabled={isStreaming}
              className="relative w-full bg-[#111111] border border-orange-500/20 rounded-2xl px-6 py-4 text-lg font-medium text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 focus:bg-[#151515] transition-all disabled:opacity-50"
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-rose-600 hover:from-orange-400 hover:to-rose-500 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500 text-white transition-all shadow-[0_0_30px_rgba(249,115,22,0.4)] disabled:shadow-none overflow-hidden group z-10"
          >
            <AnimatePresence mode="wait">
              {isStreaming ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1, rotate: 360 }}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <BasketballSVG className="w-7 h-7 text-white/80" />
                </motion.div>
              ) : (
                <motion.div
                  key="send"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                >
                  <Send size={24} className="ml-1 drop-shadow-md group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </form>
      </motion.div>

      <ApprovalModal request={approvalRequest} onApprove={sendApproval} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
