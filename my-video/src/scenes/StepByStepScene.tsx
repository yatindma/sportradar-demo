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

// Step definitions with icons
const STEP_ITEMS = [
  { num: 1, label: "Think", icon: "🧠", desc: "Plan tool calls" },
  { num: 2, label: "Round 1", icon: "⚡", desc: "Gather data" },
  { num: 3, label: "Round 2", icon: "📊", desc: "Analyze + export" },
  { num: 4, label: "Respond", icon: "💬", desc: "Stream answer" },
];

export const StepByStepScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const accentColor = COLORS.emerald;

  // --- Master fade ---
  const fadeIn = interpolate(frame, [0, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 28, durationInFrames],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.4, 0, 1, 1),
    }
  );

  // --- Label ---
  const labelIn = interpolate(frame, [10, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const labelY = interpolate(labelIn, [0, 1], [14, 0]);

  // --- Heading ---
  const headingIn = interpolate(frame, [16, 38], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const headingY = interpolate(headingIn, [0, 1], [20, 0]);

  // --- Accent line ---
  const accentWidth = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: { damping: 20, stiffness: 60, mass: 0.8 },
  });

  // --- Subtitle ---
  const subtitleIn = interpolate(frame, [42, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const subtitleY = interpolate(subtitleIn, [0, 1], [12, 0]);

  // Step node size
  const NODE = 68;
  const GAP = 140; // gap between node centers
  const totalWidth = (STEP_ITEMS.length - 1) * GAP;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        opacity: fadeIn * fadeOut,
      }}
    >
      <ParticleField />

      {/* Ambient glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 50% 55%, ${accentColor}10 0%, transparent 50%)`,
          pointerEvents: "none",
        }}
      />

      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            maxWidth: 1200,
            padding: "0 60px",
            gap: 16,
          }}
        >
          {/* Label */}
          <div
            style={{
              opacity: labelIn,
              transform: `translateY(${labelY}px)`,
              fontFamily: FONTS.mono,
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: accentColor,
              textTransform: "uppercase",
            }}
          >
            Live Demo
          </div>

          {/* Heading */}
          <div
            style={{
              opacity: headingIn,
              transform: `translateY(${headingY}px)`,
              fontFamily: FONTS.sans,
              fontSize: 56,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: COLORS.textPrimary,
              textAlign: "center",
              lineHeight: 1.15,
            }}
          >
            Watch the Agent Think
          </div>

          {/* Accent line */}
          <div
            style={{
              width: interpolate(accentWidth, [0, 1], [0, 80]),
              height: 3,
              borderRadius: 2,
              background: `linear-gradient(90deg, ${accentColor}, ${accentColor}80)`,
              marginTop: 4,
              marginBottom: 8,
            }}
          />

          {/* === ANIMATED STEP TIMELINE === */}
          <div
            style={{
              position: "relative",
              width: totalWidth + NODE + 40,
              height: 160,
              marginTop: 20,
              marginBottom: 20,
            }}
          >
            {/* Connecting lines between steps */}
            <svg
              width={totalWidth + NODE + 40}
              height={160}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                pointerEvents: "none",
              }}
            >
              {STEP_ITEMS.slice(0, -1).map((_, i) => {
                const lineDelay = 50 + i * 45 + 15;
                const lineProgress = spring({
                  frame: Math.max(0, frame - lineDelay),
                  fps,
                  config: { damping: 18, stiffness: 80, mass: 0.6 },
                });

                const x1 = 20 + i * GAP + NODE;
                const x2 = 20 + (i + 1) * GAP;
                const y = NODE / 2 + 8;

                return (
                  <g key={`line-${i}`}>
                    {/* Background line */}
                    <line
                      x1={x1}
                      y1={y}
                      x2={x2}
                      y2={y}
                      stroke={COLORS.surface3}
                      strokeWidth={3}
                      strokeLinecap="round"
                    />
                    {/* Animated progress line */}
                    <line
                      x1={x1}
                      y1={y}
                      x2={x1 + (x2 - x1) * lineProgress}
                      y2={y}
                      stroke={accentColor}
                      strokeWidth={3}
                      strokeLinecap="round"
                      opacity={0.8}
                    />
                    {/* Traveling dot */}
                    {lineProgress > 0.05 && lineProgress < 0.95 && (
                      <circle
                        cx={x1 + (x2 - x1) * lineProgress}
                        cy={y}
                        r={5}
                        fill={accentColor}
                        opacity={0.9}
                      />
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Step nodes */}
            {STEP_ITEMS.map((step, i) => {
              const stepDelay = 50 + i * 45;
              const stepProgress = spring({
                frame: Math.max(0, frame - stepDelay),
                fps,
                config: { damping: 18, stiffness: 70, mass: 0.8 },
              });

              // Pop-in effect
              const popScale = interpolate(
                stepProgress,
                [0, 0.6, 0.8, 1],
                [0, 1.15, 0.95, 1]
              );

              const isActive = stepProgress > 0.9;
              const glowIntensity = isActive
                ? 0.5 + 0.3 * Math.sin((frame - stepDelay) * 0.08)
                : 0;

              const nodeX = 20 + i * GAP;

              return (
                <div
                  key={step.num}
                  style={{
                    position: "absolute",
                    left: nodeX,
                    top: 8,
                    width: NODE,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 10,
                    transform: `scale(${popScale})`,
                    opacity: stepProgress,
                  }}
                >
                  {/* Circle node */}
                  <div
                    style={{
                      width: NODE,
                      height: NODE,
                      borderRadius: "50%",
                      background: isActive
                        ? `linear-gradient(135deg, ${accentColor}30, ${accentColor}15)`
                        : COLORS.surface2,
                      border: `2.5px solid ${isActive ? accentColor : COLORS.surface3}`,
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      fontSize: 30,
                      boxShadow: isActive
                        ? `0 0 ${20 + glowIntensity * 20}px ${accentColor}40, 0 0 ${40 + glowIntensity * 30}px ${accentColor}15`
                        : "none",
                    }}
                  >
                    {step.icon}
                  </div>

                  {/* Label */}
                  <div
                    style={{
                      fontFamily: FONTS.sans,
                      fontSize: 16,
                      fontWeight: 700,
                      color: isActive ? COLORS.textPrimary : COLORS.textSecondary,
                      letterSpacing: "0.02em",
                      textAlign: "center",
                    }}
                  >
                    {step.label}
                  </div>

                  {/* Description */}
                  <div
                    style={{
                      fontFamily: FONTS.sans,
                      fontSize: 12,
                      color: COLORS.textMuted,
                      textAlign: "center",
                      opacity: interpolate(stepProgress, [0.8, 1], [0, 1], {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                      }),
                    }}
                  >
                    {step.desc}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Subtitle */}
          <div
            style={{
              opacity: subtitleIn,
              transform: `translateY(${subtitleY}px)`,
              fontFamily: FONTS.mono,
              fontSize: 20,
              color: COLORS.emerald,
              textAlign: "center",
              lineHeight: 1.5,
              maxWidth: 800,
              textShadow: `0 0 8px ${COLORS.emerald}60, 0 0 20px ${COLORS.emerald}25`,
            }}
          >
            <span style={{ color: COLORS.textMuted }}>A user asks: </span>
            &quot;Find the youngest guards, compare them with Steph
            Curry, and export the results.&quot;
            <span
              style={{
                opacity: Math.sin(frame * 0.4) > 0 ? 1 : 0,
                color: COLORS.emerald,
              }}
            >
              |
            </span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
