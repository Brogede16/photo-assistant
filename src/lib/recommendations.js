import { lensCoversAnyFocal } from "./focal.js";
import { preferredRolesForScenario, triangulateScenario } from "./scenario.js";

export function pickLens(profile, equipment, classification = null) {
  return rankLenses(profile, equipment, classification)[0]?.lens || equipment.lenses?.[0];
}

export function rankLenses(profile, equipment, classification = null) {
  const roles = preferredRolesForScenario(profile, classification);
  const lenses = equipment.lenses || [];
  const declaredFocal = profile.baseSettings?.focalLength;
  return lenses
    .map((lens) => ({
      lens,
      // Et objektiv, der ikke kan nå profilens egen brændvidde, må aldrig vinde
      // på rolle-point alene: så beder guiden brugeren om at zoome til noget,
      // objektivet fysisk ikke kan.
      coversFocal: lensCoversAnyFocal(lens, declaredFocal),
      score: roles.reduce((sum, role) => sum + (lens.roles?.includes(role) ? 1 : 0), 0)
    }))
    .sort((a, b) => Number(b.coversFocal) - Number(a.coversFocal)
      || b.score - a.score
      || (b.lens.focalLength?.max || 0) - (a.lens.focalLength?.max || 0));
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
    exposureCompensation: settings.exposureCompensation?.start || settings.exposureCompensation || undefined,
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
    setManualMode: ["Tryk LÅSEKNAPPEN i midten af programhjulet (øverst til venstre) ned, mens du drejer hjulet til M.", `Kontrollér at M vises på topskærmen, før du indstiller ${settings.shutter}, ${settings.aperture} og ISO ${settings.iso}.`],
    setAvMode: ["Tryk LÅSEKNAPPEN i midten af programhjulet (øverst til venstre) ned, mens du drejer hjulet til Av.", `Drej det tandede hjul, der omslutter udløserknappen (Main Dial), til ${settings.aperture}.`, `Kontrollér lukkertiden i søgeren (nederst til venstre i søgerbilledet) — den må ikke blive langsommere end ${settings.shutter}.`],
    setTvMode: ["Tryk LÅSEKNAPPEN i midten af programhjulet (øverst til venstre) ned, mens du drejer hjulet til Tv.", `Drej det tandede hjul, der omslutter udløserknappen (Main Dial), til ${settings.shutter}.`, "Kameraet vælger blænden automatisk."],
    setProgramMode: ["Tryk LÅSEKNAPPEN i midten af programhjulet (øverst til venstre) ned, mens du drejer hjulet til P.", "Lad kameraet vælge lukkertid og blænde til dette hurtige hverdagsbillede."],
    setBulbMode: ["Tryk LÅSEKNAPPEN i midten af programhjulet ned, mens du drejer det til M.", "Drej det tandede hjul ved udløserknappen (Main Dial) forbi 30 sekunder, til bogstavet B (Bulb) vises på topskærmen.", "Start og stop eksponeringen med Canon Camera Connect eller en fjernudløser."],
    setFocalLength: [`Montér ${lens.brand} ${lens.model} på kamerahuset.`, `Drej den brede gummiring yderst på objektivet (zoomringen) til ${settings.focalLength}.`],
    setShutter: ["Lukkertiden kan kun stilles direkte i M eller Tv. Står kameraet i Av eller P, vælger det selv — skift program først, hvis du ikke allerede har gjort det.", `Drej det tandede hjul, der omslutter selve udløserknappen (Main Dial), med pegefingeren uden at løfte hånden fra grebet. Hvert lille klik flytter typisk lukkertiden ét trin, til topskærmen viser ${settings.shutter}.`, wholeSecondsHint(settings.shutter)],
    setAperture: [settings.mode === "Av" ? `I Av: drej det tandede hjul ved udløserknappen (Main Dial) til ${settings.aperture}.` : `I M: drej det store hjul på bagsiden (Quick Control Dial, betjenes med tommelfingeren) til ${settings.aperture}.`, "Reagerer hjulet ikke, så tjek den lille LOCK-kontakt lige under baghjulet til venstre."],
    setIso: ["Tryk knappen mærket 'ISO' — den sidder i rækken af tre knapper på toppen af kameraet, lige bag udløseren.", `Drej det tandede hjul ved udløseren (Main Dial) til ${String(settings.iso).toLowerCase() === "auto" ? "AUTO" : settings.iso}, mens du kigger på topskærmen.`, "Tryk udløseren halvt ned for at bekræfte."],
    setAiServo: ["Tryk ÉN gang på AF-knappen — den sidder i rækken af tre knapper på toppen af kameraet. Ét tryk sætter Main Dial til at styre fokusmetode.", "Drej det tandede hjul ved udløseren (Main Dial), til AI SERVO vises på topskærmen.", `Tryk udløseren halvt ned og hold den der: AI Servo genfokuserer hele tiden, så længe du holder, i stedet for at låse fokus én gang. Hold fokuspunktet på motivet, mens det bevæger sig — anbefalingen her er ${settings.focus}.`],
    setOneShot: ["Tryk ÉN gang på AF-knappen — den sidder i rækken af tre knapper på toppen af kameraet. Ét tryk sætter Main Dial til at styre fokusmetode.", "Drej det tandede hjul ved udløseren (Main Dial), til ONE SHOT vises på topskærmen.", `Tryk udløseren halvt ned: fokus låser med et bip og forbliver låst, så længe du holder halvt nede — flytter du kameraet efter det bip, flytter fokus ikke med. Placér fokuspunktet som anbefalet: ${settings.focus}.`],
    setLensManualFocus: [`Skub den lille skydekontakt mærket AF/MF på siden af ${lens.model} til MF.`, `Drej fokusringen (den brede ring nærmest kamerahuset), til motivet står skarpt: ${settings.focus}.`],
    setHighSpeedContinuous: ["Tryk AF-knappen (rækken af tre knapper på toppen) ÉN gang — det skifter kun fokusmetode. Tryk den hurtigt igen, mens topskærmen stadig viser AF-symbolet: andet tryk skifter Main Dial til at styre DRIVE i stedet.", `Drej det tandede hjul ved udløseren (Main Dial), til ${settings.drive} vises på topskærmen.`, "Tag korte serier på 3-5 billeder — kortet fyldes hurtigt, og de fleste billeder i en lang serie bliver alligevel kasseret."],
    setDriveMode: ["Tryk AF-knappen (rækken af tre knapper på toppen) ÉN gang — det skifter kun fokusmetode. Tryk den hurtigt igen, mens topskærmen stadig viser AF-symbolet: andet tryk skifter Main Dial til at styre DRIVE i stedet.", `Drej det tandede hjul ved udløseren (Main Dial), til ${settings.drive} vises på topskærmen.`, settings.drive === "Single" ? "Tag ét billede ad gangen." : "Brug korte, kontrollerede serier."],
    setLensStabilizationOn: [`Find den lille skydekontakt mærket STABILIZER eller IS på siden af ${lens.model}, og sæt den til ON.`, "Slå stabilisering fra, hvis kameraet står helt fast på stativ."],
    useLiveViewForAstro: ["Vip den runde kontakt med den røde knap på bagsiden (øverst til højre for skærmen) for at aktivere Live View, tryk så den røde START/STOP-knap i midten.", "Forstør en klar stjerne 5x og derefter 10x (forstørrelsesknappen med lup-ikon, nederst til højre bagpå).", "Drej fokusringen på objektivet, til stjernen er mindst mulig og skarp."],
    use80dIntervalTimer: ["Tryk MENU (bagsiden, øverst til venstre) og find Intervaltimer under den røde optagefane.", "Sæt intervallet til den anbefalede pause og antal billeder til serien.", "Slå Long exposure noise reduction fra, før du starter lange serier."],
    useCanonCameraConnect: ["Forbind EOS 80D til Canon Camera Connect via kameraets Wi-Fi-menu (MENU-knap, bagsiden øverst til venstre).", "Åbn fjernoptagelse i appen, og brug appens udløser uden at røre kameraet."]
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
    },
    "wrong-colors": {
      title: "Forkerte farver",
      advice: [
        "Skyd RAW eller RAW+JPEG, hvis du ikke allerede gør — så kan hvidbalancen rettes bagefter uden tab af kvalitet.",
        "Skift hvidbalance fra Auto til den lyskilde, der faktisk er til stede, fx Wolfram/kunstlys ved stearinlys eller bål.",
        "Blandet lys (fx vindueslys og loftslampe samtidig) er svært at rette fuldt ud; prøv at slukke den ene lyskilde."
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
