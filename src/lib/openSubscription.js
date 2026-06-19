// Единый канал оплаты: открывает WhatsApp (+7 747 195 8968) с заготовленным
// сообщением. Переиспользуется везде, где есть призыв оплатить (дашборд-баннеры,
// лендинг PriceSection, экран результата демо) — чтобы не дублировать wa.me-логику.
//
// user передаётся ТОЛЬКО когда залогинен (дашборд) → менеджер сразу видит, кто
// пишет (имя+класс). На лендинге/демо (гость) user нет → общее сообщение.
// wa.me хочет цифры с кодом страны без «+». Guard на пустой профиль: строки
// «Ученик»/«Класс» добавляются лишь при наличии → никаких «undefined».
const WHATSAPP_NUMBER = '77471958968';

export function openSubscriptionWhatsApp(user) {
  const lines = ['Здравствуйте! Хочу оформить подписку на AAPA.'];
  const fio = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  if (fio) lines.push('', `Ученик: ${fio}`);
  if (user?.grade) lines.push(`Класс: ${user.grade}`);
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
