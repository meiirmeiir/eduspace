import React from "react";

// ── Inline SVG-иконки. Пути взяты из набора Lucide/Feather (MIT/ISC) ───────────
//    Цвет — через currentColor (наследуется от родителя: light/dark, цвет
//    варианта шапки). viewBox 24, размер по пропу size (default 16).
const svgBase = (size) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": "true",
  focusable: "false",
  style: { display: "block" },
});
const strokeAttrs = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

// Звезда (Feather «star») — заливка currentColor (тир-иконка ESR)
export function IconStar({ size = 16, ...rest }) {
  return (
    <svg {...svgBase(size)} {...rest}>
      <polygon
        points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

// Ромб/самоцвет (Lucide «gem») — обводка currentColor (кристаллы)
export function IconGem({ size = 16, ...rest }) {
  return (
    <svg {...svgBase(size)} {...rest}>
      <path {...strokeAttrs} d="M6 3h12l4 6-10 13L2 9Z" />
      <path {...strokeAttrs} d="M11 3 8 9l4 13 4-13-3-6" />
      <path {...strokeAttrs} d="M2 9h20" />
    </svg>
  );
}

// Луна (Lucide «moon») — тёмная тема
export function IconMoon({ size = 16, ...rest }) {
  return (
    <svg {...svgBase(size)} {...rest}>
      <path {...strokeAttrs} d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

// Солнце (Lucide «sun») — светлая тема
export function IconSun({ size = 16, ...rest }) {
  return (
    <svg {...svgBase(size)} {...rest}>
      <circle {...strokeAttrs} cx="12" cy="12" r="4" />
      <path {...strokeAttrs} d="M12 2v2" />
      <path {...strokeAttrs} d="M12 20v2" />
      <path {...strokeAttrs} d="m4.93 4.93 1.41 1.41" />
      <path {...strokeAttrs} d="m17.66 17.66 1.41 1.41" />
      <path {...strokeAttrs} d="M2 12h2" />
      <path {...strokeAttrs} d="M20 12h2" />
      <path {...strokeAttrs} d="m6.34 17.66-1.41 1.41" />
      <path {...strokeAttrs} d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}
