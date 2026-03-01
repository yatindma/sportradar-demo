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
import { ParticleField } from "./ParticleField";

type TextSlideProps = {
  heading: string;
  subtitle?: string;
  /** Accent color for the heading highlight line */
  accentColor?: string;
  /** Optional small label above heading (e.g., "STEP 1", "NEXT UP") */
  label?: string;
  /** Optional bullet points shown below subtitle */
  bullets?: (string | { name: string; desc: string; color: string })[];
};

export const TextSlide: React.FC<TextSlideProps> = ({
  heading,
  subtitle,
  accentColor = COLORS.orange,
  label,
  bullets,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // --- Master fade (slower, 24 frames in / 28 frames out) ---
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

  // --- Label animation (slower entry) ---
  const labelIn = interpolate(frame, [10, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const labelY = interpolate(labelIn, [0, 1], [14, 0]);

  // --- Heading line-by-line reveal (slower: 12-frame gap between batches) ---
  const headingWords = heading.split(" ");
  const wordsPerBatch = 3;
  const batches: string[] = [];
  for (let i = 0; i < headingWords.length; i += wordsPerBatch) {
    batches.push(headingWords.slice(i, i + wordsPerBatch).join(" "));
  }

  // --- Accent line (slower spring) ---
  const accentWidth = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: { damping: 20, stiffness: 60, mass: 0.8 },
  });

  // --- Subtitle (later entry, slower reveal) ---
  const subtitleDelay = 30 + batches.length * 12;
  const subtitleIn = interpolate(frame, [subtitleDelay, subtitleDelay + 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const subtitleY = interpolate(subtitleIn, [0, 1], [12, 0]);

  // --- Bullets stagger (much slower: 22-frame gap between bullets) ---
  const bulletBaseDelay = subtitleDelay + 24;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        opacity: fadeIn * fadeOut,
      }}
    >
      <ParticleField />

      {/* Subtle ambient glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 50% 45%, ${accentColor}12 0%, transparent 55%)`,
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
            maxWidth: 1100,
            padding: "0 80px",
            gap: 20,
          }}
        >
          {/* Label */}
          {label && (
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
              {label}
            </div>
          )}

          {/* Heading - word batches reveal */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
            }}
          >
            {batches.map((batch, i) => {
              const batchDelay = 16 + i * 12;
              const batchIn = interpolate(
                frame,
                [batchDelay, batchDelay + 22],
                [0, 1],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                }
              );
              const batchY = interpolate(batchIn, [0, 1], [20, 0]);

              return (
                <div
                  key={i}
                  style={{
                    opacity: batchIn,
                    transform: `translateY(${batchY}px)`,
                    fontFamily: FONTS.sans,
                    fontSize: 56,
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                    color: COLORS.textPrimary,
                    textAlign: "center",
                    lineHeight: 1.15,
                  }}
                >
                  {batch}
                </div>
              );
            })}
          </div>

          {/* Accent line */}
          <div
            style={{
              width: interpolate(accentWidth, [0, 1], [0, 80]),
              height: 3,
              borderRadius: 2,
              background: `linear-gradient(90deg, ${accentColor}, ${accentColor}80)`,
              marginTop: 4,
              marginBottom: 4,
            }}
          />

          {/* Subtitle */}
          {subtitle && (
            <div
              style={{
                opacity: subtitleIn,
                transform: `translateY(${subtitleY}px)`,
                fontFamily: FONTS.sans,
                fontSize: 24,
                color: COLORS.textSecondary,
                textAlign: "center",
                lineHeight: 1.5,
                maxWidth: 800,
              }}
            >
              {subtitle}
            </div>
          )}

          {/* Bullets */}
          {bullets && bullets.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                marginTop: 12,
                alignItems: "flex-start",
              }}
            >
              {bullets.map((bullet, i) => {
                const bulletDelay = bulletBaseDelay + i * 40;
                const bulletIn = interpolate(
                  frame,
                  [bulletDelay, bulletDelay + 16],
                  [0, 1],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.bezier(0.16, 1, 0.3, 1),
                  }
                );
                const bulletX = interpolate(bulletIn, [0, 1], [24, 0]);

                // Typing effect: starts after name appears, ~1.5 chars per frame
                const isStructured = typeof bullet !== "string";
                const descText = isStructured ? bullet.desc : "";
                const typeStart = bulletDelay + 12;
                const charsRevealed = isStructured
                  ? Math.floor(
                      interpolate(
                        frame,
                        [typeStart, typeStart + descText.length / 1.5],
                        [0, descText.length],
                        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                      )
                    )
                  : 0;
                const showCursor = isStructured && frame >= typeStart && charsRevealed < descText.length;

                return (
                  <div
                    key={i}
                    style={{
                      opacity: bulletIn,
                      transform: `translateX(${bulletX}px)`,
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: typeof bullet === "string" ? accentColor : bullet.color,
                        flexShrink: 0,
                        boxShadow: `0 0 12px ${typeof bullet === "string" ? accentColor : bullet.color}60`,
                      }}
                    />
                    {typeof bullet === "string" ? (
                      <span
                        style={{
                          fontFamily: FONTS.sans,
                          fontSize: 24,
                          color: COLORS.textSecondary,
                          lineHeight: 1.4,
                        }}
                      >
                        {bullet}
                      </span>
                    ) : (
                      <span
                        style={{
                          fontFamily: FONTS.sans,
                          fontSize: 24,
                          lineHeight: 1.4,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: FONTS.mono,
                            fontWeight: 700,
                            color: bullet.color,
                            textShadow: `0 0 8px ${bullet.color}90, 0 0 20px ${bullet.color}40, 0 0 40px ${bullet.color}20`,
                          }}
                        >
                          {bullet.name}
                        </span>
                        <span style={{ color: COLORS.textMuted }}> — </span>
                        <span style={{ color: COLORS.textSecondary }}>
                          {descText.slice(0, charsRevealed)}
                        </span>
                        {showCursor && (
                          <span
                            style={{
                              color: bullet.color,
                              opacity: Math.sin(frame * 0.3) > 0 ? 1 : 0,
                              fontWeight: 300,
                            }}
                          >
                            |
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
