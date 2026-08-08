import { loadJson, saveJson } from "./storage.js";

const PRESET_KEY = "photoAssistant.presets";

export function loadPresets() {
  return loadJson(PRESET_KEY, []);
}

export function savePreset(input) {
  const presets = loadPresets();
  const preset = {
    id: input.id || `local-${Date.now()}`,
    source: "user",
    badge: "MIT PRESET",
    createdAt: input.createdAt || new Date().toISOString(),
    name: input.name || "Mit preset",
    settings: input.settings || {},
    tags: input.tags || [],
    notes: input.notes || ""
  };
  saveJson(PRESET_KEY, [preset, ...presets.filter((item) => item.id !== preset.id)]);
  return preset;
}

export function deletePreset(id) {
  saveJson(
    PRESET_KEY,
    loadPresets().filter((preset) => preset.id !== id)
  );
}
