import React, { useEffect } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export default function CustomCursor() {
    const cursorX = useMotionValue(-100);
    const cursorY = useMotionValue(-100);

    // Outer ring spring (slower, lagging)
    const outerSpringConfig = { damping: 25, stiffness: 200, mass: 0.5 };
    const outerX = useSpring(cursorX, outerSpringConfig);
    const outerY = useSpring(cursorY, outerSpringConfig);

    // Inner dot spring (fast, stiff)
    const innerSpringConfig = { damping: 30, stiffness: 800, mass: 0.1 };
    const innerX = useSpring(useMotionValue(-100), innerSpringConfig);
    const innerY = useSpring(useMotionValue(-100), innerSpringConfig);

    useEffect(() => {
        const moveCursor = (e) => {
            cursorX.set(e.clientX - 16); // Center outer halo (32/2)
            cursorY.set(e.clientY - 16);
            innerX.set(e.clientX - 4); // Center inner dot (8/2)
            innerY.set(e.clientY - 4);
        };

        document.body.classList.add("custom-cursor-active");
        window.addEventListener("mousemove", moveCursor);

        return () => {
            window.removeEventListener("mousemove", moveCursor);
            document.body.classList.remove("custom-cursor-active");
        };
    }, [cursorX, cursorY, innerX, innerY]);

    return (
        <>
            <style>{`
        .custom-cursor-active, 
        .custom-cursor-active * {
          cursor: none !important;
        }
      `}</style>

            {/* Outer Halo */}
            <motion.div
                className="fixed top-0 left-0 w-8 h-8 rounded-full border border-orange-500/50 pointer-events-none z-[99999]"
                style={{
                    x: outerX,
                    y: outerY,
                    boxShadow: "0 0 20px rgba(249, 115, 22, 0.4)",
                }}
            />
            {/* Inner Dot */}
            <motion.div
                className="fixed top-0 left-0 w-2 h-2 rounded-full bg-orange-400 pointer-events-none z-[100000] shadow-[0_0_10px_rgba(249,115,22,1)]"
                style={{
                    x: innerX,
                    y: innerY,
                }}
            />
        </>
    );
}
