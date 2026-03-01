// Color scheme matching SportScout Ultra frontend exactly
export const COLORS = {
  // Backgrounds
  bg: "#050505",
  surface1: "#0a0a0a",
  surface2: "#111111",
  surface3: "#18181b",

  // Primary - Orange
  orange: "#f97316",
  orangeLight: "#fb923c",
  orangeDim: "rgba(249, 115, 22, 0.15)",
  orangeGlow: "rgba(249, 115, 22, 0.35)",

  // Secondary - Amber
  amber: "#f59e0b",
  amberLight: "#fbbf24",
  amberDim: "rgba(245, 158, 11, 0.15)",

  // Accent - Rose
  rose: "#f43f5e",
  roseLight: "#fb7185",
  roseDim: "rgba(244, 63, 94, 0.15)",

  // Tech/AI - Cyan
  cyan: "#06b6d4",
  cyanLight: "#22d3ee",
  cyanDim: "rgba(6, 182, 212, 0.15)",

  // Success
  emerald: "#10b981",
  emeraldLight: "#34d399",
  emeraldDim: "rgba(16, 185, 129, 0.15)",

  // Text
  textPrimary: "#ffffff",
  textSecondary: "#d4d4d8",
  textMuted: "#71717a",
  textDim: "#3f3f46",

  // Borders
  border: "rgba(249, 115, 22, 0.1)",
  borderActive: "rgba(249, 115, 22, 0.3)",
} as const;

export const FONTS = {
  mono: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
  sans: "'Outfit', 'Inter', -apple-system, sans-serif",
} as const;

// Tool definitions for the agent
export const TOOLS = [
  {
    name: "search_history",
    icon: "🔍",
    color: COLORS.cyan,
    description: "BM25 History Search",
    detail: "SQLite FTS5 over prior queries + preference keywords",
    apiCalls: false,
    round: 1,
  },
  {
    name: "query_players",
    icon: "📋",
    color: COLORS.emerald,
    description: "Local Player Registry",
    detail: "Pandas DataFrame filter on 500+ cached NBA players",
    apiCalls: false,
    round: 1,
  },
  {
    name: "fetch_sports_data",
    icon: "🏀",
    color: COLORS.orange,
    description: "Sportradar Live API",
    detail: "Player profiles, game logs, standings & live scores",
    apiCalls: true,
    round: 1,
  },
  {
    name: "compare_entities",
    icon: "📊",
    color: COLORS.rose,
    description: "Comparison Engine",
    detail: "Compare 1-6 players with radar, bar & table charts",
    apiCalls: false,
    round: 2,
  },
  {
    name: "generate_excel",
    icon: "📥",
    color: COLORS.amber,
    description: "Excel Export",
    detail: "Reads table_data from compare_entities → .xls download",
    apiCalls: false,
    round: 2,
  },
] as const;
