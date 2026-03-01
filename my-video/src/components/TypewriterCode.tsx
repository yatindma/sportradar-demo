import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";
import { COLORS, FONTS } from "../constants";

interface CodeLine {
  text: string;
  color?: string;
  indent?: number;
}

interface TypewriterCodeProps {
  lines: Array<CodeLine>;
  delay?: number;
  title?: string;
  speed?: number;
  width?: number | string;
  holographic?: boolean;
  brandColor?: string;
}

export const TypewriterCode: React.FC<TypewriterCodeProps> = ({
  lines,
  delay = 0,
  title = "terminal",
  speed = 2,
  width = 620,
  holographic = false,
  brandColor = COLORS.orange,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - delay);

  const entrySpring = spring({
    frame: adjustedFrame,
    fps,
    config: { damping: 16, stiffness: 90, mass: 0.9 },
  });

  const entryScale = interpolate(entrySpring, [0, 1], [0.92, 1]);
  const entryOpacity = interpolate(entrySpring, [0, 1], [0, 1]);
  const entryY = interpolate(entrySpring, [0, 1], [20, 0]);

  const lineMetrics = useMemo(() => {
    let cumChars = 0;
    return lines.map((line) => {
      const startChar = cumChars;
      cumChars += line.text.length;
      const endChar = cumChars;
      cumChars += speed * 3;
      return { startChar, endChar, totalAtEnd: cumChars };
    });
  }, [lines, speed]);

  const totalTypingUnits =
    lineMetrics.length > 0 ? lineMetrics[lineMetrics.length - 1].totalAtEnd : 0;
  const typingFrames = Math.max(1, totalTypingUnits / speed);
  const typingProgress = interpolate(
    adjustedFrame,
    [0, typingFrames * 0.18, typingFrames],
    [0, totalTypingUnits * 0.2, totalTypingUnits],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.2, 0.9, 0.15, 1),
    }
  );

  const totalCharsTyped = Math.floor(typingProgress);
  const cursorBlink = interpolate(
    Math.sin((frame + delay) * 0.45) + Math.sin((frame + delay) * 0.11),
    [-2, 2],
    [0.15, 1]
  );
  const cursorVisible = cursorBlink > 0.38 && adjustedFrame > 4;

  const activeLineIndex = useMemo(() => {
    for (let i = lineMetrics.length - 1; i >= 0; i--) {
      if (totalCharsTyped >= lineMetrics[i].startChar) return i;
    }
    return 0;
  }, [totalCharsTyped, lineMetrics]);

  const scanY = interpolate(adjustedFrame % 120, [0, 120], [0, 100], {
    extrapolateRight: "clamp",
  });

  const hoverY = holographic
    ? interpolate(Math.sin((frame + delay) * 0.08), [-1, 1], [5, -6])
    : 0;
  const hoverX = holographic
    ? interpolate(Math.sin((frame + delay) * 0.045), [-1, 1], [-2, 2])
    : 0;
  const rotateX = holographic
    ? interpolate(Math.sin((frame + delay) * 0.028), [-1, 1], [8, 11])
    : 0;
  const rotateY = holographic
    ? interpolate(Math.sin((frame + delay) * 0.037), [-1, 1], [-3.5, 3.5])
    : 0;
  const rotateZ = holographic
    ? interpolate(Math.sin((frame + delay) * 0.02), [-1, 1], [-0.35, 0.35])
    : 0;
  const glowPulse = holographic
    ? interpolate(Math.sin((frame + delay) * 0.12), [-1, 1], [0.35, 0.8])
    : 0.35;

  return (
    <div
      style={{
        position: "relative",
        perspective: holographic ? 1800 : undefined,
        transformStyle: "preserve-3d",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: holographic ? "-8% -8% -28% -8%" : 0,
          pointerEvents: "none",
          opacity: holographic ? 0.95 : 0,
          background: holographic
            ? `radial-gradient(ellipse at 50% 85%, ${brandColor}4f 0%, transparent 58%)`
            : "none",
          filter: "blur(28px)",
          transform: `translateY(${hoverY * 0.9}px)`,
        }}
      />

      <div
        style={{
          width,
          opacity: entryOpacity,
          transform: `translateX(${hoverX}px) translateY(${entryY + hoverY}px) scale(${entryScale}) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)`,
          transformOrigin: "top center",
          transformStyle: "preserve-3d",
          borderRadius: 12,
          overflow: "hidden",
          border: holographic
            ? "1px solid rgba(255,255,255,0.12)"
            : "1px solid rgba(255,255,255,0.06)",
          boxShadow: holographic
            ? `0 20px 54px rgba(0,0,0,0.56), 0 6px 18px rgba(0,0,0,0.42), 0 0 ${42 * glowPulse}px ${brandColor}33, 0 0 0 1px ${brandColor}22`
            : "0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3), 0 0 0 1px rgba(249,115,22,0.08)",
        }}
      >
        {holographic && (
          <>
            <div
              style={{
                position: "absolute",
                left: 8,
                right: 8,
                top: 0,
                height: 1,
                background: `linear-gradient(90deg, transparent, ${brandColor}, transparent)`,
                opacity: 0.45,
                zIndex: 6,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 8,
                right: 8,
                bottom: -12,
                height: 10,
                transform: "rotateX(80deg)",
                transformOrigin: "top center",
                background: `linear-gradient(180deg, ${brandColor}35, rgba(0,0,0,0))`,
                filter: "blur(3px)",
                opacity: 0.45,
                zIndex: 0,
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                zIndex: 5,
                mixBlendMode: "screen",
                opacity: 0.1,
                background:
                  "linear-gradient(110deg, transparent 5%, rgba(255,255,255,0.05) 32%, transparent 55%)",
              }}
            />
          </>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "10px 14px",
            background: "linear-gradient(180deg, #1e1e24 0%, #18181c 100%)",
            borderBottom: "1px solid rgba(249,115,22,0.06)",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", gap: 6 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#ff5f57",
                boxShadow: "inset 0 -1px 1px rgba(0,0,0,0.2)",
              }}
            />
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#ffbd2e",
                boxShadow: "inset 0 -1px 1px rgba(0,0,0,0.2)",
              }}
            />
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#28c840",
                boxShadow: "inset 0 -1px 1px rgba(0,0,0,0.2)",
              }}
            />
          </div>

          <div
            style={{
              flex: 1,
              textAlign: "center",
              fontFamily: FONTS.mono,
              fontSize: 11,
              color: COLORS.textMuted,
              letterSpacing: "0.05em",
            }}
          >
            {title}
          </div>

          <div style={{ width: 44 }} />
        </div>

        <div
          style={{
            position: "relative",
            background: "linear-gradient(180deg, #0d1117 0%, #161b22 100%)",
            padding: "16px 0",
            minHeight: 60,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(180deg, transparent ${scanY - 2}%, rgba(249,115,22,0.015) ${scanY}%, transparent ${scanY + 2}%)`,
              pointerEvents: "none",
              zIndex: 2,
            }}
          />

          {lines.map((line, lineIndex) => {
            const metrics = lineMetrics[lineIndex];
            const lineStartFrame = metrics.startChar / speed;
            const charsInThisLine = Math.max(
              0,
              Math.min(
                line.text.length,
                Math.floor(totalCharsTyped - metrics.startChar)
              )
            );

            const isActive =
              lineIndex === activeLineIndex && charsInThisLine < line.text.length;
            const isVisible = totalCharsTyped >= metrics.startChar;
            const lineSettle = spring({
              frame: Math.max(0, adjustedFrame - lineStartFrame),
              fps,
              config: { damping: 17, stiffness: 120, mass: 0.7 },
            });
            const lineY = interpolate(lineSettle, [0, 1], [6, 0]);
            const lineOpacity = interpolate(lineSettle, [0, 0.2, 1], [0, 0.75, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const activePulse = isActive
              ? interpolate(Math.sin((frame + lineIndex * 7) * 0.22), [-1, 1], [0.02, 0.08])
              : 0;

            if (!isVisible) return null;

            const displayText = line.text.substring(0, charsInThisLine);
            const indent = line.indent || 0;

            return (
              <div
                key={lineIndex}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  padding: "1px 0",
                  minHeight: 22,
                  opacity: lineOpacity,
                  transform: `translateY(${lineY}px)`,
                  background: isActive
                    ? `rgba(249, 115, 22, ${activePulse})`
                    : "transparent",
                }}
              >
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 12,
                    color: isActive ? COLORS.textMuted : COLORS.textDim,
                    width: 44,
                    textAlign: "right",
                    paddingRight: 16,
                    flexShrink: 0,
                    userSelect: "none",
                    lineHeight: "22px",
                  }}
                >
                  {lineIndex + 1}
                </span>

                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 13,
                    color: line.color || COLORS.textSecondary,
                    paddingLeft: indent * 20,
                    lineHeight: "22px",
                    whiteSpace: "pre",
                  }}
                >
                  <span style={{ color: COLORS.textDim, marginRight: 10 }}>›</span>
                  {displayText}
                  {isActive && cursorVisible && (
                    <span
                      style={{
                        display: "inline-block",
                        width: 6,
                        height: 15,
                        background: COLORS.orange,
                        marginLeft: 1,
                        verticalAlign: "middle",
                        boxShadow: `0 0 10px ${COLORS.orangeGlow}`,
                        borderRadius: 1,
                        opacity: cursorBlink,
                      }}
                    />
                  )}
                </span>
              </div>
            );
          })}

          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `repeating-linear-gradient(
                0deg,
                transparent,
                transparent 3px,
                rgba(0,0,0,0.08) 3px,
                rgba(0,0,0,0.08) 4px
              )`,
              pointerEvents: "none",
              zIndex: 1,
              opacity: 0.4,
            }}
          />
        </div>
      </div>
    </div>
  );
};
