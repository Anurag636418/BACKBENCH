import type React from "react";

// ── Design tokens (matching penfight.xyz palette) ──────────────────────────
export const INK   = "#24428f";
export const INK_2 = "rgba(36,66,143,0.66)";
export const INK_3 = "rgba(36,66,143,0.32)";
export const RED   = "#bf3b2b";
export const TIN   = "#c4691a";
export const PAPER = "#e9e2cf";
export const HAND  = "'Patrick Hand', 'Chalkboard SE', cursive";
export const STAMP = "'Anton', 'Arial Narrow', sans-serif";

export const TORN_CLIP = `polygon(
  0 4px, 12% 0, 25% 5px, 38% 1px, 50% 5px, 62% 0, 75% 5px, 88% 1px, 100% 4px,
  100% calc(100% - 4px), 88% 100%, 75% calc(100% - 5px), 62% calc(100% - 1px),
  50% calc(100% - 5px), 38% 100%, 25% calc(100% - 5px), 12% calc(100% - 1px),
  0 calc(100% - 4px)
)`;

export function slip(rot: number): React.CSSProperties {
  return {
    backgroundColor: PAPER,
    backgroundImage: `repeating-linear-gradient(transparent 0 19px, rgba(36,66,143,0.18) 19px 20px)`,
    backgroundPosition: "0 9px",
    boxShadow: "0 2px 3px rgba(20,12,4,0.4), 0 9px 20px rgba(20,12,4,0.45)",
    clipPath: TORN_CLIP,
    transform: `rotate(${rot}deg)`,
  };
}
