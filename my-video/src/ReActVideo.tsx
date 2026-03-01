import { AbsoluteFill, Series } from "remotion";
import { COLORS, FONTS } from "./constants";
import { IntroScene } from "./scenes/IntroScene";
import { ToolsRevealScene } from "./scenes/ToolsRevealScene";
import { QueryFlowScene } from "./scenes/QueryFlowScene";
import { OutroScene } from "./scenes/OutroScene";
import { LiveDemoScene } from "./scenes/LiveDemoScene";
import { StepByStepScene } from "./scenes/StepByStepScene";
import { TextSlide } from "./components/TextSlide";

export const ReActVideo: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        fontFamily: FONTS.sans,
      }}
    >
      <Series>
        {/* ── 1. SHOW: Brand intro — shiny SportScout Ultra ── */}
        <Series.Sequence durationInFrames={150}>
          <IntroScene />
        </Series.Sequence>

        {/* ── 2. EDUCATE: What is SportScout Ultra ── */}
        <Series.Sequence durationInFrames={120}>
          <TextSlide
            label="Introducing"
            heading="Sports Data to Decision-Ready Answers"
            subtitle="A ReAct agent that queries, compares, and exports NBA data — all from a single prompt."
            accentColor={COLORS.orange}
          />
        </Series.Sequence>

        {/* ── 3. EDUCATE: The 5 tools ── */}
        <Series.Sequence durationInFrames={330}>
          <TextSlide
            label="How It Works"
            heading="Five Specialized Tools, One Intelligent Agent"
            subtitle="The agent picks the right tool for each step — here's the arsenal:"
            accentColor={COLORS.cyan}
            bullets={[
              { name: "search_history", desc: "BM25 search over prior queries + preference keywords", color: COLORS.cyan },
              { name: "query_players", desc: "Pandas filter on 500+ cached NBA player registry", color: COLORS.emerald },
              { name: "fetch_sports_data", desc: "Live Sportradar API — profiles, game logs & standings", color: COLORS.orange },
              { name: "compare_entities", desc: "Compare 1-6 players with radar, bar & table charts", color: COLORS.rose },
              { name: "generate_excel", desc: "Reads compare table_data → downloadable .xls export", color: COLORS.amber },
            ]}
          />
        </Series.Sequence>

        {/* ── 4. SHOW: Tools reveal animation ── */}
        <Series.Sequence durationInFrames={330}>
          <ToolsRevealScene />
        </Series.Sequence>

        {/* ── 5. EDUCATE: What the demo will show (animated footprints) ── */}
        <Series.Sequence durationInFrames={240}>
          <StepByStepScene />
        </Series.Sequence>

        {/* ── 6. SHOW: Query flow animation ── */}
        <Series.Sequence durationInFrames={1440}>
          <QueryFlowScene />
        </Series.Sequence>

        {/* ── 7. EDUCATE: What user gets ── */}
        <Series.Sequence durationInFrames={110}>
          <TextSlide
            label="The Result"
            heading="From Raw Data to Confident Decisions"
            subtitle="2 tool rounds, 5 tool calls, 1 forced response — the user gets a streamed decision summary + comparison chart + downloadable .xls file."
            accentColor={COLORS.amber}
          />
        </Series.Sequence>

        {/* ── 8. SHOW: Outro/brand + credits ── */}
        <Series.Sequence durationInFrames={240}>
          <OutroScene />
        </Series.Sequence>

        {/* ── 9. TRANSITION: Let's go to live demo ── */}
        <Series.Sequence durationInFrames={180}>
          <LiveDemoScene />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
