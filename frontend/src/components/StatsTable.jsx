/**
 * StatsTable — Player statistics comparison table
 * Super animated fiery dark aesthetic.
 */
import React from "react";
import { motion } from "framer-motion";

function getWinnerIndex(row) {
  let maxVal = -Infinity;
  let maxIdx = null;

  for (let i = 1; i < row.length; i++) {
    const num = parseFloat(row[i]);
    if (!isNaN(num) && num > maxVal) {
      maxVal = num;
      maxIdx = i;
    }
  }

  const numericCount = row.slice(1).filter((v) => !isNaN(parseFloat(v))).length;
  return numericCount >= 2 ? maxIdx : null;
}

export default function StatsTable({ data }) {
  if (!data || !data.columns || !data.rows?.length) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm font-semibold uppercase tracking-widest">
        No table data available
      </div>
    );
  }

  const highlightWinner = data.highlightWinner !== false;

  return (
    <div className="w-full overflow-auto custom-scrollbar">
      {data.title && (
        <motion.h3
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-lg font-black tracking-tight uppercase text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-500 mb-4"
        >
          {data.title}
        </motion.h3>
      )}

      <table className="w-full text-[15px] border-collapse">
        <thead>
          <tr className="border-b-2 border-orange-500/20">
            {data.columns.map((col, i) => (
              <th
                key={i}
                className={`py-4 px-4 text-xs font-black uppercase tracking-[0.2em] ${i === 0
                    ? "text-left text-orange-500/80"
                    : "text-right text-orange-500/80"
                  }`}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, rowIdx) => {
            const winnerIdx = highlightWinner ? getWinnerIndex(row) : null;

            return (
              <motion.tr
                key={rowIdx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: rowIdx * 0.05 }}
                className={`border-b border-white/[0.05] transition-colors hover:bg-orange-500/10 group ${rowIdx % 2 === 0 ? "bg-[#111111]/50" : "bg-transparent"
                  }`}
              >
                {row.map((cell, colIdx) => {
                  const isWinner = colIdx === winnerIdx;
                  return (
                    <td
                      key={colIdx}
                      className={`py-3.5 px-4 transition-all ${colIdx === 0
                          ? "text-left text-zinc-300 font-bold tracking-wide"
                          : "text-right font-mono"
                        } ${isWinner
                          ? "text-orange-500 font-black drop-shadow-[0_0_10px_rgba(249,115,22,0.4)] scale-105"
                          : colIdx > 0
                            ? "text-zinc-400 font-semibold"
                            : ""
                        }`}
                    >
                      {cell}
                      {isWinner && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="ml-1.5 text-[10px] text-amber-400 align-super font-black bg-amber-500/10 px-1 py-0.5 rounded shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                        >
                          ★
                        </motion.span>
                      )}
                    </td>
                  );
                })}
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
