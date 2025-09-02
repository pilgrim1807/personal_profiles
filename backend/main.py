from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
from datetime import datetime
import sqlite3
import gspread
import os
import json
from oauth2client.service_account import ServiceAccountCredentials

app = FastAPI(title="FastAPI + Google Sheets", version="1.0")

# --- База данных SQLite ---
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

    print("✅ Успешное подключение к Google Sheets")

except Exception as e:
    print(f"⚠️ Ошибка подключения к Google Sheets: {e}")


# --- Модели данных ---
class Answer(BaseModel):
    question: str
    answer: str


class AnswerBatch(BaseModel):
    username: str
    answers: List[Answer]


# --- API ---
@app.post("/submit")
def submit_answers(data: AnswerBatch):
    """
    Сохраняет ответы в SQLite и Google Sheets (если доступно).
    """
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    saved_answers = []

    try:
        for ans in data.answers:
            # Запись в SQLite
            cursor.execute(
                "INSERT INTO answers (username, question, answer, created_at) VALUES (?, ?, ?, ?)",
                (data.username, ans.question, ans.answer, now)
            )

            # Запись в Google Sheets (если подключен)
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
    """
    Возвращает все сохранённые результаты из SQLite.
    """
    cursor.execute("SELECT username, question, answer, created_at FROM answers ORDER BY created_at DESC")
    rows = cursor.fetchall()

    results = [
        {"username": row[0], "question": row[1], "answer": row[2], "created_at": row[3]}
        for row in rows
    ]

    return {"results": results}


@app.get("/healthz")
def health_check():
    """
    Health-check endpoint для Render.
    """
    return {"status": "ok"}
