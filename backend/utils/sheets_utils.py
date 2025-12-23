import os
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

# Настройка логгирования
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# Переменные окружения
SCOPE = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

SHEET_ID = os.getenv("SHEET_ID", "1BvPPrVUP2wRqT2JszTnJMgbR0ZAU1aljfX-cmI0wqVA")
CREDENTIALS_PATH = os.environ["GOOGLE_CREDENTIALS_PATH"]


# Глобальные объекты
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
        credentials = Credentials.from_service_account_file(CREDENTIALS_PATH, scopes=SCOPE)
        gc = gspread.authorize(credentials)
        gc.session = _build_gspread_session()
        logger.info("✅ gspread авторизован через GOOGLE_CREDENTIALS_PATH")
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


def upload_answers_to_sheet_formatted(db_path=DB_PATH):
    try:
        worksheet = get_sheet_first_tab()
        if not worksheet:
            logger.error("❌ worksheet недоступен")
            return

        # Чтение данных из SQLite
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("SELECT username, question, answer, created_at FROM answers ORDER BY created_at ASC")
        rows = cur.fetchall()
        conn.close()

        if not rows:
            logger.warning("⚠️ Нет данных для экспорта")
            return

        # Группировка по пользователям
        grouped = defaultdict(list)
        created_at_map = {}

        for username, question, answer, created_at in rows:
            grouped[username].append((question, answer))
            if username not in created_at_map:
                created_at_map[username] = created_at

        # Уникальные вопросы (нормализованные)
        all_questions = []
        seen = set()
        for answers in grouped.values():
            for q, _ in answers:
                norm_q = q.strip().lower()
                if norm_q not in seen:
                    seen.add(norm_q)
                    all_questions.append(q)

        # Заголовки
        header_row = []
        date_row = []
        for username in grouped:
            header_row.extend([username, ""])
            date_row.extend([created_at_map[username], ""])

        # Ответы
        data_rows = []
        for question in all_questions:
            row = [question]
            for username in grouped:
                answers_dict = dict(grouped[username])
                row.extend([answers_dict.get(question, ""), ""])
            data_rows.append(row)

        # Финальный массив строк
        all_rows = [
            [""] + header_row,
            [""] + date_row,
            *data_rows
        ]

        # Очистка таблицы
        worksheet.clear()

        # Загрузка строк
        updates = []
        for r_idx, row in enumerate(all_rows, start=1):
            start_a1 = rca1(r_idx, 1)
            end_a1 = rca1(r_idx, len(row))
            range_a1 = f"{start_a1}:{end_a1}"
            updates.append({"range": range_a1, "values": [row]})

        worksheet.batch_update(updates, value_input_option="USER_ENTERED")
        logger.info(f"✅ Успешно загружено {len(all_rows)} строк в Google Sheets")

        # 📐 Форматирование и объединение ячеек
        merge_requests = []
        format_requests = []

        cell_format = {
            "horizontalAlignment": "CENTER",
            "verticalAlignment": "MIDDLE",
            "wrapStrategy": "WRAP"
        }

        col = 2  # начинаем с колонки B
        for username in grouped:
            # Объединение ячеек с именем пользователя
            merge_requests.append({
                "mergeCells": {
                    "range": {
                        "sheetId": worksheet._properties["sheetId"],
                        "startRowIndex": 0,
                        "endRowIndex": 1,
                        "startColumnIndex": col - 1,
                        "endColumnIndex": col + 1
                    },
                    "mergeType": "MERGE_ALL"
                }
            })

            # Центрирование для имени и даты
            for row in [0, 1]:
                format_requests.append({
                    "repeatCell": {
                        "range": {
                            "sheetId": worksheet._properties["sheetId"],
                            "startRowIndex": row,
                            "endRowIndex": row + 1,
                            "startColumnIndex": col - 1,
                            "endColumnIndex": col + 1
                        },
                        "cell": {"userEnteredFormat": cell_format},
                        "fields": "userEnteredFormat(horizontalAlignment, verticalAlignment, wrapStrategy)"
                    }
                })

            col += 2

        # Центрирование для всех строк с вопросами и ответами
        format_requests.append({
            "repeatCell": {
                "range": {
                    "sheetId": worksheet._properties["sheetId"],
                    "startRowIndex": 2,
                    "endRowIndex": 2 + len(data_rows),
                    "startColumnIndex": 0,
                    "endColumnIndex": len(header_row) + 1
                },
                "cell": {"userEnteredFormat": cell_format},
                "fields": "userEnteredFormat(horizontalAlignment, verticalAlignment, wrapStrategy)"
            }
        })

        # Применяем форматирование и объединение
        worksheet.spreadsheet.batch_update({
            "requests": merge_requests + format_requests
        })

        logger.info("🎨 Форматирование и объединение ячеек выполнено")

    except Exception as e:
        logger.error(f"❌ Ошибка upload_answers_to_sheet_formatted: {e}")


# 🔧 Утилиты
def find_next_available_column(ws):
    values = ws.row_values(1)
    return len(values) + 1


def rowcol_to_a1(row, col):
    return rca1(row, col)


def safe_batch_update(ws, updates):
    try:
        ws.batch_update(updates)
        return True
    except Exception as e:
        logger.exception("❌ Google Sheets batch_update error")
        return False

