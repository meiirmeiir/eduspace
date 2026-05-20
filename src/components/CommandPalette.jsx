import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getContent } from "../lib/contentCache.js";

const QUICK_ACTIONS = [
  { id: "qa-home",   group: "Навигация", icon: "🏠", label: "Главная",            action: { type: "dashboard" } },
  { id: "qa-prof",   group: "Навигация", icon: "👤", label: "Личный кабинет",     action: { type: "profile" } },
  { id: "qa-plan",   group: "Навигация", icon: "🗺️", label: "Индивидуальный план", action: { type: "plan" } },
  { id: "qa-theory", group: "Навигация", icon: "📖", label: "Теория",             action: { type: "theory" } },
  { id: "qa-daily",  group: "Навигация", icon: "📝", label: "Ежедневные задачи",  action: { type: "daily" } },
  { id: "qa-diag",   group: "Навигация", icon: "🎯", label: "Умная Диагностика",  action: { type: "smart-diag" } },
];

/**
 * ⌘K / Ctrl+K command palette.
 * Indexes navigation, skills (from skillHierarchies) and theory
 * entries (from skillTheory) and surfaces them via fuzzy substring
 * search. Selecting a result calls onNavigate({ type, ... }).
 */
export default function CommandPalette({ isOpen, onClose, onNavigate }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]); // [{id, group, icon, label, sublabel, action}]
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Load skill + theory data lazily on first open
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const [hierarchies, theories] = await Promise.all([
          getContent("skillHierarchies").catch(() => []),
          getContent("skillTheory").catch(() => []),
        ]);
        if (cancelled) return;

        const skillItems = [];
        const seenSkills = new Set();
        for (const h of hierarchies) {
          for (const cluster of h.clusters || []) {
            for (const ps of cluster.pivot_skills || []) {
              if (!ps.skill_id || seenSkills.has(ps.skill_id)) continue;
              seenSkills.add(ps.skill_id);
              skillItems.push({
                id: `skill-${ps.skill_id}`,
                group: "Навыки",
                icon: "🎯",
                label: ps.skill_name || ps.skill_id,
                sublabel: [h.section, ps.grade && `${ps.grade} класс`].filter(Boolean).join(" · "),
                action: { type: "theory-skill", skillId: ps.skill_id },
              });
            }
          }
        }

        const theoryItems = (theories || [])
          .filter(t => t.theory?.concept || t.id)
          .slice(0, 200)
          .map(t => ({
            id: `theory-${t.id}`,
            group: "Теория",
            icon: "📖",
            label: t.id,
            sublabel: t.theory?.concept ? String(t.theory.concept).slice(0, 80) : "",
            action: { type: "theory-skill", skillId: t.id },
          }));

        setItems([...QUICK_ACTIONS, ...skillItems, ...theoryItems]);
      } catch {
        setItems(QUICK_ACTIONS);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  // Focus input when opened, reset state on close
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 30);
    } else {
      setQuery("");
      setActiveIdx(0);
    }
  }, [isOpen]);

  // Filter items by query (case-insensitive, multi-token substring)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 30);
    const tokens = q.split(/\s+/);
    return items.filter(it => {
      const hay = `${it.label} ${it.sublabel || ""}`.toLowerCase();
      return tokens.every(t => hay.includes(t));
    }).slice(0, 50);
  }, [items, query]);

  // Group filtered items for display
  const grouped = useMemo(() => {
    const groups = {};
    for (const it of filtered) {
      if (!groups[it.group]) groups[it.group] = [];
      groups[it.group].push(it);
    }
    return groups;
  }, [filtered]);

  // Flat list for keyboard navigation
  const flat = filtered;

  // Reset active idx when filter changes
  useEffect(() => { setActiveIdx(0); }, [query]);

  // Keep active item in view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${activeIdx}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const handleSelect = useCallback((idx) => {
    const item = flat[idx];
    if (!item) return;
    onClose();
    onNavigate(item.action);
  }, [flat, onClose, onNavigate]);

  const handleKey = useCallback((e) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(flat.length - 1, i + 1)); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(0, i - 1)); return; }
    if (e.key === "Enter") { e.preventDefault(); handleSelect(activeIdx); return; }
  }, [activeIdx, flat.length, handleSelect, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="cmdk-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Поиск по сайту"
    >
      <div className="cmdk-panel" onKeyDown={handleKey}>
        <div className="cmdk-input-row">
          <span className="cmdk-icon">🔍</span>
          <input
            ref={inputRef}
            className="cmdk-input"
            placeholder="Поиск: навык, тема, раздел…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="cmdk-kbd">esc</kbd>
        </div>
        <div className="cmdk-results" ref={listRef}>
          {flat.length === 0 ? (
            <div className="cmdk-empty">Ничего не найдено</div>
          ) : (
            Object.entries(grouped).map(([groupName, groupItems]) => (
              <div key={groupName} className="cmdk-group">
                <div className="cmdk-group-title">{groupName}</div>
                {groupItems.map((it) => {
                  const idx = flat.indexOf(it);
                  return (
                    <button
                      key={it.id}
                      data-idx={idx}
                      className={`cmdk-item ${idx === activeIdx ? "active" : ""}`}
                      onClick={() => handleSelect(idx)}
                      onMouseEnter={() => setActiveIdx(idx)}
                    >
                      <span className="cmdk-item-icon">{it.icon}</span>
                      <span className="cmdk-item-text">
                        <span className="cmdk-item-label">{it.label}</span>
                        {it.sublabel && <span className="cmdk-item-sub">{it.sublabel}</span>}
                      </span>
                      <span className="cmdk-item-hint">↵</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="cmdk-footer">
          <kbd className="cmdk-kbd">↑</kbd>
          <kbd className="cmdk-kbd">↓</kbd>
          <span>навигация</span>
          <kbd className="cmdk-kbd">↵</kbd>
          <span>выбрать</span>
          <span style={{ marginLeft: "auto" }}>
            <kbd className="cmdk-kbd">⌘K</kbd> открыть/закрыть
          </span>
        </div>
      </div>
    </div>
  );
}
