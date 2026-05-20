// @ts-check
import { test, expect } from '@playwright/test';

test.describe('dashboard smoke', () => {
  test('login → dashboard renders 4 stat cards', async ({ page }) => {
    await page.goto('/#dashboard');

    // Если оказались в разделе "profile" внутри Dashboard — переключаемся на "Главная".
    await page.locator('[data-nav-id="home"]').first().click({ trial: false }).catch(() => {});

    // Закрываем NPC-тур, если открылся.
    const skipBtn = page.getByRole('button', { name: /Пропустить/ });
    if (await skipBtn.isVisible().catch(() => false)) await skipBtn.click();

    const cards = page.locator('.stats-row .stat-card');
    await expect(cards).toHaveCount(4);

    // Проверяем содержимое — порядок: 📅 / 📚 / ✅ / 🔥
    await expect(cards.nth(0)).toContainText(/занят/);
    await expect(cards.nth(1)).toContainText(/ДЗ|задани/);
    await expect(cards.nth(2)).toContainText(/навык/);
    // 🔥 либо «N дней подряд», либо «Начни серию»
    await expect(cards.nth(3)).toContainText(/(подряд|Начни серию)/);
  });

  test('sidebar contains "Частые вопросы" item', async ({ page }) => {
    await page.goto('/#dashboard');

    const faqItem = page.locator('.dashboard-sidebar [data-nav-id="faq"]');
    await expect(faqItem).toBeVisible();
    await expect(faqItem).toContainText(/Частые вопросы/);
  });
});
