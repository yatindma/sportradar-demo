import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { COLORS, FONTS } from "../constants";

export const LiveDemoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Fade in / out ──
  const opacity = interpolate(frame, [0, 15, 155, 180], [0, 1, 1, 0], {
    extrapolateRight: "clamp",
  });

  // ── Background pulse ──
  const bgPulse = Math.sin(frame * 0.08) * 0.15 + 0.85;

  // ── "LET'S GO" spring entry ──
  const letsGoScale = spring({
    frame: frame - 10,
    fps,
    config: { damping: 12, stiffness: 80, mass: 0.8 },
  });

  // ── "LIVE" slam-in ──
  const liveScale = spring({
    frame: frame - 25,
    fps,
    config: { damping: 10, stiffness: 200, mass: 1.2 },
  });

  const liveY = interpolate(
    spring({
      frame: frame - 25,
      fps,
      config: { damping: 10, stiffness: 200, mass: 1.2 },
    }),
    [0, 1],
    [80, 0]
  );

  // ── Shockwave ring from LIVE slam ──
  const shockwaveProgress = interpolate(frame, [28, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const shockwaveOpacity = interpolate(frame, [28, 70], [0.6, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── (play button removed) ──

  // ── (subtitle removed) ──

  // ── Horizontal lines sweep ──
  const lineSweep = interpolate(frame, [5, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // ── Particles ──
  const particles = Array.from({ length: 30 }, (_, i) => {
    const angle = (i / 30) * Math.PI * 2;
    const speed = 2 + (i % 5) * 0.8;
    const startFrame = 25 + (i % 10) * 2;
    const progress = interpolate(frame, [startFrame, startFrame + 60], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const x = 960 + Math.cos(angle) * progress * (200 + i * 8);
    const y = 540 + Math.sin(angle) * progress * (200 + i * 8);
    const particleOpacity = interpolate(progress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);
    const size = 2 + (i % 4) * 1.5;
    return { x, y, opacity: particleOpacity, size };
  });

  // ── Scanning horizontal bar ──
  const scanY = interpolate(frame, [0, 180], [0, 1080], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        opacity,
        overflow: "hidden",
      }}
    >
      {/* ── Background radial glow ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 800px 600px at 50% 45%, rgba(249,115,22,${0.12 * bgPulse}) 0%, rgba(249,115,22,0.03) 50%, transparent 70%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 600px 400px at 50% 55%, rgba(6,182,212,${0.08 * bgPulse}) 0%, transparent 60%)`,
        }}
      />

      {/* ── Scan line ── */}
      <div
        style={{
          position: "absolute",
          top: scanY,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${COLORS.orange}40, transparent)`,
          opacity: 0.4,
        }}
      />

      {/* ── Horizontal accent lines ── */}
      <div
        style={{
          position: "absolute",
          top: 380,
          left: `${50 - lineSweep * 45}%`,
          right: `${50 - lineSweep * 45}%`,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${COLORS.orange}30, transparent)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 700,
          left: `${50 - lineSweep * 45}%`,
          right: `${50 - lineSweep * 45}%`,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${COLORS.cyan}30, transparent)`,
        }}
      />

      {/* ── Shockwave ring ── */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 200 + shockwaveProgress * 800,
          height: 200 + shockwaveProgress * 800,
          borderRadius: "50%",
          border: `2px solid ${COLORS.orange}`,
          opacity: shockwaveOpacity,
          pointerEvents: "none",
        }}
      />

      {/* ── Explosion particles ── */}
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            backgroundColor: i % 2 === 0 ? COLORS.orange : COLORS.cyan,
            opacity: p.opacity * 0.7,
            boxShadow: `0 0 ${p.size * 3}px ${i % 2 === 0 ? COLORS.orangeGlow : COLORS.cyanDim}`,
          }}
        />
      ))}

      {/* ── Main content ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
        }}
      >
        {/* LET'S GO */}
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 48,
            fontWeight: 300,
            color: COLORS.textSecondary,
            letterSpacing: 16,
            textTransform: "uppercase",
            transform: `scale(${letsGoScale})`,
            opacity: letsGoScale,
            marginBottom: 8,
          }}
        >
          LET'S GO TO THE
        </div>

        {/* LIVE */}
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 180,
            fontWeight: 900,
            lineHeight: 1,
            transform: `scale(${liveScale}) translateY(${liveY}px)`,
            opacity: liveScale,
            background: `linear-gradient(135deg, ${COLORS.orange} 0%, ${COLORS.orangeLight} 40%, ${COLORS.amber} 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: "none",
            filter: `drop-shadow(0 0 40px ${COLORS.orangeGlow}) drop-shadow(0 0 80px rgba(249,115,22,0.2))`,
            letterSpacing: 12,
          }}
        >
          LIVE DEMO
        </div>

        {/* ── Accent line under LIVE DEMO ── */}
        <div
          style={{
            width: interpolate(frame, [30, 55], [0, 500], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.cubic),
            }),
            height: 3,
            background: `linear-gradient(90deg, transparent, ${COLORS.orange}, ${COLORS.amber}, transparent)`,
            marginTop: 16,
            borderRadius: 2,
          }}
        />

        {/* ── Try it yourself URL ── */}
        <div
          style={{
            marginTop: 50,
            opacity: interpolate(frame, [60, 85], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            transform: `translateY(${interpolate(frame, [60, 85], [15, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.cubic),
            })}px)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.sans,
              fontSize: 24,
              fontWeight: 500,
              color: COLORS.textMuted,
              letterSpacing: 4,
              textTransform: "uppercase",
            }}
          >
            Try it yourself at
          </span>
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 32,
              fontWeight: 700,
              color: COLORS.orange,
              letterSpacing: 1,
              textShadow: `0 0 20px ${COLORS.orangeGlow}, 0 0 40px rgba(249,115,22,0.15)`,
              padding: "10px 28px",
              borderRadius: 12,
              border: `1px solid ${COLORS.borderActive}`,
              background: COLORS.orangeDim,
            }}
          >
            http://76.13.128.187:3002/
          </span>
        </div>

      </div>

      {/* ── Corner brackets ── */}
      {[
        { top: 60, left: 60 },
        { top: 60, right: 60 },
        { bottom: 60, left: 60 },
        { bottom: 60, right: 60 },
      ].map((pos, i) => {
        const bracketOpacity = interpolate(frame, [15 + i * 5, 30 + i * 5], [0, 0.3], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const isTop = "top" in pos;
        const isLeft = "left" in pos;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              ...pos,
              width: 40,
              height: 40,
              opacity: bracketOpacity,
              borderColor: COLORS.orange,
              borderStyle: "solid",
              borderWidth: 0,
              ...(isTop ? { borderTopWidth: 2 } : { borderBottomWidth: 2 }),
              ...(isLeft ? { borderLeftWidth: 2 } : { borderRightWidth: 2 }),
            } as React.CSSProperties}
          />
        );
      })}
    </AbsoluteFill>
  );
};
