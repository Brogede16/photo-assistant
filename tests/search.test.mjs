import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { astroStatus, maxStarShutterSeconds } from "../src/lib/astro.js";
import { buildRecommendation } from "../src/lib/recommendations.js";
import { classifyQuery, searchProfiles } from "../src/lib/search.js";

const taxonomy = JSON.parse(await readFile(new URL("../src/data/search/taxonomy.json", import.meta.url), "utf8"));
const situations = JSON.parse(await readFile(new URL("../src/data/situations/core-profiles.json", import.meta.url), "utf8"));
const equipment = JSON.parse(await readFile(new URL("../src/data/equipment/index.json", import.meta.url), "utf8"));

const overcast = classifyQuery("abe i zoo gråvejr", taxonomy);
assert.deepEqual(overcast.facets.subject.includes("monkey"), true);
assert.deepEqual(overcast.facets.light.includes("overcast"), true);

const birdResults = searchProfiles("fugl flyver langt væk", situations.profiles, taxonomy);
assert.equal(birdResults.results[0].item.id, "bird-flight-daylight");

const astroResults = searchProfiles("nordlys", situations.profiles, taxonomy);
assert.equal(astroResults.results[0].item.id, "aurora-weak");

const milkyWayResults = searchProfiles("mælkevejen", situations.profiles, taxonomy);
assert.equal(milkyWayResults.results[0].item.id, "milky-way-wide");

const zooResults = searchProfiles("aber i zoo gråvejr", situations.profiles, taxonomy);
assert.equal(zooResults.results[0].item.id, "zoo-monkeys-overcast");

const sportResults = searchProfiles("fodbold overskyet", situations.profiles, taxonomy);
assert.equal(sportResults.results[0].item.id, "outdoor-sport-daylight");

const recommendation = buildRecommendation(astroResults.results[0].item, equipment, { phase: "night" });
assert.equal(recommendation.lens.id, "sigma-18-35-f18-art");
assert.equal(recommendation.settings.aperture, "f/1.8");

assert.equal(maxStarShutterSeconds(18, 1.6), 13);
assert.equal(astroStatus(new Date("2026-08-08T23:00:00+02:00")).moon.percent >= 0, true);

console.log("Alle søge-, anbefalings- og astro-tests bestod.");
