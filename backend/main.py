# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse

from backend.views import pages, submit, answers, auth, debug

app = FastAPI(
    title="Personal Applications API",
    version="1.0.0",
    description="Backend для персональных анкет (группа 2/5)",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # На проде: ["https://frontend.com"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение роутеров с префиксами (по желанию)
app.include_router(pages.router, prefix="/api/pages")
app.include_router(submit.router, prefix="/api/submit")
app.include_router(answers.router, prefix="/api/answers")
app.include_router(auth.router, prefix="/api/auth")
app.include_router(debug.router, prefix="/api/debug")

# Healthcheck endpoint
@app.get("/healthz")
async def healthcheck():
    return JSONResponse({"status": "ok"})
