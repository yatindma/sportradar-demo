import React, { useMemo } from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";
import { COLORS } from "../constants";

export const ParticleField: React.FC = () => {
  const frame = useCurrentFrame();

  const particles = useMemo(() => {
    return Array.from({ length: 50 }, (_, i) => {
      const seed = i * 137.508;
      const hue = i % 2 === 0 ? "orange" : "amber";
      return {
        x: (seed * 1.3) % 100,
        baseY: 100 + ((seed * 0.7) % 40),
        size: 1.2 + (i % 5) * 0.6,
        speed: 0.08 + (i % 7) * 0.025,
        opacity: 0.08 + (i % 6) * 0.04,
        wobbleAmp: 0.3 + (i % 4) * 0.15,
        wobbleFreq: 0.008 + (i % 3) * 0.003,
        color: hue === "orange" ? COLORS.orange : COLORS.amber,
        phaseOffset: (i * 47) % 360,
        blurAmount: 0.3 + (i % 3) * 0.4,
      };
    });
  }, []);

  const gridLinesH = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => ({
      y: (i + 1) * (100 / 21),
    }));
  }, []);

  const gridLinesV = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => ({
      x: (i + 1) * (100 / 31),
    }));
  }, []);

  const scanLineY = interpolate(
    frame % 200,
    [0, 200],
    [0, 100],
    { extrapolateRight: "clamp" }
  );

  const scanLineOpacity = interpolate(
    frame % 200,
    [0, 10, 190, 200],
    [0, 0.05, 0.05, 0],
    { extrapolateRight: "clamp" }
  );

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none" as const,
      }}
    >
      {/* Radial gradient glow - top right (orange) */}
      <div
        style={{
          position: "absolute",
          top: "-20%",
          right: "-15%",
          width: "70%",
          height: "70%",
          borderRadius: "50%",
          background: `radial-gradient(ellipse at center, ${COLORS.orangeGlow} 0%, transparent 70%)`,
          opacity: interpolate(
            frame,
            [0, 60],
            [0, 0.12],
            { extrapolateRight: "clamp", easing: Easing.bezier(0.25, 0.1, 0.25, 1) }
          ),
          filter: "blur(80px)",
        }}
      />

      {/* Radial gradient glow - bottom left (rose) */}
      <div
        style={{
          position: "absolute",
          bottom: "-25%",
          left: "-20%",
          width: "65%",
          height: "65%",
          borderRadius: "50%",
          background: `radial-gradient(ellipse at center, ${COLORS.roseDim} 0%, transparent 70%)`,
          opacity: interpolate(
            frame,
            [0, 80],
            [0, 0.1],
            { extrapolateRight: "clamp", easing: Easing.bezier(0.25, 0.1, 0.25, 1) }
          ),
          filter: "blur(100px)",
        }}
      />

      {/* Grid lines - horizontal */}
      {gridLinesH.map((line, i) => {
        const lineOpacity = interpolate(
          frame,
          [i * 3, i * 3 + 40],
          [0, 0.03],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        return (
          <div
            key={`h-${i}`}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${line.y}%`,
              height: 1,
              background: `linear-gradient(90deg, transparent 0%, ${COLORS.orange} 20%, ${COLORS.orange} 80%, transparent 100%)`,
              opacity: lineOpacity,
            }}
          />
        );
      })}

      {/* Grid lines - vertical */}
      {gridLinesV.map((line, i) => {
        const lineOpacity = interpolate(
          frame,
          [i * 2, i * 2 + 50],
          [0, 0.03],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        return (
          <div
            key={`v-${i}`}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${line.x}%`,
              width: 1,
              background: `linear-gradient(180deg, transparent 0%, ${COLORS.orange} 20%, ${COLORS.orange} 80%, transparent 100%)`,
              opacity: lineOpacity,
            }}
          />
        );
      })}

      {/* Particles */}
      {particles.map((p, i) => {
        const travel = (frame * p.speed) % 140;
        const currentY = p.baseY - travel;
        const wobbleX =
          p.wobbleAmp *
          Math.sin((frame + p.phaseOffset) * p.wobbleFreq * Math.PI * 2);

        const particleOpacity =
          currentY > 95 || currentY < -5
            ? 0
            : p.opacity *
              interpolate(
                currentY,
                [-5, 10, 80, 95],
                [0, 1, 1, 0],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
              );

        const shimmer =
          0.7 +
          0.3 * Math.sin((frame * 0.05 + p.phaseOffset) * Math.PI * 2);

        return (
          <div
            key={`p-${i}`}
            style={{
              position: "absolute",
              left: `${p.x + wobbleX}%`,
              top: `${currentY}%`,
              width: p.size * 2,
              height: p.size * 2,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${p.color} 0%, transparent 70%)`,
              opacity: particleOpacity * shimmer,
              filter: `blur(${p.blurAmount}px)`,
              boxShadow: `0 0 ${p.size * 4}px ${p.color}`,
            }}
          />
        );
      })}

      {/* Scan line */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: `${scanLineY}%`,
          height: 2,
          background: `linear-gradient(90deg, transparent 0%, ${COLORS.orange} 15%, ${COLORS.orange} 85%, transparent 100%)`,
          opacity: scanLineOpacity,
          boxShadow: `0 0 20px ${COLORS.orangeGlow}, 0 0 60px ${COLORS.orangeDim}`,
        }}
      />

      {/* Noise texture overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(255, 255, 255, 0.003) 2px,
            rgba(255, 255, 255, 0.003) 4px
          )`,
          opacity: 0.5,
        }}
      />
    </div>
  );
};
