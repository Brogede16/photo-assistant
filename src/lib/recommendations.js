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
  const contextAdjustments = adjustForContext(settings, context);
  const camera = equipment.cameras?.[0];

  const presetSettings = context.presetInfluence?.preset?.settings || {};
  const scenario = triangulateScenario({
    mode: settings.mode || "M",
    focalLength: settings.focalLength || formatFocalLength(lens),
    shutter: contextAdjustments.shutter || settings.shutter?.start || settings.shutter || "Auto",
    aperture: settings.aperture?.start || settings.aperture || "Auto",
    iso: contextAdjustments.iso || settings.iso?.start || settings.iso || "Auto",
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
    gearChecklist: buildGearChecklist(profile, lens),
    actions: actionsForMode(profile.cameraActions || [], scenario.settings.mode).map((actionId) => ({
      id: actionId,
      steps: camera?.procedures?.[actionId] || []
    })),
    notes: buildNotes(profile, context)
  };
}

function actionsForMode(actions, mode) {
  const modeActions = new Set(["setManualMode", "setAvMode", "setTvMode", "setProgramMode", "setBulbMode"]);
  const modeAction = { M: "setManualMode", Av: "setAvMode", Tv: "setTvMode", P: "setProgramMode", Bulb: "setBulbMode" }[mode];
  return [...new Set([modeAction, ...actions.filter((action) => !modeActions.has(action))].filter(Boolean))];
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

function adjustForContext(settings, context) {
  if (!context.lightOverride && context.phase === "night" && settings.iso?.range) {
    return { iso: settings.iso.start };
  }
  if (context.lightOverride === "mørkere" && settings.iso?.range) {
    return { iso: settings.iso.range.at(-1) };
  }
  if (context.lightOverride === "lysere" && settings.iso?.range) {
    return { iso: settings.iso.range[0] };
  }
  return {};
}

function shouldSuggestFlash(profile, equipment) {
  return Boolean(profile.gearStrategy?.optional?.includes("flash") && equipment.flashes?.length);
}

function formatFocalLength(lens) {
  if (!lens?.focalLength) return "Auto";
  return `${lens.focalLength.min}-${lens.focalLength.max}mm`;
}

function buildNotes(profile, context) {
  const notes = [];
  if (profile.why) notes.push(profile.why);
  if (context.source === "automatic") notes.push("Automatisk kontekst bruges som udgangspunkt. Manuel override vinder altid.");
  return notes;
}

function buildGearChecklist(profile, lens) {
  const support = profile.gearStrategy?.support || [];
  const checklist = [`Canon EOS 80D`, `${lens.brand} ${lens.model}`];
  if (support.includes("tripod") || support.includes("tripod-optional")) checklist.push("Stativ");
  if (support.includes("remote-release")) checklist.push("Canon Camera Connect eller 2 sek. selvudløser");
  if (profile.family === "astro" || support.includes("tripod")) checklist.push("Ekstra batteri");
  if (profile.family === "astro") checklist.push("Pandelampe med lav styrke");
  if (profile.gearStrategy?.optional?.includes("flash")) checklist.push("Speedlite 430EX II som mulighed");
  return checklist;
}
