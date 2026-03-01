import React, { useMemo } from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  AbsoluteFill,
  staticFile,
} from "remotion";
import { COLORS, FONTS, TOOLS } from "../constants";
import { ParticleField } from "../components/ParticleField";
import { GlitchText } from "../components/GlitchText";
import { NeonCard } from "../components/NeonCard";

export const ToolsRevealScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // --- Fade in / out ---
  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  });

  const fadeOut = interpolate(frame, [300, 330], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  });

  const masterOpacity = fadeIn * fadeOut;

  // --- Subtitle fade ---
  const subtitleOpacity = interpolate(frame, [35, 55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subtitleY = interpolate(frame, [35, 55], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // --- Brain visualization (MASSIVE) ---
  const BRAIN_SIZE = 700;
  const BRAIN_CENTER = BRAIN_SIZE / 2;
  const ORBIT_RADIUS = 250;
  const BRAIN_CIRCLE_SIZE = 150;
  const NODE_SIZE = 64;

  const brainScale = spring({
    frame: Math.max(0, frame - 30),
    fps,
    config: { damping: 14, stiffness: 80, mass: 1 },
  });

  const brainPulse = 0.97 + 0.03 * Math.sin(frame * 0.08);

  // Orbit rotation
  const orbitRotation = frame * 0.15; // slow continuous rotation

  // Brain node positions (5 dots around circle)
  const brainNodes = useMemo(() => {
    return TOOLS.map((tool, i) => {
      const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
      return {
        angle,
        color: tool.color,
        name: tool.name,
        icon: tool.icon,
      };
    });
  }, []);

  // --- Tool card data ---
  const toolCards = useMemo(() => {
    return TOOLS.map((tool, i) => ({
      ...tool,
      entryFrame: 50 + i * 40,
      spotlightStart: 50 + i * 40,
      spotlightEnd: 50 + (i + 1) * 40 + 20,
    }));
  }, []);

  // Ripple effect from brain center
  const rippleCount = 3;
  const ripples = Array.from({ length: rippleCount }, (_, i) => {
    const rippleFrame = (frame + i * 25) % 75;
    const rippleProgress = rippleFrame / 75;
    const rippleRadius = interpolate(rippleProgress, [0, 1], [40, ORBIT_RADIUS + 60]);
    const rippleOpacity = interpolate(rippleProgress, [0, 0.3, 1], [0.4, 0.25, 0]);
    return { radius: rippleRadius, opacity: rippleOpacity };
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        opacity: masterOpacity,
      }}
    >
      <ParticleField />

      {/* Content container */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          padding: "40px 60px",
        }}
      >
        {/* Title area */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <GlitchText
            text="The Arsenal"
            delay={20}
            fontSize={52}
            color={COLORS.orange}
            fontWeight={800}
          />
          <div
            style={{
              opacity: subtitleOpacity,
              transform: `translateY(${subtitleY}px)`,
              fontFamily: FONTS.sans,
              fontSize: 18,
              color: COLORS.textSecondary,
              marginTop: 8,
              letterSpacing: "0.02em",
            }}
          >
            5 specialized tools at the agent&apos;s disposal
          </div>
        </div>

        {/* Main content: brain left, cards right */}
        <div
          style={{
            display: "flex",
            flex: 1,
            gap: 30,
            alignItems: "center",
          }}
        >
          {/* LEFT: Agent brain visualization - BIGGER */}
          <div
            style={{
              flex: 1,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <div
              style={{
                position: "relative",
                width: BRAIN_SIZE,
                height: BRAIN_SIZE,
                transform: `scale(${brainScale * brainPulse})`,
              }}
            >
              {/* Ambient glow behind brain */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  width: ORBIT_RADIUS * 2 + 80,
                  height: ORBIT_RADIUS * 2 + 80,
                  borderRadius: "50%",
                  background: `radial-gradient(circle, ${COLORS.orangeDim} 0%, transparent 70%)`,
                  opacity: 0.5 + 0.2 * Math.sin(frame * 0.05),
                  pointerEvents: "none",
                }}
              />

              {/* SVG layer for orbits, lines, pulses, ripples */}
              <svg
                width={BRAIN_SIZE}
                height={BRAIN_SIZE}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  pointerEvents: "none",
                }}
              >
                {/* Ripple rings */}
                {ripples.map((ripple, ri) => (
                  <circle
                    key={`ripple-${ri}`}
                    cx={BRAIN_CENTER}
                    cy={BRAIN_CENTER}
                    r={ripple.radius}
                    fill="none"
                    stroke={COLORS.orange}
                    strokeWidth={1.5}
                    opacity={ripple.opacity * brainScale}
                  />
                ))}

                {/* Outer orbital ring (dashed, rotating) */}
                <circle
                  cx={BRAIN_CENTER}
                  cy={BRAIN_CENTER}
                  r={ORBIT_RADIUS}
                  fill="none"
                  stroke={COLORS.border}
                  strokeWidth={1}
                  strokeDasharray="6 10"
                  opacity={0.5}
                  style={{
                    transformOrigin: `${BRAIN_CENTER}px ${BRAIN_CENTER}px`,
                    transform: `rotate(${orbitRotation}deg)`,
                  }}
                />

                {/* Inner decorative ring */}
                <circle
                  cx={BRAIN_CENTER}
                  cy={BRAIN_CENTER}
                  r={ORBIT_RADIUS * 0.55}
                  fill="none"
                  stroke={COLORS.orangeDim}
                  strokeWidth={0.8}
                  strokeDasharray="3 8"
                  opacity={0.3}
                  style={{
                    transformOrigin: `${BRAIN_CENTER}px ${BRAIN_CENTER}px`,
                    transform: `rotate(${-orbitRotation * 1.5}deg)`,
                  }}
                />

                {/* Connection lines + data pulses */}
                {brainNodes.map((node, i) => {
                  const toolEntryFrame = 50 + i * 40;
                  const nodeProgress = spring({
                    frame: Math.max(0, frame - toolEntryFrame),
                    fps,
                    config: { damping: 16, stiffness: 100, mass: 0.8 },
                  });

                  const isActive =
                    frame >= toolEntryFrame &&
                    frame < toolEntryFrame + 60;

                  const nodeX = BRAIN_CENTER + Math.cos(node.angle) * ORBIT_RADIUS;
                  const nodeY = BRAIN_CENTER + Math.sin(node.angle) * ORBIT_RADIUS;

                  const lineOpacity = interpolate(
                    nodeProgress,
                    [0, 1],
                    [0, 0.6]
                  );

                  // Multiple data pulses when active
                  const pulsePositions = isActive
                    ? [0, 10, 20].map((offset) => {
                        const t = ((frame * 2.5 + offset) % 30) / 30;
                        return {
                          cx: interpolate(t, [0, 1], [BRAIN_CENTER, nodeX]),
                          cy: interpolate(t, [0, 1], [BRAIN_CENTER, nodeY]),
                          opacity: interpolate(t, [0, 0.5, 1], [0.3, 0.9, 0.2]),
                          r: interpolate(t, [0, 0.5, 1], [3, 6, 3]),
                        };
                      })
                    : [];

                  return (
                    <g key={node.name}>
                      {/* Connection line */}
                      <line
                        x1={BRAIN_CENTER}
                        y1={BRAIN_CENTER}
                        x2={BRAIN_CENTER + Math.cos(node.angle) * ORBIT_RADIUS * nodeProgress}
                        y2={BRAIN_CENTER + Math.sin(node.angle) * ORBIT_RADIUS * nodeProgress}
                        stroke={node.color}
                        strokeWidth={isActive ? 2.5 : 1.2}
                        strokeDasharray={isActive ? "none" : "4 6"}
                        opacity={lineOpacity * (isActive ? 1 : 0.4)}
                      />

                      {/* Active glow line (thicker, behind) */}
                      {isActive && (
                        <line
                          x1={BRAIN_CENTER}
                          y1={BRAIN_CENTER}
                          x2={nodeX}
                          y2={nodeY}
                          stroke={node.color}
                          strokeWidth={6}
                          opacity={0.15}
                        />
                      )}

                      {/* Data pulses */}
                      {pulsePositions.map((pulse, pi) => (
                        <circle
                          key={`pulse-${pi}`}
                          cx={pulse.cx}
                          cy={pulse.cy}
                          r={pulse.r}
                          fill={node.color}
                          opacity={pulse.opacity}
                        />
                      ))}
                    </g>
                  );
                })}
              </svg>

              {/* Central Claude icon circle */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  width: BRAIN_CIRCLE_SIZE,
                  height: BRAIN_CIRCLE_SIZE,
                  borderRadius: "50%",
                  background: `radial-gradient(circle at 40% 40%, ${COLORS.surface3}, ${COLORS.surface1})`,
                  border: `2.5px solid ${COLORS.borderActive}`,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  boxShadow: `0 0 50px ${COLORS.orangeDim}, 0 0 100px ${COLORS.orangeDim}, 0 0 150px rgba(249, 115, 22, 0.08)`,
                  zIndex: 2,
                  overflow: "hidden",
                }}
              >
                <img
                  src={staticFile("claude-icon.png")}
                  alt="Claude"
                  style={{
                    width: BRAIN_CIRCLE_SIZE * 0.65,
                    height: BRAIN_CIRCLE_SIZE * 0.65,
                    objectFit: "contain",
                  }}
                />
              </div>

              {/* "ReAct Agent" label below brain */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: `translate(-50%, ${BRAIN_CIRCLE_SIZE / 2 + 14}px)`,
                  fontFamily: FONTS.mono,
                  fontSize: 20,
                  fontWeight: 700,
                  color: COLORS.orange,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  opacity: interpolate(frame, [40, 60], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                  whiteSpace: "nowrap",
                  zIndex: 5,
                  background: `${COLORS.bg}cc`,
                  padding: "4px 14px",
                  borderRadius: 6,
                  border: `1px solid ${COLORS.borderActive}`,
                  textShadow: `0 0 12px ${COLORS.orange}80`,
                }}
              >
                ReAct Agent
              </div>

              {/* Tool nodes - BIGGER with labels */}
              {brainNodes.map((node, i) => {
                const toolEntryFrame = 50 + i * 40;
                const nodeProgress = spring({
                  frame: Math.max(0, frame - toolEntryFrame),
                  fps,
                  config: { damping: 16, stiffness: 100, mass: 0.8 },
                });

                const isActive =
                  frame >= toolEntryFrame &&
                  frame < toolEntryFrame + 60;

                const nodeGlow = isActive
                  ? 0.6 + 0.4 * Math.sin(frame * 0.15)
                  : 0.3;

                const nodeX = BRAIN_CENTER + Math.cos(node.angle) * ORBIT_RADIUS;
                const nodeY = BRAIN_CENTER + Math.sin(node.angle) * ORBIT_RADIUS;

                // Floating hover effect when active
                const floatY = isActive
                  ? Math.sin(frame * 0.12) * 3
                  : 0;

                // Label position (outside the orbit, further out)
                const labelAngle = node.angle;
                const labelRadius = ORBIT_RADIUS + NODE_SIZE / 2 + 40;
                const labelX = BRAIN_CENTER + Math.cos(labelAngle) * labelRadius;
                const labelY = BRAIN_CENTER + Math.sin(labelAngle) * labelRadius;

                return (
                  <React.Fragment key={node.name}>
                    {/* Node circle */}
                    <div
                      style={{
                        position: "absolute",
                        left: nodeX - NODE_SIZE / 2,
                        top: nodeY - NODE_SIZE / 2 + floatY,
                        width: NODE_SIZE,
                        height: NODE_SIZE,
                        borderRadius: "50%",
                        background: isActive
                          ? `radial-gradient(circle at 40% 40%, ${node.color}, ${node.color}bb)`
                          : `radial-gradient(circle at 40% 40%, ${COLORS.surface3}, ${COLORS.surface2})`,
                        border: `2.5px solid ${node.color}`,
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        fontSize: 28,
                        opacity: nodeProgress,
                        transform: `scale(${nodeProgress * (isActive ? 1.15 : 1)})`,
                        boxShadow: isActive
                          ? `0 0 20px ${node.color}, 0 0 40px ${node.color}50, 0 0 60px ${node.color}20`
                          : `0 0 8px ${node.color}30`,
                        zIndex: 3,
                      }}
                    >
                      <span
                        style={{
                          filter: isActive
                            ? "none"
                            : "grayscale(0.5)",
                          opacity: nodeGlow + 0.4,
                        }}
                      >
                        {node.icon}
                      </span>
                    </div>

                    {/* Node label with dark background pill */}
                    <div
                      style={{
                        position: "absolute",
                        left: labelX,
                        top: labelY + floatY,
                        transform: "translate(-50%, -50%)",
                        fontFamily: FONTS.mono,
                        fontSize: 18,
                        fontWeight: 700,
                        color: isActive ? node.color : COLORS.textSecondary,
                        letterSpacing: "0.05em",
                        opacity: nodeProgress * (isActive ? 1 : 0.8),
                        whiteSpace: "nowrap",
                        textShadow: isActive
                          ? `0 0 12px ${node.color}aa`
                          : `0 0 4px ${COLORS.bg}`,
                        zIndex: 4,
                        background: `${COLORS.bg}ee`,
                        padding: "5px 14px",
                        borderRadius: 6,
                        border: `1px solid ${isActive ? node.color + "60" : COLORS.border}`,
                      }}
                    >
                      {node.name}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* RIGHT: Tool cards stack */}
          <div
            style={{
              width: 620,
              display: "flex",
              flexDirection: "column",
              gap: 14,
              perspective: 1000,
            }}
          >
            {toolCards.map((tool) => {
              const cardFrame = Math.max(0, frame - tool.entryFrame);

              const cardSpring = spring({
                frame: cardFrame,
                fps,
                config: { damping: 14, stiffness: 90, mass: 0.8 },
              });

              const slideX = interpolate(cardSpring, [0, 1], [300, 0]);
              const rotateY = interpolate(cardSpring, [0, 1], [15, 0]);
              const cardOpacity = interpolate(
                cardSpring,
                [0, 1],
                [0, 1]
              );

              const isSpotlight =
                frame >= tool.spotlightStart &&
                frame < tool.spotlightEnd;

              const isApiTool = tool.apiCalls;

              return (
                <div
                  key={tool.name}
                  style={{
                    transform: `translateX(${slideX}px) perspective(1000px) rotateY(${rotateY}deg)`,
                    opacity: cardOpacity,
                    transformOrigin: "right center",
                  }}
                >
                  <NeonCard
                    delay={tool.entryFrame}
                    glowColor={tool.color}
                    active={isSpotlight}
                    width="100%"
                    style={{ padding: 0 }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "16px 20px",
                        gap: 16,
                      }}
                    >
                      {/* Icon container */}
                      <div
                        style={{
                          width: 50,
                          height: 50,
                          borderRadius: 12,
                          background: `linear-gradient(135deg, ${tool.color}25, ${tool.color}10)`,
                          border: `1px solid ${tool.color}30`,
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          fontSize: 26,
                          flexShrink: 0,
                        }}
                      >
                        {tool.icon}
                      </div>

                      {/* Text content */}
                      <div
                        style={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: FONTS.mono,
                            fontSize: 18,
                            fontWeight: 700,
                            color: tool.color,
                            letterSpacing: "0.01em",
                          }}
                        >
                          {tool.name}
                        </span>
                        <span
                          style={{
                            fontFamily: FONTS.sans,
                            fontSize: 16,
                            color: COLORS.textSecondary,
                            lineHeight: 1.3,
                          }}
                        >
                          {tool.description}
                        </span>
                        <span
                          style={{
                            fontFamily: FONTS.sans,
                            fontSize: 13,
                            color: COLORS.textMuted,
                            lineHeight: 1.3,
                          }}
                        >
                          {tool.detail}
                        </span>
                      </div>

                      {/* API / LOCAL badge */}
                      <div
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          background: isApiTool
                            ? COLORS.orangeDim
                            : COLORS.emeraldDim,
                          border: `1px solid ${isApiTool ? COLORS.orange : COLORS.emerald}30`,
                          fontFamily: FONTS.mono,
                          fontSize: 11,
                          fontWeight: 700,
                          color: isApiTool
                            ? COLORS.orange
                            : COLORS.emerald,
                          letterSpacing: "0.06em",
                          flexShrink: 0,
                        }}
                      >
                        {isApiTool ? "API" : "LOCAL"}
                      </div>
                    </div>
                  </NeonCard>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
