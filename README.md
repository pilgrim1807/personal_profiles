#  Персональные анкеты для группы 2/5

Бэкенд-приложение на **FastAPI**, которое:
- принимает ответы пользователей по API
- сохраняет их в **SQLite**
- синхронизирует с **Google Sheets**
- предоставляет документацию по API (**Swagger UI**)

Фронтенд (`frontend/`) — статические страницы (HTML, JS, CSS).

---

# Структура проекта

```bash

backend/
    main.py # код приложения FastAPI
    requirements.txt # зависимости Python
    tests.db # локальная база SQLite ( в gitignore)
    credentials.json # Google API ключ ( в gitignore)
    venv/ # виртуальное окружение (в gitignore)
    pycache/ # кеш Python

frontend/
    index.html
    profile.html
    processing.html
    assets/
    css/
    js/
    fonts/
    audio/
    manifest-index.json
    manifest-processing.json
    manifest-profile.json
