// Тест-аккаунты владельца — НЕ должны попадать в недельный рейтинг
// (leaderboard/{week}/entries). Очки в профиле (users.totalPoints/weekPoints)
// копятся как обычно — гард пропускает ТОЛЬКО запись entry лидерборда
// (см. addPoints в pointsUtils.js). Так видео-записи (bsZhaekY) и ручные тесты
// не засоряют топ, который видят реальные ученики.
//
// Список — по аудиту users (scripts/_audit_test_accounts.mjs). НАМЕРЕННО НЕ
// включены:
//   • Затравка-трио (реалистичные казахские имена, населяют топ на запуске):
//       BF16d… Айгерим Сейтова · TVUe… Данияр Жумабеков · pxfx… Аружан Калиева
//   • Похожие на реальных (внешние почты, не +alias) — на всякий случай:
//       1slikjH… Умный Пластилин (akylyermek@) · WJFab… Saniya Tleukhanova ·
//       b6OVR… Rufiya Zhangeldi (nu.edu.kz)
//   • Админ-владелец TQR8q… (Мейрбек Базарбек) — реальный аккаунт.
// Эти 7 при необходимости легко перенести сюда.
export const TEST_UIDS = new Set([
  'bsZhaekYhxODSY9Xanxvh3WutIQ2', // Тест Ученик — видео-пайплайн (главный засоритель)
  '0NaGE5URMqZHEfW39xVjumWx3Lj2', // уіу іуі
  '4Xi39CSqTHhRuh6ITU50Fe8UtOB2', // test helper
  '5GTcCqSVSGUpvloHJMpASaUFd4f1', // Тест Ученик (studenttest@)
  '5NnsoQPttGbw0xecxFoMsVUzNMi2', // Тест Ученик (teststudent@)
  '626g7dJLh8Mp2eNqM8sYY94cT9o2', // Тест Онбординг
  'AkitqP2ohONgdtX5Q7w9fz1PGRA2', // Тест Авторизация (test@example.com)
  'E74lONqwgKOPaxkCRMTeiE2ObC72', // ab cd
  'GoqtcLNE4STrDP1MExMjV68wbao1', // Тест2 Онбординг2
  'J0i4tFX3CqhDbuOfm5sNSR2MDja2', // Тест 1
  'MRCwu2d5wVWvgInZch6hUEOK1aB3', // тест онборднг
  'OnpMU8y4jZObjNVsNb7oOMH64n53', // de ef
  'OvtLexT1VmVkZ2EN3sYgFx3RtrU2', // ab de
  'R7qn9eXx35W1Qlc4NNpDs5S6Kf33', // Тест 2
  'RFPAZTvTEePGZvSmlVUkmXqLHfw1', // Тест Родитель (parenttest@)
  'Rl23HY6FKmTL8GF2YvpdDGNIOoq2', // test helper1
  'SFZek4CZUCVkAUjdmjJDJjnNt593', // Тест Ежедневки (dailytest)
  'VNxKg7TaBQW3Lr2LI2C8mSBQLR12', // Тест 12
  'WH2UJ3ZJfIbZ1S5HFhhGrPDqgZq1', // Тест ВсегоСайта
  'XZkhz8abjyZp4K4R05nohHs8PgA2', // tes tes
  'btNEP1bxPUVSwOPaMA8CbvjP0qd2', // Тест Раздробление
  'e5NPCTdNb5N3m2DsrTjlffJNgjk2', // Тест Retry3
  'ksmg6iyX3AWf3e7CZSfvxUA8iPn2', // Meiir Phone (testphone@)
  'mKr1ilQSEnRvUa8WiKy6utqSiKP2', // Тест Миграция 2
  'nGeFgtTmCLTCYlY8N74SdMVGFgp2', // Т Т (tt@)
  'qaApIDGulEbgVdz3bAfHpcYeh1u1', // тест 123
  't3jdC7aLdpMXiOnvxHD19kLZaBf2', // Тест Миграция 1
  'vTgkorsMDedNU375Yohx64ZXh6s1', // Тест Родитель1 (testparent — родитель bsZhaekY)
  'vmn0Iu4a5QgL91ZPlNHIfGUtJ1O2', // re re (meiirmeiir@)
  'wGMSYG64qvdR15tT7QOIpB1QbfT2', // Test 1 (test_retry@)
  'yDIH9sbAPKRPEl1qlwRd2ajUbo03', // bc de
  'yf1qIkYB5rfonTRImUUMeFR9nAF3', // Тест Авт
]);

export const isTestAccount = (uid) => TEST_UIDS.has(uid);
