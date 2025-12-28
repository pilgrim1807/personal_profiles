/* =======================
   ДАННЫЕ ПРОФИЛЕЙ
======================= */
let PROFILES = [
  { name: "Сергей", className: "sergey" },
  { name: "Андрей", className: "andrey" },
  { name: "Соня", className: "sonya" },
  { name: "Валера", className: "valera" },
  { name: "Воваха", className: "vovaha" }
];

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

const PROFILES_BY_SLUG = Object.fromEntries(PROFILES.map(p => [p.slug, p]));

/* =======================
   ПРЕДЗАГРУЗКА ИЗОБРАЖЕНИЙ
======================= */
function preloadAllImages() {
  const urls = PROFILES.flatMap(p => [p.jpg, p.webp, p.jpgDark, p.webpDark]);
  return Promise.all(
    urls.map(src => new Promise(res => {
      const img = new Image();
      img.onload = img.onerror = res;
      img.src = src;
    }))
  );
}

/* =======================
   РЕНДЕР ПРОФИЛЕЙ
======================= */
function renderProfiles() {
  const list = document.getElementById("profiles-list");
  if (!list) return;

  const isDark = document.body.classList.contains("dark");

  list.innerHTML = PROFILES.map(p => `
    <button class="profiles-list__item profile-card--avatar ${p.className}"
            type="button"
            data-slug="${p.slug}">
      <div class="polaroid">
        <picture>
          <source srcset="${isDark ? p.webpDark : p.webp}" type="image/webp">
          <img src="${isDark ? p.jpgDark : p.jpg}"
               alt="${p.name}"
               width="240"
               height="320"
               loading="eager">
        </picture>
        <div class="profile-card__caption">${p.name}</div>
      </div>
    </button>
  `).join("");
}

/* =======================
   ЗВУКИ
======================= */
let flashSound, ejectSound, bubbleSound;

function preloadSounds() {
  flashSound = new Audio("/static/audio/flash.mp3");
  ejectSound = new Audio("/static/audio/photo-out.mp3");
  bubbleSound = new Audio("/static/audio/bubble.mp3");

  [flashSound, ejectSound, bubbleSound].forEach(s => {
    s.preload = "auto";
    s.load();
  });
}

/* =======================
   ТЕМА
======================= */
function initThemeToggle() {
  const btn = document.getElementById("themeToggle");
  const body = document.body;

  const saved = localStorage.getItem("theme");
  body.classList.toggle(
    "dark",
    saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  btn?.addEventListener("click", () => {
    const isDark = body.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
    renderProfiles();
  });
}

/* =======================
   МОДАЛКА ПРОФИЛЯ
======================= */
function initSoundWarning() {
  const warning = document.getElementById("sound-warning");
  if (!warning) return;

  const box = warning.querySelector(".sound-warning__box");
  const flash = document.querySelector(".flash-overlay");

  document.querySelectorAll(".profiles-list__item").forEach(btn => {
    btn.addEventListener("click", e => {
      e.preventDefault();
      warning.classList.add("active");

      flash.classList.add("active");
      flashSound.currentTime = 0;
      flashSound.play().catch(() => {});
      setTimeout(() => flash.classList.remove("active"), 800);

      setTimeout(() => {
        ejectSound.currentTime = 0;
        ejectSound.play().catch(() => {});
        box.classList.add("show");
      }, 600);
    });
  });

  document.getElementById("sound-close")?.addEventListener("click", () => {
    warning.classList.remove("active");
    box.classList.remove("show");
  });
}

/* =======================
   ВСПОМОГАТЕЛЬНОЕ
======================= */
function createSplashes(el) {
  const r = el.getBoundingClientRect();
  for (let i = 0; i < 25; i++) {
    const d = document.createElement("div");
    d.className = "splash";
    d.style.left = `${r.left + r.width / 2}px`;
    d.style.top = `${r.top + r.height / 2}px`;
    document.body.appendChild(d);
    d.addEventListener("animationend", () => d.remove());
  }
}

/* =======================
   START OVERLAY + OPENING
======================= */
window.addEventListener("DOMContentLoaded", () => {
  const overlay = document.getElementById("start-overlay");
  const openingSound = new Audio("/static/audio/opening.mp3");
  openingSound.preload = "auto";
  openingSound.volume = 0.8;

  if (overlay) {
    overlay.addEventListener("click", () => {
      openingSound.currentTime = 0;
openingSound.volume = 0;
openingSound.play().catch(() => {});

let v = 0;
const fade = setInterval(() => {
  v += 0.05;
  if (v >= 0.8) {
    openingSound.volume = 0.8;
    clearInterval(fade);
  } else {
    openingSound.volume = v;
  }
}, 80);

      openingSound.play().catch(() => {});
      overlay.classList.add("fade-out");
      setTimeout(() => overlay.remove(), 500);
    });
  }

  /* ИНИЦИАЛИЗАЦИЯ СТРАНИЦЫ */
  initThemeToggle();
  preloadSounds();
  renderProfiles();
  initSoundWarning();
  preloadAllImages();

  /* ПУЗЫРЬ */
  const btn = document.getElementById("bubble-btn");
  const wrapper = document.getElementById("token-wrapper");

  if (btn && wrapper) {
    wrapper.style.display = "none";

    btn.addEventListener("click", () => {
      bubbleSound.currentTime = 0;
      bubbleSound.play().catch(() => {});
      btn.classList.add("pop");
      createSplashes(btn);

      btn.addEventListener("animationend", () => {
        btn.classList.remove("pop");
        btn.classList.add("icon-only");
        wrapper.style.display = "block";
      }, { once: true });
    });
  }
});

