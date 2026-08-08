const MOTION_RULES = {
  still: { rank: 0, mode: "Av", shutter: "Auto (mindst 1/125)", focus: "One Shot", drive: "Single" },
  gentle: { rank: 1, mode: "Tv", shutter: "1/320", focus: "AI Servo", drive: "Continuous low" },
  active: { rank: 2, mode: "Tv", shutter: "1/500", focus: "AI Servo", drive: "Continuous low" },
  fast: { rank: 3, mode: "Tv", shutter: "1/1000", focus: "AI Servo", drive: "High-speed continuous" },
  flight: { rank: 4, mode: "Tv", shutter: "1/1600", focus: "AI Servo", drive: "High-speed continuous" }
};

export function triangulateScenario(baseSettings, classification, profile) {
  const settings = { ...baseSettings };
  const decisions = [];
  const explicitMatches = (classification?.matches || []).filter((match) => !match.implied);
  const motionSignals = explicitMatches
    .map((match) => ({ match, rule: MOTION_RULES[match.effects?.motion] }))
    .filter((item) => item.rule)
    .sort((a, b) => b.rule.rank - a.rule.rank);

  if (motionSignals.length && canAdaptMode(profile)) {
    const { match, rule } = motionSignals[0];
    settings.mode = rule.mode;
    settings.shutter = rule.shutter;
    if (rule.mode === "Tv") settings.aperture = "Auto";
    settings.iso = "Auto";
    settings.focus = rule.focus;
    settings.drive = rule.drive;
    decisions.push(`${match.label} vælger ${rule.mode}: ${rule.shutter} prioriteres, mens kameraet hjælper med resten.`);
  }

  const distance = strongestMatch(explicitMatches, "distance");
  if (distance?.id === "far") decisions.push("Lang afstand prioriterer teleobjektiv og stabil støtte.");
  if (distance?.id === "near") decisions.push("Tæt afstand prioriterer et bredere objektiv og mere kontakt med motivet.");
  if (distance?.id === "close-up") {
    settings.aperture = "f/5.6";
    decisions.push("Close-up prioriterer kort fokusafstand og f/5.6 for lidt mere dybdeskarphed.");
  }
  if (distance?.id === "macro") {
    settings.aperture = "f/8";
    settings.focus = "Manuel fokus eller One Shot";
    decisions.push("Makro giver meget lille dybdeskarphed. Dit nuværende kit kan lave close-ups, men ikke ægte 1:1-makro uden et makroobjektiv eller mellemring.");
  }

  const lowLight = explicitMatches.find((match) => ["low-light", "indoor", "night", "nightclub", "evening"].includes(match.id));
  if (lowLight && profile.family !== "astro" && !profile.exposurePlan) {
    settings.iso = "Auto";
    decisions.push(`${lowLight.label} betyder, at ISO får lov at kompensere efter lukkertiden er sikret.`);
  }

  const brightLight = explicitMatches.find((match) => ["bright-sun", "midday"].includes(match.id));
  if (brightLight && profile.family !== "astro" && !profile.exposurePlan) {
    settings.iso = "100";
    decisions.push(`${brightLight.label} starter ved ISO 100 for at beskytte de lyse områder.`);
  }

  const place = strongestMatch(explicitMatches, "place");
  if (place) decisions.push(`${place.label} bruges som miljøkontekst og ændrer kun de indstillinger, stedet faktisk påvirker.`);

  return { settings, decisions };
}

function canAdaptMode(profile) {
  const protectedTechnique = profile.conditions?.technique?.some((id) => ["panning"].includes(id));
  return profile.family !== "astro" && profile.family !== "event" && profile.family !== "close-up" && !profile.exposurePlan && !protectedTechnique && profile.id !== "fireworks-tripod" && profile.modePolicy !== "fixed";
}

export function preferredRolesForScenario(profile, classification) {
  const roles = [...(profile.gearStrategy?.preferredLensRoles || [])];
  const ids = new Set((classification?.matches || []).map((match) => match.id));
  if (ids.has("far")) roles.unshift("telephoto");
  if (ids.has("near")) roles.unshift("people", "walkaround");
  if (ids.has("close-up") || ids.has("macro")) roles.unshift("close-up");
  if (ids.has("nightclub") || ids.has("indoor") || ids.has("low-light")) roles.unshift("low-light");
  if (ids.has("beach") || ids.has("landscape")) roles.unshift("wide");
  return [...new Set(roles)];
}

function strongestMatch(matches, type) {
  return matches.filter((match) => match.type === type).sort((a, b) => b.score - a.score)[0] || null;
}
