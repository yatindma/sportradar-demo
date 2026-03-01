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
import { NeonCard } from "../components/NeonCard";
import { TypewriterCode } from "../components/TypewriterCode";

// === PLANNING PHASE — Claude analyzes the query ===
const planningLines = [
  { text: "► analyzing user intent...", color: COLORS.cyan },
  { text: '  "Find youngest guards, compare with Curry, export"', color: COLORS.textSecondary },
  { text: "", color: COLORS.textMuted },
  { text: "  PLAN:", color: COLORS.cyanLight },
  { text: "  step 1 → search user history for preferences", color: COLORS.cyanLight },
  { text: "           tool: search_history", color: COLORS.textMuted },
  { text: "  step 2 → find youngest guards from player registry", color: COLORS.emeraldLight },
  { text: "           tool: query_players (filter: G, sort: age)", color: COLORS.textMuted },
  { text: "  step 3 → pull Steph Curry's live stats", color: COLORS.orangeLight },
  { text: "           tool: fetch_sports_data (Sportradar API)", color: COLORS.textMuted },
  { text: "  step 4 → compare young guards vs Curry", color: COLORS.roseLight },
  { text: "           tool: compare_entities (radar + table)", color: COLORS.textMuted },
  { text: "  step 5 → export comparison to Excel", color: COLORS.amberLight },
  { text: "           tool: generate_excel (.xls download)", color: COLORS.textMuted },
  { text: "", color: COLORS.textMuted },
  { text: "  strategy: round 1 → parallel(step 1,2,3)", color: COLORS.cyanLight },
  { text: "            round 2 → sequential(step 4 → step 5)", color: COLORS.cyanLight },
  { text: "  tools: 5 | rounds: 2 | confidence: 0.94", color: COLORS.textMuted },
  { text: "  ✓ plan locked — dispatching round 1...", color: COLORS.emeraldLight },
];

const round1Lines = [
  { text: "► executing plan: step 1, 2, 3 (parallel)", color: COLORS.cyan },
  { text: "", color: COLORS.textMuted },
  { text: "[step 1] search_history(query='youngest guards')", color: COLORS.cyanLight },
  { text: "  └─ sqlite FTS5 → 2 prior hits, pref_keywords: ['ppg','3pt']", color: COLORS.textMuted },
  { text: "[step 2] query_players(position=='G', sort_by='age', limit=10)", color: COLORS.emeraldLight },
  { text: "  └─ pd.DataFrame → filter 547 rows → sort age asc → top 10", color: COLORS.textMuted },
  { text: "  └─ result: Wembanyama(20), Chet(21), Scoot(21)... ✓", color: COLORS.emeraldLight },
  { text: "[step 3] fetch_sports_data(player='Stephen Curry')", color: COLORS.orangeLight },
  { text: "  └─ sportradar /players/{id}/profile → 200 OK (142ms)", color: COLORS.textMuted },
  { text: "  └─ PPG: 26.4, APG: 5.1, FG%: 45.2, 3P%: 40.8 ✓", color: COLORS.orangeLight },
];

const round2Lines = [
  { text: "► executing plan: step 4 → step 5 (sequential)", color: COLORS.cyan },
  { text: "  round 1 data received — proceeding to analysis", color: COLORS.textSecondary },
  { text: "", color: COLORS.textMuted },
  { text: "[step 4] compare_entities(entities=['top10 guards','Curry'])", color: COLORS.roseLight },
  { text: "  └─ context pull: Curry stats from fetch_sports_data ✓", color: COLORS.orangeLight },
  { text: "  └─ context pull: 10 guards from query_players ✓", color: COLORS.emeraldLight },
  { text: "  └─ metrics: ['PPG','APG','FG%','3P%','RPG','STL']", color: COLORS.textMuted },
  { text: "  └─ normalize 0-100 → radar_data + table_data (11×8) ✓", color: COLORS.roseLight },
  { text: "[step 5] generate_excel(file='guard_comparison.xls')", color: COLORS.amberLight },
  { text: "  └─ reads table_data from compare_entities context", color: COLORS.textMuted },
  { text: "  └─ HTML-as-XLS → /api/download/abc123 ✓", color: COLORS.amberLight },
];

const round3Lines = [
  { text: "► plan complete — all 5 steps executed", color: COLORS.emeraldLight },
  { text: "  synthesizing final answer from gathered data...", color: COLORS.textSecondary },
  { text: "", color: COLORS.textMuted },
  { text: "streaming SSE → response_chunk tokens:", color: COLORS.cyanLight },
  { text: '  "Curry leads in PPG (26.4) and 3P% (40.8)..."', color: COLORS.textSecondary },
  { text: '  "Young guards like Wembanyama show defensive upside..."', color: COLORS.textSecondary },
  { text: "  └─ client_action: render_chart(radar) + render_table", color: COLORS.emeraldLight },
  { text: "  └─ client_action: download(guard_comparison.xls)", color: COLORS.amberLight },
  { text: "final_response → stream_end ✓", color: COLORS.emeraldLight },
];

const TOOL_EXPLAINERS = [
  {
    name: "search_history",
    purpose: "BM25 search over prior queries for user preferences.",
    stage: 1,
    color: COLORS.cyan,
  },
  {
    name: "query_players",
    purpose: "Pandas filter on 500+ cached players (age < 24, G).",
    stage: 1,
    color: COLORS.emerald,
  },
  {
    name: "fetch_sports_data",
    purpose: "Live Sportradar API — profiles, game logs, standings & scores.",
    stage: 1,
    color: COLORS.orange,
  },
  {
    name: "compare_entities",
    purpose: "Compare 1-6 players with radar, bar & table charts.",
    stage: 2,
    color: COLORS.rose,
  },
  {
    name: "generate_excel",
    purpose: "Exports table_data to downloadable .xls file.",
    stage: 2,
    color: COLORS.amber,
  },
] as const;

export const QueryFlowScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const fadeOut = interpolate(frame, [1340, 1390], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.4, 0, 1, 1),
  });

  const cameraYaw = interpolate(Math.sin(frame * 0.008), [-1, 1], [-0.9, 0.9]);
  const cameraPitch = interpolate(Math.sin(frame * 0.006 + 1), [-1, 1], [-0.6, 0.7]);
  const terminalFloatY = interpolate(Math.sin(frame * 0.04), [-1, 1], [6, -7]);
  const terminalFloatX = interpolate(Math.sin(frame * 0.02), [-1, 1], [-2, 2]);

  // Stage boundaries: Plan(0-400) → Round1(400-660) → Round2(660-920) → Response(920+)
  const stage: 0 | 1 | 2 | 3 = frame < 400 ? 0 : frame < 660 ? 1 : frame < 920 ? 2 : 3;

  const userQuery =
    "Find the youngest guards, compare them with Steph Curry, and export the results.";

  // Stage opacities
  const planOpacity = interpolate(frame, [30, 60, 370, 410], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const stepOneOpacity = interpolate(frame, [410, 440, 630, 670], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const stepTwoOpacity = interpolate(frame, [660, 700, 890, 930], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const stepThreeOpacity = interpolate(frame, [920, 960, 1250, 1290], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const summarySpring = spring({
    frame: Math.max(0, frame - 1040),
    fps,
    config: { damping: 15, stiffness: 105, mass: 0.8 },
  });

  // === Thinking animation ===
  const thinkingDots = ".".repeat(Math.floor(frame / 10) % 4);
  const thinkingPulse = 0.5 + 0.5 * Math.sin(frame * 0.12);
  // Three bouncing dots for extra thinking effect
  const dot1 = Math.sin(frame * 0.15) * 0.5 + 0.5;
  const dot2 = Math.sin(frame * 0.15 - 0.8) * 0.5 + 0.5;
  const dot3 = Math.sin(frame * 0.15 - 1.6) * 0.5 + 0.5;

  const stagePill = (label: string, index: number) => {
    const active = stage === index;
    const done = stage > index;
    return (
      <div
        key={label}
        style={{
          padding: "9px 14px",
          borderRadius: 999,
          border: `1px solid ${active
              ? index === 0 ? `${COLORS.cyan}60` : COLORS.borderActive
              : done
                ? "rgba(16,185,129,0.35)"
                : "rgba(255,255,255,0.08)"
            }`,
          color: active
            ? index === 0 ? COLORS.cyan : COLORS.orange
            : done ? COLORS.emerald : COLORS.textMuted,
          background: active
            ? index === 0 ? COLORS.cyanDim : COLORS.orangeDim
            : "rgba(255,255,255,0.02)",
          fontFamily: FONTS.mono,
          fontSize: 11,
          letterSpacing: "0.07em",
          fontWeight: 700,
        }}
      >
        {done ? "✓ " : ""}
        {label}
      </div>
    );
  };

  const toolStatus = (toolStage: number) => {
    if (stage > toolStage) return "done";
    if (stage === toolStage) return "running";
    return "upcoming";
  };

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, opacity: fadeIn * fadeOut }}>
      <ParticleField />

      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(circle at 50% 14%, rgba(255,255,255,0.05), transparent 42%), radial-gradient(circle at 78% 80%, rgba(249,115,22,0.09), transparent 56%)",
        }}
      />

      {/* Planning phase ambient glow */}
      {stage === 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: `radial-gradient(circle at 40% 50%, ${COLORS.cyan}08 0%, transparent 50%)`,
            opacity: thinkingPulse,
          }}
        />
      )}

      <AbsoluteFill
        style={{
          perspective: 1800,
          transformStyle: "preserve-3d",
          transform: `rotateX(${cameraPitch}deg) rotateY(${cameraYaw}deg)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 84,
            right: 84,
            top: 40,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontFamily: FONTS.sans,
              fontSize: 40,
              fontWeight: 700,
              color: COLORS.textPrimary,
              letterSpacing: "-0.02em",
            }}
          >
            One query. Clear decision. Export ready.
          </div>
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: 12,
              color: COLORS.orange,
              letterSpacing: "0.08em",
            }}
          >
            LIVE WORKFLOW
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            top: 100,
            left: "50%",
            transform: "translateX(-50%)",
            width: 1320,
          }}
        >
          <NeonCard
            delay={8}
            glowColor={COLORS.cyan}
            active={stage <= 1}
            width="100%"
          >
            <div
              style={{
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 11,
                  color: COLORS.cyan,
                  letterSpacing: "0.08em",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                USER ASKED
              </span>
              <span
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 20,
                  color: COLORS.textPrimary,
                  lineHeight: 1.3,
                }}
              >
                {userQuery}
              </span>
            </div>
          </NeonCard>
        </div>

        {/* Stage pills */}
        <div
          style={{
            position: "absolute",
            left: 84,
            top: 186,
            display: "flex",
            gap: 10,
          }}
        >
          {stagePill("PLAN", 0)}
          {stagePill("ROUND 1: GATHER", 1)}
          {stagePill("ROUND 2: ANALYZE", 2)}
          {stagePill("RESPONSE", 3)}
        </div>

        {/* Thinking indicator — visible during planning */}
        {stage === 0 && (
          <div
            style={{
              position: "absolute",
              right: 84,
              top: 186,
              display: "flex",
              alignItems: "center",
              gap: 10,
              opacity: planOpacity,
            }}
          >
            {/* Bouncing dots */}
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {[dot1, dot2, dot3].map((d, i) => (
                <div
                  key={i}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: COLORS.cyan,
                    opacity: 0.4 + d * 0.6,
                    transform: `translateY(${-d * 4}px)`,
                    boxShadow: `0 0 ${4 + d * 8}px ${COLORS.cyan}80`,
                  }}
                />
              ))}
            </div>
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 13,
                color: COLORS.cyan,
                letterSpacing: "0.08em",
                fontWeight: 700,
                textShadow: `0 0 ${6 + thinkingPulse * 10}px ${COLORS.cyan}60`,
              }}
            >
              THINKING{thinkingDots}
            </span>
          </div>
        )}

        <div
          style={{
            position: "absolute",
            left: 84,
            right: 84,
            top: 248,
            display: "flex",
            gap: 28,
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              flex: 1,
              minWidth: 0,
              transform: `translateX(${terminalFloatX}px) translateY(${terminalFloatY}px)`,
            }}
          >
            <div style={{ position: "relative", width: "100%", height: 440 }}>
              {/* Planning terminal */}
              <div style={{ position: "absolute", inset: 0, opacity: planOpacity }}>
                <TypewriterCode
                  lines={planningLines}
                  delay={40}
                  title="claude → planning"
                  speed={1.8}
                  width="100%"
                  holographic={true}
                  brandColor={COLORS.cyan}
                />
              </div>
              {/* Round 1 terminal */}
              <div style={{ position: "absolute", inset: 0, opacity: stepOneOpacity }}>
                <TypewriterCode
                  lines={round1Lines}
                  delay={430}
                  title="round 1 → gather data (parallel)"
                  speed={0.7}
                  width="100%"
                  holographic={true}
                  brandColor={COLORS.cyan}
                />
              </div>
              {/* Round 2 terminal */}
              <div style={{ position: "absolute", inset: 0, opacity: stepTwoOpacity }}>
                <TypewriterCode
                  lines={round2Lines}
                  delay={690}
                  title="round 2 → analyze + export"
                  speed={0.7}
                  width="100%"
                  holographic={true}
                  brandColor={COLORS.orange}
                />
              </div>
              {/* Round 3 terminal */}
              <div style={{ position: "absolute", inset: 0, opacity: stepThreeOpacity }}>
                <TypewriterCode
                  lines={round3Lines}
                  delay={950}
                  title="round 3 → forced response (no tools)"
                  speed={0.7}
                  width="100%"
                  holographic={true}
                  brandColor={COLORS.emerald}
                />
              </div>
            </div>
          </div>

          <div style={{ width: 520, flexShrink: 0 }}>
            <NeonCard
              delay={24}
              glowColor={
                stage === 0 ? COLORS.cyan
                : stage === 1 ? COLORS.cyan
                : stage === 2 ? COLORS.orange
                : COLORS.emerald
              }
              active={stage <= 2}
              width="100%"
            >
              <div
                style={{
                  padding: "20px 20px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: 14,
                      color: COLORS.textSecondary,
                      letterSpacing: "0.09em",
                      fontWeight: 700,
                    }}
                  >
                    TOOLS FOR THIS QUERY
                  </span>
                  <span
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: 12,
                      color: stage === 0
                        ? COLORS.cyan
                        : stage === 3 ? COLORS.emerald : COLORS.orange,
                      letterSpacing: "0.06em",
                    }}
                  >
                    {stage === 0
                      ? "PLANNING..."
                      : stage === 3
                        ? "ALL DONE"
                        : `ROUND ${stage} ACTIVE`}
                  </span>
                </div>

                {TOOL_EXPLAINERS.map((tool, idx) => {
                  const status = stage === 0 ? "upcoming" : toolStatus(tool.stage);
                  const isRunning = status === "running";
                  const isDone = status === "done";
                  const isPlanning = stage === 0;

                  // During planning, highlight tools as they get mentioned in planning lines
                  const planHighlight = isPlanning && frame > 120 + idx * 40;

                  return (
                    <div
                      key={tool.name}
                      style={{
                        borderRadius: 12,
                        border: `1.5px solid ${isRunning
                            ? `${tool.color}88`
                            : isDone
                              ? "rgba(16,185,129,0.5)"
                              : planHighlight
                                ? `${tool.color}40`
                                : "rgba(255,255,255,0.08)"
                          }`,
                        background: isRunning
                          ? `${tool.color}22`
                          : isDone
                            ? "rgba(16,185,129,0.06)"
                            : planHighlight
                              ? `${tool.color}08`
                              : "rgba(255,255,255,0.01)",
                        padding: "14px 16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        opacity: isDone || isRunning ? 1 : planHighlight ? 0.8 : 0.6,
                        boxShadow: isRunning
                          ? `0 0 16px ${tool.color}20, inset 0 0 12px ${tool.color}08`
                          : planHighlight
                            ? `0 0 8px ${tool.color}10`
                            : "none",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: FONTS.mono,
                            fontSize: 15,
                            color: isDone ? COLORS.emerald : planHighlight ? tool.color : tool.color,
                            fontWeight: 700,
                          }}
                        >
                          {isDone ? "✓" : `${idx + 1}.`} {tool.name}
                        </span>
                        <span
                          style={{
                            fontFamily: FONTS.mono,
                            fontSize: 12,
                            color: isRunning
                              ? COLORS.orange
                              : isDone
                                ? COLORS.emerald
                                : planHighlight
                                  ? COLORS.cyan
                                  : COLORS.textDim,
                            letterSpacing: "0.06em",
                            fontWeight: 600,
                          }}
                        >
                          {isRunning
                            ? "● RUNNING"
                            : isDone
                              ? "DONE"
                              : planHighlight
                                ? "SELECTED"
                                : "UPCOMING"}
                        </span>
                      </div>
                      <span
                        style={{
                          fontFamily: FONTS.sans,
                          fontSize: 14,
                          color: isDone ? COLORS.textMuted : COLORS.textSecondary,
                          lineHeight: 1.4,
                        }}
                      >
                        {tool.purpose}
                      </span>
                    </div>
                  );
                })}
              </div>
            </NeonCard>
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 700,
            width: 1060,
            transform: `translateX(-50%) translateY(${interpolate(summarySpring, [0, 1], [14, 0])}px)`,
            opacity: interpolate(frame, [1030, 1070], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <NeonCard
            delay={1040}
            glowColor={COLORS.emerald}
            active={frame >= 1070 && frame < 1320}
            width="100%"
          >
            <div
              style={{
                padding: "20px 24px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 11,
                    color: COLORS.emerald,
                    letterSpacing: "0.08em",
                  }}
                >
                  WHAT USER GETS
                </span>
                <span
                  style={{
                    fontFamily: FONTS.sans,
                    fontSize: 30,
                    color: COLORS.textPrimary,
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                  }}
                >
                  A decision summary + downloadable comparison sheet.
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.textMuted }}>
                  TIME TO ANSWER
                </span>
                <span style={{ fontFamily: FONTS.mono, fontSize: 24, color: COLORS.orange, fontWeight: 700 }}>
                  1.2s
                </span>
              </div>
            </div>
          </NeonCard>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
