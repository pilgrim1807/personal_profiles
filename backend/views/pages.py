import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from starlette.responses import Response

FRONTEND_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "../../frontend"))
INDEX_FILE = os.path.join(FRONTEND_DIR, "index.html")
FAVICON_PATH = os.path.join(FRONTEND_DIR, "assets", "favicons", "favicon.ico")

router = APIRouter()


def _safe_file_response(path: str) -> FileResponse:
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(path, media_type="text/html")


@router.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return FileResponse(FAVICON_PATH)


@router.api_route("/profile.html", methods=["GET", "HEAD"], include_in_schema=False)
async def serve_profile():
    return _safe_file_response(os.path.join(FRONTEND_DIR, "profile.html"))


@router.api_route("/processing.html", methods=["GET", "HEAD"], include_in_schema=False)
async def serve_processing():
    return _safe_file_response(os.path.join(FRONTEND_DIR, "processing.html"))


@router.api_route("/{full_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
async def catch_all(full_path: str):
    path = os.path.join(FRONTEND_DIR, full_path)
    if os.path.isfile(path):
        return FileResponse(path)
    return _safe_file_response(INDEX_FILE)


@router.api_route("/", methods=["GET", "HEAD"], include_in_schema=False)
async def serve_index():
    html = """
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8" />
        <title>Психологические портреты участников 2/5</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta property="og:title" content="Психологические портреты участников 2/5" />
        <meta property="og:description" content="Пройдите онлайн-тест, чтобы мы убедились, что правильно составили ваши характиристики." />
        <meta property="og:image" content="https://personal-applications-2-5.onrender.com/assets/favicons/social-preview.png" />
        <meta property="og:url" content="https://personal-applications-2-5.onrender.com" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Психологические портреты участников 2/5" />
        <meta name="twitter:description" content="Пройдите онлайн-тест, чтобы мы убедились, что правильно составили ваши характиристики." />
        <meta name="twitter:image" content="https://personal-applications-2-5.onrender.com/assets/favicons/social-preview.png" />
    </head>
    <body>
        <script>window.location.replace("/index.html")</script>
    </body>
    </html>
    """
    return HTMLResponse(content=html)
