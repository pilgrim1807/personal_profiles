from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse

from backend.views import pages, submit, answers, auth, debug

app = FastAPI(
    title="Personal Applications API",
    version="1.0.0",
    description="Backend для персональных анкет (группа 2/5)",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение роутеров
app.include_router(pages.router, prefix="/api/pages")
app.include_router(submit.router, prefix="/api/submit")
app.include_router(answers.router, prefix="/api/answers")
app.include_router(auth.router, prefix="/api/auth")
app.include_router(debug.router, prefix="/api/debug")

# Healthcheck endpoint
@app.get("/healthz")
async def healthcheck():
    return JSONResponse({"status": "ok"})

# Корневой маршрут
@app.get("/", response_class=HTMLResponse)
async def root():
    return """
    <html>
        <head><title>Personal Applications API</title></head>
        <body>
            <h1>✅ API работает</h1>
            <p>Добро пожаловать! Доступные маршруты:</p>
            <ul>
                <li><a href="/api/pages">/api/pages</a></li>
                <li><a href="/api/submit">/api/submit</a></li>
                <li><a href="/api/answers">/api/answers</a></li>
                <li><a href="/api/auth">/api/auth</a></li>
                <li><a href="/api/debug">/api/debug</a></li>
                <li><a href="/healthz">/healthz</a> (health check)</li>
            </ul>
        </body>
    </html>
    """
