import os
import json
import sqlite3
import logging
from datetime import datetime
from typing import List, Optional

import certifi
import gspread
import requests
import urllib3
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Form, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.service_account import Credentials
from starlette.responses import Response

# Bootstrap

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
os.environ["SSL_CERT_FILE"] = certifi.where()
os.environ["REQUESTS_CA_BUNDLE"] = certifi.where()

app = FastAPI(title="API Анкеты 2/5", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://personal-applications-2-5.onrender.com",
        "http://localhost",
        "http://127.0.0.1",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# SQLite

DB_PATH = os.getenv("DB_PATH", "tests.db")

def _ensure_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
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
    conn.close()

_ensure_db()

# Google Sheets

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
    s = requests.Session()
    s.verify = certifi.where()
    return s

def _authorize_gspread() -> Optional[gspread.Client]:
    """Создаёт gspread клиента с авторизацией сервис-аккаунта."""
    global credentials, gc
    try:
        creds_json = os.getenv("GOOGLE_CREDENTIALS")
        if creds_json:
            credentials = Credentials.from_service_account_info(json.loads(creds_json), scopes=SCOPE)
        else:
            credentials = Credentials.from_service_account_file("credentials.json", scopes=SCOPE)
        gc = gspread.authorize(credentials)
        gc.session = _build_gspread_session()
        logger.info("✅ gspread авторизован")
        return gc
    except Exception as e:
        logger.error(f"❌ Авторизация gspread провалена: {e}")
        return None

def get_sheet() -> Optional[gspread.Worksheet]:
    """Возвращает Worksheet, при необходимости обновляет токен/клиент и создаёт вкладку."""
    global credentials, gc, sheet
    try:
        if not gc:
            if not _authorize_gspread():
                return None

        if credentials and getattr(credentials, "expired", False):
            credentials.refresh(GoogleRequest())
            logger.info("🔑 Google token обновлён")

        if not sheet:
            sh = gc.open_by_key(SHEET_ID)
            try:
                sheet = sh.worksheet(SHEET_TAB)
            except gspread.WorksheetNotFound:
                sheet = sh.add_worksheet(title=SHEET_TAB, rows=1000, cols=10)
                sheet.append_row(["username", "question", "answer", "created_at"], value_input_option="USER_ENTERED")
                logger.info(f"🆕 Создан лист '{SHEET_TAB}'")

        return sheet
    except Exception as e:
        logger.error(f"❌ Ошибка get_sheet: {e}")
        return None

# API

@app.post("/submit")
async def submit_answers(
    username: str = Form(...),
    answers: str = Form(...),
    photo: UploadFile = File(None),
    photos: List[UploadFile] = File(default=[]),
):
    """
    Принимает ответы, сохраняет в SQLite и Google Sheets.
    Возвращает флаги sheets_ok/sheets_error для диагностики.
    """
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    try:
        parsed = json.loads(answers)
        if not isinstance(parsed, list):
            raise ValueError("answers должен быть массивом объектов {question, answer}")

        # SQLite
        conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        cur = conn.cursor()
        rows_for_db = [
            (username, str(item.get("question", "")), str(item.get("answer", "")), now)
            for item in parsed
        ]
        cur.executemany(
            "INSERT INTO answers (username, question, answer, created_at) VALUES (?, ?, ?, ?)",
            rows_for_db,
        )
        conn.commit()
        conn.close()

        # Google Sheets
        sheets_ok = False
        sheets_error = None
        ws = get_sheet()
        if ws:
            try:
                rows_for_sheet = [
                    [username, item.get("question", ""), item.get("answer", ""), now]
                    for item in parsed
                ]
                if rows_for_sheet:
                    ws.append_rows(rows_for_sheet, value_input_option="USER_ENTERED")
                sheets_ok = True
            except Exception as e:
                sheets_error = str(e)
                logger.warning(f"⚠️ Ошибка записи в Google Sheets: {e}")
        else:
            sheets_error = "gspread client/worksheet unavailable"

        return {
            "status": "ok",
            "saved_count": len(parsed),
            "sheets_ok": sheets_ok,
            "sheets_error": sheets_error,
        }

    except Exception as e:
        logger.exception("Ошибка при сохранении")
        raise HTTPException(status_code=500, detail=f"Ошибка при сохранении: {e}")

@app.get("/healthz", include_in_schema=False)
def healthz():
    ws = get_sheet()
    return {"status": "ok" if ws else "fail", "sheet": SHEET_ID, "tab": SHEET_TAB}

@app.get("/whoami", include_in_schema=False)
def whoami():
    """Вернуть почту сервис-аккаунта для шаринга в Google Sheets."""
    try:
        creds_json = os.getenv("GOOGLE_CREDENTIALS")
        info = json.loads(creds_json) if creds_json else json.load(open("credentials.json", "r", encoding="utf-8"))
        return {"client_email": info.get("client_email")}
    except Exception as e:
        return {"error": str(e)}

@app.post("/debug/google", include_in_schema=False)
def debug_google():
    """Пробная запись в Google Sheets для проверки доступа."""
    ws = get_sheet()
    if not ws:
        return {"sheets_ok": False, "error": "no worksheet (auth or access failed)"}
    try:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        ws.append_row(["_debug_", "ping", "ok", now], value_input_option="USER_ENTERED")
        return {"sheets_ok": True}
    except Exception as e:
        return {"sheets_ok": False, "error": str(e)}

# фронтенд

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.normpath(os.path.join(BASE_DIR, "../frontend"))
INDEX_FILE = os.path.join(FRONTEND_DIR, "index.html")

class StaticFilesCache(StaticFiles):
    def file_response(self, *args, **kwargs) -> Response:
        resp = super().file_response(*args, **kwargs)
        resp.headers.setdefault("Cache-Control", "public, max-age=86400")
        return resp

for folder in ["assets", "css", "js", "fonts", "audio"]:
    path = os.path.join(FRONTEND_DIR, folder)
    if os.path.exists(path):
        mount_cls = StaticFilesCache if folder == "assets" else StaticFiles
        app.mount(f"/{folder}", mount_cls(directory=path), name=folder)

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

@app.api_route("/{full_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
async def catch_all(full_path: str):
    path = os.path.join(FRONTEND_DIR, full_path)
    if os.path.isfile(path):
        return FileResponse(path)
    return _safe_file_response(INDEX_FILE)
