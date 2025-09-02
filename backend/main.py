from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
from datetime import datetime
import sqlite3
import gspread
import os
import json
from oauth2client.service_account import ServiceAccountCredentials

app = FastAPI()

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
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    saved_answers = []

    for ans in data.answers:
        cursor.execute(
            "INSERT INTO answers (username, question, answer, created_at) VALUES (?, ?, ?, ?)",
            (data.username, ans.question, ans.answer, now)
        )

        sheet.append_row([data.username, ans.question, ans.answer, now])

        saved_answers.append({
            "username": data.username,
            "question": ans.question,
            "answer": ans.answer,
            "created_at": now
        })

    conn.commit()

    return {"status": "ok", "saved": saved_answers}


# --- Получение всех результатов ---
@app.get("/results")
def get_results():
    cursor.execute("SELECT username, question, answer, created_at FROM answers ORDER BY created_at DESC")
    rows = cursor.fetchall()

    results = [
        {"username": row[0], "question": row[1], "answer": row[2], "created_at": row[3]}
        for row in rows
    ]

    return {"results": results}
