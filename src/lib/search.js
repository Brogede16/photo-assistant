const DANISH_REPLACEMENTS = new Map([
  ["æ", "ae"],
  ["ø", "oe"],
  ["å", "aa"]
]);

export function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[æøå]/g, (char) => DANISH_REPLACEMENTS.get(char) || char)
    .replace(/[^a-z0-9\s/-]/g, " ")
    .replace(/\s+/g, " ");
}

export function tokenize(value) {
  const normalized = normalizeText(value);
  if (!normalized) return [];
  const tokens = new Set(normalized.split(" ").filter(Boolean));
  tokens.add(normalized);
  return [...tokens];
}

export function buildSearchIndex(taxonomy) {
  const entries = [];
  for (const term of taxonomy.terms) {
    const phrases = [term.label, term.id, ...(term.synonyms || [])];
    for (const phrase of phrases) {
      entries.push({
        phrase: normalizeText(phrase),
        term
      });
    }
  }
  return entries;
}

export function classifyQuery(query, taxonomy) {
  const normalized = normalizeText(query);
  const tokens = tokenize(query);
  const index = buildSearchIndex(taxonomy);
  const matches = new Map();

  for (const entry of index) {
    if (!entry.phrase) continue;
    const directMatch = normalized.includes(entry.phrase);
    const partialMatch = tokens.some((token) => entry.phrase.startsWith(token) || token.startsWith(entry.phrase));
    const fuzzyMatch = tokens.some((token) => token.length > 4 && levenshtein(token, entry.phrase) <= 1);
    if (directMatch || partialMatch || fuzzyMatch) {
      const current = matches.get(entry.term.id) || { ...entry.term, score: 0 };
      current.score += directMatch ? 4 : partialMatch ? 2 : 1;
      matches.set(entry.term.id, current);
    }
  }

  const facets = {};
  for (const match of matches.values()) {
    if (!facets[match.type]) facets[match.type] = [];
    facets[match.type].push(match.id);
  }

  return {
    query,
    normalized,
    tokens,
    matches: [...matches.values()].sort((a, b) => b.score - a.score),
    facets
  };
}

export function searchProfiles(query, profiles, taxonomy, presets = []) {
  const classification = classifyQuery(query, taxonomy);
  const results = [];

  for (const profile of profiles) {
    const score = scoreProfile(profile, classification);
    if (score > 0) {
      results.push({
        type: "official",
        score: score + (profile.priority || 0) / 100,
        item: profile
      });
    }
  }

  for (const preset of presets) {
    const score = scorePreset(preset, classification);
    if (score > 0) {
      results.push({
        type: "preset",
        score: score + 0.5,
        item: preset
      });
    }
  }

  return {
    classification,
    results: results.sort((a, b) => b.score - a.score)
  };
}

export function findTermById(taxonomy, id) {
  return taxonomy.terms.find((term) => term.id === id);
}

export function termsToQuery(taxonomy, termIds, extraText = "") {
  const labels = termIds.map((id) => findTermById(taxonomy, id)?.label).filter(Boolean);
  return [...labels, extraText].join(" ").trim();
}

export function suggestNextTags(query, profiles, taxonomy, selectedIds = [], limit = 10) {
  const selected = new Set(selectedIds);
  const search = searchProfiles(query || termsToQuery(taxonomy, selectedIds), profiles, taxonomy);
  const candidates = new Map();

  for (const result of search.results.slice(0, 5)) {
    const profile = result.item;
    const ids = [
      ...(profile.subjects || []),
      ...(profile.conditions?.movement || []),
      ...(profile.conditions?.light || []),
      ...(profile.conditions?.distance || []),
      ...(profile.gearStrategy?.preferredLensRoles || [])
    ];
    for (const id of ids) {
      if (selected.has(id)) continue;
      const term = findTermById(taxonomy, id);
      if (!term) continue;
      const current = candidates.get(id) || { term, score: 0 };
      current.score += result.score + typeBoost(term.type);
      candidates.set(id, current);
    }
  }

  if (candidates.size < limit) {
    for (const term of taxonomy.terms) {
      if (selected.has(term.id)) continue;
      if (!["subject", "movement", "light", "distance"].includes(term.type)) continue;
      const current = candidates.get(term.id) || { term, score: 0 };
      current.score += typeBoost(term.type);
      candidates.set(term.id, current);
    }
  }

  return [...candidates.values()]
    .sort((a, b) => b.score - a.score || a.term.label.localeCompare(b.term.label, "da"))
    .slice(0, limit)
    .map((item) => item.term);
}

function scoreProfile(profile, classification) {
  let score = 0;
  for (const match of classification.matches) {
    if (profile.subjects?.includes(match.id)) score += match.score + 4;
    if (profile.conditions?.movement?.includes(match.id)) score += match.score + 3;
    if (profile.conditions?.light?.includes(match.id)) score += match.score + 3;
    if (profile.conditions?.distance?.includes(match.id)) score += match.score + 2;
    if (profile.gearStrategy?.preferredLensRoles?.includes(match.id)) score += match.score + 1;
    if (normalizeText(profile.title).includes(match.id)) score += 2;
    if (normalizeText(profile.title).includes(normalizeText(match.label))) score += 2;
  }
  return score;
}

function scorePreset(preset, classification) {
  let score = 0;
  const haystack = normalizeText([preset.name, ...(preset.tags || []), preset.notes || ""].join(" "));
  for (const match of classification.matches) {
    if (haystack.includes(normalizeText(match.id)) || haystack.includes(normalizeText(match.label))) {
      score += match.score + 3;
    }
  }
  for (const token of classification.tokens) {
    if (haystack.includes(token)) score += 1;
  }
  return score;
}

function typeBoost(type) {
  return {
    subject: 4,
    movement: 3,
    light: 3,
    distance: 2,
    equipment: 1
  }[type] || 0;
}

function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[a.length][b.length];
}
