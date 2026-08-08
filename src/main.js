import { readExifFromFile } from "./lib/exif.js";
import { loadPresets, savePreset } from "./lib/presets.js";
import { buildRecommendation, explainProblem } from "./lib/recommendations.js";
import { consumeKnownTerms, findTermById, mergeTagIds, searchProfiles, suggestNextTags, termsToQuery } from "./lib/search.js";

const state = {
  equipment: null,
  taxonomy: null,
  profiles: [],
  lessons: [],
  versionLog: null,
  context: {},
  selectedResult: null,
  searchText: "",
  selectedTagIds: [],
  activeClassification: null,
  presets: loadPresets(),
  unknownSearches: [],
  selectedLearnTopic: "shutter",
  theme: getInitialTheme()
};

const app = document.querySelector("#app");

applyTheme();
boot();

async function boot() {
  const [equipment, taxonomy, situations, versionLog, learning] = await Promise.all([
    fetchJson("/src/data/equipment/index.json"),
    fetchJson("/src/data/search/taxonomy.json"),
    fetchJson("/src/data/situations/core-profiles.json"),
    fetchJson("/src/data/version-log.json"),
    fetchJson("/src/data/learn/lessons.json")
  ]);
  state.equipment = equipment;
  state.taxonomy = taxonomy;
  state.profiles = situations.profiles;
  state.versionLog = versionLog;
  state.lessons = learning.lessons;
  registerServiceWorker();
  render();
}

function render() {
  app.innerHTML = `
    <header class="topbar">
      <div>
        <p class="eyebrow">Canon EOS 80D</p>
        <h1>Photo Assistant</h1>
      </div>
      <div class="header-actions">
        <button class="icon-button theme-toggle" data-action="toggle-theme" aria-label="${state.theme === "dark" ? "Skift til lyst tema" : "Skift til mørkt tema"}" title="${state.theme === "dark" ? "Lyst tema" : "Mørkt tema"}"><span aria-hidden="true">${state.theme === "dark" ? "☀" : "◐"}</span></button>
        <button class="icon-button" data-action="show-version-log" aria-label="Versionlog" title="Versionlog">v${state.versionLog.current}</button>
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
          <p class="section-kicker">Forslag mens du skriver</p>
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
        <p class="section-kicker">Anbefalet</p>
        <h2>${query ? "Anbefalinger til din situation" : "Hurtige startpunkter"}</h2>
      </div>
      <div class="result-list">
        ${resultList.map(renderResultCard).join("")}
      </div>
    </section>
  `;
  bindResultEvents();
}

function renderSelectedTags() {
  if (!state.selectedTagIds.length) {
    return `<span class="empty-tags">Klik på forslag for at bygge din situation</span>`;
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

function renderVersionLog() {
  const content = document.querySelector("#content");
  content.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <p class="section-kicker">Versionlog</p>
        <h2>Hvad er nyt?</h2>
      </div>
      <div class="version-list">
        ${state.versionLog.entries.map(renderVersionEntry).join("")}
      </div>
    </section>
  `;
}

function renderVersionEntry(entry) {
  return `
    <article class="version-entry">
      <div class="card-title-row">
        <div>
          <p class="badge">v${entry.version} · ${entry.date}</p>
          <h3>${entry.title}</h3>
        </div>
      </div>
      <ul>
        ${entry.items.map((item) => `<li>${item}</li>`).join("")}
      </ul>
    </article>
  `;
}

function renderResultCard(result, index) {
  if (result.type === "preset") return renderPresetCard(result.item, result.score);
  const recommendation = buildRecommendation(result.item, state.equipment, { ...state.context, classification: state.activeClassification, presetInfluence: result.presetInfluence });
  return `
    <article class="result-card" data-result-index="${index}">
      <div class="card-title-row">
        <div>
          <p class="badge">${result.presetInfluence ? "Guide + dit preset" : "Photo Assistant guide"}</p>
          <h3>${result.item.title}</h3>
        </div>
        <button data-open-result="${result.item.id}">Åbn</button>
      </div>
      <p>${recommendation.lens.brand} ${recommendation.lens.model}</p>
      <div class="settings-strip">
        <span>${recommendation.settings.mode}</span>
        <span>${recommendation.settings.shutter}</span>
        <span>${recommendation.settings.aperture}</span>
        <span>ISO ${recommendation.settings.iso}</span>
      </div>
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
        ${Object.values(preset.settings || {})
          .filter(Boolean)
          .slice(0, 4)
          .map((value) => `<span>${value}</span>`)
          .join("")}
      </div>
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
        <span>${recommendation.settings.mode}</span>
        <span>${recommendation.settings.focalLength}</span>
        <span>${recommendation.settings.shutter}</span>
        <span>${recommendation.settings.aperture}</span>
        <span>ISO ${recommendation.settings.iso}</span>
      </div>
      <div class="settings-strip technique-strip">
        <span>${recommendation.settings.focus}</span>
        <span>${recommendation.settings.drive}</span>
        ${recommendation.flash ? `<span>${recommendation.flash.model}</span>` : ""}
      </div>
      ${renderExposurePlan(recommendation.exposurePlan)}
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
  document.querySelector('[data-action="show-version-log"]')?.addEventListener("click", renderVersionLog);
  document.querySelector('[data-action="toggle-theme"]')?.addEventListener("click", toggleTheme);
}

function getInitialTheme() {
  const saved = localStorage.getItem("photoAssistant.theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", state.theme === "dark" ? "#090b0e" : "#f4f6f8");
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  localStorage.setItem("photoAssistant.theme", state.theme);
  applyTheme();
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
}

function runSearch(query) {
  const search = searchProfiles(query, state.profiles, state.taxonomy, state.presets);
  state.activeClassification = search.classification;
  renderHome(search.results.slice(0, 10));
}

function setSearchVisibility(visible) {
  document.querySelector(".search-hero")?.toggleAttribute("hidden", !visible);
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
  const exif = await readExifFromFile(file);
  const output = document.querySelector("#exif-output");
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
