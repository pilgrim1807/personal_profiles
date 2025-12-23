import os
import json
import logging
import certifi
import requests
import gspread
import sqlite3
from typing import Optional
from collections import defaultdict

from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.service_account import Credentials
from gspread.utils import rowcol_to_a1 as rca1

from backend.config import DB_PATH

# Логирование

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# Google scopes

SCOPE = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

# Глобальные объекты

credentials: Optional[Credentials] = None
gc: Optional[gspread.Client] = None
worksheet: Optional[gspread.Worksheet] = None

# Вспомогательные функции


def _build_gspread_session() -> requests.Session:
    session = requests.Session()
    session.verify = certifi.where()
    return session


def _authorize_gspread() -> Optional[gspread.Client]:
    """
    Авторизация ТОЛЬКО через переменные окружения:
    - GOOGLE_CREDENTIALS (JSON)
    - SHEET_ID
    """
    global credentials, gc

    sheet_id = os.getenv("SHEET_ID")
    creds_json = os.getenv("GOOGLE_CREDENTIALS")

    # 🔍 Диагностические логи
    logger.info("DEBUG SHEET_ID = %r", sheet_id)
    logger.info("DEBUG GOOGLE_CREDENTIALS_JSON SET = %s", bool(creds_json))

    if not sheet_id or not creds_json:
        logger.error("❌ Не заданы GOOGLE_CREDENTIALS или SHEET_ID")
        return None

    try:
        creds_dict = json.loads(creds_json)

        credentials = Credentials.from_service_account_info(
            creds_dict,
            scopes=SCOPE,
        )

        gc = gspread.authorize(credentials)
        gc.session = _build_gspread_session()

        logger.info("✅ gspread авторизован через GOOGLE_CREDENTIALS (env)")
        return gc

    except Exception:
        logger.exception("❌ Авторизация gspread провалена")
        return None

# Получение первого листа


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

        sheet_id = os.getenv("SHEET_ID")
        sh = gc.open_by_key(sheet_id)
        tabs = sh.worksheets()

        if not tabs:
            worksheet = sh.add_worksheet(
                title="Ответы",
                rows=1000,
                cols=10,
            )
            worksheet.append_row(
                ["username", "question", "answer", "created_at"],
                value_input_option="USER_ENTERED",
            )
            logger.info("🆕 Создан первый лист 'Ответы'")
        else:
            worksheet = tabs[0]

        return worksheet

    except Exception:
        logger.exception("❌ Ошибка get_sheet_first_tab")
        return None

# Экспорт данных из SQLite в Google Sheets (форматированный)


def upload_answers_to_sheet_formatted(db_path=DB_PATH):
    try:
        worksheet = get_sheet_first_tab()
        if not worksheet:
            logger.error("❌ worksheet недоступен")
            return

        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute(
            "SELECT username, question, answer, created_at "
            "FROM answers ORDER BY created_at ASC"
        )
        rows = cur.fetchall()
        conn.close()

        if not rows:
            logger.warning("⚠️ Нет данных для экспорта")
            return

        grouped = defaultdict(list)
        created_at_map = {}

        for username, question, answer, created_at in rows:
            grouped[username].append((question, answer))
            created_at_map.setdefault(username, created_at)

        all_questions = []
        seen = set()
        for answers in grouped.values():
            for q, _ in answers:
                key = q.strip().lower()
                if key not in seen:
                    seen.add(key)
                    all_questions.append(q)

        header_row = []
        date_row = []
        for username in grouped:
            header_row.extend([username, ""])
            date_row.extend([created_at_map[username], ""])

        data_rows = []
        for question in all_questions:
            row = [question]
            for username in grouped:
                answers_dict = dict(grouped[username])
                row.extend([answers_dict.get(question, ""), ""])
            data_rows.append(row)

        all_rows = [
            [""] + header_row,
            [""] + date_row,
            *data_rows,
        ]

        worksheet.clear()

        updates = []
        for r_idx, row in enumerate(all_rows, start=1):
            start = rca1(r_idx, 1)
            end = rca1(r_idx, len(row))
            updates.append({
                "range": f"{start}:{end}",
                "values": [row],
            })

        worksheet.batch_update(updates, value_input_option="USER_ENTERED")
        logger.info(f"✅ Загружено {len(all_rows)} строк в Google Sheets")

        merge_requests = []
        format_requests = []

        cell_format = {
            "horizontalAlignment": "CENTER",
            "verticalAlignment": "MIDDLE",
            "wrapStrategy": "WRAP",
        }

        col = 2
        for username in grouped:
            merge_requests.append({
                "mergeCells": {
                    "range": {
                        "sheetId": worksheet._properties["sheetId"],
                        "startRowIndex": 0,
                        "endRowIndex": 1,
                        "startColumnIndex": col - 1,
                        "endColumnIndex": col + 1,
                    },
                    "mergeType": "MERGE_ALL",
                }
            })

            for row_idx in (0, 1):
                format_requests.append({
                    "repeatCell": {
                        "range": {
                            "sheetId": worksheet._properties["sheetId"],
                            "startRowIndex": row_idx,
                            "endRowIndex": row_idx + 1,
                            "startColumnIndex": col - 1,
                            "endColumnIndex": col + 1,
                        },
                        "cell": {"userEnteredFormat": cell_format},
                        "fields": "userEnteredFormat(horizontalAlignment,verticalAlignment,wrapStrategy)",
                    }
                })

            col += 2

        worksheet.spreadsheet.batch_update({
            "requests": merge_requests + format_requests
        })

        logger.info("🎨 Форматирование применено")

    except Exception:
        logger.exception("❌ Ошибка upload_answers_to_sheet_formatted")

# Утилиты


def find_next_available_column(ws):
    return len(ws.row_values(1)) + 1


def rowcol_to_a1(row, col):
    return rca1(row, col)


def safe_batch_update(ws, updates):
    try:
        ws.batch_update(updates, value_input_option="USER_ENTERED")
        return True
    except Exception:
        logger.exception("❌ Google Sheets batch_update error")
        return False
