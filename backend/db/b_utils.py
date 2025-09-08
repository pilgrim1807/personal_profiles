import sqlite3
import os

DB_PATH = os.getenv("DB_PATH", os.path.join(os.path.dirname(__file__), "../../tests.db"))

def _ensure_db() -> None:
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


def save_answers_to_db(username: str, parsed: list, timestamp: str) -> None:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    cur = conn.cursor()
    rows_for_db = [
        (username, str(item.get("question", "")), str(item.get("answer", "")), timestamp)
        for item in parsed
    ]
    cur.executemany(
        "INSERT INTO answers (username, question, answer, created_at) VALUES (?, ?, ?, ?)",
        rows_for_db,
    )
    conn.commit()
    conn.close()
