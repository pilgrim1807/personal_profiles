// Данные профилей с webp + jpg
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

// Модальное окно (звук)
function initSoundWarning() {
  const warning = document.getElementById("sound-warning");
  const continueBtn = document.getElementById("sound-continue");
  let targetName = null;

  document.querySelectorAll(".profiles-list__item").forEach((button) => {
    const name = button.querySelector(".profile-card__caption")?.textContent?.trim();
    if (name) {
      button.addEventListener("click", (e) => {
        e.preventDefault();
        targetName = name;
        warning.classList.add("active");
      });
    }
  });

  continueBtn?.addEventListener("click", () => {
    warning.classList.remove("active");
    if (targetName) {
      window.location.href = `profile.html?name=${encodeURIComponent(targetName)}`;
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
