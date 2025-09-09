# Персональные анкеты для группы 2/5

Бэкенд-приложение на FastAPI, которое:

Принимает ответы пользователей по API

Сохраняет данные в SQLite и дает возможность скачать

Синхронизирует данные с Google Sheets

Предоставляет документацию по API через Swagger UI

Фронтенд (frontend/) — статические страницы на HTML, CSS и JS.

# Структура проекта

```bash

backend/
    main.py                  # Точка входа FastAPI
    requirements.txt         # Зависимости
    .env                     # Переменные окружения (не коммитить)
    credentials.json         # Ключ для Google API (не коммитить)
    app.log                  # Лог работы
    views/                   # Роуты FastAPI
        pages.py             # HTML-страницы
        submit.py            # Приём ответов
        answers.py           # Просмотр/экспорт ответов
        auth.py              # Проверка токена
        debug.py             # Служебные эндпоинты
    utils/
    sheets_utils.py      # Работа с Google Sheets
    db/
       b_utils.py           # Работа с SQLite
    version_assets.py        # Статическая версия ресурсов
    tests.db                 # SQLite база (локально, в .gitignore)
    venv/                    # Виртуальное окружение (в .gitignore)

frontend/
    index.html               # Выбор профиля
    profile.html             # Просмотр профиля
    processing.html          # Результаты
    /static/assets/          # Изображения и иконки
    css/                     # Стили
    js/                      # Скрипты
    fonts/                   # Шрифты
    audio/                   # Звуки
    manifest-index.json      # PWA-манифесты
    manifest-processing.json
    manifest-profile.json
