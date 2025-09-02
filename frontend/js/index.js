// Данные профилей
const PROFILES = [
  { name: "Сергей", photo: "assets/names/sergey.jpg", className: "sergey" },
  { name: "Андрей", photo: "assets/names/andrey.jpg", className: "andrey" },
  { name: "Соня",   photo: "assets/names/sonya.jpg",  className: "sonya" },
  { name: "Валера", photo: "assets/names/valera.jpg", className: "valera" },
  { name: "Воваха", photo: "assets/names/vovaha.jpg", className: "vovaha" }
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
        <img class="profile-card__photo"
             src="${profile.photo}"
             alt="${profile.name}"
             loading="eager"
             fetchpriority="high">
        <div class="profile-card__caption">${profile.name}</div>
      </div>
    </button>
  `).join("");

  initSoundWarning();
}

// Модальное окно, связанное со звуком
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
