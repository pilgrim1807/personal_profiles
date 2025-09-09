import os
from dotenv import load_dotenv

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

# Загрузка .env переменных
load_dotenv()

# Проверка (удали позже)
print("✅ ADMIN_TOKEN:", os.getenv("ADMIN_TOKEN"))

from backend.views import pages, submit, answers, auth, debug

app = FastAPI()

# Разрешить CORS (если нужен)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Маршруты
app.include_router(pages.router)
app.include_router(submit.router)
app.include_router(answers.router)
app.include_router(auth.router)
app.include_router(debug.router)

# Статические файлы (если нужно)
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")

# Корневой редирект
@app.get("/", include_in_schema=False)
async def root():
    return RedirectResponse("/index.html")
