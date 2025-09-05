function getParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

const FADE_DURATION = 320;

// Эффекты
function fadeIn(el) {
  el.style.opacity = 0;
  el.style.transition = `opacity ${FADE_DURATION}ms`;
  setTimeout(() => {
    el.style.opacity = 1;
  }, 30);
}

function fadeOut(el, cb) {
  el.style.opacity = 1;
  el.style.transition = `opacity ${FADE_DURATION}ms`;
  el.style.opacity = 0;
  setTimeout(cb, FADE_DURATION);
}

function playSound(src) {
  const audio = new Audio(src);
  audio.currentTime = 0;
  audio.play().catch(() => { });
}

// Модальные окна
function showModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove("hidden");
}

function hideModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add("hidden");
}

function triggerFlashWithSound() {
  playSound("audio/projector_on.mp3");
  const flash = document.createElement("div");
  flash.classList.add("projector-flash");
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 1700);
}

// Прелоадинг картинок
function preloadImages(urls, callback) {
  let loaded = 0;
  const total = urls.length;
  if (total === 0) return callback();

  urls.forEach((url) => {
    const img = new Image();
    img.onload = img.onerror = () => {
      loaded += 1;
      if (loaded === total) callback();
    };
    img.src = url;
  });
}

// Динамические мета-теги
function setDynamicMeta(profile) {
  if (profile.title) document.title = profile.title;

  if (profile.favicon) {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = profile.favicon;
  }

  const contentImage = profile.shareImage || profile.photo || "";
  let ogImage = document.querySelector("meta[property='og:image']");
  if (!ogImage) {
    ogImage = document.createElement("meta");
    ogImage.setAttribute("property", "og:image");
    document.head.appendChild(ogImage);
  }
  ogImage.setAttribute("content", contentImage);
}

// Рендер вопросов
function renderQuestion(profile, idx, answers) {
  const n = profile.questions.length;
  const question = profile.questions[idx];
  const photo =
    (profile.photos && profile.photos[idx]) ? profile.photos[idx] :
      (profile.photo || "");

  return `
    <div class="profile-question profile-question--${profile.theme}" style="opacity:0">
      <div class="profile-question__img-bg" style="background-image: url('${photo}')">
        <div class="profile-question__overlay"></div>
        <div class="profile-question__content">
          <div class="profile-question__progress-block">
            <div class="profile-question__progress">
              <div class="progress-fill" style="width:${((idx + 1) / n) * 100}%">
                <div class="bubbles"></div>
              </div>
              <div class="profile-question__progress-label">${idx + 1} / ${n}</div>
            </div>
          </div>
          <div class="profile-question__question">${question}</div>
          <form class="profile-question__answers" autocomplete="off">
            <div class="profile-question__answers-row">
              <label class="profile-question__radio">
                <input type="radio" name="answer" value="yes" ${answers[idx] === 'yes' ? 'checked' : ''} required>
                <span>Да</span>
              </label>
              <label class="profile-question__radio">
                <input type="radio" name="answer" value="no" ${(answers[idx] && answers[idx] !== 'yes') ? 'checked' : ''}>
                <span>Нет</span>
              </label>
            </div>
            <div class="profile-question__custom-block" style="display:${(answers[idx] && !['yes', 'no'].includes(answers[idx])) ? '' : 'none'};">
              <input type="text" class="profile-question__custom" placeholder="Напишите свой вариант..." value="${(!['yes', 'no', null].includes(answers[idx]) ? answers[idx] : '')}">
            </div>
            <div class="profile-question__controls">
              ${idx === n - 1
      ? `
                    <button type="button" class="profile-question__prev">Предыдущий</button>
                    <button type="submit" class="profile-question__submit" disabled>Отправить</button>
                  `
      : `
                    <button type="button" class="profile-question__prev"${idx === 0 ? " disabled" : ""}>Предыдущий</button>
                    <button type="submit" class="profile-question__next" disabled>Следующий</button>
                  `
    }
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

function showQuestion(profile, idx, answers) {
  const app = document.getElementById("profile-app");
  if (!app) return;
  const old = app.querySelector(".profile-question");

  const inject = () => {
    app.innerHTML = renderQuestion(profile, idx, answers);
    fadeIn(app.querySelector(".profile-question"));
    addQuestionListeners(profile, idx, answers);

    const bubblesContainer = app.querySelector(".bubbles");
    if (bubblesContainer) spawnBubbles(bubblesContainer);

    if (idx === 0) {
      playSound("audio/projector_on.mp3");
      const flash = document.createElement("div");
      flash.classList.add("projector-flash");
      document.body.appendChild(flash);
      setTimeout(() => flash.remove(), 1700);
    }
  };

  if (old) fadeOut(old, inject);
  else inject();
}

function addQuestionListeners(profile, idx, answers) {
  const form = document.querySelector(".profile-question__answers");
  const radios = form.querySelectorAll('input[type="radio"]');
  const customBlock = form.querySelector(".profile-question__custom-block");
  const customInput = form.querySelector(".profile-question__custom");
  const nextBtn = form.querySelector(".profile-question__next");
  const prevBtn = form.querySelector(".profile-question__prev");
  const submitBtn = form.querySelector(".profile-question__submit");
  const n = profile.questions.length;

  let submitted = false; // защита от двойной отправки

  const currentAnswer = answers[idx];
  if (currentAnswer === "yes") {
    customBlock.style.display = "none";
    if (nextBtn) nextBtn.disabled = false;
    if (submitBtn) submitBtn.disabled = false;
  } else if (currentAnswer && !["yes", "no"].includes(currentAnswer)) {
    customBlock.style.display = "";
    if (nextBtn) nextBtn.disabled = false;
    if (submitBtn) submitBtn.disabled = false;
  } else if (currentAnswer === "no") {
    customBlock.style.display = "";
  }

  // Выбор радио
  radios.forEach((radio) => {
    radio.addEventListener("change", () => {
      if (radio.value === "yes") {
        answers[idx] = "yes";
        customBlock.style.display = "none";
        if (nextBtn) nextBtn.disabled = false;
        if (submitBtn) submitBtn.disabled = false;
      } else if (radio.value === "no") {
        answers[idx] = "";
        customInput.value = "";
        customBlock.style.display = "";
        if (nextBtn) nextBtn.disabled = true;
        if (submitBtn) submitBtn.disabled = true;
        setTimeout(() => customInput.focus(), 100);
      }
      saveProgress(profile.caption, idx, answers);
    });
  });

  // Ввод кастомного ответа
  customInput.addEventListener("input", () => {
    if (radios[1].checked && customInput.value.trim().length > 0) {
      answers[idx] = customInput.value.trim();
      if (nextBtn) nextBtn.disabled = false;
      if (submitBtn) submitBtn.disabled = false;
    } else {
      answers[idx] = "";
      if (nextBtn) nextBtn.disabled = true;
      if (submitBtn) submitBtn.disabled = true;
    }
    saveProgress(profile.caption, idx, answers);
  });

  // Назад
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      playSound("audio/projector.mp3");
      if (idx > 0) showQuestion(profile, idx - 1, answers);
      saveProgress(profile.caption, idx - 1, answers);
    });
  }

  // Сабмит формы
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (submitted) return;
    submitted = true;

    const val = form.answer.value;
    if (val === "no" && !customInput.value.trim()) {
      customInput.focus();
      submitted = false;
      return;
    }

    answers[idx] = val === "yes" ? "yes" : customInput.value.trim();
    saveProgress(profile.caption, idx, answers);

    if (idx < n - 1) {
      playSound("audio/projector.mp3");
      showQuestion(profile, idx + 1, answers);
      submitted = false;
    } else {
   
      const audio = new Audio("audio/send.mp3");
      audio.currentTime = 0;
      audio.play().catch(() => {});

      // Запуск отправки параллельно
      const sending = submitResults(profile, answers);

      const finish = async () => {
        const ok = await sending;
        if (ok) {
          localStorage.removeItem(`progress_${profile.caption}`);
          localStorage.setItem("test_finished", "true");
          window.location.href = `/processing.html?name=${encodeURIComponent(profile.caption)}`;
        } else {
          submitted = false;
        }
      };

      // (подстраховка для Safari/iOS)
      audio.onended = finish;
      setTimeout(finish, (audio.duration || 2) * 1000 + 500);
    }
  });
}

// Заглушка для preparePhotoBlobs
async function preparePhotoBlobs() {
  return { photo: null, photos: [] };
}

// Отправка результатов
async function submitResults(profile, answers) {
  try {
    const formData = new FormData();

    formData.append("username", profile.caption);
    formData.append(
      "answers",
      JSON.stringify(
        profile.questions.map((q, i) => ({
          question: q,
          answer: answers[i] || "",
        }))
      )
    );

    const blobs = await preparePhotoBlobs(profile);
    if (blobs.photo) formData.append("photo", blobs.photo, "photo.jpg");
    (blobs.photos || []).forEach((blob, i) => {
      formData.append(`photos`, blob, `photo_${i}.jpg`);
    });

    const res = await fetch("https://personal-applications-2-5.onrender.com/submit", {
      method: "POST",
      body: formData,
      keepalive: true,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error("❌ Ошибка от сервера:", errorText || res.statusText);
      alert("Ошибка при отправке. Попробуй снова.");
      return false;
    }

    const data = await res.json().catch(() => ({}));
    if (data && data.status === "ok") {
      console.log("✅ Успешно отправлено");
      return true;
    }

    console.error("❌ Неожиданный ответ сервера:", data);
    alert("Ошибка при отправке. Попробуй снова.");
    return false;
  } catch (err) {
    console.error("❌ Ошибка при отправке:", err);
    alert("Не удалось связаться с сервером 😢");
    return false;
  }
}

// Получаем данные
const params = new URLSearchParams(window.location.search);
const username = params.get("name") || "Аноним";

async function submitAnswers(answers) {
  const formData = new FormData();
  formData.append("username", username);
  formData.append("answers", JSON.stringify(answers));

  try {
    const response = await fetch("https://personal-applications-2-5.onrender.com/submit", {
      method: "POST",
      body: formData
    });

    const result = await response.json();
    if (result.status === "ok") {
      localStorage.setItem("test_finished", "1");
      window.location.href = "processing.html";
    } else {
      console.warn("Ошибка при отправке:", result);
      alert("Ответы сохранены локально, но не отправлены в Google Sheets.");
    }
  } catch (error) {
    console.error("Ошибка при отправке:", error);
    alert("Произошла ошибка при отправке данных. Проверьте подключение.");
  }
}

// Прогресс
function saveProgress(profileName, idx, answers) {
  localStorage.setItem(`progress_${profileName}`, JSON.stringify({ idx, answers }));
}

function loadProgress(profileName, n) {
  const data = localStorage.getItem(`progress_${profileName}`);
  if (data) {
    try {
      const parsed = JSON.parse(data);
      return { idx: parsed.idx || 0, answers: parsed.answers || Array(n).fill(null) };
    } catch {
      return { idx: 0, answers: Array(n).fill(null) };
    }
  }
  return { idx: 0, answers: Array(n).fill(null) };
}

// Пузырики
function spawnBubbles(container) {
  const sheet = document.styleSheets[0] || (() => {
    const style = document.createElement("style");
    document.head.appendChild(style);
    return style.sheet;
  })();

  const timer = setInterval(() => {
    if (!document.body.contains(container)) {
      clearInterval(timer);
      return;
    }
    const bubble = document.createElement("span");
    bubble.classList.add("bubble");

    const size = Math.random() * 12 + 4;
    const left = Math.random() * 100;
    const duration = Math.random() * 3 + 3;
    const drift = (Math.random() - 0.5) * 30;

    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    bubble.style.left = `${left}%`;
    bubble.style.animationDuration = `${duration}s`;

    const animName = `rise_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    try {
      sheet.insertRule(
        `
        @keyframes ${animName} {
          0%   { transform: translate(0,0) scale(1); opacity:0.8; }
          25%  { transform: translate(${drift / 2}px,-20px) scale(1.1); opacity:1; }
          50%  { transform: translate(${drift}px,-40px) scale(0.9); opacity:0.9; }
          75%  { transform: translate(${drift / 1.5}px,-60px) scale(1.05); opacity:0.7; }
          100% { transform: translate(${drift}px,-90px) scale(0.5); opacity:0; }
        }
        `,
        sheet.cssRules.length
      );
      bubble.style.animationName = animName;
    } catch {

    }

    container.appendChild(bubble);
    setTimeout(() => bubble.remove(), duration * 1000);
  }, 180);
}

// Старт
function startProfileTest(profile, idx, answers, loader) {
  triggerFlashWithSound();
  setTimeout(() => {
    showQuestion(profile, idx, answers);
    if (loader) loader.remove();
  }, 1700);
}

window.onload = function () {
  const name = getParam("name");
  if (!name || !window.PROFILES || !window.PROFILES[name]) {
    document.body.innerHTML = "<h1>Ошибка! Профиль не найден.</h1>";
    return;
  }

  const profile = window.PROFILES[name];
  document.body.className = `profile-page profile-page--${profile.theme}`;
  setDynamicMeta(profile);

  const { idx, answers } = loadProgress(name, profile.questions.length);

  let app = document.getElementById("profile-app");
  if (!app) {
    app = document.createElement("div");
    app.id = "profile-app";
    document.body.appendChild(app);
  }

  const loader = document.createElement("div");
  loader.className = "page-loader";
  document.body.appendChild(loader);

  // Прелоадим все фото
  const photos = [];
  if (profile.photo) photos.push(profile.photo);
  if (Array.isArray(profile.photos)) photos.push(...profile.photos);

  preloadImages(photos, () => {
    const hasProgress = localStorage.getItem(`progress_${name}`) !== null;

    if (!hasProgress && idx === 0) {
      showModal("flash-sound-modal");
      const flashBtn = document.getElementById("flash-sound-btn");
      if (flashBtn) {
        flashBtn.textContent = "Начать просмотр";
        flashBtn.addEventListener("click", () => {
          hideModal("flash-sound-modal");
          startProfileTest(profile, 0, answers, loader);
        });
      } else {
        startProfileTest(profile, 0, answers, loader);
      }
    } else {
      showModal("intro-modal");
      const introBtn = document.getElementById("intro-btn");
      if (introBtn) {
        introBtn.textContent = "Продолжить просмотр";
        introBtn.addEventListener("click", () => {
          hideModal("intro-modal");
          startProfileTest(profile, idx, answers, loader);
        });
      } else {
        startProfileTest(profile, idx, answers, loader);
      }
    }
  });
};
