/**
 * ApprovalModal — Simple user confirmation for live data fetches.
 */
import React from "react";
import { ShieldCheck, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ApprovalModal({ request, onApprove }) {
  if (!request) return null;

  return (
    <AnimatePresence>
      {request && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-auto"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-[#000]/80 backdrop-blur-md" />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.9, y: 50, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: -50, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative bg-[#09090b] border border-white/[0.05] rounded-[2rem] shadow-[0_0_60px_rgba(59,130,246,0.15)] max-w-md w-full mx-6 overflow-hidden"
          >
            {/* Body */}
            <div className="px-8 pt-8 pb-6 flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex-shrink-0 flex items-center justify-center border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                <ShieldCheck size={24} strokeWidth={2.5} className="text-blue-400" />
              </div>
              <p className="text-[17px] font-semibold text-zinc-100 leading-relaxed pt-2.5">
                {request.description}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 px-8 py-5 bg-[#0c0c0e] border-t border-white/[0.05]">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onApprove(request.step_id, false)}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl border border-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-800/50 hover:border-zinc-600 text-[14px] font-semibold transition-all"
              >
                <X size={16} strokeWidth={2.5} />
                No
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onApprove(request.step_id, true)}
                className="flex-[1.4] flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-[14px] font-bold shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all overflow-hidden relative group"
              >
                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 pointer-events-none" />
                <Check size={18} className="drop-shadow-lg" strokeWidth={2.5} />
                Yes, go ahead
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
