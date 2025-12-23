# backend/main.py
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

# 🔹 Загружаем .env локально
if os.getenv("RENDER") != "true":
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / ".env")

# Проверка
print("✅ ADMIN_TOKEN:", os.getenv("ADMIN_TOKEN"))
print("📂 DB_PATH:", os.getenv("DB_PATH"))
print("🔑 GOOGLE_CREDENTIALS:", "SET" if os.getenv("GOOGLE_CREDENTIALS") else "NOT SET")
print("📄 SHEET_ID:", os.getenv("SHEET_ID"))

from backend.views import pages, submit, answers, auth, debug

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pages.router)
app.include_router(submit.router, prefix="/api")
app.include_router(answers.router)
app.include_router(auth.router)
app.include_router(debug.router)

app.mount("/static", StaticFiles(directory="frontend/static"), name="static")

@app.get("/", include_in_schema=False)
async def root():
    return RedirectResponse("/index.html")