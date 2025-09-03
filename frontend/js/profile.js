function getParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

const FADE_DURATION = 320;

// Эффекты
function fadeIn(el) {
  el.style.opacity = 0;
  el.style.transition = `opacity ${FADE_DURATION}ms`;
  setTimeout(() => { el.style.opacity = 1; }, 30);
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
  audio.play().catch(() => {});
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
      loaded++;
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
  const ogImage = document.querySelector("meta[property='og:image']");
  if (ogImage) {
    ogImage.setAttribute("content", profile.shareImage || profile.photo);
  } else {
    const meta = document.createElement("meta");
    meta.setAttribute("property", "og:image");
    meta.setAttribute("content", profile.shareImage || profile.photo);
    document.head.appendChild(meta);
  }
}

// Рендер вопросов
function renderQuestion(profile, idx, answers) {
  const n = profile.questions.length;
  const question = profile.questions[idx];
  const photo = (profile.photos && profile.photos[idx]) || profile.photo || "";

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
                <input type="radio" name="answer" value="no" ${answers[idx] && answers[idx] !== 'yes' ? 'checked' : ''}>
                <span>Нет</span>
              </label>
            </div>
            <div class="profile-question__custom-block" style="display:${answers[idx] && !['yes','no'].includes(answers[idx]) ? '' : 'none'};">
              <input type="text" class="profile-question__custom" placeholder="Напишите свой вариант..." value="${(!['yes','no',null].includes(answers[idx]) ? answers[idx] : '')}">
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
                `}
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

function showQuestion(profile, idx, answers) {
  const app = document.getElementById('profile-app');
  if (!app) return;
  const old = app.querySelector('.profile-question');
  const inject = () => {
    app.innerHTML = renderQuestion(profile, idx, answers);
    fadeIn(app.querySelector('.profile-question'));
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
  if (old) fadeOut(old, inject); else inject();
}

function addQuestionListeners(profile, idx, answers) {
  const form = document.querySelector('.profile-question__answers');
  const radios = form.querySelectorAll('input[type="radio"]');
  const customBlock = form.querySelector('.profile-question__custom-block');
  const customInput = form.querySelector('.profile-question__custom');
  const nextBtn = form.querySelector('.profile-question__next');
  const prevBtn = form.querySelector('.profile-question__prev');
  const submitBtn = form.querySelector('.profile-question__submit');
  const n = profile.questions.length;

  if (answers[idx] === 'yes') {
    if (nextBtn) nextBtn.disabled = false;
    if (submitBtn) submitBtn.disabled = false;
    customBlock.style.display = 'none';
  }
  if (answers[idx] === 'no' || (answers[idx] && !['yes','no'].includes(answers[idx]))) {
    customBlock.style.display = '';
    if (answers[idx] && !['yes','no'].includes(answers[idx]) && answers[idx].length > 0) {
      if (nextBtn) nextBtn.disabled = false;
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  radios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.value === 'yes' && radio.checked) {
        customBlock.style.display = 'none';
        if (nextBtn) nextBtn.disabled = false;
        if (submitBtn) submitBtn.disabled = false;
        answers[idx] = 'yes';
      }
      if (radio.value === 'no' && radio.checked) {
        customBlock.style.display = '';
        customInput.value = '';
        if (nextBtn) nextBtn.disabled = true;
        if (submitBtn) submitBtn.disabled = true;
        answers[idx] = '';
        setTimeout(() => customInput.focus(), 120);
      }
      saveProgress(profile.caption, idx, answers);
    });
  });

  customInput.addEventListener('input', () => {
    if (radios[1].checked && customInput.value.trim().length > 0) {
      answers[idx] = customInput.value.trim();
      if (nextBtn) nextBtn.disabled = false;
      if (submitBtn) submitBtn.disabled = false;
    } else {
      if (nextBtn) nextBtn.disabled = true;
      if (submitBtn) submitBtn.disabled = true;
      answers[idx] = '';
    }
    saveProgress(profile.caption, idx, answers);
  });

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      playSound("audio/projector.mp3");
      if (idx > 0) showQuestion(profile, idx - 1, answers);
      saveProgress(profile.caption, idx - 1, answers);
    });
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    let val = form.answer.value;
    if (val === 'no') {
      if (!customInput.value.trim()) {
        customInput.focus();
        return;
      }
      answers[idx] = customInput.value.trim();
    }
    if (val === 'yes') {
      answers[idx] = 'yes';
    }

    if (idx < n - 1) {
      playSound("audio/projector.mp3");
      showQuestion(profile, idx + 1, answers);
      saveProgress(profile.caption, idx + 1, answers);
    } else {
      playSound("audio/send.mp3");
      setTimeout(() => {
        submitResults(profile, answers);
        localStorage.removeItem(`progress_${profile.caption}`);
      }, 1000);
    }
  });
}

// Отправка результатов (с фотографиями)
async function submitResults(profile, answers) {
  const formData = new FormData();

  const answersJSON = JSON.stringify(
    profile.questions.map((q, i) => ({
      question: q,
      answer: answers[i] || ""
    }))
  );

  const photoPrepPromise = preparePhotoBlobs(profile);

  formData.append("username", profile.caption);
  formData.append("answers", answersJSON);

  try {

    const blobs = await photoPrepPromise;

    if (blobs.photo) {
      formData.append("photo", blobs.photo, "photo.jpg");
    }

    blobs.photos.forEach((blob, i) => {
      formData.append(`photos[${i}]`, blob, `photo_${i}.jpg`);
    });

    // Отправка
    const res = await fetch("/submit", {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Ошибка от сервера:", errorText);
      alert("Произошла ошибка при отправке данных. Попробуй снова.");
      return;
    }

    const data = await res.json();

    if (data.status === "ok") {
      localStorage.setItem("test_finished", "true");
      window.location.href = "/processing.html?name=" + encodeURIComponent(profile.caption);
    } else {
      console.error("Ошибка ответа:", data);
      alert("Ошибка при отправке. Попробуй снова.");
    }
  } catch (err) {
    console.error("Ошибка при отправке:", err);
    alert("Не удалось связаться с сервером 😢");
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
      return { idx: parsed.idx, answers: parsed.answers || Array(n).fill(null) };
    } catch {
      return { idx: 0, answers: Array(n).fill(null) };
    }
  }
  return { idx: 0, answers: Array(n).fill(null) };
}

// Пузырики
function spawnBubbles(container) {
  setInterval(() => {
    if (!document.body.contains(container)) return;
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
    const animName = `rise${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const styleSheet = document.styleSheets[0];
    styleSheet.insertRule(`
      @keyframes ${animName} {
        0%   { transform: translate(0,0) scale(1); opacity:0.8; }
        25%  { transform: translate(${drift / 2}px,-20px) scale(1.1); opacity:1; }
        50%  { transform: translate(${drift}px,-40px) scale(0.9); opacity:0.9; }
        75%  { transform: translate(${drift / 1.5}px,-60px) scale(1.05); opacity:0.7; }
        100% { transform: translate(${drift}px,-90px) scale(0.5); opacity:0; }
      }
    `, styleSheet.cssRules.length);
    bubble.style.animationName = animName;
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
  const name = getParam('name');
  if (!name || !PROFILES[name]) {
    document.body.innerHTML = "<h1>Ошибка! Профиль не найден.</h1>";
    return;
  }

  const profile = PROFILES[name];
  document.body.className = `profile-page profile-page--${profile.theme}`;
  setDynamicMeta(profile);

  const { idx, answers } = loadProgress(name, profile.questions.length);

  let app = document.getElementById('profile-app');
  if (!app) {
    app = document.createElement('div');
    app.id = 'profile-app';
    document.body.appendChild(app);
  }

  const loader = document.createElement("div");
  loader.className = "page-loader";
  document.body.appendChild(loader);

  // Прелоадим все фото
  const photos = [];
  if (profile.photo) photos.push(profile.photo);
  if (profile.photos) photos.push(...profile.photos);

  preloadImages(photos, () => {
    const hasProgress = localStorage.getItem(`progress_${name}`) !== null;

    if (!hasProgress && idx === 0) {
      showModal("flash-sound-modal");
      const flashBtn = document.getElementById("flash-sound-btn");
      flashBtn.textContent = "Начать просмотр";
      flashBtn.addEventListener("click", () => {
        hideModal("flash-sound-modal");
        startProfileTest(profile, 0, answers, loader);
      });
    } else {
      showModal("intro-modal");
      const introBtn = document.getElementById("intro-btn");
      introBtn.textContent = "Продолжить просмотр";
      introBtn.addEventListener("click", () => {
        hideModal("intro-modal");
        startProfileTest(profile, idx, answers, loader);
      });
    }
  });
};

