import React, { useEffect, useState } from 'react';
import { collection, getDocs, db } from '../firestore-rest.js';
import { useTheme } from '../ThemeContext.jsx';
import { ACHIEVEMENTS } from '../lib/achievements.js';
import AchievementBadge from './AchievementBadge.jsx';

// Сетка всех достижений. Читает users/{uid}/achievements и показывает по каждому
// типу наивысший полученный уровень (или заблокированный). progress (опц.) —
// карта { scholar, streak, wealth, accuracy } для «X/Y» (только свой профиль).
export default function AchievementsGrid({ uid, progress }) {
  const { theme: THEME } = useTheme();
  const [earned, setEarned] = useState({}); // achievementId → наивысший level
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    setLoading(true);
    getDocs(collection(db, `users/${uid}/achievements`))
      .then(snap => {
        if (cancelled) return;
        const map = {};
        snap.docs.forEach(d => {
          const data = d.data() || {};
          const id = data.achievementId;
          const lvl = Number(data.level) || 0;
          if (id && lvl > (map[id] || 0)) map[id] = lvl;
        });
        setEarned(map);
      })
      .catch(() => { if (!cancelled) setEarned({}); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [uid]);

  const normal = ACHIEVEMENTS.filter(a => !a.exclusive);
  const exclusive = ACHIEVEMENTS.filter(a => a.exclusive);
  const earnedCount = ACHIEVEMENTS.filter(a => (earned[a.id] || 0) > 0).length;

  // Одна строка с горизонтальным скроллом (раньше — wrap в несколько строк).
  const renderRow = (list) => (
    <div className="ach-row" style={{ display: 'flex', flexWrap: 'nowrap', gap: 14, overflowX: 'auto', paddingBottom: 8 }}>
      {list.map(a => (
        <div key={a.id} style={{ flexShrink: 0 }}>
          <AchievementBadge ach={a} earnedLevel={earned[a.id] || 0} progress={progress?.[a.id]} />
        </div>
      ))}
    </div>
  );

  return (
    <div className="dashboard-section" style={{ padding: '18px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="section-title" style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 15, fontWeight: 800, color: THEME.primary, margin: 0 }}>
          🏆 Достижения
        </div>
        <div style={{
          fontSize: 13, fontWeight: 800, color: '#fbbf24',
          background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.35)',
          borderRadius: 99, padding: '4px 14px',
        }}>
          ⭐ Получено {earnedCount} из {ACHIEVEMENTS.length}
        </div>
      </div>

      {loading ? (
        <div style={{ color: THEME.textLight, fontSize: 13 }}>Загрузка…</div>
      ) : (
        <>
          {renderRow(normal)}
          {exclusive.length > 0 && (
            <>
              <div style={{ height: 1, background: THEME.border, margin: '18px 0 14px' }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', marginBottom: 12, letterSpacing: 0.5 }}>
                ЭКСКЛЮЗИВНЫЕ
              </div>
              {renderRow(exclusive)}
            </>
          )}
        </>
      )}
    </div>
  );
}
