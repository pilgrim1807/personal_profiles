import json
import logging
from datetime import datetime
from typing import List

from fastapi import APIRouter, Form, File, UploadFile, HTTPException
from backend.db.b_utils import save_answers_to_db
from backend.utils.sheets_utils import (
    get_sheet_first_tab,
    find_next_available_column,
    rowcol_to_a1,
    safe_batch_update
)

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/submit")
async def submit_answers(
    username: str = Form(...),
    answers: str = Form(...),
    photo: UploadFile = File(None),        # Зарезервировано для будущего использования
    photos: List[UploadFile] = File(default=[]),  # Зарезервировано для будущего использования
):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    try:
        parsed = json.loads(answers)
        if not isinstance(parsed, list):
            raise ValueError("Поле 'answers' должно быть массивом объектов {question, answer}")
        logger.info(f"📩 ▶️ SUBMIT от {username}, {len(parsed)} ответов:")
        for i, item in enumerate(parsed, 1):
            logger.info(f"  Q{i}: {item.get('question')} → {item.get('answer')}")
        save_answers_to_db(username, parsed, now)


        # Работа с Google Sheets
        sheets_ok = False
        sheets_error = None
        tab_used = None

        ws = get_sheet_first_tab()
        if ws:
            try:
                tab_used = ws.title
                col = find_next_available_column(ws)
                ws.update_cell(1, col, username)
                ws.update_cell(2, col, now)

                updates = []
                for i, item in enumerate(parsed):
                    question = item.get("question", f"Q{i+1}")
                    raw_ans = item.get("answer", "")
                    answer = (
                        "да" if raw_ans == "yes"
                        else "нет" if raw_ans == "no"
                        else f"нет ({raw_ans})" if raw_ans
                        else "нет"
                    )
                    row_q = 3 + i * 2
                    row_a = row_q + 1
                    updates.append({"range": rowcol_to_a1(row_q, col), "values": [[question]]})
                    updates.append({"range": rowcol_to_a1(row_a, col), "values": [[answer]]})

                if updates and not safe_batch_update(ws, updates):
                    raise Exception("Ошибка при записи в Google Таблицу")

                sheets_ok = True
                logger.info(f"✅ Данные {username} успешно записаны в колонку {col}")

            except Exception as e:
                sheets_error = str(e)
                logger.warning(f"⚠️ Ошибка записи в Google Sheets: {e}")
        else:
            sheets_error = "Google Sheets недоступен"

        return {
            "status": "ok",
            "saved_count": len(parsed),
            "sheets_ok": sheets_ok,
            "sheets_error": sheets_error,
            "tab_used": tab_used,
        }

    except Exception as e:
        logger.exception("❌ Ошибка при сохранении")
        raise HTTPException(status_code=500, detail=f"Ошибка при сохранении: {e}")
