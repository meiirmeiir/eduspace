import React from "react";
import ThemeToggle from "./ThemeToggle.jsx";
import { IconStar, IconGem } from "./ui/icons.jsx";
import { getLeague } from "../lib/pointsUtils.js";

/**
 * Общая правая зона хедера: чип ESR + чип Кристаллы + переключатель темы.
 * Вставляется И в AppTopbar, И в .mobile-topbar дашборда — единый вид без
 * слияния компонентов.
 *
 * READ-ONLY: только читает user.weekPoints (ESR) и user.crystals. НИЧЕГО не
 * пишет в Firestore и не фетчит лидерборд (тир — локальный getLeague).
 *
 * Чипы — некликабельные индикаторы (span, без onClick). Показываются только
 * при наличии игрового состояния (ученик): showStats или user.weekPoints != null.
 *
 * Props:
 *   user      — объект пользователя (источник weekPoints/crystals)
 *   dark      — true для тёмного/прозрачного варианта (светлый текст/иконки)
 *   showStats — явно переопределить показ чипов (по умолчанию по weekPoints)
 */
export default function TopbarStats({ user, dark = false, showStats }) {
  const hasGame = showStats ?? (user?.weekPoints != null);
  const esr = user?.weekPoints ?? 0;
  const crystals = user?.crystals ?? 0;
  let tier = null;
  try { tier = getLeague(esr)?.current ?? null; } catch { tier = null; }

  return (
    <div className={`topbar-stats${dark ? " topbar-stats--dark" : ""}`}>
      {hasGame && (
        <>
          <span
            className="topbar-chip"
            title={`ESR${tier?.name ? ` · ${tier.name}` : ""}: ${esr.toLocaleString("ru-RU")}`}
          >
            <IconStar size={15} style={tier?.color ? { color: tier.color } : undefined} />
            <span className="topbar-chip-val">{esr.toLocaleString("ru-RU")}</span>
          </span>
          <span className="topbar-chip" data-tour="crystals-chip" title={`Кристаллы: ${crystals.toLocaleString("ru-RU")}`}>
            <IconGem size={15} />
            <span className="topbar-chip-val">{crystals.toLocaleString("ru-RU")}</span>
          </span>
        </>
      )}
      <ThemeToggle />
    </div>
  );
}
