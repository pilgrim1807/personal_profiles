import os
import io
import csv
import html
import sqlite3
from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse

# Настройки
DB_PATH = os.getenv("DB_PATH", os.path.join(os.path.dirname(__file__), "../../tests.db"))
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN")
if not ADMIN_TOKEN:
    raise RuntimeError("❌ Переменная окружения ADMIN_TOKEN не задана!")

router = APIRouter()


def verify_token(request: Request):
    token = request.headers.get("Authorization")
    if not token or token != f"Bearer {ADMIN_TOKEN}":
        raise HTTPException(status_code=403, detail="Access denied")


@router.get("/answers", response_class=HTMLResponse)
def view_answers(request: Request):
    verify_token(request)
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute("SELECT username, question, answer, created_at FROM answers ORDER BY created_at DESC")
        rows = cur.fetchall()

    html_content = """
    <html><head><meta charset='utf-8'><title>Ответы</title>
    <style>
        body { font-family: sans-serif; padding: 20px; }
        table { border-collapse: collapse; width: 100%; }
        td, th { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
        th { background: #f8f8f8; }

        /* Пагинация */
        .pagination { margin: 10px 0; text-align: center; }
        .pagination button {
            margin: 0 5px; padding: 5px 10px;
            background: #007BFF; color: white; border: none;
            cursor: pointer; border-radius: 3px;
        }
        .pagination button:disabled {
            background: #ccc; cursor: not-allowed;
        }
        .pagination span { margin: 0 10px; }
    </style></head><body>
    <h2>Ответы пользователей</h2>

    <div class="pagination">
      <button id="prevBtn">← Назад</button>
      <span id="pageInfo">Страница 1</span>
      <button id="nextBtn">Вперёд →</button>
    </div>

    <table>
      <thead><tr><th>Имя</th><th>Вопрос</th><th>Ответ</th><th>Дата</th></tr></thead>
      <tbody id="answersTable">
    """

    for name, question, answer, date in rows:
        html_content += (
            f"<tr>"
            f"<td>{html.escape(name)}</td>"
            f"<td>{html.escape(question)}</td>"
            f"<td>{html.escape(answer)}</td>"
            f"<td>{html.escape(date)}</td>"
            f"</tr>"
        )

    html_content += """
      </tbody>
    </table>

    <script>
      document.addEventListener("DOMContentLoaded", () => {
        const rows = Array.from(document.querySelectorAll('#answersTable tr'));
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const pageInfo = document.getElementById('pageInfo');

        const rowsPerPage = 10;
        let currentPage = 1;
        const totalPages = Math.ceil(rows.length / rowsPerPage);

        function showPage(page) {
          const start = (page - 1) * rowsPerPage;
          const end = start + rowsPerPage;
          rows.forEach((row, index) => {
            row.style.display = (index >= start && index < end) ? '' : 'none';
          });
          pageInfo.textContent = `Страница ${page} из ${totalPages}`;
          prevBtn.disabled = page === 1;
          nextBtn.disabled = page === totalPages;
        }

        prevBtn.addEventListener('click', () => {
          if (currentPage > 1) { currentPage--; showPage(currentPage); }
        });

        nextBtn.addEventListener('click', () => {
          if (currentPage < totalPages) { currentPage++; showPage(currentPage); }
        });

        showPage(1);
      });
    </script>

    </body></html>
    """
    return HTMLResponse(content=html_content)


@router.get("/answers.csv")
def export_answers_csv(request: Request):
    verify_token(request)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT username, question, answer, created_at FROM answers ORDER BY created_at ASC")
    rows = cur.fetchall()
    conn.close()

    grouped = defaultdict(list)
    created_at_map = {}

    for username, question, answer, created_at in rows:
        grouped[username].append((question, answer))
        if username not in created_at_map:
            created_at_map[username] = created_at  # первая дата

    # Уникальные вопросы в порядке появления
    all_questions = []
    seen = set()
    for user_answers in grouped.values():
        for question, _ in user_answers:
            if question not in seen:
                seen.add(question)
                all_questions.append(question)

    # Создание CSV
    output = io.StringIO()
    writer = csv.writer(output)

    # Первая строка — имена
    header = [""]
    for username in grouped:
        header.extend([username, ""])
    writer.writerow(header)

    # Вторая строка — даты
    dates = [""]
    for username in grouped:
        raw = created_at_map.get(username)
        try:
            formatted = datetime.strptime(raw, "%Y-%m-%d %H:%M:%S").strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            formatted = raw or ""
        dates.extend([formatted, ""])
    writer.writerow(dates)

    # Ответы
    for question in all_questions:
        row = [question]
        for username in grouped:
            answer = next((a for q, a in grouped[username] if q == question), "")
            row.extend([answer, ""])
        writer.writerow(row)

    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=answers.csv",
            "Content-Type": "text/csv; charset=utf-8"
        }
    )

