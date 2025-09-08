import os
import json
import logging
import certifi
import requests
import gspread
from typing import Optional
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.service_account import Credentials
from gspread.utils import rowcol_to_a1 as rca1

logger = logging.getLogger(__name__)

SCOPE = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

SHEET_ID = os.getenv("SHEET_ID", "1BvPPrVUP2wRqT2JszTnJMgbR0ZAU1aljfX-cmI0wqVA")
CREDENTIALS_PATH = os.path.join(os.path.dirname(__file__), "../../credentials.json")

credentials: Optional[Credentials] = None
gc: Optional[gspread.Client] = None
worksheet: Optional[gspread.Worksheet] = None


def _build_gspread_session() -> requests.Session:
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
            credentials = Credentials.from_service_account_file(CREDENTIALS_PATH, scopes=SCOPE)
        gc = gspread.authorize(credentials)
        gc.session = _build_gspread_session()
        logger.info("✅ gspread авторизован")
        return gc
    except Exception as e:
        logger.error(f"❌ Авторизация gspread провалена: {e}")
        return None


def get_sheet_first_tab() -> Optional[gspread.Worksheet]:
    global credentials, gc, worksheet
    try:
        if not gc and not _authorize_gspread():
            return None

        if credentials and getattr(credentials, "expired", False):
            credentials.refresh(GoogleRequest())
            gc = gspread.authorize(credentials)
            gc.session = _build_gspread_session()
            logger.info("🔑 Google token обновлён")

        sh = gc.open_by_key(SHEET_ID)
        tabs = sh.worksheets()
        if not tabs:
            worksheet = sh.add_worksheet(title="Ответы", rows=1000, cols=10)
            worksheet.append_row(["username", "question", "answer", "created_at"], value_input_option="USER_ENTERED")
            logger.info("🆕 Создан первый лист 'Ответы'")
        else:
            worksheet = tabs[0]
            try:
                has_values = bool(worksheet.get_all_values())
            except Exception:
                has_values = False
            if not has_values:
                worksheet.append_row(["username", "question", "answer", "created_at"], value_input_option="USER_ENTERED")
        return worksheet
    except Exception as e:
        logger.error(f"❌ Ошибка get_sheet_first_tab: {e}")
        return None


def find_next_available_column(ws):
    values = ws.row_values(1)
    return len(values) + 1


def rowcol_to_a1(row, col):
    return rca1(row, col)


def safe_batch_update(ws, updates):
    try:
        ws.batch_update([{"range": u["range"], "values": u["values"]} for u in updates])
        return True
    except Exception as e:
        logger.error(f"Ошибка при batch_update: {e}")
        return False
