import os
import json
import sqlite3
import certifi
import gspread
import requests
import urllib3
import logging
from dotenv import load_dotenv
from datetime import datetime
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from google.oauth2.service_account import Credentials
from google.auth.transport.requests import Request
from pydantic import BaseModel
from typing import List

# --- Загрузка переменных окружения ---
load_dotenv()

# --- Логирование ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- SSL и CA ---
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
os.environ["SSL_CERT_FILE"] = certifi.where()
os.environ["REQUESTS_CA_BUNDLE"] = certifi.where()

# --- FastAPI ---
app = FastAPI(title="API Анкеты для 2/5", version="1.0")

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://personal-applications-2-5.onrender.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API Token для авторизации ---
API_TOKEN = os.getenv("API_TOKEN")

def check_token(authorization: str = Header(...)):
    expected = f"Bearer {API_TOKEN}"
    if authorization != expected:
        raise HTTPException(status_code=403, detail="Forbidden")

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
SCOPE = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
SHEET_ID = "1BvPPrVUP2wRqT2JszTnJMgbR0ZAU1aljfX-cmI0wqVA"

credentials = None
gc = None
sheet = None

try:
    creds_json = os.getenv("GOOGLE_CREDENTIALS")
    if creds_json:
        credentials = Credentials.from_service_account_info(json.loads(creds_json), scopes=SCOPE)
    else:
        credentials = Credentials.from_service_account_file("credentials.json", scopes=SCOPE)

    gc = gspread.Client(auth=credentials)
    session = requests.Session()
    session.verify = certifi.where()
    gc.session = session

    sheet = gc.open_by_key(SHEET_ID).worksheet("Ответы")
    logger.info("✅ Подключение к Google Sheets успешно")

except Exception as e:
    logger.warning(f"⚠️ Ошибка подключения к Google Sheets: {e}")
    sheet = None

def get_sheet():
    global credentials, gc, sheet

    try:
        if credentials and credentials.expired:
            credentials.refresh(Request())
            logger.info("🔑 Google token обновлён")

        if not gc:
            gc = gspread.Client(auth=credentials)
            session = requests.Session()
            session.verify = certifi.where()
            gc.session = session

        if not sheet:
            sheet = gc.open_by_key(SHEET_ID).worksheet("Ответы")

        return sheet
    except Exception as e:
        logger.error(f"❌ Не удалось получить Google Sheets: {e}")
        return None

# --- Модели ---
class Answer(BaseModel):
    question: str
    answer: str

class AnswerBatch(BaseModel):
    username: str
    answers: List[Answer]

# --- API ---
@app.post("/submit")
def submit_answers(data: AnswerBatch, _: str = Depends(check_token)):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    saved_answers = []

    try:
        for ans in data.answers:
            cursor.execute(
                "INSERT INTO answers (username, question, answer, created_at) VALUES (?, ?, ?, ?)",
                (data.username, ans.question, ans.answer, now)
            )

            current_sheet = get_sheet()
            if current_sheet:
                try:
                    current_sheet.append_row([data.username, ans.question, ans.answer, now])
                except Exception as e:
                    logger.warning(f"⚠️ Ошибка записи в Google Sheets: {e}")

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
def get_results(_: str = Depends(check_token)):
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

# --- Фронтенд ---
from pathlib import Path
from fastapi.responses import FileResponse

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../frontend"))
INDEX_FILE = os.path.join(FRONTEND_DIR, "index.html")

def cached_static(directory: str, prefix: str):
    if os.path.exists(directory):
        app.mount(prefix, StaticFiles(directory=directory, html=False), name=prefix.strip("/"))

for folder in ["assets", "css", "js", "fonts", "audio"]:
    cached_static(os.path.join(FRONTEND_DIR, folder), f"/{folder}")

@app.api_route("/", methods=["GET", "HEAD"], include_in_schema=False)
async def serve_index():
    return FileResponse(INDEX_FILE, media_type="text/html")

@app.api_route("/profile.html", methods=["GET", "HEAD"], include_in_schema=False)
async def serve_profile():
    return FileResponse(os.path.join(FRONTEND_DIR, "profile.html"), media_type="text/html")

@app.api_route("/processing.html", methods=["GET", "HEAD"], include_in_schema=False)
async def serve_processing():
    return FileResponse(os.path.join(FRONTEND_DIR, "processing.html"), media_type="text/html")

@app.api_route("/{full_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
async def catch_all(full_path: str):
    safe_path = os.path.normpath(os.path.join(FRONTEND_DIR, full_path))
    frontend_abs = os.path.abspath(FRONTEND_DIR)

    if not safe_path.startswith(frontend_abs):
        return FileResponse(INDEX_FILE, media_type="text/html")

    if os.path.exists(safe_path) and os.path.isfile(safe_path):
        return FileResponse(safe_path)

    return File