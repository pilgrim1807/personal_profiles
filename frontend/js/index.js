// Данные профилей
const PROFILES = [
  { name: "Сергей", jpg: "assets/names/sergey.jpg", webp: "assets/names/sergey.webp", className: "sergey" },
  { name: "Андрей", jpg: "assets/names/andrey.jpg", webp: "assets/names/andrey.webp", className: "andrey" },
  { name: "Соня",   jpg: "assets/names/sonya.jpg",  webp: "assets/names/sonya.webp",  className: "sonya" },
  { name: "Валера", jpg: "assets/names/valera.jpg", webp: "assets/names/valera.webp", className: "valera" },
  { name: "Воваха", jpg: "assets/names/vovaha.jpg", webp: "assets/names/vovaha.webp", className: "vovaha" }
];

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
               alt="${profile.name}"
               loading="lazy">
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

// Модальное окно

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

      // Активируем фон модалки
      warning.classList.add("active");

      // Вспышка + звук
      flash.classList.add("active");
      flashSound.currentTime = 0;
      flashSound.play().catch(() => {});
      setTimeout(() => flash.classList.remove("active"), 1000);

      // Пауза после вспышки → затем выезд фото
      setTimeout(() => {
        ejectSound.currentTime = 0;
        ejectSound.play().catch(() => {});

        box.classList.add("show");
      }, 800); // пауза 0.8s (можно увеличить/уменьшить)
    });
  });

  // Кнопка "Продолжить"
  continueBtn?.addEventListener("click", () => {
    warning.classList.remove("active");
    box.classList.remove("show");
    if (targetName) {
      window.location.href = `profile.html?name=${encodeURIComponent(targetName)}`;
    }
  });

  // Закрыть по крестику
  closeBtn?.addEventListener("click", () => {
    warning.classList.remove("active");
    box.classList.remove("show");
  });

  // Клик по фону
  warning?.addEventListener("click", (e) => {
    if (e.target === warning) {
      warning.classList.remove("active");
      box.classList.remove("show");
    }
  });

  // ESC
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

// Запуск
document.addEventListener("DOMContentLoaded", () => {
  renderProfiles();
  initThemeToggle();
});
