/**
 * RadarChart — Multi-chart comparison visualization.
 */
import React from "react";
import {
  RadarChart as ReRadarChart,
  BarChart as ReBarChart,
  LineChart as ReLineChart,
  AreaChart as ReAreaChart,
  PieChart as RePieChart,
  ScatterChart as ReScatterChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  CartesianGrid,
  XAxis,
  YAxis,
  Radar,
  Bar,
  Line,
  Area,
  Pie,
  Cell,
  Scatter,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { motion } from "framer-motion";

const COLORS = ["#f97316", "#3b82f6", "#f43f5e", "#f59e0b", "#22c55e", "#06b6d4"];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-[#0b0b0b]/95 border border-white/[0.05] rounded-xl px-4 py-3 shadow-[0_0_30px_rgba(0,0,0,0.8)] backdrop-blur-md"
    >
      {label ? <p className="text-[13px] font-black uppercase text-zinc-400 mb-2 tracking-widest">{label}</p> : null}
      {payload.map((entry, i) => (
        <p
          key={i}
          className="text-sm font-bold tracking-wide"
          style={{ color: entry.color, textShadow: `0 0 10px ${entry.color}80` }}
        >
          {entry.name}: <span className="font-black text-white ml-2">{Number(entry.value).toFixed(1)}</span>
        </p>
      ))}
    </motion.div>
  );
}

function buildTableLikeRows(data) {
  return data.labels.map((label, i) => {
    const point = { stat: label, idx: i + 1 };
    data.datasets.forEach((ds) => {
      point[ds.name] = Number(ds.values[i] ?? 0);
    });
    return point;
  });
}

// Shared cartesian axis/grid props (inlined as direct children, NOT wrapped in a component)
const cartesianGridProps = { stroke: "rgba(255,255,255,0.08)", strokeDasharray: "4 4", vertical: false };
const xAxisProps = {
  dataKey: "stat",
  tick: { fill: "#a1a1aa", fontSize: 12, fontWeight: 800 },
  axisLine: { stroke: "rgba(255,255,255,0.12)" },
  tickLine: false,
};
const yAxisProps = {
  tick: { fill: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 700 },
  axisLine: false,
  tickLine: false,
  domain: [0, 100],
};
const legendStyle = { fontSize: 14, fontWeight: "bold", color: "#f4f4f5", paddingTop: 16 };

export default function RadarChartView({ data }) {
  if (!data || !data.labels || !data.datasets?.length) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm font-bold uppercase tracking-widest">
        No chart data available
      </div>
    );
  }

  const chartType = data.chart_type || "radar";
  const rowData = buildTableLikeRows(data);

  // Calculate max value across all datasets for proper domain scaling
  const allValues = data.datasets.flatMap((ds) => ds.values.map((v) => Number(v || 0)));
  const computedMax = Math.max(...allValues, 1);
  const domainMax = Math.ceil(computedMax / 10) * 10 || 100;
  const pieData = data.datasets.map((ds, i) => {
    const total = ds.values.reduce((sum, v) => sum + Number(v || 0), 0);
    const avg = ds.values.length > 0 ? total / ds.values.length : 0;
    return { name: ds.name, value: Number(avg.toFixed(2)), color: ds.color || COLORS[i % COLORS.length] };
  });
  const scatterData = data.datasets.map((ds, i) => ({
    name: ds.name,
    color: ds.color || COLORS[i % COLORS.length],
    points: data.labels.map((label, idx) => ({ x: idx + 1, y: Number(ds.values[idx] ?? 0), z: 6, label })),
  }));

  const renderChart = () => {
    if (chartType === "bar" || chartType === "histogram") {
      return (
        <ReBarChart data={rowData} margin={{ top: 20, right: 24, left: 0, bottom: 24 }}>
          <defs>
            {data.datasets.map((ds, i) => {
              const color = ds.color || COLORS[i % COLORS.length];
              return (
                <linearGradient key={`bar-gradient-${i}`} id={`barGradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.45} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid {...cartesianGridProps} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={10} />
          {data.datasets.map((ds, i) => (
            <Bar
              key={ds.name}
              name={ds.name}
              dataKey={ds.name}
              fill={`url(#barGradient-${i})`}
              radius={[8, 8, 2, 2]}
              maxBarSize={36}
            />
          ))}
        </ReBarChart>
      );
    }

    if (chartType === "line" || chartType === "gaussian") {
      return (
        <ReLineChart data={rowData} margin={{ top: 20, right: 24, left: 0, bottom: 24 }}>
          <CartesianGrid {...cartesianGridProps} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={10} />
          {data.datasets.map((ds, i) => (
            <Line
              key={ds.name}
              name={ds.name}
              dataKey={ds.name}
              type="monotone"
              stroke={ds.color || COLORS[i % COLORS.length]}
              strokeWidth={chartType === "gaussian" ? 3.5 : 3}
              dot={chartType === "gaussian" ? false : { r: 2.8 }}
              activeDot={{ r: 6 }}
            />
          ))}
        </ReLineChart>
      );
    }

    if (chartType === "area") {
      return (
        <ReAreaChart data={rowData} margin={{ top: 20, right: 24, left: 0, bottom: 24 }}>
          <defs>
            {data.datasets.map((ds, i) => {
              const color = ds.color || COLORS[i % COLORS.length];
              return (
                <linearGradient key={`area-gradient-${i}`} id={`areaGradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.05} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid {...cartesianGridProps} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={10} />
          {data.datasets.map((ds, i) => (
            <Area
              key={ds.name}
              name={ds.name}
              dataKey={ds.name}
              type="monotone"
              stroke={ds.color || COLORS[i % COLORS.length]}
              fill={`url(#areaGradient-${i})`}
              strokeWidth={2.5}
            />
          ))}
        </ReAreaChart>
      );
    }

    if (chartType === "pie") {
      return (
        <RePieChart>
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={10} />
          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="48%" outerRadius="68%" label>
            {pieData.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
        </RePieChart>
      );
    }

    if (chartType === "scatter") {
      return (
        <ReScatterChart margin={{ top: 20, right: 24, left: 0, bottom: 24 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
          <XAxis type="number" dataKey="x" name="Stat Index" tick={{ fill: "#a1a1aa", fontSize: 12 }} />
          <YAxis type="number" dataKey="y" name="Value" domain={[0, 100]} tick={{ fill: "#a1a1aa", fontSize: 12 }} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<CustomTooltip />} />
          <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={10} />
          {scatterData.map((series) => (
            <Scatter
              key={series.name}
              name={series.name}
              data={series.points}
              fill={series.color}
              line={{ stroke: series.color, strokeWidth: 2, strokeDasharray: "2 6" }}
            />
          ))}
        </ReScatterChart>
      );
    }

    // Default: radar chart
    return (
      <ReRadarChart cx="50%" cy="50%" outerRadius="75%" data={rowData}>
        <defs>
          {data.datasets.map((ds, i) => {
            const color = ds.color || COLORS[i % COLORS.length];
            return (
              <filter key={`glow-${i}`} id={`radarGlow-${i}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2.2" result="blur" />
                <feFlood floodColor={color} floodOpacity="0.3" result="color" />
                <feComposite in="color" in2="blur" operator="in" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            );
          })}
        </defs>
        <PolarGrid stroke="rgba(255,255,255,0.08)" strokeWidth={2} strokeDasharray="4 4" />
        <PolarAngleAxis dataKey="stat" tick={{ fill: "#a1a1aa", fontSize: 13, fontWeight: 900, textAnchor: "middle" }} />
        <PolarRadiusAxis
          angle={45}
          domain={[0, domainMax]}
          tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: "bold" }}
          axisLine={false}
        />
        {data.datasets.map((ds, i) => (
          <Radar
            key={ds.name}
            name={ds.name}
            dataKey={ds.name}
            stroke={ds.color || COLORS[i % COLORS.length]}
            fill={ds.color || COLORS[i % COLORS.length]}
            fillOpacity={0.15}
            strokeWidth={3}
            dot={{ r: 2.5, fill: ds.color || COLORS[i % COLORS.length], stroke: "rgba(255,255,255,0.8)", strokeWidth: 0.6 }}
            activeDot={{ r: 6, fill: "#fff", strokeWidth: 2, stroke: ds.color || COLORS[i % COLORS.length], strokeOpacity: 1 }}
            style={{ filter: `url(#radarGlow-${i})` }}
          />
        ))}
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={10} />
      </ReRadarChart>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full h-full relative">
      <motion.div
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 bg-gradient-to-t from-orange-500/5 to-transparent pointer-events-none z-0 rounded-full blur-3xl"
      />

      <ResponsiveContainer width="100%" height="100%" className="relative z-10">
        {renderChart()}
      </ResponsiveContainer>
    </motion.div>
  );
}
