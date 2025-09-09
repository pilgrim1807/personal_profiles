import json
import os
from datetime import datetime
from fastapi import APIRouter
from backend.utils.sheets_utils import get_sheet_first_tab

router = APIRouter()
CREDENTIALS_PATH = os.path.join(os.path.dirname(__file__), "../../credentials.json")

@router.get("/healthz", include_in_schema=False)
def healthz():
    ws = get_sheet_first_tab()
    return {"status": "ok" if ws else "fail", "tab": ws.title if ws else None}

@router.get("/whoami", include_in_schema=False)
def whoami():
    try:
        creds_json = os.getenv("GOOGLE_CREDENTIALS")
        info = json.loads(creds_json) if creds_json else json.load(open(CREDENTIALS_PATH, "r", encoding="utf-8"))
        return {"client_email": info.get("client_email")}
    except Exception as e:
        return {"error": str(e)}

@router.api_route("/debug/google", methods=["GET", "POST"], include_in_schema=False)
def debug_google():

    ws = get_sheet_first_tab()
    if not ws:
        return {"sheets_ok": False, "error": "no worksheet (auth/access failed)"}
    try:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        ws.append_row(["_debug_", "ping", "ok", now], value_input_option="USER_ENTERED")
        return {"sheets_ok": True, "tab": ws.title}
    except Exception as e:
        return {"sheets_ok": False, "error": str(e), "tab": ws.title}
