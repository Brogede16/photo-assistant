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

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const density = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(rect.width * density));
    canvas.height = Math.max(1, Math.round(rect.height * density));
    source.width = 84;
    source.height = Math.max(56, Math.round(84 * rect.height / Math.max(1, rect.width)));
    draw(performance.now());
  }

  function draw(now) {
    if (disposed || !source.width || !source.height) return;
    const time = reduceMotion ? SESSION_SEED * 1000 : now;
    const image = sourceContext.createImageData(source.width, source.height);
    const data = image.data;

    for (let y = 0; y < source.height; y += 1) {
      const v = y / Math.max(1, source.height - 1);
      for (let x = 0; x < source.width; x += 1) {
        const u = x / Math.max(1, source.width - 1);
        const centerX = 0.5 + Math.sin(time * 0.00022 + SESSION_SEED) * 0.18;
        const centerY = 0.44 + Math.cos(time * 0.00017 + SESSION_SEED * 1.4) * 0.16;
        const dx = (u - centerX) / 0.78;
        const dy = (v - centerY) / 0.72;
        const sphere = Math.pow(Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy)), 0.72);
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
        data[pixel + 3] = Math.round(238 * sphere);
      }
    }

    sourceContext.putImageData(image, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
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
  if (!reduceMotion) frameId = requestAnimationFrame(animate);

  return () => {
    disposed = true;
    cancelAnimationFrame(frameId);
    window.removeEventListener("resize", resize);
  };
}
