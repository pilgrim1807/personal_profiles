const bubblesContainer = document.querySelector(".bubbles");
const popSound = new Audio("audio/bubble.mp3");

function createBubble() {
  const bubble = document.createElement("div");
  bubble.classList.add("bubble");

  const size = Math.random() * 80 + 40;
  bubble.style.width = size + "px";
  bubble.style.height = size + "px";
  bubble.style.left = Math.random() * 100 + "vw";

  const duration = 8 + (120 - size) / 10;
  bubble.style.animationDuration = duration + "s";

  const hue = Math.floor(Math.random() * 360);
  bubble.style.setProperty("--hue", hue);

  // универсальная функция для лопанья
  function popBubble(event) {
    if (bubble.classList.contains("pop")) return;
    bubble.classList.add("pop");
    popSound.currentTime = 0;
    popSound.play();

    const centerX = event.touches ? event.touches[0].clientX : event.clientX;
    const centerY = event.touches ? event.touches[0].clientY : event.clientY;

    const splashCount = Math.floor(size / 6);
    for (let i = 0; i < splashCount; i++) {
      createSplash(centerX, centerY, hue, size);
    }

    bubble.addEventListener("animationend", () => bubble.remove());
  }

  // поддержка и клика, и тапа
  bubble.addEventListener("click", popBubble);
  bubble.addEventListener("touchstart", popBubble, { passive: true });

  // увеличить хитбокс для пальца
  bubble.style.padding = "10px";
  bubble.style.boxSizing = "content-box";

  bubblesContainer.appendChild(bubble);
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

setInterval(createBubble, 500);
