import sqlite3
import io
import csv
import os

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse

DB_PATH = os.getenv("DB_PATH", os.path.join(os.path.dirname(__file__), "../../tests.db"))
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "sekret123")

router = APIRouter()

@router.get("/answers", response_class=HTMLResponse)
def view_answers(request: Request):
    token = request.query_params.get("token")
    if token != ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="Access denied")

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT username, question, answer, created_at FROM answers ORDER BY created_at DESC")
    rows = cur.fetchall()
    conn.close()

    html = """
    <html><head><meta charset='utf-8'><title>Ответы</title>
    <style>table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px}</style>
    </head><body><h2>Ответы</h2><table><tr><th>Имя</th><th>Вопрос</th><th>Ответ</th><th>Дата</th></tr>"""
    for r in rows:
        html += f"<tr><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td></tr>"
    html += "</table></body></html>"
    return HTMLResponse(content=html)


@router.get("/answers.csv")
def export_answers_csv(request: Request):
    token = request.query_params.get("token")
    if token != ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="Access denied")

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT username, question, answer, created_at FROM answers ORDER BY created_at DESC")
    rows = cur.fetchall()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Имя", "Вопрос", "Ответ", "Дата"])
    writer.writerows(rows)

    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv")
