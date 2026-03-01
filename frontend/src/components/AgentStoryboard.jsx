import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/* ═══════════════════════════════════════════════════════════
   SVG CHARACTERS
   ═══════════════════════════════════════════════════════════ */

const UserSVG = () => (
    <svg viewBox="0 0 160 280" fill="none" className="w-full h-full">
        <ellipse cx="80" cy="272" rx="50" ry="8" fill="black" opacity="0.4" />
        <path d="M58 200 L52 252 Q50 260 56 260 L66 260 Q72 260 70 252 L68 200" fill="#2a2a30" stroke="#3f3f46" strokeWidth="2" />
        <path d="M92 200 L88 252 Q86 260 92 260 L102 260 Q108 260 106 252 L100 200" fill="#2a2a30" stroke="#3f3f46" strokeWidth="2" />
        <path d="M42 110 Q40 108 44 95 L60 88 L100 88 L116 95 Q120 108 118 110 L120 200 Q120 206 114 206 L46 206 Q40 206 40 200 Z" fill="#3f3f46" stroke="#52525b" strokeWidth="2" />
        <path d="M56 150 Q56 146 60 146 L100 146 Q104 146 104 150 L104 168 Q104 172 100 172 L60 172 Q56 172 56 168 Z" fill="#35353d" stroke="#52525b" strokeWidth="1" />
        <line x1="80" y1="95" x2="80" y2="206" stroke="#52525b" strokeWidth="1" strokeDasharray="4 4" />
        <path d="M42 108 L24 140 Q20 148 24 152 L30 160 Q34 164 36 158 L44 130" fill="#3f3f46" stroke="#52525b" strokeWidth="2" />
        <g className="vid-user-arm" style={{ transformOrigin: "118px 108px" }}>
            <path d="M118 108 L136 140 Q140 148 136 152 L130 160 Q126 164 124 158 L116 130" fill="#3f3f46" stroke="#52525b" strokeWidth="2" />
            <circle cx="133" cy="158" r="8" fill="#d4d4d8" stroke="#a1a1aa" strokeWidth="1.5" />
        </g>
        <rect x="68" y="80" width="24" height="14" rx="4" fill="#d4d4d8" />
        <circle cx="80" cy="52" r="36" fill="#e4e4e7" stroke="#d4d4d8" strokeWidth="2" />
        <path d="M44 46 Q44 18 80 16 Q116 18 116 46 Q116 38 108 32 Q96 24 80 24 Q64 24 52 32 Q44 38 44 46 Z" fill="#52525b" />
        <ellipse cx="66" cy="50" rx="5" ry="6" fill="#18181b" /><circle cx="64" cy="48" r="2" fill="white" opacity="0.8" />
        <ellipse cx="94" cy="50" rx="5" ry="6" fill="#18181b" /><circle cx="92" cy="48" r="2" fill="white" opacity="0.8" />
        <path d="M68 66 Q80 76 92 66" stroke="#18181b" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M42 42 Q42 14 80 12 Q118 14 118 42" stroke="#f97316" strokeWidth="4" fill="none" strokeLinecap="round" />
        <rect x="34" y="38" width="12" height="18" rx="6" fill="#f97316" />
        <rect x="114" y="38" width="12" height="18" rx="6" fill="#f97316" />
    </svg>
);

const AgentSVG = () => (
    <svg viewBox="0 0 180 300" fill="none" className="w-full h-full">
        <ellipse cx="90" cy="290" rx="60" ry="10" fill="#f97316" opacity="0.15" />
        <rect x="52" y="242" width="20" height="24" rx="4" fill="#27272a" stroke="#3f3f46" strokeWidth="2" />
        <ellipse className="vid-flame-l" cx="62" cy="272" rx="7" ry="14" fill="url(#fg)" opacity="0.8" />
        <rect x="108" y="242" width="20" height="24" rx="4" fill="#27272a" stroke="#3f3f46" strokeWidth="2" />
        <ellipse className="vid-flame-r" cx="118" cy="272" rx="7" ry="14" fill="url(#fg)" opacity="0.8" />
        <rect x="38" y="120" width="104" height="126" rx="16" fill="#18181b" stroke="#f97316" strokeWidth="3" />
        <circle cx="90" cy="175" r="18" fill="#18181b" stroke="#f97316" strokeWidth="2" />
        <circle className="vid-core" cx="90" cy="175" r="12" fill="#f97316" opacity="0.2" />
        <path d="M90 167 L92 173 L98 175 L92 177 L90 183 L88 177 L82 175 L88 173 Z" fill="#f97316" opacity="0.9" />
        <g className="vid-agent-arm" style={{ transformOrigin: "38px 128px" }}>
            <path d="M38 128 L16 162 Q12 170 16 174 L22 182 Q26 186 28 180 L36 152" fill="#18181b" stroke="#f97316" strokeWidth="2.5" />
            <circle cx="19" cy="180" r="10" fill="#18181b" stroke="#f97316" strokeWidth="2" />
            <path d="M14 176 L12 172 M19 174 L19 170 M24 176 L26 172" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" />
        </g>
        <path d="M142 128 L164 162 Q168 170 164 174 L158 182 Q154 186 152 180 L144 152" fill="#18181b" stroke="#ea580c" strokeWidth="2.5" />
        <circle cx="161" cy="180" r="10" fill="#18181b" stroke="#ea580c" strokeWidth="2" />
        <rect x="72" y="98" width="36" height="26" rx="8" fill="#27272a" stroke="#f97316" strokeWidth="2" />
        <g className="vid-agent-head">
            <rect x="34" y="28" width="112" height="76" rx="20" fill="#18181b" stroke="#f97316" strokeWidth="3" />
            <line x1="90" y1="28" x2="90" y2="10" stroke="#f97316" strokeWidth="2" />
            <circle className="vid-antenna" cx="90" cy="8" r="5" fill="#f97316" />
            <rect x="50" y="48" width="80" height="28" rx="14" fill="#09090b" stroke="#27272a" strokeWidth="2" />
            <circle className="vid-eye-l" cx="72" cy="62" r="8" fill="#f97316" opacity="0.9" />
            <circle cx="70" cy="60" r="3" fill="#fbbf24" opacity="0.6" />
            <circle className="vid-eye-r" cx="108" cy="62" r="8" fill="#f97316" opacity="0.9" />
            <circle cx="106" cy="60" r="3" fill="#fbbf24" opacity="0.6" />
            <g className="vid-mouth">
                {[68,78,88,98,108].map((x,i) => (
                    <rect key={i} x={x} y="84" width="6" height="4" rx="2" fill="#f97316" opacity={[0.6,0.8,1,0.8,0.6][i]} />
                ))}
            </g>
        </g>
        <defs><radialGradient id="fg" cx="50%" cy="0%" r="100%">
            <stop offset="0%" stopColor="#06b6d4" /><stop offset="50%" stopColor="#0891b2" /><stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
        </radialGradient></defs>
    </svg>
);

/* ═══════════════════════════════════════════════════════════
   TOOL ICONS (compact inline SVGs)
   ═══════════════════════════════════════════════════════════ */
const icons = {
    search: (c) => <svg viewBox="0 0 24 24" className="w-6 h-6"><circle cx="11" cy="11" r="7" fill="none" stroke={c} strokeWidth="2"/><line x1="16" y1="16" x2="21" y2="21" stroke={c} strokeWidth="2.5" strokeLinecap="round"/></svg>,
    api: (c) => <svg viewBox="0 0 24 24" className="w-6 h-6"><polyline points="4,14 8,10 12,16 18,6 22,10" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    compare: (c) => <svg viewBox="0 0 24 24" className="w-6 h-6"><rect x="3" y="12" width="5" height="9" rx="1" fill={c} opacity="0.5"/><rect x="10" y="6" width="5" height="15" rx="1" fill={c} opacity="0.7"/><rect x="17" y="9" width="5" height="12" rx="1" fill={c}/></svg>,
    book: (c) => <svg viewBox="0 0 24 24" className="w-6 h-6"><path d="M4 4 L4 20 Q4 21 5 21 L19 21 Q20 21 20 20 L20 8 L16 4 Z" fill={c} opacity="0.1" stroke={c} strokeWidth="1.5"/><line x1="8" y1="11" x2="16" y2="11" stroke={c} strokeWidth="1.5" strokeLinecap="round"/><line x1="8" y1="15" x2="14" y2="15" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></svg>,
    download: (c) => <svg viewBox="0 0 24 24" className="w-6 h-6"><rect x="4" y="2" width="16" height="20" rx="3" fill={c} opacity="0.1" stroke={c} strokeWidth="1.5"/><path d="M12 8 L12 16 M9 13 L12 16 L15 13" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

/* ═══════════════════════════════════════════════════════════
   TOOLS CONFIG — active = used for "Compare Jokic vs Embiid"
   ═══════════════════════════════════════════════════════════ */
const TOOLS = [
    { id: "query_players",     label: "Query Players",   desc: "Search 500+ NBA players",     icon: "search",   color: "#a1a1aa", glow: "161,161,170", active: false },
    { id: "fetch_sports_data", label: "Sportradar API",  desc: "Live stats & game logs",      icon: "api",      color: "#f97316", glow: "249,115,22",  active: true  },
    { id: "compare_entities",  label: "Compare",         desc: "Radar & bar chart gen",       icon: "compare",  color: "#fb7185", glow: "251,113,133", active: true  },
    { id: "search_history",    label: "History",         desc: "Recall prior session context",icon: "book",     color: "#a78bfa", glow: "167,139,250", active: false },
    { id: "generate_excel",    label: "Export CSV",      desc: "Download CSV report",         icon: "download", color: "#34d399", glow: "52,211,153",  active: true  },
];

/* ═══════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function AgentStoryboard() {
    const ref = useRef(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const ctx = gsap.context(() => {

            // ─── INITIAL STATE ───
            gsap.set(".sb-bubble-user, .sb-bubble-agent, .sb-lightbulb, .sb-step", { autoAlpha: 0, scale: 0.85 });
            gsap.set(".vid-user-char", { x: 0, y: 0, rotation: 0 });
            gsap.set(".sb-tool", { autoAlpha: 0, y: 40 });
            gsap.set(".sb-check", { autoAlpha: 0, scale: 0 });
            gsap.set(".sb-desc", { autoAlpha: 0 });
            gsap.set(".vid-user-arm, .vid-agent-arm, .vid-agent-head", { rotation: 0 });
            gsap.set(".sb-progress", { scaleX: 0 });

            // ─── AMBIENT ───
            gsap.to(".vid-flame-l, .vid-flame-r", { scaleY: 0.7, opacity: 0.5, duration: 0.3, yoyo: true, repeat: -1, ease: "sine.inOut", stagger: 0.15 });
            gsap.to(".vid-antenna", { opacity: 0.3, duration: 0.8, yoyo: true, repeat: -1, ease: "sine.inOut" });
            gsap.to(".vid-core", { attr: { r: 16 }, opacity: 0.1, duration: 1.2, yoyo: true, repeat: -1, ease: "sine.inOut" });

            // ─── MAIN TIMELINE ───
            const tl = gsap.timeline({ repeat: -1, repeatDelay: 2, paused: true });

            ScrollTrigger.create({
                trigger: el,
                start: "top 85%",
                end: "bottom 10%",
                onEnter: () => tl.play(),
                onLeave: () => tl.pause(),
                onEnterBack: () => tl.resume(),
                onLeaveBack: () => tl.pause()
            });

            // ── 1. User asks ──
            tl.to(".vid-user-arm", { rotation: -25, duration: 0.4, ease: "power2.out" })
              .to(".sb-bubble-user", { autoAlpha: 1, scale: 1, duration: 0.5, ease: "back.out(1.7)" }, "-=0.2")
              .to({}, { duration: 1 });

            // ── 2. Agent thinks ──
            tl.to(".vid-user-arm", { rotation: 0, duration: 0.3 })
              .to(".vid-agent-arm", { rotation: -100, duration: 0.35, ease: "power2.out" })
              .to(".vid-agent-arm", { rotation: -85, duration: 0.15, yoyo: true, repeat: 3 })
              .to(".vid-agent-head", { rotation: 8, duration: 0.3, yoyo: true, repeat: 1 }, "<")
              .to(".vid-eye-l, .vid-eye-r", { scaleY: 0.3, transformOrigin: "center", duration: 0.2 }, "<")
              .to(".vid-eye-l, .vid-eye-r", { scaleY: 1, duration: 0.2 });

            // ── 3. Lightbulb ──
            tl.to(".sb-lightbulb", { autoAlpha: 1, scale: 1, duration: 0.4, ease: "back.out(2.5)" })
              .to(".vid-agent-arm", { rotation: 0, duration: 0.3 })
              .to(".vid-eye-l, .vid-eye-r", { scale: 1.3, transformOrigin: "center", duration: 0.2, ease: "back.out(2)" }, "<")
              .to(".vid-eye-l, .vid-eye-r", { scale: 1, duration: 0.3 }, "+=0.15")
              .to({}, { duration: 0.2 });

            // ── 4. Step label ──
            tl.to(".sb-step", { autoAlpha: 1, scale: 1, duration: 0.3 });

            // ── 5. Agent reaches + progress bar + ALL tools appear ──
            tl.to(".vid-agent-arm", { rotation: -55, duration: 0.4, ease: "power2.out" });
            tl.to(".sb-progress", { scaleX: 1, duration: 5, ease: "none" });
            tl.addLabel("toolsIn", "<");

            // All 5 tools pop in together (inactive ones are dimmer via CSS)
            TOOLS.forEach((_, i) => {
                tl.to(`.sb-tool-${i}`, { autoAlpha: 1, y: 0, duration: 0.25, ease: "back.out(1.5)" }, `toolsIn+=${i * 0.1}`);
            });

            tl.to({}, { duration: 0.4 });

            // ── 6. Active tools process one-by-one ──
            let seq = 0;
            TOOLS.forEach((tool, i) => {
                if (!tool.active) return;
                const offset = seq * 0.8;
                seq++;

                // Show desc
                tl.to(`.sb-desc-${i}`, { autoAlpha: 1, duration: 0.2 }, `toolsIn+=${1.2 + offset}`);
                // Glow + scale
                tl.to(`.sb-tool-${i}`, {
                    boxShadow: `0 0 30px rgba(${tool.glow}, 0.7)`, scale: 1.15,
                    duration: 0.2
                }, `toolsIn+=${1.3 + offset}`);
                // Checkmark
                tl.to(`.sb-check-${i}`, { autoAlpha: 1, scale: 1, duration: 0.2, ease: "back.out(2)" }, `toolsIn+=${1.5 + offset}`);
                // Dim back (keep visible)
                tl.to(`.sb-tool-${i}`, {
                    boxShadow: `0 0 12px rgba(${tool.glow}, 0.2)`, scale: 1,
                    duration: 0.2
                }, `toolsIn+=${1.6 + offset}`);
                // Hide desc
                tl.to(`.sb-desc-${i}`, { autoAlpha: 0, duration: 0.15 }, `toolsIn+=${1.65 + offset}`);
            });

            tl.to({}, { duration: 0.4 });

            // ── 7. Tools + lightbulb collapse ──
            tl.to(".sb-tool, .sb-check, .sb-lightbulb, .sb-step", {
                autoAlpha: 0, scale: 0.5, y: -40,
                duration: 0.5, stagger: 0.02, ease: "power3.in"
            });

            // ── 8. Agent speaks (bubble + chart inside) ──
            tl.to(".vid-agent-arm", { rotation: -45, duration: 0.3 })
              .to(".sb-bubble-agent", { autoAlpha: 1, scale: 1, duration: 0.5, ease: "back.out(1.5)" })
              .fromTo(".bar-1", { height: 0 }, { height: "38%", duration: 0.5, ease: "power2.out" }, "-=0.1")
              .fromTo(".bar-2", { height: 0 }, { height: "88%", duration: 0.5, ease: "power2.out" }, "-=0.3")
              .fromTo(".val-1, .val-2", { autoAlpha: 0, y: 5 }, { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.1 });

            // ── 9. Agent mouth animation ──
            tl.to(".vid-mouth rect", { opacity: 1, duration: 0.08, stagger: { each: 0.04, repeat: 5, yoyo: true } });

            // ── Hold ──
            tl.to({}, { duration: 1 });

            // ── 10. User reads answer → DANCES 🕺 ──
            tl.to(".vid-user-char", { y: -18, duration: 0.18, ease: "power2.out" })
              .to(".vid-user-char", { y: 0,   duration: 0.18, ease: "bounce.out" })
              .to(".vid-user-char", { y: -22, duration: 0.15, ease: "power2.out" })
              .to(".vid-user-char", { y: 0,   duration: 0.18, ease: "bounce.out" })
              .to(".vid-user-char", { rotation: -12, duration: 0.12, ease: "power1.inOut" }, "-=0.1")
              .to(".vid-user-char", { rotation: 12,  duration: 0.12, ease: "power1.inOut" })
              .to(".vid-user-char", { rotation: -10, duration: 0.1 })
              .to(".vid-user-char", { rotation: 10,  duration: 0.1 })
              .to(".vid-user-char", { rotation: 0,   duration: 0.12 })
              .to(".vid-user-arm",  { rotation: -50, duration: 0.15, ease: "power2.out" }, "-=0.3")
              .to(".vid-user-arm",  { rotation: 20,  duration: 0.15 })
              .to(".vid-user-arm",  { rotation: -40, duration: 0.12 })
              .to(".vid-user-arm",  { rotation: 0,   duration: 0.15, ease: "power2.out" })
              .to(".vid-user-char", { y: -14, duration: 0.13, ease: "power2.out" })
              .to(".vid-user-char", { y: 0,   duration: 0.15, ease: "bounce.out" });

            // ── 11. User + bubble walk off left together ──
            tl.to(".vid-user-char", { x: "-280%", duration: 0.9, ease: "power2.in" });

            // ── Hold at end ──
            tl.to({}, { duration: 1.5 });

            ScrollTrigger.refresh();
        }, el);

        return () => ctx.revert();
    }, []);

    return (
        <section ref={ref} className="py-24 w-full bg-[#050505] min-h-screen flex flex-col items-center justify-center overflow-hidden border-t border-zinc-900 relative">

            {/* BG */}
            <div className="absolute inset-0 z-0 opacity-[0.06]" style={{
                backgroundImage: "linear-gradient(rgba(249,115,22,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.4) 1px, transparent 1px)",
                backgroundSize: "60px 60px"
            }} />

            {/* Header */}
            <div className="text-center z-10 px-6 mb-16">
                <p className="text-orange-500 font-mono text-sm tracking-[0.3em] uppercase mb-4">How It Works</p>
                <h2 className="text-5xl md:text-6xl font-black">
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 via-amber-400 to-rose-500">Agentic AI in Action</span>
                </h2>
                <p className="text-zinc-500 mt-4 text-lg font-medium max-w-xl mx-auto">
                    Watch our AI agent orchestrate <span className="text-zinc-300 font-semibold">5 specialized tools</span> to deliver insights.
                </p>
            </div>

            {/* ═══ CINEMATIC FRAME ═══ */}
            <div className="relative z-10 w-full max-w-6xl mx-4" style={{
                aspectRatio: "16/9",
                background: "linear-gradient(180deg, #0c0c0e 0%, #09090b 100%)",
                borderRadius: "28px",
                boxShadow: "0 0 0 1.5px rgba(249,115,22,0.6), 0 0 40px rgba(249,115,22,0.25), 0 0 80px rgba(249,115,22,0.12), 0 40px 80px rgba(0,0,0,0.7)",
                overflow: "hidden"
            }}>
                {/* Title bar */}
                <div className="absolute top-0 inset-x-0 h-10 bg-[#111]/80 backdrop-blur-sm border-b border-zinc-800/50 flex items-center px-5 z-50">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                        <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                        <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                    </div>
                    <div className="flex-1 flex justify-center">
                        <span className="text-zinc-300 text-[11px] font-mono tracking-wide">sportradar-ai-agent</span>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="absolute top-10 inset-x-0 h-[2px] z-50 bg-zinc-800/30">
                    <div className="sb-progress h-full origin-left bg-gradient-to-r from-orange-500 via-amber-400 to-rose-500" />
                </div>

                {/* Step label */}
                <div className="sb-step absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-1 rounded-full bg-orange-500/10 border border-orange-500/20">
                    <span className="text-orange-400 text-[11px] font-mono">EXECUTING TOOL CHAIN...</span>
                </div>

                {/* Floor */}
                <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-orange-950/10 to-transparent border-t border-zinc-800/20 z-0" />

                {/* ═══ STAGE ═══ */}
                <div className="absolute inset-0 top-10">

                    {/* ─── USER (left 8%, bottom-aligned) ─── */}
                    <div className="vid-user-char absolute left-[8%] bottom-[6%] w-[130px]">
                        {/* Bubble */}
                        <div className="sb-bubble-user absolute bottom-[100%] mb-2 left-0 w-[240px]">
                            <div className="relative bg-zinc-800/90 backdrop-blur-sm text-white p-4 rounded-2xl rounded-bl-none border border-zinc-700/60 shadow-lg">
                                <p className="text-[13px] font-semibold leading-snug">Compare Jokic vs Embiid in the clutch.</p>
                                <div className="absolute -bottom-[6px] left-3 w-3 h-3 bg-zinc-800/90 border-b border-l border-zinc-700/60 -rotate-45" />
                            </div>
                        </div>
                        <UserSVG />
                    </div>

                    {/* ─── AI AGENT (right 8%, bottom-aligned) ─── */}
                    <div className="vid-agent-body-wrapper absolute right-[8%] bottom-[6%] w-[140px]">
                        {/* Lightbulb */}
                        <div className="sb-lightbulb absolute -top-12 left-1/2 -translate-x-1/2">
                            <svg viewBox="0 0 40 40" className="w-9 h-9">
                                <path d="M15 28 Q10 24 10 18 Q10 10 20 8 Q30 10 30 18 Q30 24 25 28 Z" fill="#fbbf24" opacity="0.15" stroke="#fbbf24" strokeWidth="1.5" />
                                <rect x="15" y="28" width="10" height="5" rx="2" fill="none" stroke="#fbbf24" strokeWidth="1.5" />
                                {[20,8,32,10,30].map((x,i) => <line key={i} x1={x} y1={[2,8,8,2,2][i]} x2={[20,13,27,14,26][i]} y2={[6,11,11,6,6][i]} stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />)}
                            </svg>
                        </div>

                        {/* Bubble */}
                        <div className="sb-bubble-agent absolute bottom-[100%] mb-2 right-0 w-[300px]">
                            <div className="relative rounded-2xl rounded-br-none shadow-lg overflow-hidden" style={{ background: "linear-gradient(135deg, #ea580c, #e11d48)" }}>
                                <div className="p-4 pb-3">
                                    <p className="text-white/80 text-[11px] font-medium">Process complete!</p>
                                    <p className="text-white text-[13px] font-bold mt-1 leading-snug">Jokic completely dominates efficiency in clutch time.</p>
                                </div>
                                {/* Chart inside bubble */}
                                <div className="sb-chart mx-3 mb-3 rounded-xl overflow-hidden" style={{
                                    background: "rgba(0,0,0,0.35)",
                                    border: "1px solid rgba(255,255,255,0.15)"
                                }}>
                                    <div className="px-3 pt-2 pb-1 border-b border-white/10">
                                        <h3 className="text-white font-bold text-[10px]">Clutch True Shooting %</h3>
                                    </div>
                                    <div className="flex justify-center items-end gap-8 h-[100px] px-6 pb-3">
                                        <div className="flex flex-col items-center gap-1 h-full justify-end">
                                            <span className="val-1 text-[11px] font-bold text-zinc-300">52.1%</span>
                                            <div className="bar-1 w-10 bg-gradient-to-t from-zinc-500 to-zinc-400 rounded-t-lg" style={{ height: 0 }} />
                                            <span className="text-zinc-300/70 font-semibold text-[9px] mt-0.5">Embiid</span>
                                        </div>
                                        <div className="flex flex-col items-center gap-1 h-full justify-end">
                                            <span className="val-2 text-[11px] font-bold text-amber-300">71.4%</span>
                                            <div className="bar-2 w-10 rounded-t-lg" style={{ height: 0, background: "linear-gradient(to top, #fbbf24, #fde68a)", boxShadow: "0 0 12px rgba(251,191,36,0.5)" }} />
                                            <span className="text-amber-300/80 font-semibold text-[9px] mt-0.5">Jokic</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute -bottom-[6px] right-3 w-3 h-3 rotate-45" style={{ background: "#e11d48" }} />
                            </div>
                        </div>
                        <AgentSVG />
                    </div>

                    {/* ─── TOOLS (center bottom) ─── */}
                    <div className="absolute bottom-[8%] left-1/2 -translate-x-1/2 z-40 flex flex-col items-center">
                        {/* Description pills (stacked, only one visible at a time) */}
                        <div className="relative h-6 mb-2 flex justify-center">
                            {TOOLS.map((t, i) => t.active && (
                                <div key={i} className={`sb-desc sb-desc-${i} absolute whitespace-nowrap px-3 py-0.5 rounded-full text-[11px] font-semibold border`}
                                     style={{ color: t.color, borderColor: `rgba(${t.glow},0.3)`, background: `rgba(${t.glow},0.08)` }}>
                                    {t.desc}
                                </div>
                            ))}
                        </div>

                        {/* Tool row */}
                        <div className="flex gap-2">
                            {TOOLS.map((t, i) => (
                                <div key={t.id} className="relative">
                                    {/* Checkmark (only for active) */}
                                    {t.active && (
                                        <div className={`sb-check sb-check-${i} absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center z-20`}
                                             style={{ background: t.color }}>
                                            <svg viewBox="0 0 12 12" className="w-2.5 h-2.5"><path d="M2 6 L5 9 L10 3" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        </div>
                                    )}
                                    {/* Card */}
                                    <div className={`sb-tool sb-tool-${i} flex flex-col items-center gap-1 px-2.5 py-2 rounded-xl border bg-[#0c0c0e]`}
                                         style={{
                                             borderColor: `rgba(${t.glow}, ${t.active ? 0.4 : 0.15})`,
                                             boxShadow: `0 0 12px rgba(${t.glow}, ${t.active ? 0.15 : 0.03})`,
                                             filter: t.active ? "none" : "brightness(0.5)"
                                         }}>
                                        {icons[t.icon](t.color)}
                                        <span className="text-[9px] font-bold leading-none" style={{ color: t.color }}>{t.label}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>

            {/* ═══ TOOL LEGEND ═══ */}
            <div className="z-10 mt-12 w-full max-w-5xl px-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {TOOLS.map(t => (
                        <div key={`l-${t.id}`} className="flex flex-col items-center gap-2 p-3 rounded-xl border bg-zinc-900/50"
                             style={{ borderColor: `rgba(${t.glow}, 0.2)` }}>
                            {icons[t.icon](t.color)}
                            <span className="text-xs font-bold" style={{ color: t.color }}>{t.label}</span>
                            <span className="text-[10px] text-zinc-500 text-center leading-tight">{t.desc}</span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
