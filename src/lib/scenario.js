const MOTION_RULES = {
  still: { rank: 0, shutter: "1/125", focus: "One Shot", drive: "Single" },
  gentle: { rank: 1, shutter: "1/320", focus: "AI Servo", drive: "Continuous low" },
  active: { rank: 2, shutter: "1/500", focus: "AI Servo", drive: "Continuous low" },
  fast: { rank: 3, shutter: "1/1000", focus: "AI Servo", drive: "High-speed continuous" },
  flight: { rank: 4, shutter: "1/1600", focus: "AI Servo", drive: "High-speed continuous" }
};

export function triangulateScenario(baseSettings, classification, profile) {
  const settings = { ...baseSettings };
  const decisions = [];
  const explicitMatches = (classification?.matches || []).filter((match) => !match.implied);
  const motionSignals = explicitMatches
    .map((match) => ({ match, rule: MOTION_RULES[match.effects?.motion] }))
    .filter((item) => item.rule)
    .sort((a, b) => b.rule.rank - a.rule.rank);

  if (motionSignals.length && profile.family !== "astro" && profile.id !== "fireworks-tripod") {
    const { match, rule } = motionSignals[0];
    settings.mode = "M";
    settings.shutter = rule.shutter;
    settings.focus = rule.focus;
    settings.drive = rule.drive;
    decisions.push(`${match.label} gør ${rule.shutter} til sikkert udgangspunkt og styrer fokus/serie.`);
  }

  const distance = strongestMatch(explicitMatches, "distance");
  if (distance?.id === "far") decisions.push("Lang afstand prioriterer teleobjektiv og stabil støtte.");
  if (distance?.id === "near") decisions.push("Tæt afstand prioriterer et bredere objektiv og mere kontakt med motivet.");

  const lowLight = explicitMatches.find((match) => ["low-light", "indoor", "night", "nightclub", "evening"].includes(match.id));
  if (lowLight && profile.family !== "astro") {
    settings.iso = "Auto";
    decisions.push(`${lowLight.label} betyder, at ISO får lov at kompensere efter lukkertiden er sikret.`);
  }

  const brightLight = explicitMatches.find((match) => ["bright-sun", "midday"].includes(match.id));
  if (brightLight && profile.family !== "astro") {
    settings.iso = "100";
    decisions.push(`${brightLight.label} starter ved ISO 100 for at beskytte de lyse områder.`);
  }

  const place = strongestMatch(explicitMatches, "place");
  if (place) decisions.push(`${place.label} bruges som miljøkontekst og ændrer kun de indstillinger, stedet faktisk påvirker.`);

  return { settings, decisions };
}

export function preferredRolesForScenario(profile, classification) {
  const roles = [...(profile.gearStrategy?.preferredLensRoles || [])];
  const ids = new Set((classification?.matches || []).map((match) => match.id));
  if (ids.has("far")) roles.unshift("telephoto");
  if (ids.has("near")) roles.unshift("people", "walkaround");
  if (ids.has("nightclub") || ids.has("indoor") || ids.has("low-light")) roles.unshift("low-light");
  if (ids.has("beach") || ids.has("landscape")) roles.unshift("wide");
  return [...new Set(roles)];
}

function strongestMatch(matches, type) {
  return matches.filter((match) => match.type === type).sort((a, b) => b.score - a.score)[0] || null;
}
