import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { astroStatus, astroTargets, maxStarShutterSeconds } from "../src/lib/astro.js";
import { buildRecommendation } from "../src/lib/recommendations.js";
import { classifyQuery, findExactTerm, searchProfiles, suggestNextTags, termsToQuery } from "../src/lib/search.js";

const taxonomy = JSON.parse(await readFile(new URL("../src/data/search/taxonomy.json", import.meta.url), "utf8"));
const situations = JSON.parse(await readFile(new URL("../src/data/situations/core-profiles.json", import.meta.url), "utf8"));
const equipment = JSON.parse(await readFile(new URL("../src/data/equipment/index.json", import.meta.url), "utf8"));
const versionLog = JSON.parse(await readFile(new URL("../src/data/version-log.json", import.meta.url), "utf8"));

const overcast = classifyQuery("abe i zoo gråvejr", taxonomy);
assert.deepEqual(overcast.facets.subject.includes("monkey"), true);
assert.deepEqual(overcast.facets.light.includes("overcast"), true);
assert.equal(findExactTerm(taxonomy, "aber").id, "monkey");
assert.equal(findExactTerm(taxonomy, "gråvejr").id, "overcast");
assert.equal(findExactTerm(taxonomy, "ko").id, "cow");
assert.equal(findExactTerm(taxonomy, "køer").id, "cow");
assert.equal(findExactTerm(taxonomy, "ukendt ord"), null);

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

assert.equal(maxStarShutterSeconds(18, 1.6), 13);
assert.equal(astroStatus(new Date("2026-08-08T23:00:00+02:00")).moon.percent >= 0, true);
assert.equal(astroTargets(new Date("2026-08-08T23:00:00+02:00")).some((target) => target.id === "milky-way-wide"), true);
assert.equal(versionLog.current, "0.4.5");
assert.equal(versionLog.entries[0].version, "0.4.5");

console.log("Alle søge-, anbefalings- og astro-tests bestod.");
