# Состояние после защиты серверных эндпоинтов

Дата: 2026-05-05
Платформа: Vercel Serverless Functions

---

## Что защищено

### GET /api/lessons
- Firebase ID token (Bearer) обязателен → 401 без токена
- admin/teacher → все уроки
- ученик → только `WHERE studentId == uid` (серверная фильтрация)
- CORS: `ALLOWED_ORIGIN` из env, fail-closed (500 если не задан)

### POST /api/lessons
- Firebase ID token обязателен → 401
- Проверка роли через Firestore `users/{uid}.role` → 403 если не admin/teacher
- Создание Zoom-митинга недоступно для учеников

### POST /api/lessons-batch
- Те же гарантии что и POST /api/lessons
- Защита от DoS на Zoom API квоту (только admin/teacher могут создавать пачку уроков)

### POST /api/webhooks/zoom
- HMAC SHA-256 подпись (`x-zm-signature`) — проверяется
- Timing-safe сравнение (`crypto.timingSafeEqual`) — защита от timing-oracle атак
- Проверка возраста `x-zm-request-timestamp` ≤ 300 сек — защита от replay-атак
- `endpoint.url_validation` handshake работает (до проверки подписи, как требует Zoom)

---

## Env-переменные, необходимые на Vercel (production)

| Переменная | Назначение |
|---|---|
| `FIREBASE_ADMIN_SERVICE_ACCOUNT` | JSON сервисного аккаунта Firebase (Admin SDK) |
| `ALLOWED_ORIGIN` | Разрешённый CORS origin (`https://eduspace-murex.vercel.app`) |
| `ZOOM_WEBHOOK_SECRET` | Secret для верификации подписи Zoom webhook |
| `ZOOM_ACCOUNT_ID` | Zoom Server-to-Server OAuth |
| `ZOOM_CLIENT_ID` | Zoom Server-to-Server OAuth |
| `ZOOM_CLIENT_SECRET` | Zoom Server-to-Server OAuth |

---

## Что НЕ сделано (намеренно, отдельные задачи)

- **Firebase App Check** — дополнительная защита от не-браузерных клиентов. Отложено до стабилизации основного функционала (TODO в коде).
- **Custom claims для роли** — сейчас роль читается из Firestore на каждый запрос (доп. round-trip). Можно вынести в Firebase custom claim для производительности. Не критично при текущей нагрузке.
- **Rate limiting** — нет защиты от flood-запросов к `/api/lessons`. Актуально при росте трафика (рассмотреть Vercel Edge Middleware или upstash/ratelimit).
- **`ALLOWED_ORIGIN` список** — сейчас одно значение. Если появится staging-домен, нужно будет поддержать массив origins.
- **Логирование ошибок** — 401/403 пишутся только в `console.error`. При росте можно подключить Sentry или Vercel Log Drains для алертинга.

---

## Аудит-файлы

- `audit/api-security-audit.md` — исходный inventory (фаза 0)
- `audit/api-security-post.md` — этот файл (финальное состояние)
