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

# --- API ---
from fastapi import Form, File, UploadFile, HTTPException
from typing import List
from datetime import datetime
import json


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
        saved_answers = []

        for item in parsed_answers:
            cursor.execute(
                "INSERT INTO answers (username, question, answer, created_at) VALUES (?, ?, ?, ?)",
                (username, item["question"], item["answer"], now)
            )

            current_sheet = get_sheet()
            if current_sheet:
                try:
                    current_sheet.append_row([username, item["question"], item["answer"], now])
                except Exception as e:
                    logger.warning(f"⚠️ Ошибка записи в Google Sheets: {e}")

            saved_answers.append({
                "username": username,
                "question": item["question"],
                "answer": item["answer"],
                "created_at": now
            })

        conn.commit()
        return {"status": "ok", "saved": saved_answers}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при сохранении: {e}")


# --- Health check ---
@app.get("/healthz", include_in_schema=False)
def healthz():
    return {"status": "ok"}


# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://personal-applications-2-5.onrender.com"],
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

# --- Фронтенд ---
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.responses import Response


FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "../frontend")
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

    return FileResponse(INDEX_FILE, media_type="text/html")

