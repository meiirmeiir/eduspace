import { useState, useEffect } from "react";

// Глобальная floating-кнопка «наверх». Монтируется в main.jsx сиблингом <App/> →
// работает на всех экранах одним компонентом, App.jsx не трогаем.
// Скролл = window (контент скроллит body). Без useTheme — стиль через CSS-класс
// .scroll-to-top + [data-theme="dark"]-оверрайд в index.css. Появляется при scrollY > 600.
export default function ScrollToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {        // rAF-троттл: не setState на каждый scroll-event
        setShow(window.scrollY > 600);
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();                            // начальное состояние (если страница уже проскроллена)
    return () => window.removeEventListener("scroll", onScroll);   // cleanup на unmount
  }, []);

  if (!show) return null;
  return (
    <button
      className="scroll-to-top"
      aria-label="Наверх"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >↑</button>
  );
}
