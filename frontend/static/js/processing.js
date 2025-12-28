// Глобальная переменная для переиспользуемого звука
let bubbleSound = null;
let endingSound = null;

// Предзагрузка звука
function preloadBubbleSound() {
  bubbleSound = new Audio("/static/audio/bubble.mp3");
  bubbleSound.preload = "auto";
  bubbleSound.load();
}

function preloadEndingSound() {
  endingSound = new Audio("/static/audio/ending.mp3");
  endingSound.preload = "auto";
  endingSound.load();
}


document.addEventListener("DOMContentLoaded", () => {
  // Предзагружаем звук один раз
  preloadBubbleSound();
  preloadEndingSound();

  // Проверка: завершён ли тест
  if (!localStorage.getItem("test_finished")) {
    window.location.href = "index.html";
    return;
  }

  // Получаем основные DOM-элементы
  const btn = document.getElementById("bubble-btn");
  const tokenInput = document.getElementById("token-input");
  const tokenWrapper = document.getElementById("token-wrapper");

  if (!btn || !tokenInput || !tokenWrapper) return;

  tokenWrapper.style.display = "none";
  btn.style.display = "none";

  // Показываем пузырь-модалку
  showBubbleModal();



  // Обработчик кнопки
  btn.addEventListener("click", () => {
    const token = tokenInput?.value?.trim();

    if (bubbleSound) {
      bubbleSound.currentTime = 0;
      bubbleSound.play().catch(() => { });
    }

    btn.classList.add("pop");
    createSplashes(btn);

    btn.addEventListener(
      "animationend",
      () => {
        btn.classList.remove("pop");

        if (token && getToken() === token) {
          downloadCSV();
          return;
        }

        btn.classList.add("icon-only");
        tokenWrapper.style.display = "block";
        tokenInput.focus();
      },
      { once: true }
    );
  });

  // Обработчик ввода токена
  tokenInput.addEventListener("keypress", (e) => {
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
          downloadCSV();
        }, 1600);
      })
      .catch(() => {
        showMessageInsteadOfInput("⛔ Неверный токен! Попробуй снова.", false);
      });
  });
});
/* ---------- МОДАЛЬНОЕ ОКНО - ПУЗЫРЬ ---------- */
function showBubbleModal() {
  let finished = false;
  const existingModal = document.getElementById("bubble-modal");
  if (existingModal) existingModal.remove();

  const bubbleMsg = createModalBubble();

  bubbleMsg.addEventListener("click", () => {
    if (finished) return;
    finished = true;

    bubbleMsg.style.pointerEvents = "none";

    const modal = document.getElementById("bubble-modal");

    bubbleMsg.classList.add("pop");
    createSplashes(bubbleMsg);

    playBubble();

    function playBubble() {
      if (!bubbleSound) return playEnding();

      bubbleSound.currentTime = 0;
      bubbleSound.play()
        .then(() => {
          bubbleSound.addEventListener("ended", playEnding, { once: true });
        })
        .catch(playEnding);
    }

    function playEnding() {
      if (!endingSound) return goNext();

      endingSound.currentTime = 0;
      endingSound.play()
        .then(() => {
          endingSound.addEventListener("ended", goNext, { once: true });
        })
        .catch(goNext);
    }


    function goNext() {
      if (modal) {
        modal.classList.add("fade-out");
        setTimeout(() => {
          modal.remove();

          const main = document.querySelector("main");
          if (main) main.style.opacity = "1";

        }, 300);
      }
    }

  });

}

/* ---------- СКАЧИВАНИЕ CSV ---------- */
function downloadCSV() {
  const token = getToken();
  if (!token) {
    showTokenMessage("⛔ Токен не найден. Повторите ввод.", false);
    return;
  }

  const loader = showLoader();

  fetch("/answers.csv", {
    headers: {
      Authorization: "Bearer " + token
    }
  })
    .then((res) => {
      if (res.status === 403) throw new Error("Неверный токен");
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

      sessionStorage.removeItem("token_validated");
    })
    .catch((err) => {
      showTokenMessage("⛔ Ошибка при скачивании: " + err.message, false);
    })
    .finally(() => {
      hideLoader(loader);
    });
}

/* ---------- ХРАНЕНИЕ ТОКЕНА ---------- */
function saveToken(token) {
  sessionStorage.setItem("token_validated", token);
}
function getToken() {
  return sessionStorage.getItem("token_validated");
}

/* ---------- ЛОАДЕР ---------- */
function showLoader() {
  const loader = document.createElement("div");
  loader.className = "loader-overlay";
  loader.innerHTML = `<div class="spinner"></div>`;
  document.body.appendChild(loader);
  return loader;
}
function hideLoader(loader) {
  if (loader) loader.remove();
}

/* ---------- СООБЩЕНИЕ ВМЕСТО ИНПУТА ---------- */
function showMessageInsteadOfInput(msg, success = false) {
  const wrapper = document.getElementById("token-wrapper");
  const input = document.getElementById("token-input");

  let note = wrapper.querySelector(".token-message");
  if (!note) {
    note = document.createElement("div");
    note.className = "token-message";
    wrapper.appendChild(note);
  }

  note.classList.remove("success", "error");
  note.classList.add(success ? "success" : "error");
  note.textContent = msg;

  input.style.opacity = "0";
  note.style.opacity = "1";
  note.style.display = "flex";

  setTimeout(() => {
    note.style.display = "none";
    input.value = "";
    input.style.opacity = "1";
    growBubbleBack();
  }, 1500);
}

/* ---------- ВОЗВРАТ ПУЗЫРЯ ---------- */
function growBubbleBack() {
  const wrapper = document.getElementById("token-wrapper");
  const btn = document.getElementById("bubble-btn");

  wrapper.style.display = "none";

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

/* ---------- КАСТОМНЫЕ СООБЩЕНИЯ ---------- */
function showTokenMessage(msg, success = false) {
  const wrapper = document.getElementById("token-wrapper");
  let note = wrapper.querySelector(".token-message");

  if (!note) {
    note = document.createElement("div");
    note.className = "token-message";
    wrapper.appendChild(note);
  }

  note.classList.remove("success", "error");
  note.classList.add(success ? "success" : "error");
  note.textContent = msg;

  clearTimeout(note._timeout);
  note._timeout = setTimeout(() => {
    note.remove();
  }, 4000);
}

/* ---------- СПЛЭШИ ---------- */
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
function createModalBubble() {
  const modal = document.createElement("div");
  modal.id = "bubble-modal";
  modal.className = "bubble-modal";

  const msg = document.createElement("div");
  msg.className = "bubble-message";

  msg.innerHTML = `
    <svg viewBox="0 0 800 600" class="bubble-text" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" gradientTransform="rotate(45)">
          <stop offset="0%" stop-color="#0a0833"/>
          <stop offset="50%" stop-color="#110e54ff"/>
          <stop offset="100%" stop-color="#161169ff"/>
        </linearGradient>
        <path id="arcTop" d="M 80 180 Q 400 120 720 180" />
        <path id="arcMiddle" d="M 80 250 Q 400 200 720 250" />
        <path id="arcBottom" d="M 80 330 Q 400 280 720 330" />
        <path id="arcHint" d="M 80 410 Q 400 360 720 410" />
      </defs>
      <text font-size="46" font-weight="700" text-anchor="middle" class="autoscale depth-sync" data-max="56">
        <textPath href="#arcTop" startOffset="50%">
          <tspan class="emoji">✨</tspan>
          <tspan class="gradient-text">Тест завершён</tspan>
          <tspan class="emoji">✨</tspan>
        </textPath>
      </text>
      <text font-size="38" text-anchor="middle" dy="1.6em" class="autoscale depth-sync" data-max="46">
        <textPath href="#arcMiddle" startOffset="50%">
          <tspan class="gradient-text">Ты молодец!</tspan>
        </textPath>
      </text>
      <text font-size="30" text-anchor="middle" dy="3.0em" class="autoscale depth-sync" data-max="38">
        <textPath href="#arcBottom" startOffset="50%">
          <tspan class="gradient-text">Лопни пузырь, чтобы продолжить</tspan>
        </textPath>
      </text>
      <text font-size="28" text-anchor="middle" dy="4.6em" class="autoscale depth-sync" data-max="36">
        <textPath href="#arcHint" startOffset="50%">
          <tspan class="emoji">💥</tspan>
          <tspan class="gradient-text">Другие пузыри тоже можно лопать</tspan>
          <tspan class="emoji">💥</tspan>
        </textPath>
      </text>
    </svg>
  `;

  modal.appendChild(msg);
  document.body.appendChild(modal);

  setTimeout(() => {
    const svg = msg.querySelector("svg");
    svg.querySelectorAll("text.autoscale").forEach((node) => {
      const maxW = svg.viewBox.baseVal.width * 0.85;
      let fs = parseFloat(node.getAttribute("font-size"));
      const maxFs = parseFloat(node.dataset.max) || fs;
      let bb = node.getBBox();

      if (bb.width > maxW) {
        node.setAttribute("font-size", fs * (maxW / bb.width));
      } else {
        while (bb.width < maxW * 0.9 && fs < maxFs) {
          fs++;
          node.setAttribute("font-size", fs);
          bb = node.getBBox();
        }
      }
    });
  }, 50);

  return msg;
}


