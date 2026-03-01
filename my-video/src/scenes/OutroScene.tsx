import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, FONTS } from "../constants";
import { ParticleField } from "../components/ParticleField";

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Animations ──
  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const brandIn = spring({
    frame: Math.max(0, frame - 8),
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.8 },
  });

  const taglineIn = interpolate(frame, [40, 65], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const pillIn = interpolate(frame, [55, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const dividerIn = interpolate(frame, [75, 110], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const madeWithIn = interpolate(frame, [95, 125], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const builtByIn = interpolate(frame, [130, 160], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const thankYouIn = spring({
    frame: Math.max(0, frame - 170),
    fps,
    config: { damping: 12, stiffness: 80, mass: 0.6 },
  });

  const holdGlow = interpolate(
    Math.sin(frame * 0.05),
    [-1, 1],
    [0.2, 0.5]
  );

  const pulseGlow = interpolate(
    Math.sin(frame * 0.1),
    [-1, 1],
    [0.6, 1]
  );

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, opacity: fadeIn }}>
      <ParticleField />

      {/* Ambient glow - orange top */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `radial-gradient(ellipse at 50% 20%, ${COLORS.orangeDim} 0%, transparent 50%)`,
          opacity: holdGlow,
        }}
      />

      {/* Ambient glow - cyan bottom */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `radial-gradient(ellipse at 50% 85%, ${COLORS.cyanDim} 0%, transparent 45%)`,
          opacity: holdGlow * 0.7,
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
            gap: 0,
          }}
        >
          {/* ── Logo + Brand ── */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
              transform: `translateY(${interpolate(brandIn, [0, 1], [24, 0])}px) scale(${interpolate(brandIn, [0, 1], [0.92, 1])})`,
              opacity: interpolate(brandIn, [0, 1], [0, 1]),
            }}
          >
            {/* Logo box */}
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: 26,
                border: `1px solid ${COLORS.borderActive}`,
                background: `linear-gradient(145deg, ${COLORS.surface3}, ${COLORS.surface1})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 16px 40px rgba(0,0,0,0.5), 0 0 ${30 * pulseGlow}px ${COLORS.orangeDim}`,
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 54,
                  fontWeight: 800,
                  color: COLORS.orange,
                  textShadow: `0 0 18px ${COLORS.orangeGlow}`,
                }}
              >
                S
              </span>
            </div>

            {/* Brand name */}
            <div
              style={{
                fontFamily: FONTS.sans,
                fontSize: 56,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: COLORS.textPrimary,
              }}
            >
              SportScout Ultra
            </div>
          </div>

          {/* ── Tagline ── */}
          <div
            style={{
              opacity: taglineIn,
              transform: `translateY(${interpolate(taglineIn, [0, 1], [12, 0])}px)`,
              fontFamily: FONTS.sans,
              fontSize: 22,
              color: COLORS.textSecondary,
              marginTop: 10,
            }}
          >
            From raw data to confident decisions.
          </div>

          {/* ── Pill ── */}
          <div
            style={{
              opacity: pillIn,
              transform: `translateY(${interpolate(pillIn, [0, 1], [10, 0])}px) scale(${interpolate(pillIn, [0, 1], [0.95, 1])})`,
              marginTop: 14,
              padding: "9px 22px",
              borderRadius: 999,
              border: `1px solid ${COLORS.borderActive}`,
              color: COLORS.orange,
              fontFamily: FONTS.mono,
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
            }}
          >
            Built for High-Speed Sports Ops
          </div>

          {/* ── Divider ── */}
          <div
            style={{
              marginTop: 32,
              marginBottom: 28,
              width: interpolate(dividerIn, [0, 1], [0, 320]),
              height: 1,
              background: `linear-gradient(90deg, transparent, ${COLORS.textDim}, transparent)`,
              opacity: dividerIn,
            }}
          />

          {/* ── Made with section ── */}
          <div
            style={{
              opacity: madeWithIn,
              transform: `translateY(${interpolate(madeWithIn, [0, 1], [14, 0])}px)`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                fontFamily: FONTS.sans,
                fontSize: 14,
                color: COLORS.textMuted,
                letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
              }}
            >
              This video was made with
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 40,
              }}
            >
              {/* Claude Code */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Img
                  src={staticFile("claude-icon.png")}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                  }}
                />
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 18,
                    fontWeight: 600,
                    color: COLORS.textPrimary,
                  }}
                >
                  Claude Code
                </span>
              </div>

              {/* + separator */}
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 20,
                  color: COLORS.textDim,
                  fontWeight: 300,
                }}
              >
                +
              </span>

              {/* Remotion */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Img
                  src={staticFile("remotion-logo.png")}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                  }}
                />
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 18,
                    fontWeight: 600,
                    color: COLORS.textPrimary,
                  }}
                >
                  Remotion
                </span>
              </div>
            </div>
          </div>

          {/* ── Built by ── */}
          <div
            style={{
              opacity: builtByIn,
              transform: `translateY(${interpolate(builtByIn, [0, 1], [10, 0])}px)`,
              marginTop: 30,
              fontFamily: FONTS.sans,
              fontSize: 20,
              color: COLORS.textSecondary,
              fontWeight: 500,
            }}
          >
            Built by{" "}
            <span
              style={{
                color: COLORS.orange,
                fontWeight: 700,
              }}
            >
              Yatin Arora
            </span>
          </div>

          {/* ── Thank You ── */}
          <div
            style={{
              opacity: interpolate(thankYouIn, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(thankYouIn, [0, 1], [16, 0])}px) scale(${interpolate(thankYouIn, [0, 1], [0.9, 1])})`,
              marginTop: 28,
              fontFamily: FONTS.sans,
              fontSize: 16,
              color: COLORS.textMuted,
              letterSpacing: "0.08em",
            }}
          >
            Thank you for watching
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
