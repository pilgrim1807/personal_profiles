from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse

from backend.views import pages, submit, answers, auth, debug

app = FastAPI(
    title="Personal Applications API",
    version="1.0.0",
    description="Backend для персональных анкет (группа 2/5)",
)

# Разрешить запросы с любого источника
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Роутеры
app.include_router(pages.router)
app.include_router(submit.router)
app.include_router(answers.router)
app.include_router(auth.router)
app.include_router(debug.router)

# Healthcheck
@app.get("/healthz")
async def healthcheck():
    return JSONResponse({"status": "ok"})

