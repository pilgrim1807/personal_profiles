// Данные профилей (базовые)
let PROFILES = [
  { name: "Сергей", className: "sergey" },
  { name: "Андрей", className: "andrey" },
  { name: "Соня", className: "sonya" },
  { name: "Валера", className: "valera" },
  { name: "Воваха", className: "vovaha" }
];

// Генерация slug + путей к картинкам
PROFILES = PROFILES.map(p => {
  const slug = p.className
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "");

  return {
    ...p,
    slug,
    jpg: `/static/assets/names/${slug}.jpg`,
    webp: `/static/assets/names/${slug}.webp`,
    jpgDark: `/static/assets/names/${slug}_dark.jpg`,
    webpDark: `/static/assets/names/${slug}_dark.webp`
  };
});

// Словарь для быстрого поиска по slug
const PROFILES_BY_SLUG = Object.fromEntries(PROFILES.map(p => [p.slug, p]));

// Предзагрузка изображений (и светлых, и тёмных)
function preloadAllImages() {
  const urls = PROFILES.flatMap(p => [p.jpg, p.webp, p.jpgDark, p.webpDark]);
  const promises = urls.map(src => new Promise(res => {
    if (!src) return res();
    const img = new Image();
    img.onload = img.onerror = res;
    img.src = src;
  }));
  return Promise.all(promises);
}

// Рендеринг карточек с учётом темы
function renderProfiles() {
  const list = document.getElementById("profiles-list");
  if (!list) return;

  const isDark = document.body.classList.contains("dark");

  list.innerHTML = PROFILES.map(profile => {
    const jpg = isDark ? profile.jpgDark : profile.jpg;
    const webp = isDark ? profile.webpDark : profile.webp;

    return `
      <button class="profiles-list__item profile-card--avatar ${profile.className}" 
              type="button" 
              data-slug="${profile.slug}" 
              aria-label="Выбрать профиль ${profile.name}">
        <div class="polaroid">
          <picture>
            <source srcset="${webp}" type="image/webp">
            <img class="profile-card__photo"
                 src="${jpg}"
                 alt="${profile.name}"
                 width="240"
                 height="320"
                 loading="eager">
          </picture>
          <div class="profile-card__caption">${profile.name}</div>
        </div>
      </button>
    `;
  }).join("");
}

// Модальное окно для профилей
function initSoundWarning() {
  const warning = document.getElementById("sound-warning");
  if (!warning) return;

  const box = warning.querySelector(".sound-warning__box.polaroid-photo");
  const flash = document.querySelector(".flash-overlay");
  const continueBtn = document.getElementById("sound-continue");
  const closeBtn = document.getElementById("sound-close");

  let targetName = null;
  let targetSlug = null;

  document.querySelectorAll(".profiles-list__item").forEach((button) => {
    const name = button.querySelector(".profile-card__caption")?.textContent?.trim();
    const slug = button.dataset.slug;
    if (!name || !slug) return;

    button.addEventListener("click", (e) => {
      e.preventDefault();
      targetName = name;
      targetSlug = slug;

      warning.classList.add("active");

      flash.classList.add("active");
      flashSound.currentTime = 0;
      flashSound.play().catch(() => {});
      setTimeout(() => flash.classList.remove("active"), 1000);

      setTimeout(() => {
        ejectSound.currentTime = 0;
        ejectSound.play().catch(() => {});
        box.classList.add("show");
      }, 800);
    });
  });

  continueBtn?.addEventListener("click", () => {
    warning.classList.remove("active");
    box.classList.remove("show");
    if (targetSlug) {
      window.location.href = `profile.html?slug=${encodeURIComponent(targetSlug)}`;
    }
  });

  closeBtn?.addEventListener("click", () => {
    warning.classList.remove("active");
    box.classList.remove("show");
  });

  warning.addEventListener("click", (e) => {
    if (e.target === warning) {
      warning.classList.remove("active");
      box.classList.remove("show");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      warning.classList.remove("active");
      box.classList.remove("show");
    }
  });
}

// Звуки
const flashSound = new Audio("audio/flash.mp3");
flashSound.preload = "auto";

const ejectSound = new Audio("audio/photo-out.mp3");
ejectSound.preload = "auto";

const bubbleSound = new Audio("audio/bubble.mp3");
bubbleSound.preload = "auto";

// Переключение темы
function initThemeToggle() {
  const btn = document.getElementById("themeToggle");
  const body = document.body;

  // Восстанавливаем сохранённую тему
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme) {
    body.classList.toggle("dark", savedTheme === "dark");
  } else {
    // Если темы нет в localStorage — используем системную
    body.classList.toggle("dark", window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  // Кнопка смены темы
  btn?.addEventListener("click", () => {
    const isDark = body.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
    renderProfiles(); // перерисуем карточки с картинками
  });

  // Автоматическая реакция на смену темы в системе
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener("change", (e) => {
    if (!localStorage.getItem("theme")) { 
      body.classList.toggle("dark", e.matches);
      renderProfiles();
    }
  });
}

// Сообщение вместо инпута
function showMessageInsteadOfInput(msg, success = false) {
  const wrapper = document.getElementById("token-wrapper");
  const input = document.getElementById("token-input");

  input.style.display = "none";

  let note = wrapper.querySelector(".token-message");
  if (!note) {
    note = document.createElement("div");
    note.className = "token-message";
    wrapper.appendChild(note);
  }

  note.classList.remove("success", "error", "show");
  note.classList.add(success ? "success" : "error", "show");
  note.textContent = msg;

  note.style.display = "flex";

  setTimeout(() => {
    note.classList.remove("show");
    setTimeout(() => {
      note.remove();
      input.value = "";
      input.style.display = "block";
      delayedGrowBubble();
    }, 300);
  }, 1500);
}

// Рост пузыря обратно
function delayedGrowBubble() {
  const wrapper = document.getElementById("token-wrapper");
  const btn = document.getElementById("bubble-btn");

  wrapper.style.display = "none";
  document.getElementById("token-input").value = "";

  btn.classList.remove("bubble-download", "visible");
  btn.classList.add("icon-only");

  requestAnimationFrame(() => {
    btn.classList.remove("icon-only");
    btn.classList.add("bubble-download", "grow");
    btn.addEventListener("animationend", () => {
      btn.classList.remove("grow");
      btn.classList.add("visible");
    }, { once: true });
  });
}

// Брызги
function createSplashes(el) {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  for (let i = 0; i < 25; i++) {
    createSplash(cx, cy, 200, rect.width);
  }
}

function createSplash(x, y, hue, size) {
  const d = document.createElement("div");
  d.className = "splash";
  const s = (Math.random() * 6 + 3) * (size / 120);
  d.style.width = d.style.height = `${s}px`;
  d.style.left = `${x - s / 2}px`;
  d.style.top = `${y - s / 2}px`;
  const angle = Math.random() * 2 * Math.PI;
  const dist = (Math.random() * 60 + 40) * (size / 120);
  d.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
  d.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);
  d.style.setProperty("--hue", hue);
  document.body.appendChild(d);
  d.addEventListener("animationend", () => d.remove());
}

function downloadCSV(token) {
  fetch("/answers.csv", {
    headers: {
      "Authorization": "Bearer " + token
    }
  })
    .then((res) => {
      if (res.status === 403) {
        sessionStorage.removeItem("token_validated");
        throw new Error("Неверный токен");
      }
      if (!res.ok) throw new Error("Ошибка доступа");
      return res.blob();
    })
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "answers.csv";
      a.click();
      URL.revokeObjectURL(url);
    })
    .catch((err) => {
      showMessageInsteadOfInput("⛔ Ошибка при скачивании: " + err.message, false);
    });
}

function saveToken(token) {
  sessionStorage.setItem("token_validated", token);
}

// Запуск
document.addEventListener("DOMContentLoaded", () => {
  // сначала тема
  initThemeToggle();

  // предзагрузка изображений
  preloadAllImages().then(() => {
    //  рендер и подключение модалки
    renderProfiles();
    initSoundWarning();
  });

  // токен/скачивание CSV и прочее остаётся ниже
  const savedToken = sessionStorage.getItem("token_validated");
  if (savedToken) {
    downloadCSV(savedToken);
  }

  const btn = document.getElementById("bubble-btn");
  const wrapper = document.getElementById("token-wrapper");

  if (btn && wrapper) {
    wrapper.style.display = "none";
    btn.classList.remove("icon-only");
    btn.classList.add("bubble-download", "visible");

    btn.addEventListener("click", () => {
      bubbleSound.currentTime = 0;
      bubbleSound.play().catch(() => { });

      btn.classList.add("pop");
      createSplashes(btn);

      btn.addEventListener("animationend", () => {
        btn.classList.remove("pop");
        btn.classList.add("icon-only");
        wrapper.style.display = "block";
        document.getElementById("token-input")?.focus();
      }, { once: true });
    });

    document.getElementById("token-input")?.addEventListener("keypress", (e) => {
      if (e.key !== "Enter") return;
      const token = e.target.value.trim();
      if (!token) return;

      const formData = new FormData();
      formData.append("token", token);

      fetch("/submit_token", {
        method: "POST",
        body: formData
      })
        .then((res) => {
          if (!res.ok) throw new Error("invalid");
          return res.json();
        })
        .then(() => {
          saveToken(token);
          showMessageInsteadOfInput("✅ Токен принят. Ответ сохранён.", true);
          setTimeout(() => {
            downloadCSV(token);
          }, 1600);
        })
        .catch(() => {
          showMessageInsteadOfInput("⛔ Неверный токен! Попробуй снова.", false);
        });
    });
  }
});
