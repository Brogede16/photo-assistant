// Datavalidering på tværs af alle scenarieprofiler.
//
// Profilerne er håndskrevet over mange omgange, og en tastefejl i én værdi
// (fx f/2.8 i en middagssolprofil) er usynlig ved gennemlæsning. Testene her
// tjekker derfor hver profil mod fysikken og mod det udstyr, brugeren faktisk
// har, så fejl fanges automatisk i takt med at samlingen vokser.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pickLens } from "../src/lib/recommendations.js";
import {
  apertureToNumber,
  ev100FromSettings,
  isoToNumber,
  shutterToSeconds,
  focalAlternatives,
  lensCoversFocal,
  maxApertureAtFocal,
  settingStart
} from "./helpers/exposure.mjs";

const situations = JSON.parse(await readFile(new URL("../src/data/situations/core-profiles.json", import.meta.url), "utf8"));
const equipment = JSON.parse(await readFile(new URL("../src/data/equipment/index.json", import.meta.url), "utf8"));
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

const profiles = situations.profiles;

// --- 1. Er lysmængden fysisk plausibel? ------------------------------------

// Forventet EV100 pr. lystag. Intervallerne er bevidst brede: de skal fange
// grove fejl (dagslysindstillinger i en natprofil), ikke diskutere en halv stop.
// Har en profil flere lystags, accepteres foreningsmængden af deres intervaller,
// fordi profilen netop dækker hele det spænd.
const LIGHT_EV_RANGES = {
  "bright-sun": [13, 17],
  daylight: [10, 17],
  overcast: [9, 15],
  shade: [7, 13],
  twilight: [2, 12],
  "window-light": [4, 11],
  indoor: [3, 10],
  "bright-interior": [5, 11],
  "dim-interior": [0, 8],
  "low-light": [-1, 9],
  night: [-9, 9],
  "dark-sky": [-9, 3],
  "light-pollution": [-7, 5],
  "stage-light": [1, 11],
  spotlight: [4, 12],
  "screen-light": [1, 9],
  "house-lights-on": [3, 10],
  "house-lights-off": [-3, 8]
};

// Motiver der lyser selv eller er direkte solbelyste. De følger ikke omgivelsernes
// lysniveau, så deres eget interval accepteres på lige fod med lystagenes.
const SUBJECT_EV_RANGES = {
  "solar-eclipse": [12, 18],
  moon: [10, 17],
  stars: [-9, 0],
  "milky-way": [-9, 0],
  "meteor-shower": [-9, 0],
  "star-trails": [-5, 3],
  aurora: [-9, -1],
  fireworks: [1, 8],
  fire: [0, 9],
  "cinema-screen": [2, 10],
  "light-trails": [0, 8]
};

// ND-filter fjerner et ukendt antal stop, og light painting tilfører lys, som
// scenen ikke selv har. I begge tilfælde siger EV intet om omgivelsernes lys.
function skipsEvCheck(profile) {
  return (profile.conditions?.equipment || []).includes("nd-filter")
    || (profile.conditions?.technique || []).includes("light-painting");
}

function expectedEvWindows(profile) {
  const windows = [];
  for (const id of profile.conditions?.light || []) {
    if (LIGHT_EV_RANGES[id]) windows.push(LIGHT_EV_RANGES[id]);
  }
  const lightWindow = windows.length
    ? [Math.min(...windows.map((w) => w[0])), Math.max(...windows.map((w) => w[1]))]
    : null;
  const subjectWindows = (profile.subjects || [])
    .map((id) => SUBJECT_EV_RANGES[id])
    .filter(Boolean);
  return [lightWindow, ...subjectWindows].filter(Boolean);
}

let checkedEv = 0;
for (const profile of profiles) {
  if (skipsEvCheck(profile)) continue;
  const ev = ev100FromSettings(profile.baseSettings || {});
  if (ev === null) continue; // Auto på lukkertid, blænde eller ISO: intet fast lysniveau at måle.
  const windows = expectedEvWindows(profile);
  if (!windows.length) continue; // Ingen lystags og intet selvlysende motiv at holde den op mod.
  checkedEv += 1;
  const fits = windows.some(([low, high]) => ev >= low && ev <= high);
  assert.equal(
    fits,
    true,
    `Profil ${profile.id} giver EV100 ${ev.toFixed(1)} med ${settingStart(profile.baseSettings.shutter)}, `
      + `${settingStart(profile.baseSettings.aperture)} og ISO ${settingStart(profile.baseSettings.iso)}. `
      + `Det passer ikke til ${(profile.conditions?.light || []).join(", ") || "motivet"}, `
      + `hvor forventningen er ${windows.map(([a, b]) => `EV ${a} til ${b}`).join(" eller ")}.`
  );
}
assert.equal(checkedEv > 40, true, `Kun ${checkedEv} profiler fik kontrolleret EV; parsingen er sandsynligvis knækket.`);

// --- 2. Kan brugerens objektiver overhovedet levere indstillingen? ---------

const APERTURE_TOLERANCE_STOPS = 1 / 3;

// Et zoomobjektiv er lysstærkest i den korte ende, så en blænde er brugbar, hvis
// den kan nås et sted inden for den angivne brændvidde. Testen leder efter de
// blænder, objektivet aldrig kan levere — ikke efter dem, der kræver, at man
// bliver i den korte ende.
function apertureIsReachable(lens, [focalLow], aperture) {
  const widest = maxApertureAtFocal(lens, focalLow);
  const stopsWider = 2 * Math.log2(widest / aperture);
  return stopsWider <= APERTURE_TOLERANCE_STOPS;
}

for (const profile of profiles) {
  const alternatives = focalAlternatives(profile.baseSettings?.focalLength);
  const aperture = apertureToNumber(settingStart(profile.baseSettings?.aperture));
  if (!alternatives.length) continue;

  // Hver angivet brændvidde skal findes på mindst ét af brugerens objektiver.
  for (const alternative of alternatives) {
    const covering = equipment.lenses.filter((lens) => lensCoversFocal(lens, alternative));
    assert.equal(
      covering.length > 0,
      true,
      `Profil ${profile.id} beder om ${alternative.join("-")}mm, som intet objektiv i kittet dækker.`
    );
    if (!aperture) continue;
    assert.equal(
      covering.some((lens) => apertureIsReachable(lens, alternative, aperture)),
      true,
      `Profil ${profile.id} beder om f/${aperture} ved ${alternative.join("-")}mm. `
        + `Det er lysstærkere end noget objektiv i kittet kan ved den brændvidde `
        + `(${covering.map((lens) => `${lens.model}: f/${maxApertureAtFocal(lens, alternative[0]).toFixed(1)}`).join(", ")}).`
    );
  }

  // Det objektiv, appen faktisk viser, skal kunne bruges til mindst ét af alternativerne.
  const chosen = pickLens(profile, equipment, null);
  assert.equal(
    alternatives.some((alternative) => lensCoversFocal(chosen, alternative)),
    true,
    `Profil ${profile.id} viser ${chosen.model} (${chosen.focalLength.min}-${chosen.focalLength.max}mm), `
      + `men brændvidden er angivet som ${profile.baseSettings.focalLength}. `
      + "Guiden vil bede brugeren om at zoome til noget, objektivet ikke kan."
  );
  if (!aperture) continue;
  const chosenAlternative = alternatives.find((alternative) => lensCoversFocal(chosen, alternative));
  assert.equal(
    apertureIsReachable(chosen, chosenAlternative, aperture),
    true,
    `Profil ${profile.id} viser ${chosen.model} med f/${aperture} ved ${chosenAlternative.join("-")}mm, `
      + `men objektivet åbner kun til f/${maxApertureAtFocal(chosen, chosenAlternative[0]).toFixed(1)} der.`
  );
}

// --- 3. Ligger startværdien inden for profilens eget interval? -------------

// Lukkertidsintervaller skrives fra langsom til hurtig ("1/250" til "1/800"),
// blænde og ISO fra lav til høj. Rækkefølgen normaliseres derfor, og testen
// kontrollerer kun, at startpunktet faktisk ligger inde i intervallet.
let checkedRanges = 0;
for (const profile of profiles) {
  for (const [key, parse] of [["shutter", shutterToSeconds], ["aperture", apertureToNumber], ["iso", isoToNumber]]) {
    const setting = profile.baseSettings?.[key];
    if (!setting || typeof setting !== "object" || !Array.isArray(setting.range)) continue;
    const start = parse(setting.start);
    const bounds = setting.range.map(parse);
    if (start === null || bounds.some((value) => value === null)) continue;
    checkedRanges += 1;
    const low = Math.min(...bounds);
    const high = Math.max(...bounds);
    assert.equal(
      start >= low && start <= high,
      true,
      `Profil ${profile.id} starter på ${setting.start} for ${key}, men intervallet er ${setting.range.join(" til ")}.`
    );
  }
}
assert.equal(checkedRanges > 300, true, `Kun ${checkedRanges} intervaller blev kontrolleret; parsingen er sandsynligvis knækket.`);

// --- 4. Holder familierne sig ryddelige? -----------------------------------

const familyCounts = new Map();
for (const profile of profiles) {
  assert.equal(typeof profile.family, "string", `Profil ${profile.id} mangler family.`);
  assert.equal(
    profile.family,
    profile.family.toLowerCase(),
    `Familie "${profile.family}" bruger store bogstaver. Familier skrives med små bogstaver i data; `
      + "brugerfladen sætter selv stort begyndelsesbogstav."
  );
  familyCounts.set(profile.family, (familyCounts.get(profile.family) || 0) + 1);
}
for (const [family, count] of familyCounts) {
  assert.equal(
    count >= 2,
    true,
    `Familien "${family}" har kun ${count} profil. Læg den i en eksisterende familie, `
      + "eller udbyg den, så listen af familier ikke vokser med én pr. scenarie."
  );
}

// --- 5. Passer dokumentationen på data? ------------------------------------

const readmeCount = Number(readme.match(/-\s*(\d+)\s+grundscenarier/)?.[1]);
assert.equal(
  readmeCount,
  profiles.length,
  `README skriver ${readmeCount} grundscenarier, men der er ${profiles.length}.`
);

console.log(`Datatests bestod: ${checkedEv} profiler EV-kontrolleret, ${checkedRanges} intervaller, ${profiles.length} profiler tjekket mod udstyr, ${familyCounts.size} familier.`);
