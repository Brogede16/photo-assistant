import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { astroStatus, astroTargets, maxStarShutterSeconds } from "../src/lib/astro.js";
import { buildRecommendation } from "../src/lib/recommendations.js";
import { classifyQuery, consumeKnownTerms, findExactTerm, mergeTagIds, searchProfiles, suggestNextTags, termsToQuery } from "../src/lib/search.js";

const taxonomy = JSON.parse(await readFile(new URL("../src/data/search/taxonomy.json", import.meta.url), "utf8"));
const situations = JSON.parse(await readFile(new URL("../src/data/situations/core-profiles.json", import.meta.url), "utf8"));
const equipment = JSON.parse(await readFile(new URL("../src/data/equipment/index.json", import.meta.url), "utf8"));
const versionLog = JSON.parse(await readFile(new URL("../src/data/version-log.json", import.meta.url), "utf8"));
const learning = JSON.parse(await readFile(new URL("../src/data/learn/lessons.json", import.meta.url), "utf8"));

const overcast = classifyQuery("abe i zoo gråvejr", taxonomy);
assert.deepEqual(overcast.facets.subject.includes("monkey"), true);
assert.deepEqual(overcast.facets.light.includes("overcast"), true);
assert.equal(findExactTerm(taxonomy, "aber").id, "monkey");
assert.equal(findExactTerm(taxonomy, "gråvejr").id, "overcast");
assert.equal(findExactTerm(taxonomy, "ko").id, "cow");
assert.equal(findExactTerm(taxonomy, "køer").id, "cow");
assert.equal(findExactTerm(taxonomy, "ukendt ord"), null);
assert.equal(findExactTerm(taxonomy, "sover").id, "sleeping");
assert.equal(findExactTerm(taxonomy, "natklub").id, "nightclub");
assert.equal(findExactTerm(taxonomy, "makro").id, "macro");
assert.equal(findExactTerm(taxonomy, "nærbillede").id, "close-up");
assert.equal(findExactTerm(taxonomy, "gruppeportræt").id, "group-portrait");

const consumedPhrase = consumeKnownTerms("ko gråt vejr ", taxonomy);
assert.deepEqual(consumedPhrase.termIds, ["cow", "overcast"]);
assert.equal(consumedPhrase.remainder, "");

const livePartial = suggestNextTags("kan", situations.profiles, taxonomy, [], 6);
assert.equal(livePartial[0].id, "rabbit");

const resolvedDistance = mergeTagIds(taxonomy, ["near"], ["far"]);
assert.deepEqual(resolvedDistance, ["far"]);
const resolvedTime = mergeTagIds(taxonomy, ["morning"], ["night-time"]);
assert.deepEqual(resolvedTime, ["night-time"]);

const birdResults = searchProfiles("fugl flyver langt væk", situations.profiles, taxonomy);
assert.equal(birdResults.results[0].item.id, "bird-flight-daylight");

const astroResults = searchProfiles("nordlys", situations.profiles, taxonomy);
assert.equal(astroResults.results[0].item.id, "aurora-weak");

const milkyWayResults = searchProfiles("mælkevejen", situations.profiles, taxonomy);
assert.equal(milkyWayResults.results[0].item.id, "milky-way-wide");

const zooResults = searchProfiles("aber i zoo gråvejr", situations.profiles, taxonomy);
assert.equal(zooResults.results[0].item.id, "zoo-monkeys-overcast");

const cowResults = searchProfiles("ko overskyet", situations.profiles, taxonomy);
assert.equal(cowResults.results[0].item.id, "cow-field-overcast");
assert.equal(searchProfiles("ko", situations.profiles, taxonomy).results.some((result) => result.item.id === "concert-stage-light"), false);

const eatingAnimalResults = searchProfiles("får spiser på mark", situations.profiles, taxonomy);
assert.equal(eatingAnimalResults.results[0].item.id, "animal-eating-outdoors");
assert.equal(eatingAnimalResults.results.some((result) => result.item.family === "astro"), false);
const specificCowResults = searchProfiles("ko spiser langt væk mark", situations.profiles, taxonomy);
assert.equal(specificCowResults.results.some((result) => result.item.id === "zoo-monkeys-overcast"), false);
assert.equal(specificCowResults.results.some((result) => result.item.id === "wildlife-forest-low-light"), false);
assert.deepEqual(specificCowResults.results.slice(0, 2).map((result) => result.item.id), ["animal-eating-outdoors", "cow-field-overcast"]);

const nightclubResults = searchProfiles("mennesker danser på natklub", situations.profiles, taxonomy);
assert.equal(nightclubResults.results[0].item.id, "nightclub-dancing");
const nightclubClassification = classifyQuery("mennesker danser på natklub", taxonomy);
assert.equal(nightclubClassification.facets.place.includes("nightclub"), true);
assert.equal(nightclubClassification.facets.light?.includes("night") || false, false);

const macroResults = searchProfiles("insekt makro udenfor", situations.profiles, taxonomy);
assert.equal(macroResults.results[0].item.id, "insect-close-up");
assert.deepEqual(macroResults.results.filter((result) => result.type === "official").map((result) => result.item.id), ["insect-close-up"]);
const rainConcert = searchProfiles("koncert udenfor regn scenelys", situations.profiles, taxonomy);
assert.equal(rainConcert.results[0].item.id, "concert-outdoor-rain");
assert.equal(rainConcert.results.some((result) => result.item.id === "concert-indoor-stage"), false);
const groupPortrait = searchProfiles("gruppe portræt indenfor", situations.profiles, taxonomy);
assert.equal(groupPortrait.results[0].item.id, "portrait-group-indoor");

const cowNextTags = suggestNextTags("Ko", situations.profiles, taxonomy, ["cow"], 6);
assert.equal(cowNextTags.some((term) => term.id === "monkey"), false);

const tagQuery = termsToQuery(taxonomy, ["monkey", "overcast", "medium"], "");
assert.equal(tagQuery, "Abe Overskyet Mellem afstand");
assert.equal(searchProfiles(tagQuery, situations.profiles, taxonomy).results[0].item.id, "zoo-monkeys-overcast");

const nextTags = suggestNextTags("Abe", situations.profiles, taxonomy, ["monkey"], 6);
assert.equal(nextTags.some((term) => ["overcast", "running", "medium"].includes(term.id)), true);

const starNextTags = suggestNextTags("Stjerner", situations.profiles, taxonomy, ["stars"], 8);
assert.equal(starNextTags.some((term) => term.id === "aurora"), true);
assert.equal(starNextTags.some((term) => term.id === "night"), true);
assert.equal(starNextTags.some((term) => term.id === "milky-way"), true);
assert.equal(starNextTags.some((term) => term.id === "monkey"), false);
assert.equal(starNextTags.some((term) => term.id === "still"), false);

const sportResults = searchProfiles("fodbold overskyet", situations.profiles, taxonomy);
assert.equal(sportResults.results[0].item.id, "outdoor-sport-daylight");

const recommendation = buildRecommendation(astroResults.results[0].item, equipment, { phase: "night" });
assert.equal(recommendation.lens.id, "sigma-18-35-f18-art");
assert.equal(recommendation.settings.aperture, "f/1.8");
assert.equal(recommendation.gearChecklist.includes("Stativ"), true);

const childClassification = classifyQuery("barn griner udenfor", taxonomy);
const childProfile = searchProfiles("barn griner udenfor", situations.profiles, taxonomy).results[0].item;
const childRecommendation = buildRecommendation(childProfile, equipment, { classification: childClassification });
assert.equal(childRecommendation.settings.shutter, "1/500");
assert.equal(childRecommendation.settings.focus, "AI Servo");

const protectedAstro = buildRecommendation(astroResults.results[0].item, equipment, {
  phase: "night",
  classification: classifyQuery("nordlys løber", taxonomy)
});
assert.equal(protectedAstro.settings.shutter, "6s");

const macroRecommendation = buildRecommendation(macroResults.results[0].item, equipment, {
  classification: macroResults.classification
});
assert.equal(macroRecommendation.lens.id, "canon-ef-s-18-55-is-stm");
assert.equal(macroRecommendation.settings.aperture, "f/8");
assert.equal(macroRecommendation.scenarioDecisions.some((line) => line.includes("1:1-makro")), true);

const localPreset = {
  id: "local-test",
  name: "Mit regnkoncert-preset",
  baseProfileId: "concert-outdoor-rain",
  tags: ["concert", "outdoor", "rain"],
  settings: { shutter: "1/800", iso: "Auto" }
};
const influencedSearch = searchProfiles("koncert udenfor regn", situations.profiles, taxonomy, [localPreset]);
const influencedOfficial = influencedSearch.results.find((result) => result.type === "official" && result.item.id === "concert-outdoor-rain");
assert.equal(influencedOfficial.presetInfluence.preset.id, "local-test");
const influencedRecommendation = buildRecommendation(influencedOfficial.item, equipment, {
  classification: influencedSearch.classification,
  presetInfluence: influencedOfficial.presetInfluence
});
assert.equal(influencedRecommendation.settings.shutter, "1/800");
assert.equal(influencedRecommendation.scenarioDecisions[0].includes("Mit regnkoncert-preset"), true);

assert.equal(maxStarShutterSeconds(18, 1.6), 13);
assert.equal(astroStatus(new Date("2026-08-08T23:00:00+02:00")).moon.percent >= 0, true);
assert.equal(astroTargets(new Date("2026-08-08T23:00:00+02:00")).some((target) => target.id === "milky-way-wide"), true);
assert.equal(versionLog.current, "0.6.0");
assert.equal(versionLog.entries[0].version, "0.6.0");
assert.equal(learning.lessons.length, 5);
assert.equal(learning.lessons.every((lesson) => lesson.answers[lesson.correct]), true);

console.log("Alle søge-, anbefalings- og astro-tests bestod.");
