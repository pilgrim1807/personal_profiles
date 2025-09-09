// Данные профилей
const PROFILES = [
  { name: "Сергей", jpg: "assets/names/sergey.jpg", webp: "assets/names/sergey.webp", className: "sergey" },
  { name: "Андрей", jpg: "assets/names/andrey.jpg", webp: "assets/names/andrey.webp", className: "andrey" },
  { name: "Соня", jpg: "assets/names/sonya.jpg", webp: "assets/names/sonya.webp", className: "sonya" },
  { name: "Валера", jpg: "assets/names/valera.jpg", webp: "assets/names/valera.webp", className: "valera" },
  { name: "Воваха", jpg: "assets/names/vovaha.jpg", webp: "assets/names/vovaha.webp", className: "vovaha" }
];

// Предзагрузка изображений
function preloadImages() {
  PROFILES.forEach(p => {
    const imgWebp = new Image();
    imgWebp.src = p.webp;

    const imgJpg = new Image();
    imgJpg.src = p.jpg;
  });
}

// Рендеринг карточек
function renderProfiles() {
  const list = document.getElementById("profiles-list");
  if (!list) return;

  list.innerHTML = PROFILES.map(profile => `
    <button class="profiles-list__item profile-card--avatar ${profile.className}" 
            type="button" 
            aria-label="Выбрать профиль ${profile.name}">
      <div class="polaroid">
        <picture>
          <source srcset="${profile.webp}" type="image/webp">
          <img class="profile-card__photo"
               src="${profile.jpg}"
               alt="${profile.name}">
        </picture>
        <div class="profile-card__caption">${profile.name}</div>
      </div>
    </button>
  `).join("");

  initSoundWarning();
}


// Звуки
const flashSound = new Audio("audio/flash.mp3");
flashSound.preload = "auto";

const ejectSound = new Audio("audio/photo-out.mp3");
ejectSound.preload = "auto";

const bubbleSound = new Audio("audio/bubble.mp3");
bubbleSound.preload = "auto";

// Модальное окно для профилей
function initSoundWarning() {
  const warning = document.getElementById("sound-warning");
  const box = warning.querySelector(".sound-warning__box.polaroid-photo");
  const flash = document.querySelector(".flash-overlay");
  const continueBtn = document.getElementById("sound-continue");
  const closeBtn = document.getElementById("sound-close");

  let targetName = null;

  document.querySelectorAll(".profiles-list__item").forEach((button) => {
    const name = button.querySelector(".profile-card__caption")?.textContent?.trim();
    if (!name) return;

    button.addEventListener("click", (e) => {
      e.preventDefault();
      targetName = name;

      warning.classList.add("active");

      flash.classList.add("active");
      flashSound.currentTime = 0;
      flashSound.play().catch(() => { });
      setTimeout(() => flash.classList.remove("active"), 1000);

      setTimeout(() => {
        ejectSound.currentTime = 0;
        ejectSound.play().catch(() => { });
        box.classList.add("show");
      }, 800);
    });
  });

  continueBtn?.addEventListener("click", () => {
    warning.classList.remove("active");
    box.classList.remove("show");
    if (targetName) {
      window.location.href = `profile.html?name=${encodeURIComponent(targetName)}`;
    }
  });

  closeBtn?.addEventListener("click", () => {
    warning.classList.remove("active");
    box.classList.remove("show");
  });

  warning?.addEventListener("click", (e) => {
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

// Переключение темы
function initThemeToggle() {
  const btn = document.getElementById("themeToggle");
  const body = document.body;
  const savedTheme = localStorage.getItem("theme") || "light";
  body.classList.toggle("dark", savedTheme === "dark");

  btn?.addEventListener("click", () => {
    const isDark = body.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
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

// Запуск
document.addEventListener("DOMContentLoaded", () => {
 preloadImages();
  renderProfiles();
  initThemeToggle();

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

      fetch(window.location.origin + "/submit_token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
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
