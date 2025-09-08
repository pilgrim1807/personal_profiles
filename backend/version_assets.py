import time
import re
from pathlib import Path

HTML_DIR = Path("frontend")
EXTS = ("css", "js")
version = int(time.time())

def update_versions_in_file(file_path: Path):
    with file_path.open("r", encoding="utf-8") as f:
        content = f.read()

    original = content
    for ext in EXTS:
        
        pattern = re.compile(rf'({ext}/[^"\']+\.{ext})(\?v=\d+)?')
        content = pattern.sub(rf'\1?v={version}', content)

    if content != original:
        with file_path.open("w", encoding="utf-8") as f:
            f.write(content)
        print(f"✅ Обновлено: {file_path.name}")
    else:
        print(f"ℹ️  Пропущено (без изменений): {file_path.name}")

def main():
    html_files = list(HTML_DIR.glob("*.html"))
    if not html_files:
        print("⚠️ HTML-файлы не найдены")
        return

    print(f"🔄 Обновление кэш-версий с ?v={version}")
    for html_file in html_files:
        update_versions_in_file(html_file)

if __name__ == "__main__":
    main()
