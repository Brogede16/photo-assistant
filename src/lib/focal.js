// Brændvidder skrives i profilerne som menneskelig tekst: "35mm",
// "70-300mm" eller "70-300mm eller 18-35mm" når to objektiver kan løse opgaven.

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
  return lens.focalLength?.min <= low && lens.focalLength?.max >= high;
}

export function lensCoversAnyFocal(lens, value) {
  const alternatives = focalAlternatives(value);
  if (!alternatives.length) return false;
  return alternatives.some((alternative) => lensCoversFocal(lens, alternative));
}
