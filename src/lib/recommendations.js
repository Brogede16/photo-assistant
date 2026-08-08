import { preferredRolesForScenario, triangulateScenario } from "./scenario.js";

export function pickLens(profile, equipment, classification = null) {
  const roles = preferredRolesForScenario(profile, classification);
  const lenses = equipment.lenses || [];
  const scored = lenses
    .map((lens) => ({
      lens,
      score: roles.reduce((sum, role) => sum + (lens.roles?.includes(role) ? 1 : 0), 0)
    }))
    .sort((a, b) => b.score - a.score || (b.lens.focalLength?.max || 0) - (a.lens.focalLength?.max || 0));

  return scored[0]?.score > 0 ? scored[0].lens : lenses[0];
}

export function buildRecommendation(profile, equipment, context = {}) {
  const lens = pickLens(profile, equipment, context.classification);
  const settings = profile.baseSettings || {};
  const camera = equipment.cameras?.[0];

  const presetSettings = context.presetInfluence?.preset?.settings || {};
  const scenario = triangulateScenario({
    mode: settings.mode || "M",
    focalLength: settings.focalLength || formatFocalLength(lens),
    shutter: settings.shutter?.start || settings.shutter || "Auto",
    aperture: settings.aperture?.start || settings.aperture || "Auto",
    iso: settings.iso?.start || settings.iso || "Auto",
    focus: settings.focus || "Auto",
    drive: settings.drive || "Single",
    ...pickUsablePresetSettings(presetSettings)
  }, context.classification, profile);
  if (context.presetInfluence) {
    scenario.decisions.unshift(`Dit preset “${context.presetInfluence.preset.name}” bruges som lokalt udgangspunkt; de aktuelle tags har sidste ord.`);
  }

  return {
    profile,
    camera,
    lens,
    flash: shouldSuggestFlash(profile, equipment) ? equipment.flashes?.[0] : null,
    settings: scenario.settings,
    scenarioDecisions: scenario.decisions,
    exposurePlan: profile.exposurePlan || null,
    actions: actionsForSettings(profile.cameraActions || [], scenario.settings).map((actionId) => ({
      id: actionId,
      steps: buildExactSteps(actionId, scenario.settings, camera, lens)
    })),
    notes: buildNotes(profile)
  };
}

function actionsForSettings(actions, settings) {
  const generatedActions = new Set([
    "setManualMode", "setAvMode", "setTvMode", "setProgramMode", "setBulbMode",
    "setFocalLength", "setShutter", "setAperture", "setIso", "setAiServo", "setOneShot",
    "setLensManualFocus", "setHighSpeedContinuous", "setDriveMode"
  ]);
  const modeAction = { M: "setManualMode", Av: "setAvMode", Tv: "setTvMode", P: "setProgramMode", Bulb: "setBulbMode" }[settings.mode];
  const focus = String(settings.focus).toLowerCase();
  const focusAction = focus.includes("ai servo") ? "setAiServo" : focus.includes("manuel") || focus.includes("mf") ? "setLensManualFocus" : "setOneShot";
  const driveAction = /single|continuous|serie/i.test(String(settings.drive)) ? "setDriveMode" : null;
  const exposureActions = settings.mode === "M"
    ? ["setShutter", "setAperture"]
    : settings.mode === "Tv" ? ["setShutter"] : settings.mode === "Av" ? ["setAperture"] : [];
  const extras = actions.filter((action) => !generatedActions.has(action));
  return [...new Set([modeAction, "setFocalLength", ...exposureActions, "setIso", focusAction, driveAction, ...extras].filter(Boolean))];
}

function buildExactSteps(actionId, settings, camera, lens) {
  const exact = {
    setManualMode: ["Drej programhjulet til M.", `Kontrollér at M vises, før du indstiller ${settings.shutter}, ${settings.aperture} og ISO ${settings.iso}.`],
    setAvMode: ["Drej programhjulet til Av.", `Drej Main Dial ved udløserknappen til ${settings.aperture}.`, `Kontrollér at kameraets lukkertid ikke bliver langsommere end ${settings.shutter}.`],
    setTvMode: ["Drej programhjulet til Tv.", `Drej Main Dial ved udløserknappen til ${settings.shutter}.`, "Kameraet vælger blænden automatisk."],
    setProgramMode: ["Drej programhjulet til P.", "Lad kameraet vælge lukkertid og blænde til dette hurtige hverdagsbillede."],
    setBulbMode: ["Drej programhjulet til M.", "Drej lukkertiden forbi 30 sekunder, til Bulb vises.", "Start og stop eksponeringen med Canon Camera Connect eller en fjernudløser."],
    setFocalLength: [`Montér ${lens.brand} ${lens.model}.`, `Drej zoomringen til ${settings.focalLength}.`],
    setShutter: [`Indstil lukkertiden til ${settings.shutter} med Main Dial ved udløserknappen.`, wholeSecondsHint(settings.shutter)],
    setAperture: [settings.mode === "Av" ? `I Av: drej Main Dial til ${settings.aperture}.` : `I M: drej Quick Control Dial bagpå til ${settings.aperture}.`, "Brug LOCK-kontakten ved baghjulet, hvis hjulet er låst."],
    setIso: ["Tryk ISO-knappen på toppen af kameraet.", `Drej Main Dial til ${String(settings.iso).toLowerCase() === "auto" ? "AUTO" : settings.iso}.`, "Tryk udløseren halvt ned for at bekræfte."],
    setAiServo: ["Tryk AF-knappen på toppen.", "Drej Main Dial til AI SERVO, og tryk udløseren halvt ned.", `Hold fokuspunktet på motivet; anbefalingen er ${settings.focus}.`],
    setOneShot: ["Tryk AF-knappen på toppen.", "Drej Main Dial til ONE SHOT, og tryk udløseren halvt ned.", `Placér fokuspunktet som anbefalet: ${settings.focus}.`],
    setLensManualFocus: [`Skub AF/MF-kontakten på ${lens.model} til MF.`, `Drej fokusringen, til motivet står skarpt: ${settings.focus}.`],
    setHighSpeedContinuous: ["Tryk DRIVE-knappen på toppen.", `Vælg ${settings.drive} med Main Dial.`, "Tag korte serier på 3-5 billeder."],
    setDriveMode: ["Tryk DRIVE-knappen på toppen.", `Drej Main Dial, til ${settings.drive} vises.`, settings.drive === "Single" ? "Tag ét billede ad gangen." : "Brug korte, kontrollerede serier."],
    setLensStabilizationOn: [`Sæt STABILIZER-kontakten på ${lens.model} til ON.`, "Slå stabilisering fra, hvis kameraet står helt fast på stativ."],
    useLiveViewForAstro: ["Tryk START/STOP for Live View.", "Forstør en klar stjerne 5x og derefter 10x.", "Drej fokusringen, til stjernen er mindst mulig og skarp."],
    useCanonCameraConnect: ["Forbind EOS 80D til Canon Camera Connect via kameraets Wi-Fi-menu.", "Åbn fjernoptagelse, og brug appens udløser uden at røre kameraet."]
  };
  return (exact[actionId] || camera?.procedures?.[actionId] || []).filter(Boolean);
}

function wholeSecondsHint(shutter) {
  const value = String(shutter);
  if (!value.endsWith("s")) return "Kontrollér den viste værdi i søgeren.";
  return `På EOS 80D vises ${value} som ${value.slice(0, -1)}\" på skærmen.`;
}

function pickUsablePresetSettings(settings) {
  const allowed = ["mode", "focalLength", "shutter", "aperture", "iso", "focus", "drive"];
  return Object.fromEntries(allowed.filter((key) => settings[key]).map((key) => [key, settings[key]]));
}

export function explainProblem(problemId, recommendation) {
  const settings = recommendation.settings;
  const map = {
    "too-dark": {
      title: "For mørkt",
      advice: [
        "Åbn blænden, hvis objektivet ikke allerede er helt åbent.",
        "Hæv ISO eller brug Auto ISO.",
        "Sænk kun lukkertiden, hvis motivet står stille eller kameraet er på stativ."
      ]
    },
    "too-bright": {
      title: "For lyst",
      advice: [
        "Brug hurtigere lukkertid.",
        "Sænk ISO.",
        "Ved månen: lad dig ikke narre af den mørke himmel, månen er meget lys."
      ]
    },
    blurry: {
      title: "Uskarpt",
      advice: [
        "Hvis motivet bevæger sig, brug hurtigere lukkertid.",
        "Hvis hele billedet er rystet, brug IS, bedre støtte eller stativ.",
        "Hvis fokus ligger forkert, skift fokusmetode og vælg fokuspunkt mere bevidst."
      ]
    },
    noise: {
      title: "For meget støj",
      advice: [
        "Støj kommer ofte af høj ISO.",
        "Prøv mere lys, større blænde eller længere lukkertid, hvis motivet tillader det.",
        "Accepter hellere lidt støj end et sløret billede ved bevægelse."
      ]
    }
  };

  return {
    settings,
    ...(map[problemId] || map.blurry)
  };
}

function shouldSuggestFlash(profile, equipment) {
  return Boolean(profile.gearStrategy?.optional?.includes("flash") && equipment.flashes?.length);
}

function formatFocalLength(lens) {
  if (!lens?.focalLength) return "Auto";
  return `${lens.focalLength.min}-${lens.focalLength.max}mm`;
}

function buildNotes(profile) {
  const notes = [];
  if (profile.why) notes.push(profile.why);
  return notes;
}
