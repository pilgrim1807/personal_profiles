from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from datetime import datetime
import sqlite3
import gspread
import os
import json
from oauth2client.service_account import ServiceAccountCredentials

app = FastAPI(title="API Анкеты для 2/5 ", version="1.0")


# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # можно ограничить ["https://personal-applications-2-5.onrender.com"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- SQLite ---
conn = sqlite3.connect("tests.db", check_same_thread=False)
cursor = conn.cursor()
cursor.execute("""
CREATE TABLE IF NOT EXISTS answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at TEXT NOT NULL
)
""")
conn.commit()

# --- Google Sheets ---
SCOPE = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
sheet = None
try:
    creds_json = os.getenv("GOOGLE_CREDENTIALS")
    if creds_json:
        CREDS = ServiceAccountCredentials.from_json_keyfile_dict(json.loads(creds_json), SCOPE)
    else:
        CREDS = ServiceAccountCredentials.from_json_keyfile_name("credentials.json", SCOPE)

    gc = gspread.authorize(CREDS)
    SHEET_ID = "1BvPPrVUP2wRqT2JszTnJMgbR0ZAU1aljfX-cmI0wqVA"

    try:
        sheet = gc.open_by_key(SHEET_ID).worksheet("Ответы")
    except gspread.exceptions.WorksheetNotFound:
        sh = gc.open_by_key(SHEET_ID)
        sheet = sh.add_worksheet(title="Ответы", rows="100", cols="4")
        sheet.append_row(["Имя", "Вопрос", "Ответ", "Дата"])

    print("✅ Подключение к Google Sheets успешно")

except Exception as e:
    print(f"⚠️ Ошибка подключения к Google Sheets: {e}")


# --- Models ---
class Answer(BaseModel):
    question: str
    answer: str


class AnswerBatch(BaseModel):
    username: str
    answers: List[Answer]


# --- API ---
@app.post("/submit")
def submit_answers(data: AnswerBatch):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    saved_answers = []
    try:
        for ans in data.answers:
            cursor.execute(
                "INSERT INTO answers (username, question, answer, created_at) VALUES (?, ?, ?, ?)",
                (data.username, ans.question, ans.answer, now)
            )
            if sheet:
                try:
                    sheet.append_row([data.username, ans.question, ans.answer, now])
                except Exception as e:
                    print(f"⚠️ Ошибка записи в Google Sheets: {e}")
            saved_answers.append({
                "username": data.username,
                "question": ans.question,
                "answer": ans.answer,
                "created_at": now
            })
        conn.commit()
        return {"status": "ok", "saved": saved_answers}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка сохранения: {e}")


@app.get("/results")
def get_results():
    cursor.execute("SELECT username, question, answer, created_at FROM answers ORDER BY created_at DESC")
    rows = cursor.fetchall()
    return {
        "results": [
            {"username": row[0], "question": row[1], "answer": row[2], "created_at": row[3]}
            for row in rows
        ]
    }


@app.get("/healthz")
def health_check():
    return {"status": "ok"}


# --- FRONTEND ---
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "../frontend")

# Кеш статики
def cached_static(directory: str, prefix: str):
    app.mount(prefix, StaticFiles(directory=directory, html=False), name=prefix.strip("/"))

for folder in ["assets", "css", "js", "fonts", "audio"]:
    cached_static(os.path.join(FRONTEND_DIR, folder), f"/{folder}")

# HTML страницы
@app.get("/", include_in_schema=False)
async def serve_index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

@app.get("/index.html", include_in_schema=False)
async def serve_index_html():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

@app.get("/profile.html", include_in_schema=False)
async def serve_profile():
    return FileResponse(os.path.join(FRONTEND_DIR, "profile.html"))

@app.get("/processing.html", include_in_schema=False)
async def serve_processing():
    return FileResponse(os.path.join(FRONTEND_DIR, "processing.html"))

# --- SPA fallback (любые неизвестные ссылки -> index.html) ---
@app.get("/{full_path:path}", include_in_schema=False)
async def catch_all(full_path: str):
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))