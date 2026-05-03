# EduSpace — Образовательная платформа

Платформа для подготовки учеников к ЕНТ по математике и физике.

## Configuration

1. Скопировать `.env.example` в `.env` и заполнить значениями из Firebase Console и @BotFather.
2. Service account JSON хранить **вне** папки проекта (например, `~/.config/aapa/sa.json`) и указывать путь через переменную `GOOGLE_APPLICATION_CREDENTIALS`.
3. Если случайно закоммитили секрет — немедленно ротировать в Google Cloud Console / @BotFather.
