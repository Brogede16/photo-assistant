export function pickLens(profile, equipment) {
  const roles = profile.gearStrategy?.preferredLensRoles || [];
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
  const lens = pickLens(profile, equipment);
  const settings = profile.baseSettings || {};
  const contextAdjustments = adjustForContext(settings, context);
  const camera = equipment.cameras?.[0];

  return {
    profile,
    camera,
    lens,
    flash: shouldSuggestFlash(profile, equipment) ? equipment.flashes?.[0] : null,
    settings: {
      mode: settings.mode || "M",
      focalLength: settings.focalLength || formatFocalLength(lens),
      shutter: contextAdjustments.shutter || settings.shutter?.start || settings.shutter || "Auto",
      aperture: settings.aperture?.start || settings.aperture || "Auto",
      iso: contextAdjustments.iso || settings.iso?.start || settings.iso || "Auto",
      focus: settings.focus || "Auto",
      drive: settings.drive || "Single"
    },
    actions: (profile.cameraActions || []).map((actionId) => ({
      id: actionId,
      steps: camera?.procedures?.[actionId] || []
    })),
    notes: buildNotes(profile, context)
  };
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
