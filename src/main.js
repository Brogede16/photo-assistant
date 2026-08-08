import { readExifFromFile } from "./lib/exif.js";
import { startAmbientField } from "./lib/ambient.js";
import { maxStarShutterSeconds } from "./lib/astro.js";
import { deletePreset, loadPresets, savePreset } from "./lib/presets.js";
import { buildRecommendation, explainProblem, rankLenses } from "./lib/recommendations.js";
import { consumeKnownTerms, findTermById, mergeTagIds, searchProfiles, suggestNextTags, termsToQuery } from "./lib/search.js";

const state = {
  equipment: null,
  taxonomy: null,
  profiles: [],
  lessons: [],
  context: {},
  selectedResult: null,
  searchText: "",
  selectedTagIds: [],
  activeClassification: null,
  presets: loadPresets(),
  unknownSearches: loadUnknownSearches(),
  selectedLearnTopic: "shutter",
  exposureTrainer: { shutter: 0, aperture: 0, iso: 0 },
  astroTool: {},
  theme: getInitialTheme(),
  ambientEnabled: getInitialAmbientSetting()
};

const app = document.querySelector("#app");
let stopAmbientField = null;
let wakeLock = null;

applyTheme();
boot();

async function boot() {
  try {
    const [equipment, taxonomy, situations, learning] = await Promise.all([
      fetchJson("/src/data/equipment/index.json"),
      fetchJson("/src/data/search/taxonomy.json"),
      fetchJson("/src/data/situations/core-profiles.json"),
      fetchJson("/src/data/learn/lessons.json")
    ]);
    state.equipment = equipment;
    state.taxonomy = taxonomy;
    state.profiles = situations.profiles;
    state.lessons = learning.lessons;
    registerServiceWorker();
    setupWakeLock();
    render();
  } catch (error) {
    renderBootError(error);
  }
}

function render() {
  stopAmbientField?.();
  app.classList.toggle("ambient-on", state.ambientEnabled);
  app.innerHTML = `
    <canvas class="ambient-field" aria-hidden="true" ${state.ambientEnabled ? "" : "hidden"}></canvas>
    <header class="topbar">
      <div>
        <p class="eyebrow">Canon EOS 80D</p>
        <h1>Photo Assistant</h1>
      </div>
      <div class="header-actions">
        <button class="icon-button fx-toggle ${state.ambientEnabled ? "active" : ""}" data-action="toggle-ambient" aria-pressed="${state.ambientEnabled}" aria-label="${state.ambientEnabled ? "Sæt gradientens bevægelse på pause" : "Start gradientens bevægelse"}" title="${state.ambientEnabled ? "Gradient bevæger sig" : "Gradient er sat på pause"}"><span aria-hidden="true">${state.ambientEnabled ? "Ⅱ" : "▶"}</span></button>
        <button class="icon-button theme-toggle" data-action="toggle-theme" aria-label="Skift farvetema" title="Skift farvetema"><span aria-hidden="true">${themeIcon(state.theme)}</span></button>
        <button class="icon-button" data-action="show-equipment" aria-label="Mit udstyr" title="Mit udstyr">80D</button>
      </div>
    </header>

    <main>
      <section class="search-hero">
        <label for="search-input">Hvad vil du fotografere?</label>
        <input id="search-input" type="search" autocomplete="off" placeholder="fx ko spiser langt væk på en mark" value="${escapeHtml(state.searchText)}" />
        <div class="selected-tags" aria-label="Valgte tags">
          ${renderSelectedTags()}
        </div>
        <div class="suggestion-block">
          <p class="section-kicker">Tags</p>
          <div class="quick-actions">
            ${renderSuggestedTags()}
          </div>
        </div>
      </section>

      <nav class="tabbar" aria-label="Hovedfunktioner">
        <button data-view="home" class="active">Fotografér</button>
        <button data-view="presets">Presets</button>
        <button data-view="learn">Lær</button>
      </nav>

      <section id="content" class="content-grid"></section>
    </main>
  `;

  bindShellEvents();
  renderHome();
  if (state.ambientEnabled) stopAmbientField = startAmbientField(document.querySelector(".ambient-field"));
}

function renderHome(results = null) {
  const content = document.querySelector("#content");
  const query = currentSearchQuery();
  const defaultSearch = searchProfiles(query || "stjerner nordlys måne fugl dyr mennesker", state.profiles, state.taxonomy, state.presets);
  if (!state.activeClassification) state.activeClassification = defaultSearch.classification;
  setSearchVisibility(true);
  const resultList = results || defaultSearch.results.slice(0, 4);

  content.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <h2>${query ? "Anbefalinger til din situation" : "Guides"}</h2>
      </div>
      <div class="result-list">
        ${resultList.length ? resultList.map(renderResultCard).join("") : renderEmptyResults(query)}
      </div>
    </section>
  `;
  bindResultEvents();
}

function renderSelectedTags() {
  if (!state.selectedTagIds.length) {
    return "";
  }
  return state.selectedTagIds
    .map((id) => {
      const term = findTermById(state.taxonomy, id);
      if (!term) return "";
      return `<button class="tag-chip selected" data-remove-tag="${term.id}" title="Fjern ${term.label}">${term.label}<span aria-hidden="true">×</span></button>`;
    })
    .join("") + `<button class="clear-tags" data-action="clear-tags">Ryd alle</button>`;
}

function renderSuggestedTags() {
  const suggestions = suggestNextTags(currentSearchQuery(), state.profiles, state.taxonomy, state.selectedTagIds, 9);
  return suggestions.map((term) => `<button class="tag-chip" data-add-tags="${term.id}">${term.label}</button>`).join("");
}

function renderPresets() {
  setSearchVisibility(false);
  const content = document.querySelector("#content");
  content.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <p class="section-kicker">Mine presets</p>
        <h2>Lokalt gemt på denne enhed</h2>
      </div>
      <label class="file-import">
        Importer EXIF fra billede
        <input id="exif-file" type="file" accept="image/jpeg,image/tiff" />
      </label>
      <div id="exif-output"></div>
      <div class="result-list">
        ${state.presets.length ? state.presets.map(renderPresetCard).join("") : "<p>Ingen egne presets endnu.</p>"}
      </div>
    </section>
  `;
  document.querySelector("#exif-file").addEventListener("change", handleExifImport);
  bindResultEvents();
}

function renderLearn() {
  setSearchVisibility(false);
  const content = document.querySelector("#content");
  const lesson = state.lessons.find((item) => item.id === state.selectedLearnTopic) || state.lessons[0];
  content.innerHTML = `
    <section class="panel learn-panel">
      <div class="panel-header">
        <p class="section-kicker">Lær ved at vælge</p>
        <h2>Foto i praksis</h2>
      </div>
      <div class="learn-topics" role="tablist" aria-label="Læringsemner">
        ${state.lessons.map((item) => `<button role="tab" data-learn-topic="${item.id}" class="${item.id === lesson.id ? "active" : ""}" aria-selected="${item.id === lesson.id}">${item.label}</button>`).join("")}
      </div>
      <article class="lesson-body">
        <h3>${lesson.title}</h3>
        <p>${lesson.intro}</p>
        <div class="lesson-scale">
          ${lesson.scale.map((point) => `<div><strong>${point.value}</strong><span>${point.label}</span><small>${point.effect}</small></div>`).join("")}
        </div>
        ${lesson.explanations ? `
          <section class="mode-explanations" aria-label="Forklaring af kameraprogrammer">
            ${lesson.explanations.map((mode) => `
              <div class="mode-explanation">
                <strong class="mode-symbol">${mode.value}</strong>
                <div>
                  <h4>${mode.name}</h4>
                  <p>${mode.meaning}</p>
                  <p><strong>Bedst når:</strong> ${mode.bestFor}</p>
                </div>
              </div>
            `).join("")}
          </section>
        ` : ""}
      ${renderExposureTrainer()}
      <div class="lesson-rule"><span>Husk</span><p>${lesson.rule}</p></div>
        <section class="field-exercise">
          <p class="section-kicker">Prøv det med dit 80D</p>
          <p>${lesson.exercise}</p>
        </section>
        <section class="lesson-check">
          <p class="section-kicker">Tjek din forståelse</p>
          <h3>${lesson.question}</h3>
          <div class="answer-grid">
            ${lesson.answers.map((answer, index) => `<button data-learn-answer="${index}" data-correct="${lesson.correct}">${answer}</button>`).join("")}
          </div>
          <p id="learn-feedback" aria-live="polite"></p>
        </section>
      </article>
      <div class="camera-steps">
        <p class="section-kicker">Knapperne på Canon EOS 80D</p>
        <div class="guide-list">
          ${lessonProcedureIds(lesson.id).map((key) => `<details><summary>${labelProcedure(key)}</summary><ol>${state.equipment.cameras[0].procedures[key].map((step) => `<li>${step}</li>`).join("")}</ol></details>`).join("")}
        </div>
      </div>
    </section>
  `;
  document.querySelectorAll("[data-learn-topic]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedLearnTopic = button.dataset.learnTopic;
      renderLearn();
    });
  });
  document.querySelectorAll("[data-learn-answer]").forEach((button) => {
    button.addEventListener("click", () => {
      const correct = Number(button.dataset.learnAnswer) === Number(button.dataset.correct);
      document.querySelectorAll("[data-learn-answer]").forEach((item) => item.classList.remove("correct", "wrong"));
      button.classList.add(correct ? "correct" : "wrong");
      document.querySelector("#learn-feedback").textContent = correct ? lesson.feedback : "Ikke helt. Se på skalaen ovenfor og prøv igen.";
    });
  });
  document.querySelectorAll("[data-exposure-control]").forEach((input) => {
    input.addEventListener("input", () => {
      state.exposureTrainer[input.dataset.exposureControl] = Number(input.value);
      renderLearn();
    });
  });
}

function renderExposureTrainer() {
  const { shutter, aperture, iso } = state.exposureTrainer;
  const total = shutter + aperture + iso;
  const base = {
    shutter: valueFromStops(["1/4000", "1/2000", "1/1000", "1/500", "1/250", "1/125", "1/60", "1/30", "1/15", "1/8", "1/4"], shutter),
    aperture: valueFromStops(["f/16", "f/11", "f/8", "f/5.6", "f/4", "f/2.8", "f/2", "f/1.8"], aperture),
    iso: valueFromStops(["ISO 100", "ISO 200", "ISO 400", "ISO 800", "ISO 1600", "ISO 3200", "ISO 6400"], iso)
  };
  return `
    <section class="exposure-trainer">
      <div>
        <p class="section-kicker">Hvad sker der hvis jeg ændrer denne?</p>
        <h3>Eksponering hænger sammen</h3>
        <p>Flyt én skyder. Appen viser, hvor meget lys du har tilføjet eller fjernet, og hvad du kan gøre for at holde samme lysmængde.</p>
      </div>
      <div class="trainer-readout">
        <span>${base.shutter}</span>
        <span>${base.aperture}</span>
        <span>${base.iso}</span>
      </div>
      ${renderExposureSlider("shutter", "Lukkertid", "Hurtigere", "Langsommere")}
      ${renderExposureSlider("aperture", "Blænde", "Mindre åbning", "Mere åbning")}
      ${renderExposureSlider("iso", "ISO", "Lavere ISO", "Højere ISO")}
      <div class="trainer-balance ${total === 0 ? "balanced" : ""}">
        <strong>${total === 0 ? "Samme lysmængde" : `${Math.abs(total)} stop ${total > 0 ? "lysere" : "mørkere"}`}</strong>
        <p>${exposureAdvice(total)}</p>
      </div>
    </section>
  `;
}

function renderExposureSlider(key, label, leftLabel, rightLabel) {
  const value = state.exposureTrainer[key];
  return `
    <label class="exposure-slider">
      <span>${label}</span>
      <input data-exposure-control="${key}" type="range" min="-3" max="3" step="1" value="${value}" />
      <small>${leftLabel} · ${rightLabel}</small>
    </label>
  `;
}

function valueFromStops(values, stops) {
  const baseIndex = Math.floor(values.length / 2);
  const index = Math.max(0, Math.min(values.length - 1, baseIndex + stops));
  return values[index];
}

function exposureAdvice(total) {
  if (total === 0) return "Du har balanceret ændringerne. Billedet bør blive cirka lige lyst, men bevægelse, dybdeskarphed og støj ændrer sig.";
  if (total > 0) return "Billedet bliver lysere. For at holde samme lys: vælg hurtigere lukkertid, mindre blændeåbning eller lavere ISO.";
  return "Billedet bliver mørkere. For at holde samme lys: vælg længere lukkertid, større blændeåbning eller højere ISO.";
}

function lessonProcedureIds(lessonId) {
  return {
    shutter: ["setManualMode", "setShutter"],
    aperture: ["setAvMode", "setAperture"],
    iso: ["setIso"],
    focus: ["setAiServo", "setOneShot", "setLensManualFocus"],
    distance: ["setLensStabilizationOn", "setLensManualFocus"],
    modes: ["setProgramMode", "setAvMode", "setTvMode", "setManualMode", "setBulbMode"]
  }[lessonId] || ["setManualMode"];
}

function renderEquipment() {
  const content = document.querySelector("#content");
  content.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <p class="section-kicker">Mit udstyr</p>
        <h2>Forudindlæst kit</h2>
      </div>
      <div class="equipment-list">
        ${state.equipment.cameras.map((item) => `<article><strong>${item.brand} ${item.model}</strong><p>APS-C · crop ${item.sensor.cropFactor} · ${item.capabilities.maxMechanicalFps} fps</p></article>`).join("")}
        ${state.equipment.lenses.map((item) => `<article><strong>${item.brand} ${item.model}</strong><p>${item.roles.join(" · ")}</p></article>`).join("")}
        ${state.equipment.flashes.map((item) => `<article><strong>${item.brand} ${item.model}</strong><p>${item.roles.join(" · ")}</p></article>`).join("")}
      </div>
    </section>
  `;
}

function renderResultCard(result, index) {
  if (result.type === "preset") return renderPresetCard(result.item, result.score);
  const recommendation = buildRecommendation(result.item, state.equipment, { ...state.context, classification: state.activeClassification, presetInfluence: result.presetInfluence });
  return `
    <article class="result-card" data-result-index="${index}">
      <div class="card-title-row">
        <div>
          ${result.presetInfluence ? `<p class="badge">Dit preset påvirker guiden</p>` : ""}
          <h3>${result.item.title}</h3>
        </div>
        <button data-open-result="${result.item.id}">Åbn</button>
      </div>
      <button class="lens-choice" data-explain-lens="${result.item.id}">${recommendation.lens.brand} ${recommendation.lens.model}</button>
      <div class="settings-strip" aria-label="Kameraindstillinger">
        ${renderSettingPill("mode", recommendation.settings.mode, result.item.id)}
        ${renderSettingPill("shutter", recommendation.settings.shutter, result.item.id)}
        ${renderSettingPill("aperture", recommendation.settings.aperture, result.item.id)}
        ${renderSettingPill("iso", recommendation.settings.iso, result.item.id)}
      </div>
      <div class="setting-explanation" aria-live="polite"></div>
      ${recommendation.exposurePlan ? `<p class="exposure-summary">${recommendation.exposurePlan.perFrame} pr. billede · ${recommendation.exposurePlan.total} samlet</p>` : ""}
    </article>
  `;
}

function renderPresetCard(preset) {
  return `
    <article class="result-card user-preset">
      <div class="card-title-row">
        <div>
          <p class="badge personal">★ MIT PRESET</p>
          <h3>${preset.name}</h3>
        </div>
      </div>
      <p>${preset.notes || "Eget preset gemt lokalt."}</p>
      ${preset.baseProfileId ? `<p class="preset-effect">Kan påvirke matchende guides som lokalt udgangspunkt.</p>` : ""}
      <div class="settings-strip">
        ${renderPresetSettings(preset.settings)}
      </div>
      <div class="quick-actions">
        <button data-edit-preset="${preset.id}">Ret navn</button>
        <button data-delete-preset="${preset.id}">Slet</button>
      </div>
    </article>
  `;
}

function renderPresetSettings(settings = {}) {
  const labels = {
    camera: "Kamera",
    lens: "Objektiv",
    focalLength: "Brændvidde",
    mode: "Program",
    shutter: "Lukkertid",
    aperture: "Blænde",
    iso: "ISO",
    focus: "Fokus",
    drive: "Serie",
    dateTime: "Dato"
  };
  const order = ["mode", "focalLength", "shutter", "aperture", "iso", "focus", "drive", "camera", "lens", "dateTime"];
  const values = order
    .filter((key) => settings[key])
    .map((key) => `<span><small>${labels[key]}</small>${key === "iso" && !String(settings[key]).startsWith("ISO") ? `ISO ${settings[key]}` : settings[key]}</span>`);
  return values.length ? values.join("") : "<span>Ingen læsbare værdier</span>";
}

function renderSettingPill(key, value, profileId) {
  const display = key === "iso" && !String(value).startsWith("ISO") ? `ISO ${value}` : value;
  return `<button class="setting-pill" data-explain-setting="${key}" data-setting-value="${escapeHtml(value)}" data-profile-id="${profileId}">${escapeHtml(display)}</button>`;
}

function renderEmptyResults(query) {
  rememberUnknownSearch(query);
  return `
    <article class="empty-state">
      <h3>Ingen guide matcher endnu</h3>
      <p>Prøv at gøre situationen lidt bredere med tags som motiv, sted, lys eller bevægelse. Søgningen er gemt lokalt, så vi kan se hvilke scenarier appen mangler.</p>
    </article>
  `;
}

function openResult(profileId) {
  const profile = state.profiles.find((item) => item.id === profileId);
  const currentResult = searchProfiles(currentSearchQuery(), state.profiles, state.taxonomy, state.presets).results.find((result) => result.type === "official" && result.item.id === profileId);
  const recommendation = buildRecommendation(profile, state.equipment, { ...state.context, classification: state.activeClassification, presetInfluence: currentResult?.presetInfluence });
  const content = document.querySelector("#content");
  content.innerHTML = `
    <section class="panel detail-panel">
      <button class="text-button" data-action="back-home">Tilbage</button>
      <p class="section-kicker">${profile.family}</p>
      <h2>${profile.title}</h2>
      <p class="hero-setting">${recommendation.lens.brand} ${recommendation.lens.model}</p>
      <div class="settings-strip large">
        ${renderSettingPill("mode", recommendation.settings.mode, profile.id)}
        ${renderSettingPill("focalLength", recommendation.settings.focalLength, profile.id)}
        ${renderSettingPill("shutter", recommendation.settings.shutter, profile.id)}
        ${renderSettingPill("aperture", recommendation.settings.aperture, profile.id)}
        ${renderSettingPill("iso", recommendation.settings.iso, profile.id)}
      </div>
      <div class="setting-explanation detail-explanation" aria-live="polite"></div>
      <div class="settings-strip technique-strip">
        ${renderSettingPill("focus", recommendation.settings.focus, profile.id)}
        ${renderSettingPill("drive", recommendation.settings.drive, profile.id)}
        ${recommendation.flash ? renderSettingPill("flash", recommendation.flash.model, profile.id) : ""}
      </div>
      ${renderExposurePlan(recommendation.exposurePlan)}
      ${renderAstroShutterTool(profile, recommendation)}
      ${recommendation.scenarioDecisions.length ? `<div class="scenario-decisions"><p class="section-kicker">Sådan hænger dine tags sammen</p><ul>${recommendation.scenarioDecisions.map((item) => `<li>${item}</li>`).join("")}</ul></div>` : ""}
      <h3>Hurtig guide</h3>
      <ol>${profile.quickGuide.map((step) => `<li>${step}</li>`).join("")}</ol>
      ${renderFieldGuide(profile)}
      <h3>Vis mig præcis hvordan</h3>
      <div class="guide-list">
        ${recommendation.actions
          .filter((action) => action.steps.length)
          .map((action) => `<details><summary>${labelProcedure(action.id)}</summary><ol>${action.steps.map((step) => `<li>${step}</li>`).join("")}</ol></details>`)
          .join("")}
      </div>
      <h3>Det virkede ikke</h3>
      <div class="quick-actions">
        <button data-problem="too-dark">For mørkt</button>
        <button data-problem="too-bright">For lyst</button>
        <button data-problem="blurry">Uskarpt</button>
        <button data-problem="noise">Grynet</button>
      </div>
      <div id="problem-output"></div>
      <button data-save-official="${profile.id}">Gem som mit preset</button>
    </section>
  `;
  document.querySelector('[data-action="back-home"]').addEventListener("click", () => renderHome());
  document.querySelectorAll("[data-problem]").forEach((button) => {
    button.addEventListener("click", () => {
      const explanation = explainProblem(button.dataset.problem, recommendation);
      document.querySelector("#problem-output").innerHTML = `<div class="advice-box"><strong>${explanation.title}</strong><ul>${explanation.advice.map((line) => `<li>${line}</li>`).join("")}</ul></div>`;
    });
  });
  document.querySelector("[data-save-official]").addEventListener("click", () => {
    const name = prompt("Navn til dit preset", `${profile.title} - mit preset`);
    if (!name) return;
    savePreset({
      name,
      settings: recommendation.settings,
      tags: [...new Set([...state.selectedTagIds, ...(profile.subjects || [])])],
      notes: `Baseret på ${profile.title}`,
      baseProfileId: profile.id
    });
    state.presets = loadPresets();
    renderPresets();
  });
  bindResultEvents();
  bindAstroTool(profile.id);
}

function renderAstroShutterTool(profile, recommendation) {
  if (!isAstroShutterProfile(profile)) return "";
  const camera = state.equipment.cameras[0];
  const lenses = state.equipment.lenses.filter((lens) => lens.roles?.some((role) => ["astro", "wide", "normal"].includes(role)));
  const selected = state.astroTool[profile.id] || {
    lensId: recommendation.lens.id,
    focalLength: parseFocalLength(recommendation.settings.focalLength) || recommendation.lens.focalLength?.min || 18
  };
  const lens = lenses.find((item) => item.id === selected.lensId) || lenses[0];
  const focal = clamp(Number(selected.focalLength) || lens.focalLength.min, lens.focalLength.min, lens.focalLength.max);
  const maxSeconds = maxStarShutterSeconds(focal, camera.sensor.cropFactor);
  const cautiousSeconds = Math.max(1, Math.floor(maxSeconds * 0.75));
  return `
    <section class="astro-tool" data-astro-profile="${profile.id}">
      <div>
        <p class="section-kicker">Astro-tjek</p>
        <h3>Maks lukkertid før stjerner trækker spor</h3>
        <p>Vælg objektiv og brændvidde. Brug det forsigtige tal, hvis stjernerne skal være helt små prikker.</p>
      </div>
      <label>
        Objektiv
        <select data-astro-lens>
          ${lenses.map((item) => `<option value="${item.id}" ${item.id === lens.id ? "selected" : ""}>${item.brand} ${item.model}</option>`).join("")}
        </select>
      </label>
      <label class="exposure-slider">
        <span>Brændvidde: ${focal}mm</span>
        <input data-astro-focal type="range" min="${lens.focalLength.min}" max="${lens.focalLength.max}" step="1" value="${focal}" />
        <small>${lens.focalLength.min}-${lens.focalLength.max}mm på ${lens.model}</small>
      </label>
      <div class="astro-readout">
        <div><span>Forsigtigt</span><strong>${cautiousSeconds}s</strong></div>
        <div><span>Øvre grænse</span><strong>${maxSeconds}s</strong></div>
      </div>
      <p>På EOS 80D ganger crop-faktoren brændvidden med ${camera.sensor.cropFactor}. Ved ${focal}mm svarer det til cirka ${Math.round(focal * camera.sensor.cropFactor)}mm full-frame.</p>
    </section>
  `;
}

function bindAstroTool(profileId) {
  const tool = document.querySelector(`[data-astro-profile="${profileId}"]`);
  if (!tool) return;
  const update = () => {
    const lens = state.equipment.lenses.find((item) => item.id === tool.querySelector("[data-astro-lens]").value);
    const focal = clamp(Number(tool.querySelector("[data-astro-focal]").value), lens.focalLength.min, lens.focalLength.max);
    state.astroTool[profileId] = { lensId: lens.id, focalLength: focal };
    openResult(profileId);
  };
  tool.querySelector("[data-astro-lens]")?.addEventListener("change", update);
  tool.querySelector("[data-astro-focal]")?.addEventListener("input", update);
}

function isAstroShutterProfile(profile) {
  const subjects = new Set(profile.subjects || []);
  return profile.family === "astro" && ["stars", "milky-way", "meteor-shower", "star-trails"].some((id) => subjects.has(id));
}

function renderExposurePlan(plan) {
  if (!plan) return "";
  return `
    <section class="exposure-plan">
      <div>
        <p class="section-kicker">Lang eksponering</p>
        <h3>Plan for hele forløbet</h3>
      </div>
      <p class="timing-note">${plan.timing}</p>
      <div class="exposure-grid">
        <div><span>Pr. billede</span><strong>${plan.perFrame}</strong></div>
        <div><span>Antal</span><strong>${plan.frames}</strong></div>
        <div><span>Interval</span><strong>${plan.interval}</strong></div>
        <div><span>Samlet tid</span><strong>${plan.total}</strong></div>
      </div>
      <p><strong>Canon-app:</strong> ${plan.control}</p>
      <details><summary>Alternativ med Bulb</summary><p>${plan.alternative}</p></details>
    </section>
  `;
}

function renderFieldGuide(profile) {
  if (!profile.fieldGuide) return "";
  const before = profile.fieldGuide.before || [];
  const during = profile.fieldGuide.during || [];
  return `
    <div class="field-guide">
      ${before.length ? `<section><h3>Før du tager billedet</h3><ol>${before.map((step) => `<li>${step}</li>`).join("")}</ol></section>` : ""}
      ${during.length ? `<section><h3>Når du fotograferer</h3><ol>${during.map((step) => `<li>${step}</li>`).join("")}</ol></section>` : ""}
    </div>
  `;
}

function bindShellEvents() {
  document.querySelectorAll("[data-add-tags]").forEach((button) => {
    button.addEventListener("click", () => {
      addTags(button.dataset.addTags.split(","));
    });
  });

  document.querySelectorAll("[data-remove-tag]").forEach((button) => {
    button.addEventListener("click", () => removeTag(button.dataset.removeTag));
  });

  document.querySelector('[data-action="clear-tags"]')?.addEventListener("click", clearTags);

  document.querySelector("#search-input")?.addEventListener("input", (event) => {
    state.searchText = event.currentTarget.value;
    promoteCompletedInputTerms();
    refreshSearchComposer();
    runSearch(currentSearchQuery());
  });

  document.querySelector("#search-input")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      state.searchText = event.currentTarget.value;
      promoteCompletedInputTerms({ includeLastTerm: true });
      runSearch(currentSearchQuery());
      refreshSearchComposer();
    }
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-view]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      if (button.dataset.view === "presets") renderPresets();
      if (button.dataset.view === "learn") renderLearn();
      if (button.dataset.view === "home") renderHome();
    });
  });

  document.querySelector('[data-action="show-equipment"]')?.addEventListener("click", renderEquipment);
  document.querySelector('[data-action="toggle-theme"]')?.addEventListener("click", toggleTheme);
  document.querySelector('[data-action="toggle-ambient"]')?.addEventListener("click", toggleAmbient);
}

function getInitialTheme() {
  const saved = localStorage.getItem("photoAssistant.theme");
  if (saved === "light" || saved === "dark" || saved === "red") return saved;
  const hour = new Date().getHours();
  if (hour >= 23 || hour < 6) return "red";
  if (hour >= 7 && hour < 17) return "light";
  return "dark";
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  const colors = { dark: "#090b0e", light: "#f4f6f8", red: "#090000" };
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", colors[state.theme] || colors.dark);
}

function toggleTheme() {
  const themes = ["light", "dark", "red"];
  state.theme = themes[(themes.indexOf(state.theme) + 1) % themes.length];
  localStorage.setItem("photoAssistant.theme", state.theme);
  applyTheme();
  render();
}

function getInitialAmbientSetting() {
  return localStorage.getItem("photoAssistant.ambientEnabled") !== "false";
}

function toggleAmbient() {
  state.ambientEnabled = !state.ambientEnabled;
  localStorage.setItem("photoAssistant.ambientEnabled", String(state.ambientEnabled));
  render();
}

function addTags(ids) {
  state.selectedTagIds = mergeTagIds(state.taxonomy, state.selectedTagIds, ids);
  runSearch(currentSearchQuery());
  render();
}

function promoteCompletedInputTerms({ includeLastTerm = false } = {}) {
  const input = document.querySelector("#search-input");
  const consumed = consumeKnownTerms(state.searchText, state.taxonomy, { includeLastTerm });
  if (!consumed.termIds.length) return false;
  state.selectedTagIds = mergeTagIds(state.taxonomy, state.selectedTagIds, consumed.termIds);
  state.searchText = consumed.remainder;
  if (input) input.value = state.searchText;
  return true;
}

function removeTag(id) {
  state.selectedTagIds = state.selectedTagIds.filter((tagId) => tagId !== id);
  runSearch(currentSearchQuery());
  render();
}

function clearTags() {
  state.selectedTagIds = [];
  state.searchText = "";
  state.activeClassification = null;
  render();
}

function currentSearchQuery() {
  return termsToQuery(state.taxonomy, state.selectedTagIds, state.searchText);
}

function refreshSearchComposer() {
  document.querySelector(".selected-tags").innerHTML = renderSelectedTags();
  document.querySelector(".suggestion-block .quick-actions").innerHTML = renderSuggestedTags();
  document.querySelectorAll("[data-add-tags]").forEach((button) => {
    button.addEventListener("click", () => addTags(button.dataset.addTags.split(",")));
  });
  document.querySelectorAll("[data-remove-tag]").forEach((button) => {
    button.addEventListener("click", () => removeTag(button.dataset.removeTag));
  });
  document.querySelector('[data-action="clear-tags"]')?.addEventListener("click", clearTags);
}

function bindResultEvents() {
  document.querySelectorAll("[data-open-result]").forEach((button) => {
    button.addEventListener("click", () => openResult(button.dataset.openResult));
  });
  document.querySelectorAll("[data-explain-setting]").forEach((button) => {
    button.addEventListener("click", () => showSettingExplanation(button));
  });
  document.querySelectorAll("[data-explain-lens]").forEach((button) => {
    button.addEventListener("click", () => showLensExplanation(button));
  });
  document.querySelectorAll("[data-delete-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      deletePreset(button.dataset.deletePreset);
      state.presets = loadPresets();
      renderPresets();
    });
  });
  document.querySelectorAll("[data-edit-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const preset = state.presets.find((item) => item.id === button.dataset.editPreset);
      if (!preset) return;
      const name = prompt("Nyt navn til preset", preset.name);
      if (!name) return;
      savePreset({ ...preset, name });
      state.presets = loadPresets();
      renderPresets();
    });
  });
}

function runSearch(query) {
  const search = searchProfiles(query, state.profiles, state.taxonomy, state.presets);
  state.activeClassification = search.classification;
  renderHome(search.results.slice(0, 10));
}

function showSettingExplanation(button) {
  const profile = state.profiles.find((item) => item.id === button.dataset.profileId);
  if (!profile) return;
  const recommendation = buildRecommendation(profile, state.equipment, { ...state.context, classification: state.activeClassification });
  const key = button.dataset.explainSetting;
  const value = button.dataset.settingValue;
  const target = button.closest(".result-card, .detail-panel")?.querySelector(".setting-explanation");
  if (!target) return;
  target.innerHTML = renderSettingExplanation(key, recommendation, value);
}

function showLensExplanation(button) {
  const profile = state.profiles.find((item) => item.id === button.dataset.explainLens);
  if (!profile) return;
  const recommendation = buildRecommendation(profile, state.equipment, { ...state.context, classification: state.activeClassification });
  const target = button.closest(".result-card")?.querySelector(".setting-explanation");
  if (!target) return;
  target.innerHTML = `
    <strong>Hvorfor dette objektiv?</strong>
    <p>${explainLensChoice(recommendation)}</p>
  `;
}

function renderSettingExplanation(key, recommendation, fallbackValue = "") {
  const value = recommendation.settings[key] || fallbackValue;
  const explanations = {
    mode: explainMode(value, recommendation),
    focalLength: `Brændvidden bestemmer udsnittet. ${value} er valgt for at passe til motivets afstand og scenariets behov for enten vidvinkel, normalvinkel eller tele.`,
    shutter: explainShutter(value, recommendation),
    aperture: explainAperture(value, recommendation),
    iso: explainIso(value, recommendation),
    focus: `Fokus er sat til ${value}, fordi scenariet enten kræver præcision på et stille motiv eller løbende fokus på bevægelse.`,
    drive: `Optagelse er sat til ${value}. Brug enkeltbillede til rolige motiver og korte serier, når øjeblikket eller bevægelsen ændrer sig hurtigt.`,
    flash: `Flash foreslås kun, når scenariet kan tåle ekstra lys uden at ødelægge stemningen eller motivet.`
  };
  return `
    <strong>${settingLabel(key)}: ${key === "iso" && !String(value).startsWith("ISO") ? `ISO ${value}` : value}</strong>
    <p>${explanations[key] || "Denne værdi er valgt ud fra scenariets tags og dit udstyr."}</p>
  `;
}

function explainMode(value, recommendation) {
  const map = {
    P: "P lader kameraet vælge både blænde og lukkertid. Det passer bedst, når øjeblikket er vigtigere end en bestemt teknisk effekt.",
    Av: `Av betyder blændeprioritet. Du vælger ${recommendation.settings.aperture}, fordi dybdeskarphed og lysindtag er vigtigst her. Kameraet vælger lukkertiden, men hold øje med at den ikke bliver langsommere end anbefalingen.`,
    Tv: `Tv betyder lukkertidsprioritet. Du vælger ${recommendation.settings.shutter}, fordi bevægelsen er det vigtigste at styre. Kameraet vælger blænden.`,
    M: `M låser både ${recommendation.settings.shutter} og ${recommendation.settings.aperture}. Det er bedst, når scenen skifter lys, men billedets bevægelse og dybdeskarphed ikke må flytte sig.`,
    Bulb: "Bulb bruges, når eksponeringen skal være længere end kameraets normale 30 sekunder. Brug stativ og Canon Camera Connect eller fjernudløser."
  };
  return map[value] || "Programmet er valgt efter hvor meget kontrol scenariet kræver.";
}

function explainShutter(value, recommendation) {
  const text = String(value);
  if (text.endsWith("s")) return `${value} er en lang lukkertid. Den bruges enten fordi kameraet står på stativ, eller fordi bevægelsen gerne må tegnes som lys, vand eller stjernespor.`;
  return `${value} er valgt for at styre bevægelse. Jo hurtigere motivet bevæger sig, jo kortere tid skal sensoren se det. Bliver motivet uskarpt, er lukkertiden ofte det første sted at stramme op.`;
}

function explainAperture(value, recommendation) {
  const numeric = Number(String(value).replace("f/", ""));
  if (numeric <= 2.8) return `${value} giver meget lys og blødere baggrund. Til gengæld bliver fokusområdet smalt, så fokuspunktet skal sidde præcist.`;
  if (numeric >= 8) return `${value} giver mere dybdeskarphed, så mere af motivet kan blive skarpt. Det koster lys, så lukkertid eller ISO skal ofte hjælpe.`;
  return `${value} er et balanceret valg: mere dybdeskarphed end helt åben blænde, men stadig rimeligt lysstærkt.`;
}

function explainIso(value, recommendation) {
  const numeric = Number(String(value).replace(/\D/g, ""));
  if (!numeric) return "Auto ISO betyder, at kameraet selv hæver eller sænker følsomheden, mens du bevarer de vigtigste valg i scenariet.";
  if (numeric <= 200) return `${numeric} er valgt for renest mulig fil, fordi scenen bør have lys nok eller kameraet står stabilt.`;
  if (numeric >= 1600) return `${numeric} er valgt for at redde lukkertiden i lavt lys. Der kan komme mere støj, men et skarpt billede med lidt støj er bedre end et rent billede der er sløret.`;
  return `${numeric} er et mellemvalg: stadig pæn kvalitet, men med lidt ekstra hjælp til lukkertid eller blænde.`;
}

function explainLensChoice(recommendation) {
  const ranked = rankLenses(recommendation.profile, state.equipment, state.activeClassification);
  const alternative = ranked.find((item) => item.lens.id !== recommendation.lens.id)?.lens;
  const roles = recommendation.lens.roles || [];
  const main = roles.includes("low-light")
    ? `${recommendation.lens.model} er valgt, fordi den samler mest lys i dit kit. Det hjælper især i mørke, indendørs, astro og scene.`
    : roles.includes("telephoto")
      ? `${recommendation.lens.model} er valgt, fordi scenariet kræver rækkevidde til et motiv på afstand.`
      : roles.includes("wide")
        ? `${recommendation.lens.model} er valgt, fordi scenariet har brug for bredt udsnit, miljø eller himmel.`
        : `${recommendation.lens.model} passer bedst til scenariets afstand, lys og udsnit.`;
  if (!alternative) return main;
  return `${main} Alternativ: ${alternative.model}, hvis du hellere vil ${alternativeReason(alternative, recommendation.lens)}.`;
}

function alternativeReason(alternative, selected) {
  const roles = alternative.roles || [];
  if (roles.includes("walkaround")) return "have en lettere standardzoom og lidt mere fleksibel rækkevidde";
  if (roles.includes("telephoto")) return "komme tættere på motivet på afstand";
  if (roles.includes("low-light")) return "prioritere mest muligt lys frem for rækkevidde";
  if (roles.includes("close-up")) return "gå tættere på små detaljer med dit nuværende kit";
  return "prioritere en anden brændvidde eller vægt";
}

function parseFocalLength(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function settingLabel(key) {
  return {
    mode: "Program",
    focalLength: "Brændvidde",
    shutter: "Lukkertid",
    aperture: "Blænde",
    iso: "ISO",
    focus: "Fokus",
    drive: "Optagelse",
    flash: "Flash"
  }[key] || key;
}

function setSearchVisibility(visible) {
  document.querySelector(".search-hero")?.toggleAttribute("hidden", !visible);
}

function themeIcon(theme) {
  return { light: "☀", dark: "◐", red: "☾" }[theme] || "◐";
}

function loadUnknownSearches() {
  try {
    return JSON.parse(localStorage.getItem("photoAssistant.unknownSearches") || "[]");
  } catch {
    return [];
  }
}

function rememberUnknownSearch(query) {
  const cleaned = query.trim();
  if (cleaned.length < 3) return;
  const entry = { query: cleaned, createdAt: new Date().toISOString() };
  state.unknownSearches = [entry, ...state.unknownSearches.filter((item) => item.query !== cleaned)].slice(0, 50);
  localStorage.setItem("photoAssistant.unknownSearches", JSON.stringify(state.unknownSearches));
}

function renderBootError(error) {
  app.innerHTML = `
    <main class="boot-error">
      <section class="panel">
        <p class="eyebrow">Photo Assistant</p>
        <h1>Appen kunne ikke starte</h1>
        <p>En af de lokale datafiler kunne ikke læses. Prøv at åbne appen igen, når der er net, så den kan hente en frisk kopi.</p>
        <details>
          <summary>Teknisk besked</summary>
          <p>${escapeHtml(error?.message || "Ukendt fejl")}</p>
        </details>
      </section>
    </main>
  `;
}

function setupWakeLock() {
  requestWakeLock();
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) requestWakeLock();
  });
}

async function requestWakeLock() {
  if (!("wakeLock" in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
  } catch {
    wakeLock = null;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function handleExifImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const output = document.querySelector("#exif-output");
  if (!/jpe?g|tiff?/i.test(file.type) && !/\.(jpe?g|tiff?)$/i.test(file.name)) {
    output.innerHTML = `
      <div class="advice-box">
        <strong>Formatet kan ikke læses lokalt</strong>
        <p>Appen kan læse EXIF fra JPEG og TIFF. HEIC fra iPhone skal eksporteres som JPEG, før appen kan gemme det som preset.</p>
      </div>
    `;
    return;
  }
  let exif = {};
  try {
    exif = await readExifFromFile(file);
  } catch {
    output.innerHTML = `
      <div class="advice-box">
        <strong>Billedet kunne ikke læses</strong>
        <p>Prøv en JPEG/TIFF med EXIF-data. Appen sender ikke billedet nogen steder.</p>
      </div>
    `;
    return;
  }
  output.innerHTML = `
    <div class="advice-box">
      <strong>Fundet i billedet</strong>
      <p>${Object.entries(exif)
        .filter(([, value]) => value)
        .map(([key, value]) => `${key}: ${value}`)
        .join(" · ") || "Ingen EXIF-data fundet."}</p>
      <button id="save-exif-preset">Gem som mit preset</button>
    </div>
  `;
  document.querySelector("#save-exif-preset").addEventListener("click", () => {
    const name = prompt("Navn til preset", file.name.replace(/\.[^.]+$/, ""));
    if (!name) return;
    savePreset({ name, settings: exif, tags: [], notes: "Importeret lokalt fra EXIF" });
    state.presets = loadPresets();
    renderPresets();
  });
}

function labelProcedure(key) {
  const labels = {
    setManualMode: "Sæt kameraet i M",
    setAvMode: "Sæt kameraet i Av",
    setTvMode: "Sæt kameraet i Tv",
    setProgramMode: "Sæt kameraet i P",
    setBulbMode: "Sæt kameraet i Bulb",
    setFocalLength: "Vælg objektiv og brændvidde",
    setShutter: "Indstil lukkertid",
    setAperture: "Indstil blænde",
    setIso: "Indstil ISO",
    setSpotMetering: "Vælg spotmåling",
    setAntiFlicker: "Slå Anti-flicker til",
    setAiServo: "Vælg AI Servo",
    setOneShot: "Vælg One Shot",
    setHighSpeedContinuous: "Vælg serieoptagelse",
    setDriveMode: "Indstil enkeltbillede eller serie",
    useLiveViewForAstro: "Fokusér med Live View",
    useCanonCameraConnect: "Brug Canon Camera Connect",
    setLensStabilizationOn: "Slå IS til på objektivet",
    setLensManualFocus: "Sæt objektivet til MF"
  };
  return labels[key] || key;
}

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Kunne ikke hente ${path}`);
  return response.json();
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js");
  }
}
