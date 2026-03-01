import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, FONTS } from "../constants";
import { ParticleField } from "../components/ParticleField";

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const fadeOut = interpolate(frame, [124, 150], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.4, 0, 1, 1),
  });

  // ── Logo "S" entry ──
  const markEntry = spring({
    frame: Math.max(0, frame - 6),
    fps,
    config: { damping: 14, stiffness: 110, mass: 0.8 },
  });
  const markScale = interpolate(markEntry, [0, 1], [0.82, 1]);
  const markY = interpolate(markEntry, [0, 1], [22, 0]);

  const cameraX = interpolate(Math.sin(frame * 0.02), [-1, 1], [-1.2, 1.2]);
  const cameraY = interpolate(Math.sin(frame * 0.014 + 0.8), [-1, 1], [-0.8, 1]);
  const markFloat = interpolate(Math.sin(frame * 0.09), [-1, 1], [6, -6]);

  // ── "SportScout Ultra" brand text entry ──
  const brandIn = spring({
    frame: Math.max(0, frame - 16),
    fps,
    config: { damping: 12, stiffness: 80, mass: 1.0 },
  });
  const brandY = interpolate(brandIn, [0, 1], [30, 0]);

  // ── Shimmer sweep across text ──
  const shimmerX = interpolate(frame, [20, 80], [-100, 200], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  });

  // ── Second shimmer pass (subtle) ──
  const shimmer2X = interpolate(frame, [70, 130], [-100, 200], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  });

  // ── Logo glow pulse ──
  const logoPulse = Math.sin(frame * 0.1) * 0.3 + 0.7;

  // ── Tagline entry ──
  const taglineIn = interpolate(frame, [35, 55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // ── Subtitle entry ──
  const subtitleIn = interpolate(frame, [48, 68], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // ── Accent line grow ──
  const lineWidth = interpolate(frame, [30, 60], [0, 400], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        opacity: fadeIn * fadeOut,
      }}
    >
      <ParticleField />

      {/* Background radial glows */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 40%, rgba(249,115,22,0.18) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(6,182,212,0.1) 0%, transparent 55%)",
          pointerEvents: "none",
        }}
      />

      {/* Extra center glow for shiny feel */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 700px 300px at 50% 48%, rgba(249,115,22,${0.08 + logoPulse * 0.06}) 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      <AbsoluteFill
        style={{
          perspective: 1800,
          transformStyle: "preserve-3d",
          transform: `rotateX(${cameraY}deg) rotateY(${cameraX}deg)`,
          alignItems: "center",
          justifyContent: "center",
          display: "flex",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
            marginTop: -20,
          }}
        >
          {/* ── Basketball Logo (matches frontend) ── */}
          <div
            style={{
              transform: `translateY(${markY + markFloat}px) scale(${markScale}) rotateX(7deg)`,
              width: 120,
              height: 120,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #f97316 0%, #d97706 50%, #f43f5e 100%)",
              border: "1px solid rgba(251,146,60,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 ${60 + logoPulse * 30}px rgba(249,115,22,0.6), 0 24px 48px rgba(0,0,0,0.5)`,
              position: "relative",
            }}
          >
            {/* Basketball icon — simple "S" as stand-in */}
            <span
              style={{
                fontSize: 56,
                lineHeight: 1,
                fontWeight: 900,
                fontFamily: FONTS.sans,
                color: "#ffffff",
                textShadow: "0 2px 8px rgba(0,0,0,0.3)",
              }}
            >
              S
            </span>
          </div>

          {/* ── "SportScout Ultra" — shiny brand text ── */}
          <div
            style={{
              opacity: brandIn,
              transform: `translateY(${brandY}px)`,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Base gradient text */}
            <div
              style={{
                fontSize: 82,
                fontWeight: 900,
                fontFamily: FONTS.sans,
                letterSpacing: "-0.02em",
                background: "linear-gradient(135deg, #ffffff 0%, #e4e4e7 40%, #fb923c 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                textAlign: "center",
                filter: `drop-shadow(0 0 30px ${COLORS.orangeGlow}) drop-shadow(0 0 60px rgba(249,115,22,0.2))`,
                lineHeight: 1.1,
              }}
            >
              SportScout Ultra
            </div>

            {/* Shimmer sweep overlay (no text, just light band) */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(105deg, transparent 0%, transparent ${shimmerX - 12}%, rgba(255,255,255,0.35) ${shimmerX}%, transparent ${shimmerX + 12}%, transparent 100%)`,
                mixBlendMode: "overlay",
                pointerEvents: "none",
                borderRadius: 8,
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(105deg, transparent 0%, transparent ${shimmer2X - 8}%, rgba(255,255,255,0.15) ${shimmer2X}%, transparent ${shimmer2X + 8}%, transparent 100%)`,
                mixBlendMode: "overlay",
                pointerEvents: "none",
                borderRadius: 8,
              }}
            />
          </div>

          {/* ── Accent line ── */}
          <div
            style={{
              width: lineWidth,
              height: 3,
              background: `linear-gradient(90deg, transparent, ${COLORS.orange}, ${COLORS.amber}, transparent)`,
              borderRadius: 2,
              marginTop: -4,
              boxShadow: `0 0 12px ${COLORS.orangeGlow}`,
            }}
          />

          {/* ── Tagline ── */}
          <div
            style={{
              opacity: taglineIn,
              transform: `translateY(${interpolate(taglineIn, [0, 1], [16, 0])}px)`,
              fontSize: 40,
              fontWeight: 700,
              fontFamily: FONTS.sans,
              letterSpacing: "-0.02em",
              color: COLORS.textPrimary,
              textAlign: "center",
            }}
          >
            One Prompt. Full Analysis.
          </div>

          {/* ── Subtitle ── */}
          <div
            style={{
              opacity: subtitleIn,
              transform: `translateY(${interpolate(subtitleIn, [0, 1], [10, 0])}px)`,
              fontSize: 22,
              fontFamily: FONTS.sans,
              color: COLORS.textSecondary,
              letterSpacing: "0.01em",
            }}
          >
            Powered by{" "}
            <span style={{ color: COLORS.orange, fontWeight: 700 }}>Agentic AI</span>
            {" & "}
            <span style={{ color: COLORS.cyan, fontWeight: 700 }}>Sportradar</span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
