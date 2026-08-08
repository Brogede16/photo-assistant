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
    const directMatch = containsPhrase(normalized, entry.phrase);
    const fuzzyMatch = tokens.some((token) => token.length > 4 && levenshtein(token, entry.phrase) <= 1);
    if (directMatch || fuzzyMatch) {
      const current = matches.get(entry.term.id) || { ...entry.term, score: 0 };
      current.score += directMatch ? 4 : 1;
      matches.set(entry.term.id, current);
    }
  }

  for (const match of [...matches.values()]) {
    for (const impliedId of match.implies || []) {
      const implied = findTermById(taxonomy, impliedId);
      if (!implied) continue;
      const current = matches.get(implied.id) || { ...implied, score: 0, implied: true };
      current.score += Math.max(1, match.score - 1);
      matches.set(implied.id, current);
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
    if (!profileAcceptsSubjects(profile, classification, taxonomy)) continue;
    if (!profileAcceptsMotion(profile, classification, taxonomy)) continue;
    if (!profileAcceptsPlace(profile, classification, taxonomy)) continue;
    if (!profileAcceptsDistance(profile, classification)) continue;
    const score = scoreProfile(profile, classification);
    if (score > 0) {
      results.push({
        type: "official",
        score: score + (profile.priority || 0) / 100,
        item: profile,
        presetInfluence: findPresetInfluence(profile, classification, presets, taxonomy)
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

function profileAcceptsDistance(profile, classification) {
  const requested = classification.matches.filter((match) => match.type === "distance" && !match.implied);
  if (!requested.length) return true;
  const supported = profile.conditions?.distance || [];
  if (!supported.length) return true;
  return requested.some((distance) => supported.includes(distance.id));
}

function profileAcceptsPlace(profile, classification, taxonomy) {
  const requestedPlaces = classification.matches.filter((match) => match.type === "place" && !match.implied);
  const requestedScopes = new Set(requestedPlaces.map((place) => placeScope(taxonomy, place.id)).filter(Boolean));
  if (!requestedScopes.size) return true;
  const profileScopes = new Set((profile.conditions?.place || []).map((id) => placeScope(taxonomy, id)).filter(Boolean));
  if (!profileScopes.size) return true;
  return [...requestedScopes].some((scope) => profileScopes.has(scope));
}

function placeScope(taxonomy, id) {
  if (id === "outdoor" || ancestorsOf(taxonomy, id).includes("outdoor")) return "outdoor";
  if (id === "inside" || ancestorsOf(taxonomy, id).includes("inside")) return "inside";
  return null;
}

function profileAcceptsMotion(profile, classification, taxonomy) {
  const actions = classification.matches.filter((match) => match.type === "action" && !match.implied);
  const movements = classification.matches.filter((match) => match.type === "movement" && !match.implied);
  if (!actions.length && !movements.length) return true;

  const profileActions = profile.conditions?.action || [];
  if (actions.length && profileActions.some((id) => actions.some((action) => action.id === id))) return true;

  const requestedMotions = new Set([...actions, ...movements].map((match) => match.effects?.motion).filter(Boolean));
  const profileMotions = new Set((profile.conditions?.movement || [])
    .map((id) => findTermById(taxonomy, id)?.effects?.motion)
    .filter(Boolean));
  if (!requestedMotions.size || !profileMotions.size) return profileActions.length === 0;
  return [...requestedMotions].some((motion) => profileMotions.has(motion));
}

function profileAcceptsSubjects(profile, classification, taxonomy) {
  const subjects = classification.matches.filter((match) => match.type === "subject" && !match.implied);
  if (!subjects.length) return true;
  return subjects.some((subject) => {
    const profileSubjects = profile.subjects || [];
    if (profileSubjects.includes(subject.id)) return true;
    const subjectAncestors = ancestorsOf(taxonomy, subject.id);
    if (subjectAncestors.length) {
      const allowed = new Set([subject.id, ...subjectAncestors]);
      return profileSubjects.length > 0 && profileSubjects.every((id) => allowed.has(id));
    }
    return profileSubjects.some((id) => ancestorsOf(taxonomy, id).includes(subject.id));
  });
}

function ancestorsOf(taxonomy, id) {
  const ancestors = [];
  let current = findTermById(taxonomy, id);
  while (current?.parent) {
    ancestors.push(current.parent);
    current = findTermById(taxonomy, current.parent);
  }
  return ancestors;
}

export function findTermById(taxonomy, id) {
  return taxonomy.terms.find((term) => term.id === id);
}

export function findExactTerm(taxonomy, value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  return taxonomy.terms.find((term) => {
    const phrases = [term.id, term.label, ...(term.synonyms || [])];
    return phrases.some((phrase) => normalizeText(phrase) === normalized);
  }) || null;
}

export function termsToQuery(taxonomy, termIds, extraText = "") {
  const labels = termIds.map((id) => findTermById(taxonomy, id)?.label).filter(Boolean);
  return [...labels, extraText].join(" ").trim();
}

export function suggestNextTags(query, profiles, taxonomy, selectedIds = [], limit = 10) {
  const selected = new Set(selectedIds);
  const search = searchProfiles(query || termsToQuery(taxonomy, selectedIds), profiles, taxonomy);
  const candidates = new Map();

  for (const term of findPrefixTerms(query, taxonomy)) {
    addCandidate(candidates, taxonomy, selected, term.id, 130);
  }

  for (const match of search.classification.matches) {
    if (!match.implied) addCandidate(candidates, taxonomy, selected, match.id, 120 + match.score);
  }

  for (const id of selectedIds) {
    const selectedTerm = findTermById(taxonomy, id);
    if (!selectedTerm) continue;

    for (const relatedId of selectedTerm.related || []) {
      addCandidate(candidates, taxonomy, selected, relatedId, 80);
    }

    for (const child of taxonomy.terms.filter((term) => term.parent === id)) {
      addCandidate(candidates, taxonomy, selected, child.id, 70);
    }

    if (selectedTerm.parent) addCandidate(candidates, taxonomy, selected, selectedTerm.parent, 20);
  }

  for (const result of search.results.slice(0, 5)) {
    const profile = result.item;
    const ids = [
      ...(profile.subjects || []),
      ...(profile.conditions?.movement || []),
      ...(profile.conditions?.light || []),
      ...(profile.conditions?.distance || []),
      ...(profile.conditions?.action || []),
      ...(profile.conditions?.place || []),
      ...(profile.conditions?.time || []),
      ...(profile.conditions?.weather || []),
      ...(profile.conditions?.style || []),
      ...(profile.conditions?.technique || []),
      ...(profile.gearStrategy?.preferredLensRoles || [])
    ];
    for (const id of ids) {
      addCandidate(candidates, taxonomy, selected, id, result.score);
    }
  }

  const hasContext = selectedIds.length > 0 || Boolean(query?.trim());
  if (!hasContext && candidates.size < limit) {
    for (const [index, id] of (taxonomy.starterTags || []).entries()) {
      addCandidate(candidates, taxonomy, selected, id, 100 - index);
    }
  }

  return [...candidates.values()]
    .sort((a, b) => b.score - a.score || a.term.label.localeCompare(b.term.label, "da"))
    .slice(0, limit)
    .map((item) => item.term);
}

function findPrefixTerms(query, taxonomy) {
  const words = normalizeText(query).split(" ").filter(Boolean);
  const prefix = words.at(-1) || "";
  if (prefix.length < 3 || findExactTerm(taxonomy, prefix)) return [];
  const matches = new Map();
  for (const term of taxonomy.terms) {
    const phrases = [term.id, term.label, ...(term.synonyms || [])].map(normalizeText);
    if (phrases.some((phrase) => phrase.startsWith(prefix))) matches.set(term.id, term);
  }
  return [...matches.values()];
}

function addCandidate(candidates, taxonomy, selected, id, score) {
  if (selected.has(id)) return;
  const term = findTermById(taxonomy, id);
  if (!term) return;
  if (term.suggest === false) return;
  if ([...selected].some((selectedId) => termsConflict(taxonomy, selectedId, id))) return;
  const current = candidates.get(id) || { term, score: 0 };
  current.score += score + typeBoost(term.type);
  candidates.set(id, current);
}

function scoreProfile(profile, classification) {
  let score = 0;
  for (const match of classification.matches) {
    if (profile.subjects?.includes(match.id)) score += match.score + 4;
    if (match.parent && profile.subjects?.includes(match.parent)) score += match.score + 3;
    if (profile.conditions?.movement?.includes(match.id)) score += match.score + 3;
    if (profile.conditions?.light?.includes(match.id)) score += match.score + 3;
    if (profile.conditions?.distance?.includes(match.id)) score += match.score + 2;
    if (profile.conditions?.action?.includes(match.id)) score += match.score + 3;
    if (profile.conditions?.place?.includes(match.id)) score += match.score + 2;
    if (profile.conditions?.time?.includes(match.id)) score += match.score + 2;
    if (profile.conditions?.weather?.includes(match.id)) score += match.score + 2;
    if (profile.conditions?.style?.includes(match.id)) score += match.score + 3;
    if (profile.conditions?.technique?.includes(match.id)) score += match.score + 2;
    if (profile.gearStrategy?.preferredLensRoles?.includes(match.id)) score += match.score + 1;
    if (containsPhrase(normalizeText(profile.title), normalizeText(match.id))) score += 2;
    if (containsPhrase(normalizeText(profile.title), normalizeText(match.label))) score += 2;
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
    action: 4,
    place: 3,
    time: 3,
    weather: 3,
    style: 4,
    technique: 2,
    equipment: 1
  }[type] || 0;
}

function findPresetInfluence(profile, classification, presets, taxonomy) {
  const currentIds = new Set(classification.matches.filter((match) => !match.implied).map((match) => match.id));
  return presets
    .map((preset) => {
      const knownTags = (preset.tags || []).filter((id) => findTermById(taxonomy, id));
      const overlap = knownTags.filter((id) => currentIds.has(id)).length;
      const sameProfile = preset.baseProfileId === profile.id;
      return { preset, strength: (sameProfile ? 100 : 0) + overlap * 10, overlap, sameProfile };
    })
    .filter((candidate) => candidate.sameProfile || candidate.overlap >= 2)
    .sort((a, b) => b.strength - a.strength)[0] || null;
}

export function mergeTagIds(taxonomy, currentIds, incomingIds) {
  const next = [...currentIds];
  for (const id of incomingIds) {
    const term = findTermById(taxonomy, id);
    if (!term) continue;
    for (let index = next.length - 1; index >= 0; index -= 1) {
      if (termsConflict(taxonomy, next[index], id)) next.splice(index, 1);
    }
    if (!next.includes(id)) next.push(id);
  }
  return next;
}

export function consumeKnownTerms(value, taxonomy, { includeLastTerm = false } = {}) {
  const hasTrailingSeparator = /[\s,;]$/.test(value);
  const words = normalizeText(value).split(" ").filter(Boolean);
  const consumableCount = includeLastTerm || hasTrailingSeparator ? words.length : Math.max(0, words.length - 1);
  const phraseIndex = buildPhraseIndex(taxonomy);
  const termIds = [];
  const remainder = [];

  for (let index = 0; index < words.length;) {
    let found = null;
    const maxLength = Math.min(4, consumableCount - index);
    for (let size = maxLength; size >= 1; size -= 1) {
      const phrase = words.slice(index, index + size).join(" ");
      if (phraseIndex.has(phrase)) {
        found = { term: phraseIndex.get(phrase), size };
        break;
      }
    }
    if (found) {
      termIds.push(found.term.id);
      index += found.size;
    } else {
      remainder.push(words[index]);
      index += 1;
    }
  }

  return { termIds: [...new Set(termIds)], remainder: remainder.join(" ") };
}

function buildPhraseIndex(taxonomy) {
  const index = new Map();
  for (const term of taxonomy.terms) {
    for (const phrase of [term.id, term.label, ...(term.synonyms || [])]) {
      index.set(normalizeText(phrase), term);
    }
  }
  return index;
}

function termsConflict(taxonomy, firstId, secondId) {
  const first = findTermById(taxonomy, firstId);
  const second = findTermById(taxonomy, secondId);
  return Boolean(first?.exclusiveGroup && first.exclusiveGroup === second?.exclusiveGroup && first.id !== second.id);
}

function containsPhrase(text, phrase) {
  if (!text || !phrase) return false;
  return (` ${text} `).includes(` ${phrase} `);
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
