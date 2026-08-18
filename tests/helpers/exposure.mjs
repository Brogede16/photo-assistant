// Fælles parsing og eksponeringsmatematik til datatestene.
//
// EV100 er scenens lysstyrke udtrykt ved ISO 100, uafhængigt af hvilken
// kombination af lukkertid, blænde og ISO der er valgt:
//
//   EV100 = log2(blænde² / lukkertid) - log2(ISO / 100)
//
// Sunny 16 er kontrollen: f/16, 1/125 og ISO 100 giver EV100 ≈ 15, som er
// stærk sol. To profiler med samme EV100 beskriver altså samme lysmængde,
// selv om deres indstillinger ser helt forskellige ud.

export function firstNumber(value) {
  const match = String(value ?? "").match(/[\d.]+/);
  return match ? Number(match[0]) : null;
}

/** baseSettings-felter er enten en ren værdi eller { start, range }. */
export function settingStart(value) {
  return value && typeof value === "object" ? value.start : value;
}

/** "1/500" → 0.002, "8s" → 8, "Auto" → null. */
export function shutterToSeconds(value) {
  const text = String(value ?? "").trim();
  if (!text || /^auto$/i.test(text)) return null;
  if (text.endsWith("s")) return Number(text.slice(0, -1).replace(",", ".")) || null;
  if (text.includes("/")) {
    const [top, bottom] = text.split("/").map(Number);
    return bottom ? top / bottom : null;
  }
  return Number(text) || null;
}

export function apertureToNumber(value) {
  const text = String(value ?? "").trim();
  if (/^auto$/i.test(text)) return null;
  return firstNumber(text);
}

export function isoToNumber(value) {
  const text = String(value ?? "").trim();
  if (/^auto$/i.test(text)) return null;
  return firstNumber(text);
}

/** Returnerer scenens EV100, eller null hvis en af de tre værdier er Auto. */
export function ev100FromSettings(baseSettings = {}) {
  const aperture = apertureToNumber(settingStart(baseSettings.aperture));
  const seconds = shutterToSeconds(settingStart(baseSettings.shutter));
  const iso = isoToNumber(settingStart(baseSettings.iso));
  if (!aperture || !seconds || !iso) return null;
  return Math.log2((aperture * aperture) / seconds) - Math.log2(iso / 100);
}

/** "70-300mm eller 35mm" → [[70, 300], [35, 35]]. */
export function focalAlternatives(value) {
  return String(value ?? "")
    .split(/\s+eller\s+/i)
    .map((part) => {
      const numbers = [...part.matchAll(/\d+/g)].map((match) => Number(match[0]));
      if (!numbers.length) return null;
      return [numbers[0], numbers.at(-1)];
    })
    .filter(Boolean);
}

export function lensCoversFocal(lens, [low, high]) {
  return lens.focalLength.min <= low && lens.focalLength.max >= high;
}

// Zoomobjektiver taber lysstyrke gradvist hen mod den lange ende. Producenterne
// oplyser kun yderpunkterne, så mellemliggende brændvidder interpoleres logaritmisk.
// Modellen er et estimat, derfor sammenlignes med en tolerance på 1/3 stop.
export function maxApertureAtFocal(lens, focal) {
  const { min, max } = lens.focalLength;
  const wideEnd = lens.aperture.maxAtMinFocal;
  const teleEnd = lens.aperture.maxAtMaxFocal;
  if (max === min || focal <= min) return wideEnd;
  if (focal >= max) return teleEnd;
  const ratio = Math.log(focal / min) / Math.log(max / min);
  return wideEnd * (teleEnd / wideEnd) ** ratio;
}
