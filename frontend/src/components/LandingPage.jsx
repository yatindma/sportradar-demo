import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { ArrowRight, Zap, BarChart3, Brain, Globe, ChevronDown } from "lucide-react";
import AgentStoryboard from "./AgentStoryboard";
import BasketballSVG from "./BasketballSVG";

const FEATURES = [
    { icon: Brain, title: "Agentic Reasoning", desc: "Multi-step AI that thinks, plans, and executes like a human analyst.", color: "#f97316" },
    { icon: BarChart3, title: "Real-Time Stats", desc: "Live Sportradar data across 500+ NBA players and every game.", color: "#fb7185" },
    { icon: Zap, title: "Instant Insights", desc: "Compare players, generate charts, and export reports in seconds.", color: "#fbbf24" },
    { icon: Globe, title: "Tool Orchestration", desc: "5 specialized tools working in concert for deep basketball intelligence.", color: "#34d399" },
];

gsap.registerPlugin(ScrollTrigger);

export default function LandingPage({ onLogin }) {
    const containerRef = useRef(null);
    const mode = "login";
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let ctx = gsap.context(() => {
            // 1. The Big Shift (Hero fading out down)
            gsap.to(".hero-bg-glow", {
                scale: 3,
                opacity: 0,
                scrollTrigger: {
                    trigger: ".hero-section",
                    start: "top top",
                    end: "bottom top",
                    scrub: 1.5,
                },
            });
            gsap.to(".hero-content", {
                y: -150,
                opacity: 0,
                scrollTrigger: {
                    trigger: ".hero-section",
                    start: "top top",
                    end: "+=500",
                    scrub: 1,
                }
            });

            // 2. Features section scroll animations
            gsap.set(".feature-card", { autoAlpha: 0, y: 80, scale: 0.9 });
            gsap.set(".features-headline", { autoAlpha: 0, y: 40 });
            gsap.set(".features-divider", { scaleX: 0 });

            ScrollTrigger.create({
                trigger: ".features-section",
                start: "top 80%",
                onEnter: () => {
                    gsap.to(".features-headline", { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out" });
                    gsap.to(".features-divider", { scaleX: 1, duration: 0.8, ease: "power2.out", delay: 0.2 });
                    gsap.to(".feature-card", {
                        autoAlpha: 1, y: 0, scale: 1,
                        duration: 0.6, stagger: 0.15, ease: "back.out(1.4)", delay: 0.4
                    });
                },
                once: true,
            });

            // 3. Floating parallax on feature icons
            gsap.utils.toArray(".feature-icon-float").forEach((el, i) => {
                gsap.to(el, {
                    y: -8 - (i * 2),
                    duration: 1.5 + (i * 0.3),
                    yoyo: true,
                    repeat: -1,
                    ease: "sine.inOut",
                    delay: i * 0.2,
                });
            });

        }, containerRef);

        return () => ctx.revert();
    }, []);

    const handleAuthSubmit = async (e) => {
        e.preventDefault();
        setError("");
        if (username.trim().length < 3) {
            setError("Username must be at least 3 characters.");
            return;
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }
        try {
            setIsSubmitting(true);
            await onLogin({ mode, username: username.trim(), password });
        } catch (err) {
            setError(err.message || "Authentication failed.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div ref={containerRef} className="bg-[#050505] text-white min-h-screen font-sans overflow-x-hidden selection:bg-orange-500/30">

            {/* SECTION 1: HERO */}
            <section className="hero-section relative h-screen flex flex-col items-center justify-center overflow-hidden">
                <div className="hero-bg-glow absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] h-[100vh] bg-gradient-to-br from-orange-600/20 via-rose-600/10 to-transparent blur-[120px] pointer-events-none z-0"></div>

                <div className="hero-content relative z-10 text-center max-w-5xl px-6">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, filter: "blur(20px)" }}
                        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                        transition={{ duration: 1, ease: "easeOut" }}
                    >
                        <div className="flex justify-center mb-8">
                            <motion.div
                                initial={{ y: -50, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ duration: 0.8, delay: 0.5, type: "spring", stiffness: 100 }}
                                className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-500 via-amber-600 to-rose-600 flex items-center justify-center shadow-[0_0_80px_rgba(249,115,22,0.6)] border border-orange-400/50"
                            >
                                <BasketballSVG className="w-12 h-12 text-white animate-[spin_8s_linear_infinite]" />
                            </motion.div>
                        </div>

                        <motion.h1
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.8, delay: 0.8 }}
                            className="text-7xl md:text-9xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-zinc-200 to-orange-400 mb-6 drop-shadow-2xl hero-title"
                        >
                            SportScout Ultra
                        </motion.h1>
                        <motion.p
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.8, delay: 1 }}
                            className="text-xl md:text-3xl text-zinc-300 font-medium mb-12 max-w-4xl mx-auto leading-relaxed"
                        >
                            The most advanced basketball intelligence engine on Earth. <br />
                            Powered by <span className="text-orange-400 font-bold">Agentic AI</span> & <span className="text-blue-400 font-bold">Sportradar</span>.
                        </motion.p>

                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.8, delay: 1.2 }}
                        >
                            <form onSubmit={handleAuthSubmit} className="mx-auto w-full max-w-md bg-[#0d0d10]/90 border border-white/10 rounded-2xl p-5 shadow-[0_0_40px_rgba(0,0,0,0.4)]">
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="Username"
                                        className="w-full rounded-xl bg-[#111114] border border-white/10 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500/70"
                                        autoComplete="username"
                                    />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Password"
                                        className="w-full rounded-xl bg-[#111114] border border-white/10 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500/70"
                                        autoComplete="current-password"
                                    />
                                </div>

                                {error && <p className="mt-3 text-xs text-red-400 font-semibold">{error}</p>}

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="mt-4 group relative inline-flex w-full items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-orange-500 text-white font-bold text-sm hover:bg-orange-400 transition-all shadow-[0_0_40px_rgba(249,115,22,0.35)] disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    <span className="relative z-10 tracking-widest uppercase">
                                        {isSubmitting ? "Please wait..." : "Login"}
                                    </span>
                                    <ArrowRight className="relative z-10 group-hover:translate-x-1 transition-transform" size={16} />
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                </div>

                {/* Scroll Down Indicator */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2, duration: 0.8 }}
                    className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 cursor-pointer"
                    onClick={() => document.querySelector(".features-section")?.scrollIntoView({ behavior: "smooth" })}
                >
                    <span className="text-zinc-500 text-[11px] font-mono tracking-widest uppercase">Scroll</span>
                    <motion.div
                        animate={{ y: [0, 8, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    >
                        <ChevronDown size={20} className="text-orange-500/70" />
                    </motion.div>
                </motion.div>

            </section>

            {/* SECTION 2: SCROLL-ANIMATED FEATURES */}
            <section className="features-section relative py-32 px-6 overflow-hidden">
                {/* Subtle bg glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-500/5 rounded-full blur-[150px] pointer-events-none" />

                <div className="features-headline relative z-10 text-center mb-16">
                    <p className="text-orange-500 font-mono text-sm tracking-[0.3em] uppercase mb-4">Why SportScout Ultra</p>
                    <h2 className="text-4xl md:text-6xl font-black tracking-tight">
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-200 to-orange-400">Intelligence, Reimagined</span>
                    </h2>
                    <div className="features-divider origin-center mx-auto mt-6 h-[2px] w-24 bg-gradient-to-r from-transparent via-orange-500 to-transparent" />
                </div>

                <div className="relative z-10 max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {FEATURES.map((f, i) => {
                        const Icon = f.icon;
                        return (
                            <div
                                key={i}
                                className="feature-card group relative p-6 rounded-2xl border border-white/[0.06] bg-[#0a0a0c]/80 backdrop-blur-sm hover:border-white/[0.12] transition-all duration-300"
                                style={{ boxShadow: `0 0 0 0 ${f.color}00` }}
                                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 0 40px ${f.color}20`; }}
                                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = `0 0 0 0 ${f.color}00`; }}
                            >
                                <div className="feature-icon-float mb-4 w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${f.color}15`, border: `1px solid ${f.color}30` }}>
                                    <Icon size={22} style={{ color: f.color }} />
                                </div>
                                <h3 className="text-white font-bold text-base mb-2">{f.title}</h3>
                                <p className="text-zinc-500 text-sm leading-relaxed">{f.desc}</p>
                                {/* Bottom accent line */}
                                <div className="absolute bottom-0 left-6 right-6 h-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: `linear-gradient(90deg, transparent, ${f.color}40, transparent)` }} />
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* SECTION 3: TOOL CALLING VISUALIZATION */}
            <AgentStoryboard />


        </div>
    );
}
