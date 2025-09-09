import os
from fastapi import APIRouter, HTTPException, Body

ADMIN_TOKEN = os.getenv("ADMIN_TOKEN")
if not ADMIN_TOKEN:
    raise RuntimeError("❌ Переменная окружения ADMIN_TOKEN не задана!")

router = APIRouter()

@router.post("/submit_token")
def submit_token(data: dict = Body(...)):
    token = data.get("token")
    if not token:
        raise HTTPException(status_code=400, detail="Token required")

    if token == ADMIN_TOKEN:
        return {"ok": True}
    else:
        raise HTTPException(status_code=403, detail="Invalid token")
