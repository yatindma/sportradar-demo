import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { COLORS } from "../constants";

interface NeonCardProps {
  children: React.ReactNode;
  delay?: number;
  glowColor?: string;
  active?: boolean;
  width?: number | string;
  style?: React.CSSProperties;
}

export const NeonCard: React.FC<NeonCardProps> = ({
  children,
  delay = 0,
  glowColor = COLORS.orange,
  active = false,
  width = "auto",
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - delay);

  // Entry spring animation
  const entryProgress = spring({
    frame: adjustedFrame,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.8 },
  });

  const scale = interpolate(entryProgress, [0, 1], [0.85, 1]);
  const translateY = interpolate(entryProgress, [0, 1], [30, 0]);
  const opacity = interpolate(entryProgress, [0, 1], [0, 1]);

  // Active state pulsing glow
  const pulsePhase = Math.sin(adjustedFrame * 0.06) * 0.5 + 0.5;
  const activeGlowIntensity = active
    ? interpolate(pulsePhase, [0, 1], [0.3, 0.7])
    : 0;

  // Border rotation for active state (simulated conic gradient angle)
  const borderRotation = active ? (adjustedFrame * 1.5) % 360 : 0;

  // Active transition spring
  const activeSpring = spring({
    frame: active ? adjustedFrame : 0,
    fps,
    config: { damping: 18, stiffness: 120, mass: 0.6 },
  });

  const borderOpacity = interpolate(
    activeSpring,
    [0, 1],
    [0.15, 0.5]
  );

  const glowColorWithAlpha = (alpha: number) => {
    if (glowColor.startsWith("#")) {
      const r = parseInt(glowColor.slice(1, 3), 16);
      const g = parseInt(glowColor.slice(3, 5), 16);
      const b = parseInt(glowColor.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return glowColor;
  };

  return (
    <div
      style={{
        position: "relative",
        width,
        opacity,
        transform: `scale(${scale}) translateY(${translateY}px)`,
        transformOrigin: "center center",
        ...style,
      }}
    >
      {/* Outer glow layer */}
      {active && (
        <div
          style={{
            position: "absolute",
            inset: -2,
            borderRadius: 18,
            background: `conic-gradient(from ${borderRotation}deg, ${glowColorWithAlpha(0.5)}, transparent 25%, ${glowColorWithAlpha(0.3)} 50%, transparent 75%, ${glowColorWithAlpha(0.5)})`,
            opacity: activeGlowIntensity,
            filter: "blur(1px)",
          }}
        />
      )}

      {/* Border layer */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 16,
          border: `1px solid ${glowColorWithAlpha(borderOpacity)}`,
          pointerEvents: "none" as const,
        }}
      />

      {/* Main card body */}
      <div
        style={{
          position: "relative",
          borderRadius: 16,
          background: `linear-gradient(145deg, ${COLORS.surface1} 0%, ${COLORS.surface2} 100%)`,
          overflow: "hidden",
          boxShadow: active
            ? `0 0 ${30 * activeGlowIntensity}px ${glowColorWithAlpha(0.15)},
               0 0 ${60 * activeGlowIntensity}px ${glowColorWithAlpha(0.08)},
               inset 0 1px 0 rgba(255, 255, 255, 0.04),
               inset 0 -1px 0 rgba(0, 0, 0, 0.3)`
            : `0 4px 24px rgba(0, 0, 0, 0.4),
               0 1px 4px rgba(0, 0, 0, 0.3),
               inset 0 1px 0 rgba(255, 255, 255, 0.03),
               inset 0 -1px 0 rgba(0, 0, 0, 0.2)`,
        }}
      >
        {/* Top gradient line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "10%",
            right: "10%",
            height: 1,
            background: `linear-gradient(90deg, transparent, ${glowColorWithAlpha(active ? 0.6 : 0.15)}, transparent)`,
          }}
        />

        {/* Glassmorphism inner layer */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 40%)`,
            borderRadius: 16,
            pointerEvents: "none" as const,
          }}
        />

        {/* Content */}
        <div style={{ position: "relative", zIndex: 1 }}>
          {children}
        </div>

        {/* Bottom ambient shadow */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "40%",
            background: `linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.15))`,
            borderRadius: "0 0 16px 16px",
            pointerEvents: "none" as const,
          }}
        />
      </div>
    </div>
  );
};
