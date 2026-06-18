// ESLint flat-config (ESLint 9). Цель первого захода — ловить КЛАСС бага
// «theory-краш»: необъявленная/непрокинутая переменная (`user is not defined`)
// → `no-undef` (error). Плюс react-hooks (другой класс: условные хуки).
// Косметика (`no-unused-vars`) — warn, чтобы не топить реальные ошибки.
//
// Скоуп — только src/ (React-приложение, где жил theory-краш). functions/ (CJS,
// Node-окружение), scripts/, tests/ — отдельные среды, не в этом проходе.
import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/**', 'node_modules/**', 'functions/**', 'scripts/**',
      'tests/**', '.playwright-mcp/**', 'audit/**', 'src/dev/**',
      '*.config.js', 'vite.config.*',
    ],
  },
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      // Браузерные глобалы (window/document/fetch/localStorage/requestAnimationFrame/
      // IntersectionObserver/…) — иначе no-undef ложно ругался бы на них.
      globals: { ...globals.browser, ...globals.es2021 },
    },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: '18.2' } },
    rules: {
      ...js.configs.recommended.rules,
      // JSX-использование помечает импорты/React как used → нет ложных unused.
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      // КЛЮЧЕВОЕ: класс theory-краша (свободная переменная) = ошибка.
      'no-undef': 'error',
      // Косметика — warn (не топит критичные ошибки). `_`-префикс игнорим.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Пустой catch — намеренный «глотаем ошибку» паттерн (по всему коду) → не error.
      // Пустые if/for/while остаются ошибкой (подозрительны).
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Контрол-символы в regex — НАМЕРЕННО (чистка порчи ctrl-символов в данных).
      'no-control-regex': 'off',
      // Лишние escape в regex/строках — косметика.
      'no-useless-escape': 'warn',
      // Хуки: нарушение порядка = ошибка; deps — warn.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
