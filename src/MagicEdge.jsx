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

  // Подсветка связанных путей при наведении на узел (highlight/dim из data).
  const hi = !!data.highlight;
  const dim = data.dim ? 0.32 : 1;

  // ── Заблокировано: тусклая пунктирная линия без анимации ──
  if (locked) {
    return (
      <path
        d={d}
        fill="none"
        stroke="#3f4759"
        strokeWidth={hi ? 2.5 : 2}
        strokeDasharray="5 10"
        opacity={hi ? 0.7 : (data.dim ? 0.18 : 0.45)}
        style={{ transition: 'opacity 0.2s' }}
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

      {/* Слой 1 — Аура (широкая размытая) — зелёная */}
      <path
        d={d}
        fill="none"
        stroke="#16a34a"
        strokeWidth={hi ? 16 : 12}
        opacity={(hi ? 0.34 : 0.22) * dim}
        filter={`url(#${filterId})`}
        style={{ transition: 'opacity 0.2s' }}
      />

      {/* Слой 2 — Ядро (тонкая яркая) — зелёное */}
      <path
        d={d}
        fill="none"
        stroke="#4ade80"
        strokeWidth={hi ? 4 : 3}
        opacity={(hi ? 1 : 0.92) * dim}
        strokeLinecap="round"
        style={{ transition: 'opacity 0.2s' }}
      />

      {/* Слой 3 — Бегущий свет — золотой */}
      <path
        d={d}
        fill="none"
        stroke="#fde68a"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray="8 24"
        opacity={(hi ? 1 : 0.9) * dim}
        className="magic-pulse"
        style={{ transition: 'opacity 0.2s' }}
      />
    </g>
  );
}
