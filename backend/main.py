from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from backend.views import pages, submit, answers, auth, debug

app = FastAPI(
    title="Personal Applications API",
    version="1.0.0",
    description="Backend для персональных анкет (группа 2/5)",
)

# CORS для фронтенда
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение API-роутеров
app.include_router(pages.router, prefix="/api/pages")
app.include_router(submit.router, prefix="/api/submit")
app.include_router(answers.router, prefix="/api/answers")
app.include_router(auth.router, prefix="/api/auth")
app.include_router(debug.router, prefix="/api/debug")

# Проверка доступности сервера
@app.get("/healthz")
async def healthcheck():
    return JSONResponse({"status": "ok"})

# Редирект на стартовую страницу API
@app.get("/", include_in_schema=False)
async def redirect_to_pages():
    return RedirectResponse(url="/api/pages/")

# Монтирование фронтенда (HTML, CSS, JS, Fonts и т.д.)
app.mount("/", StaticFiles(directory="frontend", html=True), name="static")

