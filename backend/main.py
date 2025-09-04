# main.py
import os
import json
import sqlite3
import certifi
import gspread
import requests
import urllib3
import logging
from datetime import datetime
from dotenv import load_dotenv
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Form, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.responses import Response

from google.oauth2.service_account import Credentials
from google.auth.transport.requests import Request as GoogleRequest

# --- Загрузка переменных окружения ---
load_dotenv()

# --- Логирование ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)  # важно: __name__

# --- SSL и CA ---
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
os.environ["SSL_CERT_FILE"] = certifi.where()
os.environ["REQUESTS_CA_BUNDLE"] = certifi.where()

# --- FastAPI ---
app = FastAPI(title="API Анкеты для 2/5", version="1.0")

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://personal-applications-2-5.onrender.com",
        "http://localhost",
        "http://127.0.0.1",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*"  # при необходимости сузить
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- SQLite ---
conn = sqlite3.connect("tests.db", check_same_thread=False)
cursor = conn.cursor()
cursor.execute(
    """
    CREATE TABLE IF NOT EXISTS answers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """
)
conn.commit()

# --- Google Sheets ---
SCOPE = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]
SHEET_ID = os.getenv("SHEET_ID", "1BvPPrVUP2wRqT2JszTnJMgbR0ZAU1aljfX-cmI0wqVA")
SHEET_TAB = os.getenv("SHEET_TAB", "Ответы")

credentials: Optional[Credentials] = None
gc: Optional[gspread.Client] = None
sheet: Optional[gspread.Worksheet] = None

def _build_gspread_session() -> requests.Session:
    # почему: гарантируем валидный корневой серт
    s = requests.Session()
    s.verify = certifi.where()
    return s

def _authorize_gspread() -> Optional[gspread.Client]:
    global credentials, gc
    try:
        creds_json = os.getenv("GOOGLE_CREDENTIALS")
        if creds_json:
            credentials = Credentials.from_service_account_info(json.loads(creds_json), scopes=SCOPE)
        else:
            credentials = Credentials.from_service_account_file("credentials.json", scopes=SCOPE)

        gc = gspread.authorize(credentials)  # явная авторизация
        gc.session = _build_gspread_session()
        return gc
    except Exception as e:
        logger.warning(f"⚠️ Ошибка авторизации Google Sheets: {e}")
        return None

def get_sheet() -> Optional[gspread.Worksheet]:
    global credentials, gc, sheet
    try:
        if credentials and hasattr(credentials, "expired") and credentials.expired:
            credentials.refresh(GoogleRequest())
            logger.info("🔑 Google token обновлён")

        if not gc:
            gc = _authorize_gspread()
            if not gc:
                return None

        if not sheet:
            sh = gc.open_by_key(SHEET_ID)
            sheet = sh.worksheet(SHEET_TAB)

        return sheet
    except Exception as e:
        logger.error(f"❌ Не удалось получить Google Sheets: {e}")
        return None

@app.post("/submit")
async def submit_answers(
    username: str = Form(...),
    answers: str = Form(...),
    photo: UploadFile = File(None),
    photos: List[UploadFile] = File(default=[])
):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    try:
        parsed_answers = json.loads(answers)
        if not isinstance(parsed_answers, list):
            raise ValueError("answers должен быть массивом объектов {question, answer}")

        saved_answers = []

        # Сохраняем в БД
        for item in parsed_answers:
            cursor.execute(
                "INSERT INTO answers (username, question, answer, created_at) VALUES (?, ?, ?, ?)",
                (username, str(item.get("question", "")), str(item.get("answer", "")), now),
            )
            saved_answers.append(
                {
                    "username": username,
                    "question": str(item.get("question", "")),
                    "answer": str(item.get("answer", "")),
                    "created_at": now,
                }
            )

        conn.commit()

        # Пишем пачкой в Google Sheets (быстрее, чем по одной строке)
        ws = get_sheet()
        if ws:
            try:
                rows = [[username, i.get("question", ""), i.get("answer", ""), now] for i in parsed_answers]
                if rows:
                    ws.append_rows(rows, value_input_option="USER_ENTERED")
            except Exception as e:
                logger.warning(f"⚠️ Ошибка записи в Google Sheets: {e}")

        return {"status": "ok", "saved": saved_answers}

    except Exception as e:
        logger.exception("Ошибка при сохранении")
        raise HTTPException(status_code=500, detail=f"Ошибка при сохранении: {e}")

# --- Health check ---
@app.get("/healthz", include_in_schema=False)
def healthz():
    return {"status": "ok"}

# --- Фронтенд статика ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "../frontend")
FRONTEND_DIR = os.path.normpath(FRONTEND_DIR)

INDEX_FILE = os.path.join(FRONTEND_DIR, "index.html")

class StaticFilesCache(StaticFiles):
    def file_response(self, *args, **kwargs) -> Response:
        resp = super().file_response(*args, **kwargs)
        resp.headers.setdefault("Cache-Control", "public, max-age=86400")
        return resp

static_folders = ["assets", "css", "js", "fonts", "audio"]
for folder in static_folders:
    folder_path = os.path.join(FRONTEND_DIR, folder)
    if os.path.exists(folder_path):
        mount_cls = StaticFilesCache if folder == "assets" else StaticFiles
        app.mount(f"/{folder}", mount_cls(directory=folder_path), name=folder)

favicon_path = os.path.join(FRONTEND_DIR, "assets", "favicons", "favicon.ico")
if os.path.exists(favicon_path):
    @app.get("/favicon.ico", include_in_schema=False)
    async def favicon():
        return FileResponse(favicon_path)

def _safe_file_response(path: str) -> FileResponse:
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(path, media_type="text/html")

@app.api_route("/", methods=["GET", "HEAD"], include_in_schema=False)
async def serve_index():
    return _safe_file_response(INDEX_FILE)

@app.api_route("/profile.html", methods=["GET", "HEAD"], include_in_schema=False)
async def serve_profile():
    return _safe_file_response(os.path.join(FRONTEND_DIR, "profile.html"))

@app.api_route("/processing.html", methods=["GET", "HEAD"], include_in_schema=False)
async def serve_processing():
    return _safe_file_response(os.path.join(FRONTEND_DIR, "processing.html"))

# Опциональный catch-all для SPA маршрутов
@app.api_route("/{full_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
async def catch_all(full_path: str):
    path = os.path.join(FRONTEND_DIR, full_path)
    if os.path.isfile(path):
        return FileResponse(path)
    # по умолчанию — index.html
    return _safe_file_response(INDEX_FILE)


