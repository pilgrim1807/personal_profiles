document.addEventListener("DOMContentLoaded", function () {
  const finished = localStorage.getItem("test_finished");
  if (!finished) {
    window.location.href = "index.html";
    return;
  }

  const bubbleMessage = createModalBubble();
  const bubbleModal = document.getElementById("bubble-modal");
  const popSound = new Audio("audio/bubble.mp3");

  function closeBubbleModal() {
    popSound.currentTime = 0;
    popSound.play();

    // анимация лопания пузыря
    bubbleMessage.classList.add("pop");

    const rect = bubbleMessage.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // брызги
    setTimeout(() => {
      const splashCount = 25;
      for (let i = 0; i < splashCount; i++) {
        createSplash(centerX, centerY, 200, rect.width);
      }
    }, 100);

    bubbleMessage.addEventListener(
      "animationend",
      () => {
        bubbleModal.remove();
        document.querySelector("main").classList.add("fade-in");
        document.querySelector("footer").classList.add("fade-in");
      },
      { once: true }
    );
  }

  // закрытие пузыря по клику
  bubbleMessage.addEventListener("click", closeBubbleModal);
});

// сброс прогресса
function resetProgress() {
  localStorage.removeItem("test_finished");
}

function createSplash(x, y, hue, bubbleSize) {
  const splash = document.createElement("div");
  splash.classList.add("splash");

  const scaleFactor = bubbleSize / 120;
  const particleSize = Math.random() * 6 + 3;
  splash.style.width = splash.style.height = particleSize * scaleFactor + "px";

  splash.style.position = "fixed";
  splash.style.left = `${x - particleSize / 2}px`;
  splash.style.top = `${y - particleSize / 2}px`;

  const angle = Math.random() * Math.PI * 2;
  const distance = (Math.random() * 60 + 40) * scaleFactor;
  splash.style.setProperty("--dx", Math.cos(angle) * distance + "px");
  splash.style.setProperty("--dy", Math.sin(angle) * distance + "px");
  splash.style.setProperty("--hue", hue);

  document.body.appendChild(splash);
  splash.addEventListener("animationend", () => splash.remove());
}

function createModalBubble() {
  const bubbleModal = document.createElement("div");
  bubbleModal.id = "bubble-modal";
  bubbleModal.className = "bubble-modal";

  const bubbleMessage = document.createElement("div");
  bubbleMessage.className = "bubble-message";

  bubbleMessage.innerHTML = `
    <svg viewBox="0 0 800 600" class="bubble-text" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- дуги ещё шире -->
        <path id="arcTop" d="M 80 180 Q 400 120 720 180" />
        <path id="arcMiddle" d="M 80 250 Q 400 200 720 250" />
        <path id="arcBottom" d="M 80 330 Q 400 280 720 330" />
        <path id="arcHint" d="M 80 410 Q 400 360 720 410" />

        <!-- градиент -->
        <linearGradient id="grad" gradientTransform="rotate(45)">
       <stop offset="0%" stop-color="#0a0833"/>
          <stop offset="50%" stop-color="#110e54ff"/>
          <stop offset="100%" stop-color="#161169ff"/>
        </linearGradient>
      </defs>

      <!-- заголовок -->
      <text font-size="46" font-weight="700" text-anchor="middle" class="autoscale depth-sync" data-max="56">
        <textPath href="#arcTop" startOffset="50%">
          <tspan class="emoji">✨</tspan>
          <tspan class="gradient-text">Тест завершён</tspan>
          <tspan class="emoji">✨</tspan>
        </textPath>
      </text>

      <!-- подзаголовок -->
      <text font-size="38" text-anchor="middle" dy="1.6em" class="autoscale depth-sync" data-max="46">
        <textPath href="#arcMiddle" startOffset="50%">
          <tspan class="gradient-text">Ты молодец!</tspan>
        </textPath>
      </text>

      <!-- подсказка 1 -->
      <text font-size="30" text-anchor="middle" dy="3.0em" class="autoscale depth-sync" data-max="38">
        <textPath href="#arcBottom" startOffset="50%">
          <tspan class="emoji" dx="-10">💜</tspan>
          <tspan class="gradient-text"> Лопни пузырь, чтобы продолжить </tspan>
          <tspan class="emoji" dx="10">💜</tspan>
        </textPath>
      </text>

      <!-- подсказка 2 -->
      <text font-size="28" text-anchor="middle" dy="4.6em" class="autoscale depth-sync" data-max="36">
        <textPath href="#arcHint" startOffset="50%">
          <tspan class="emoji">💥</tspan>
          <tspan class="gradient-text"> Другие пузыри тоже можно лопать </tspan>
          <tspan class="emoji">💥</tspan>
        </textPath>
      </text>
    </svg>
  `;

  bubbleModal.appendChild(bubbleMessage);
  document.body.appendChild(bubbleModal);

  // Авто-масштабирование
  setTimeout(() => {
    const svg = bubbleMessage.querySelector("svg");
    const textNodes = svg.querySelectorAll("text.autoscale");

    textNodes.forEach(node => {
      const maxWidth = svg.viewBox.baseVal.width * 0.85;
      let fontSize = parseFloat(node.getAttribute("font-size"));
      const maxFontSize = parseFloat(node.dataset.max) || fontSize;

      let bbox = node.getBBox();

      if (bbox.width > maxWidth) {
        const scale = maxWidth / bbox.width;
        node.setAttribute("font-size", fontSize * scale);
      } else {

        while (bbox.width < maxWidth * 0.9 && fontSize < maxFontSize) {
          fontSize += 1;
          node.setAttribute("font-size", fontSize);
          bbox = node.getBBox();
        }
      }
    });
  }, 50);

  return bubbleMessage;
}
