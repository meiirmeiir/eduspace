// @ts-check
import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const AUTH_FILE = 'playwright/.auth/session.json';

/**
 * Дашборд считается «видим», когда есть сайдбар с пунктами навигации.
 * Этот хелпер используется и для проверки текущей сессии, и для подтверждения
 * успешного входа после логина.
 */
async function dashboardVisible(page) {
  return await page.locator('[data-nav-id="home"], [data-nav-id="dashboard"]')
    .first()
    .isVisible({ timeout: 5_000 })
    .catch(() => false);
}

setup('authenticate', async ({ browser }) => {
  // ── 1. Пробуем использовать существующую сессию ────────────────────────────
  if (fs.existsSync(AUTH_FILE)) {
    const ctx = await browser.newContext({ storageState: AUTH_FILE });
    const page = await ctx.newPage();
    await page.goto('/#dashboard');
    const ok = await dashboardVisible(page);
    await ctx.close();
    if (ok) {
      console.log('[auth.setup] reused existing session');
      return;
    }
    // Сессия истекла / битая — выкидываем и логинимся заново
    console.log('[auth.setup] session.json expired, deleting and re-logging in');
    try { fs.unlinkSync(AUTH_FILE); } catch {}
  }

  // ── 2. Свежий логин ────────────────────────────────────────────────────────
  const email = process.env.PLAYWRIGHT_EMAIL;
  const password = process.env.PLAYWRIGHT_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Set PLAYWRIGHT_EMAIL and PLAYWRIGHT_PASSWORD in .env.local before running smoke.'
    );
  }

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/');

  // На лендинге справа форма EmailAuthScreen — заполняем и логинимся.
  await page.getByPlaceholder('example@mail.com').fill(email);
  await page.getByPlaceholder('Введите пароль...').fill(password);
  await page.getByRole('button', { name: /Войти\s*→/ }).click();

  // Дашборд (или экран онбординга для нового аккаунта) должен открыться.
  await expect(page).toHaveURL(/#(dashboard|onboarding)/, { timeout: 20_000 });

  // Сохраняем сессию.
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await ctx.storageState({ path: AUTH_FILE });
  await ctx.close();
  console.log('[auth.setup] new session saved to', AUTH_FILE);
});
