import { Position } from '@xyflow/react';

// Смещение контрольных точек Безье от края handle
const CTRL = 55;

// Направление нормали для каждой стороны
const NORMAL = {
  [Position.Top]:    [ 0, -1],
  [Position.Bottom]: [ 0,  1],
  [Position.Left]:   [-1,  0],
  [Position.Right]:  [ 1,  0],
};

function buildBezier(sx, sy, sPos, tx, ty, tPos) {
  const [d1x, d1y] = NORMAL[sPos] ?? [0, 0];
  const [d2x, d2y] = NORMAL[tPos] ?? [0, 0];
  const cp1x = sx + d1x * CTRL;
  const cp1y = sy + d1y * CTRL;
  const cp2x = tx + d2x * CTRL;
  const cp2y = ty + d2y * CTRL;
  return `M ${sx} ${sy} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${tx} ${ty}`;
}

let _edgeCounter = 0;

export default function MagicEdge({
  id,
  sourceX, sourceY,
  targetX, targetY,
  sourcePosition = Position.Top,
  targetPosition = Position.Bottom,
  data = {},
}) {
  // isUnlocked — из старого DiagModuleArrow; status — из нового
  const locked =
    data.isUnlocked === false ||
    data.status === 'locked' ||
    (!data.isUnlocked && data.isUnlocked !== undefined);

  const d = buildBezier(sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition);

  // Уникальный id фильтра чтобы не конфликтовали между рёбрами
  const filterId = `mglow-${id}`;

  // ── Заблокировано: тусклая пунктирная линия без анимации ──
  if (locked) {
    return (
      <path
        d={d}
        fill="none"
        stroke="#1e3a5f"
        strokeWidth={2}
        strokeDasharray="5 10"
        opacity={0.4}
      />
    );
  }

  // ── Активно: три слоя магии ──
  return (
    <g>
      <defs>
        <filter id={filterId} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
        </filter>
      </defs>

      {/* Слой 1 — Аура (широкая размытая) */}
      <path
        d={d}
        fill="none"
        stroke="#4f46e5"
        strokeWidth={12}
        opacity={0.22}
        filter={`url(#${filterId})`}
      />

      {/* Слой 2 — Ядро (тонкая яркая) */}
      <path
        d={d}
        fill="none"
        stroke="#22d3ee"
        strokeWidth={3}
        opacity={0.92}
        strokeLinecap="round"
      />

      {/* Слой 3 — Бегущие импульсы */}
      <path
        d={d}
        fill="none"
        stroke="#e0f2fe"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray="8 24"
        opacity={0.85}
        className="magic-pulse"
      />
    </g>
  );
}
