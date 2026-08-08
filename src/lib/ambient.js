const SESSION_SEED = Math.random() * Math.PI * 2;
const PALETTES = [
  [[18, 0, 255], [37, 48, 255], [70, 86, 255], [9, 17, 138]]
];

export function startAmbientField(canvas) {
  if (!canvas) return () => {};
  const context = canvas.getContext("2d", { alpha: true });
  const source = document.createElement("canvas");
  const sourceContext = source.getContext("2d");
  const palette = PALETTES[Math.floor((SESSION_SEED / (Math.PI * 2)) * PALETTES.length) % PALETTES.length];
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  let frameId = 0;
  let lastFrame = 0;
  let disposed = false;
  let resizeObserver = null;
  let radiusX = 0.9;
  let radiusY = 0.3;
  let currentPoint = null;
  let nextPoint = null;
  let segmentStarted = 0;
  let segmentDuration = 8000;

  function resize() {
    const host = canvas.parentElement;
    const contentBottom = [...(host?.children || [])]
      .filter((element) => element !== canvas)
      .reduce((bottom, element) => Math.max(bottom, element.offsetTop + element.offsetHeight), 0);
    const hostPadding = host ? parseFloat(getComputedStyle(host).paddingBottom) || 0 : 0;
    const targetHeight = Math.max(window.innerHeight, contentBottom + hostPadding);
    canvas.style.height = `${targetHeight}px`;
    const rect = canvas.getBoundingClientRect();
    const density = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(rect.width * density));
    canvas.height = Math.max(1, Math.round(rect.height * density));
    source.width = 84;
    source.height = Math.max(56, Math.round(84 * rect.height / Math.max(1, rect.width)));
    radiusX = Math.min(1.2, (window.innerWidth * 1.34) / Math.max(1, rect.width));
    radiusY = Math.min(0.95, (window.innerHeight * 0.74) / Math.max(1, rect.height));
    if (!currentPoint) {
      currentPoint = { x: 0.3, y: Math.min(0.2, (window.innerHeight * 0.22) / Math.max(1, rect.height)) };
      nextPoint = randomPointFarFrom(currentPoint);
      segmentStarted = performance.now();
    }
    draw(performance.now());
  }

  function draw(now) {
    if (disposed || !source.width || !source.height) return;
    const time = reduceMotion ? SESSION_SEED * 1000 : now;
    const center = motionPosition(time);
    const image = sourceContext.createImageData(source.width, source.height);
    const data = image.data;

    for (let y = 0; y < source.height; y += 1) {
      const v = y / Math.max(1, source.height - 1);
      for (let x = 0; x < source.width; x += 1) {
        const u = x / Math.max(1, source.width - 1);
        const pulse = 1 + Math.sin(time * 0.00065 + SESSION_SEED * 0.8) * 0.08;
        const dx = (u - center.x) / (radiusX * pulse);
        const dy = (v - center.y) / (radiusY * pulse);
        const sphere = Math.exp(-2.35 * (dx * dx + dy * dy));
        const waves = [
          0.5 + 0.5 * Math.sin(u * 5.2 + v * 2.1 + time * 0.0002 + SESSION_SEED),
          0.5 + 0.5 * Math.sin(u * -3.4 + v * 5.8 + time * 0.00016 + SESSION_SEED * 1.7),
          0.5 + 0.5 * Math.cos(u * 4.4 + v * -3.2 + time * 0.00018 + SESSION_SEED * 2.4),
          0.5 + 0.5 * Math.sin(u * 2.2 + v * 6.1 - time * 0.00014 + SESSION_SEED * 3.1)
        ];
        const total = waves.reduce((sum, value) => sum + value * value, 0);
        const pixel = (y * source.width + x) * 4;
        for (let channel = 0; channel < 3; channel += 1) {
          data[pixel + channel] = Math.round(waves.reduce((sum, value, index) => sum + palette[index][channel] * value * value, 0) / total);
        }
        data[pixel + 3] = Math.round(255 * sphere);
      }
    }

    sourceContext.putImageData(image, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
  }

  function motionPosition(now) {
    if (reduceMotion || !currentPoint || !nextPoint) return currentPoint || { x: 0.3, y: 0.12 };
    let progress = (now - segmentStarted) / segmentDuration;
    if (progress >= 1) {
      currentPoint = nextPoint;
      nextPoint = randomPointFarFrom(currentPoint);
      segmentStarted = now;
      segmentDuration = 6000 + Math.random() * 4000;
      progress = 0;
    }
    const eased = progress * progress * (3 - 2 * progress);
    return {
      x: currentPoint.x + (nextPoint.x - currentPoint.x) * eased,
      y: currentPoint.y + (nextPoint.y - currentPoint.y) * eased
    };
  }

  function randomPointFarFrom(origin) {
    let point;
    let attempts = 0;
    do {
      point = { x: 0.06 + Math.random() * 0.88, y: 0.04 + Math.random() * 0.92 };
      attempts += 1;
    } while (attempts < 12 && Math.hypot(point.x - origin.x, point.y - origin.y) < 0.34);
    return point;
  }

  function animate(now) {
    if (disposed) return;
    if (!document.hidden && now - lastFrame > 38) {
      draw(now);
      lastFrame = now;
    }
    frameId = requestAnimationFrame(animate);
  }

  resize();
  window.addEventListener("resize", resize);
  if ("ResizeObserver" in window) {
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas.parentElement);
  }
  if (!reduceMotion) frameId = requestAnimationFrame(animate);

  return () => {
    disposed = true;
    cancelAnimationFrame(frameId);
    window.removeEventListener("resize", resize);
    resizeObserver?.disconnect();
  };
}
