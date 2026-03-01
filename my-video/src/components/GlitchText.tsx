import React, { useMemo } from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";
import { COLORS, FONTS } from "../constants";

interface GlitchTextProps {
  text: string;
  delay?: number;
  fontSize?: number;
  color?: string;
  fontWeight?: number;
  style?: React.CSSProperties;
}

const GLITCH_CHARS = "!@#$%^&*()_+-=[]{}|;:',.<>?/0123456789";

export const GlitchText: React.FC<GlitchTextProps> = ({
  text,
  delay = 0,
  fontSize = 48,
  color = COLORS.textPrimary,
  fontWeight = 700,
  style,
}) => {
  const frame = useCurrentFrame();
  const adjustedFrame = Math.max(0, frame - delay);

  const charSeeds = useMemo(() => {
    return text.split("").map((_, i) => {
      return Array.from({ length: 20 }, (__, j) => {
        const seedVal = (i * 31 + j * 17 + 7) % GLITCH_CHARS.length;
        return GLITCH_CHARS[seedVal];
      });
    });
  }, [text]);

  const revealDuration = Math.max(15, text.length * 2);
  const glitchFramesPerChar = 4;

  const renderedChars = useMemo(() => {
    if (adjustedFrame <= 0) return text.split("").map(() => ({ char: " ", resolved: false }));

    return text.split("").map((targetChar, i) => {
      const charRevealFrame = (i / text.length) * revealDuration;

      if (adjustedFrame >= charRevealFrame + glitchFramesPerChar * 3) {
        return { char: targetChar, resolved: true };
      }

      if (adjustedFrame < charRevealFrame) {
        return { char: " ", resolved: false };
      }

      if (targetChar === " ") {
        return { char: " ", resolved: false };
      }

      const glitchPhase = Math.floor(adjustedFrame - charRevealFrame);
      const glitchIndex = glitchPhase % charSeeds[i].length;
      return { char: charSeeds[i][glitchIndex], resolved: false };
    });
  }, [adjustedFrame, text, charSeeds, revealDuration]);

  const isFullyResolved = adjustedFrame > revealDuration + glitchFramesPerChar * 3 + 5;

  const entryOpacity = interpolate(
    adjustedFrame,
    [0, 8],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.33, 0, 0.67, 1) }
  );

  const entryY = interpolate(
    adjustedFrame,
    [0, 15],
    [12, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }
  );

  const glowOpacity = isFullyResolved
    ? interpolate(
        adjustedFrame - revealDuration - glitchFramesPerChar * 3 - 5,
        [0, 20],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.25, 0.1, 0.25, 1) }
      )
    : 0;

  const glitchOffsetX = !isFullyResolved && adjustedFrame > 0
    ? Math.sin(adjustedFrame * 1.7) * interpolate(
        adjustedFrame,
        [0, revealDuration],
        [3, 0],
        { extrapolateRight: "clamp" }
      )
    : 0;

  const glitchOffsetY = !isFullyResolved && adjustedFrame > 0
    ? Math.cos(adjustedFrame * 2.3) * interpolate(
        adjustedFrame,
        [0, revealDuration],
        [1.5, 0],
        { extrapolateRight: "clamp" }
      )
    : 0;

  return (
    <div
      style={{
        display: "inline-block",
        opacity: entryOpacity,
        transform: `translateY(${entryY}px) translate(${glitchOffsetX}px, ${glitchOffsetY}px)`,
        ...style,
      }}
    >
      <span
        style={{
          fontFamily: FONTS.sans,
          fontSize,
          fontWeight,
          color,
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
          textShadow: glowOpacity > 0
            ? `0 0 ${20 * glowOpacity}px ${COLORS.orangeGlow}, 0 0 ${40 * glowOpacity}px ${COLORS.orangeDim}`
            : "none",
          display: "inline-block",
        }}
      >
        {renderedChars.map((c, i) => (
          <span
            key={i}
            style={{
              display: "inline-block",
              color: c.resolved ? color : COLORS.orange,
              opacity: c.char === " " && !c.resolved ? 0 : 1,
              fontFamily: c.resolved ? FONTS.sans : FONTS.mono,
              minWidth: c.char === " " ? "0.3em" : undefined,
            }}
          >
            {c.char}
          </span>
        ))}
      </span>
    </div>
  );
};
