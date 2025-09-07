document.addEventListener("DOMContentLoaded", () => {
  if (!localStorage.getItem("test_finished")) {
    window.location.href = "index.html";
    return;
  }

  const btn = document.getElementById("bubble-btn");
  const wrapper = document.getElementById("token-wrapper");

  wrapper.style.display = "none";
  btn.classList.remove("icon-only");
  btn.classList.add("bubble-download");
  showBubbleModal();
});

/* ---------- МОДАЛКА ---------- */
function showBubbleModal() {
  document.getElementById("bubble-modal")?.remove();

  const bubbleMsg = createModalBubble();
  const popSound = new Audio("audio/bubble.mp3");

  bubbleMsg.addEventListener("click", () => {
    popSound.currentTime = 0;
    popSound.play();
    bubbleMsg.classList.add("pop");
    createSplashes(bubbleMsg);

    bubbleMsg.addEventListener(
      "animationend",
      () => {
        document.getElementById("bubble-modal")?.remove();
        const btn = document.getElementById("bubble-btn");
        btn.classList.remove("icon-only");
        btn.classList.add("bubble-download", "visible");
      },
      { once: true }
    );
  });
}

/* ---------- КНОПКА-ПУЗЫРЬ ---------- */
document.getElementById("bubble-btn").addEventListener("click", () => {
  const btn = document.getElementById("bubble-btn");
  const popSound = new Audio("audio/bubble.mp3");
  popSound.play();

  btn.classList.add("pop");
  createSplashes(btn);

  btn.addEventListener(
    "animationend",
    () => {
      btn.classList.remove("pop");
      btn.classList.add("icon-only"); // пузырь исчезает, иконка остаётся
      document.getElementById("token-wrapper").style.display = "block";
      document.getElementById("token-input").focus();
    },
    { once: true }
  );
});

/* ---------- ВВОД ТОКЕНА ---------- */
document.getElementById("token-input").addEventListener("keypress", (e) => {
  if (e.key !== "Enter") return;

  const token = e.target.value.trim();
  if (!token) return;

fetch("/submit_token", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ token })
})

    .then((res) => {
      if (!res.ok) throw new Error("invalid");
      return res.json();
    })
    .then(() => {
      showMessageInsteadOfInput("✅ Токен принят. Ответ сохранён.", true);
    })
    .catch(() => {
      showMessageInsteadOfInput("⛔ Неверный токен! Попробуй снова.", false);
    });
});

/* ---------- СООБЩЕНИЕ ВМЕСТО ИНПУТА ---------- */
function showMessageInsteadOfInput(msg, success = false) {
  const wrapper = document.getElementById("token-wrapper");
  const input = document.getElementById("token-input");

  // создаём или находим сообщение
  let note = wrapper.querySelector(".token-message");
  if (!note) {
    note = document.createElement("div");
    note.className = "token-message";
    wrapper.appendChild(note);
  }

  // применяем классы
  note.classList.remove("success", "error");
  note.classList.add(success ? "success" : "error");
  note.textContent = msg;

  // прячем только визуально инпут
  input.style.opacity = "0";
  note.style.opacity = "1";
  note.style.display = "flex";

  // через 1.5 сек → убираем сообщение и возвращаем пузырь
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

  // полностью скрываем всю обёртку
  wrapper.style.display = "none";

  // сброс пузыря к иконке
  btn.classList.remove("bubble-download", "visible");
  btn.classList.add("icon-only");

  // анимация роста пузыря
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

/* ---------- РЕНДЕР МОДАЛКИ ---------- */
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

