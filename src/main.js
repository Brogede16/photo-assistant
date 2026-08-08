import { astroStatus, maxStarShutterSeconds } from "./lib/astro.js";
import { applyManualOverride, defaultContext, getAutomaticContext } from "./lib/context.js";
import { readExifFromFile } from "./lib/exif.js";
import { loadPresets, savePreset } from "./lib/presets.js";
import { buildRecommendation, explainProblem } from "./lib/recommendations.js";
import { searchProfiles } from "./lib/search.js";

const state = {
  equipment: null,
  taxonomy: null,
  profiles: [],
  context: defaultContext(),
  selectedResult: null,
  presets: loadPresets(),
  unknownSearches: []
};

const app = document.querySelector("#app");

boot();

async function boot() {
  const [equipment, taxonomy, situations] = await Promise.all([
    fetchJson("/src/data/equipment/index.json"),
    fetchJson("/src/data/search/taxonomy.json"),
    fetchJson("/src/data/situations/core-profiles.json")
  ]);
  state.equipment = equipment;
  state.taxonomy = taxonomy;
  state.profiles = situations.profiles;
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
      <button class="icon-button" data-action="show-equipment" aria-label="Mit udstyr" title="Mit udstyr">80D</button>
    </header>

    <main>
      <section class="search-hero">
        <label for="search-input">Hvad vil du fotografere?</label>
        <div class="search-row">
          <input id="search-input" type="search" autocomplete="off" placeholder="fx nordlys, abe overskyet, fugl flyver" />
          <button data-action="search">Søg</button>
        </div>
        <div class="quick-actions">
          <button data-query="stjerner">Stjerner</button>
          <button data-query="nordlys">Nordlys</button>
          <button data-query="måne">Måne</button>
          <button data-query="fugl flyver langt">Fugl</button>
          <button data-query="dyr løber overskyet">Dyr</button>
          <button data-query="mennesker indendørs">Inde</button>
        </div>
      </section>

      <section class="now-panel">
        <div>
          <p class="section-kicker">Fotografer nu</p>
          <h2>${state.context.label}</h2>
          <p>${state.context.dateLabel} · ${state.context.locationLabel}</p>
        </div>
        <button data-action="now">Brug tid og sted</button>
      </section>

      <section class="manual-context">
        <label for="manual-light">Manuel override</label>
        <select id="manual-light" data-action="manual-light">
          <option value="">Auto-kontekst</option>
          <option value="lysere">Lysere end appen tror</option>
          <option value="mørkere">Mørkere end appen tror</option>
          <option value="overskyet">Overskyet / gråvejr</option>
          <option value="indendørs">Indendørs</option>
        </select>
      </section>

      <nav class="tabbar" aria-label="Hovedfunktioner">
        <button data-view="home" class="active">Fotografer</button>
        <button data-view="astro">Astro</button>
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
  const resultList =
    results ||
    searchProfiles("stjerner nordlys måne fugl dyr mennesker", state.profiles, state.taxonomy, state.presets).results.slice(0, 5);

  content.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <p class="section-kicker">Anbefalet</p>
        <h2>Hurtige startpunkter</h2>
      </div>
      <div class="result-list">
        ${resultList.map(renderResultCard).join("")}
      </div>
    </section>
  `;
  bindResultEvents();
}

function renderAstro() {
  const content = document.querySelector("#content");
  const status = astroStatus(new Date(state.context.date), state.context.coords);
  content.innerHTML = `
    <section class="panel astro-panel">
      <div class="panel-header">
        <p class="section-kicker">Astro Assistant</p>
        <h2>${"★".repeat(status.score)}${"☆".repeat(5 - status.score)} i aften</h2>
      </div>
      <div class="astro-visual" aria-hidden="true">
        <div class="moon-disc" style="--moon-fill:${status.moon.percent}%"></div>
        <div class="stars-field"></div>
      </div>
      <p>${status.summary}</p>
      <div class="settings-strip">
        <span>18mm</span>
        <span>f/1.8</span>
        <span>${maxStarShutterSeconds(18)}s maks</span>
        <span>ISO 1600</span>
      </div>
      <div class="quick-actions">
        <button data-query="stjerner">Stjerner</button>
        <button data-query="nordlys">Nordlys</button>
        <button data-query="måne">Måne</button>
      </div>
    </section>
  `;
  bindShellEvents();
}

function renderPresets() {
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
  const content = document.querySelector("#content");
  const camera = state.equipment.cameras[0];
  content.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <p class="section-kicker">Lær kameraet</p>
        <h2>${camera.brand} ${camera.model}</h2>
      </div>
      <div class="camera-figure" aria-label="Stiliseret Canon EOS 80D">
        <button class="hotspot top-left" title="Programhjul">M</button>
        <button class="hotspot top-right" title="ISO-knap">ISO</button>
        <button class="hotspot back-center" title="Live View">LV</button>
        <button class="hotspot back-right" title="Quick Control Dial">Q</button>
      </div>
      <div class="guide-list">
        ${Object.entries(camera.procedures)
          .slice(0, 8)
          .map(([key, steps]) => `<details><summary>${labelProcedure(key)}</summary><ol>${steps.map((step) => `<li>${step}</li>`).join("")}</ol></details>`)
          .join("")}
      </div>
    </section>
  `;
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
  const recommendation = buildRecommendation(result.item, state.equipment, state.context);
  return `
    <article class="result-card" data-result-index="${index}">
      <div class="card-title-row">
        <div>
          <p class="badge">Photo Assistant guide</p>
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
  const recommendation = buildRecommendation(profile, state.equipment, state.context);
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
      <h3>Hurtig guide</h3>
      <ol>${profile.quickGuide.map((step) => `<li>${step}</li>`).join("")}</ol>
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
      tags: [profile.family, ...(profile.subjects || [])],
      notes: `Baseret på ${profile.title}`
    });
    state.presets = loadPresets();
    renderPresets();
  });
}

function bindShellEvents() {
  document.querySelectorAll("[data-query]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelector("#search-input").value = button.dataset.query;
      runSearch(button.dataset.query);
    });
  });

  document.querySelector('[data-action="search"]')?.addEventListener("click", () => {
    runSearch(document.querySelector("#search-input").value);
  });

  document.querySelector("#search-input")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") runSearch(event.currentTarget.value);
  });

  document.querySelector('[data-action="now"]')?.addEventListener("click", async () => {
    state.context = await getAutomaticContext();
    render();
  });

  document.querySelector('[data-action="manual-light"]')?.addEventListener("change", (event) => {
    state.context = applyManualOverride(state.context, { lightOverride: event.target.value });
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-view]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      if (button.dataset.view === "astro") renderAstro();
      if (button.dataset.view === "presets") renderPresets();
      if (button.dataset.view === "learn") renderLearn();
      if (button.dataset.view === "home") renderHome();
    });
  });

  document.querySelector('[data-action="show-equipment"]')?.addEventListener("click", renderEquipment);
}

function bindResultEvents() {
  document.querySelectorAll("[data-open-result]").forEach((button) => {
    button.addEventListener("click", () => openResult(button.dataset.openResult));
  });
}

function runSearch(query) {
  const search = searchProfiles(query, state.profiles, state.taxonomy, state.presets);
  if (query.trim() && search.results.length === 0) {
    state.unknownSearches.push({ query, createdAt: new Date().toISOString() });
  }
  renderHome(search.results.slice(0, 10));
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
    setShutter: "Indstil lukkertid",
    setAperture: "Indstil blænde",
    setIso: "Indstil ISO",
    setAiServo: "Vælg AI Servo",
    setOneShot: "Vælg One Shot",
    setHighSpeedContinuous: "Vælg serieoptagelse",
    useLiveViewForAstro: "Fokusér med Live View",
    useCanonCameraConnect: "Brug Canon Camera Connect"
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
