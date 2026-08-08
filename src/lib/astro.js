const DAY_MS = 1000 * 60 * 60 * 24;
const SYNODIC_MONTH = 29.530588853;

export function moonPhase(date = new Date()) {
  const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14, 0);
  const days = (date.getTime() - knownNewMoon) / DAY_MS;
  const age = positiveModulo(days, SYNODIC_MONTH);
  const illumination = (1 - Math.cos((2 * Math.PI * age) / SYNODIC_MONTH)) / 2;
  return {
    age,
    illumination,
    label: moonLabel(age),
    percent: Math.round(illumination * 100)
  };
}

export function maxStarShutterSeconds(focalLengthMm, cropFactor = 1.6, rule = 400) {
  const safeFocal = Number(focalLengthMm) || 18;
  return Math.max(1, Math.floor(rule / (safeFocal * cropFactor)));
}

export function describeLightContext(date = new Date(), coords = null) {
  const hour = date.getHours() + date.getMinutes() / 60;
  const phase = hour < 5 || hour >= 23 ? "night" : hour < 7 ? "blue-hour" : hour < 18 ? "day" : hour < 21 ? "golden-hour" : "twilight";
  const labels = {
    night: "Nat",
    "blue-hour": "Blue hour / tidlig morgen",
    day: "Dagslys",
    "golden-hour": "Lav sol / golden hour",
    twilight: "Skumring"
  };
  return {
    phase,
    label: labels[phase],
    dateLabel: new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(date),
    locationLabel: coords ? `${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}` : "Placering ikke valgt"
  };
}

export function astroStatus(date = new Date(), coords = null) {
  const moon = moonPhase(date);
  const light = describeLightContext(date, coords);
  const starSeconds18mm = maxStarShutterSeconds(18);
  const score = scoreAstro(light.phase, moon.illumination);
  return {
    moon,
    light,
    starSeconds18mm,
    score,
    summary: `Måne ${moon.percent}% - ${light.label.toLowerCase()} - stjerner ved 18mm: maks ca. ${starSeconds18mm}s`
  };
}

function scoreAstro(phase, illumination) {
  let score = phase === "night" ? 4 : phase === "twilight" ? 2 : 1;
  if (illumination < 0.25) score += 1;
  if (illumination > 0.75) score -= 1;
  return Math.max(1, Math.min(5, score));
}

function moonLabel(age) {
  if (age < 1.5) return "Nymåne";
  if (age < 6.5) return "Tiltagende måne";
  if (age < 8.5) return "Første kvarter";
  if (age < 13.5) return "Tiltagende næsten fuld";
  if (age < 16.5) return "Fuldmåne";
  if (age < 21.5) return "Aftagende måne";
  if (age < 23.5) return "Sidste kvarter";
  return "Aftagende mod nymåne";
}

function positiveModulo(value, modulo) {
  return ((value % modulo) + modulo) % modulo;
}
