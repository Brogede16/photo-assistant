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
assert.equal(findExactTerm(taxonomy, "stjernespor").id, "star-trails");
assert.equal(findExactTerm(taxonomy, "lang eksponering").id, "long-exposure");
assert.equal(findExactTerm(taxonomy, "bil").id, "car");
assert.equal(findExactTerm(taxonomy, "standard portræt").id, "classic-portrait");
assert.equal(findExactTerm(taxonomy, "rodet baggrund").id, "busy-background");
assert.equal(findExactTerm(taxonomy, "hverdagsbillede").id, "snapshot");

const consumedPhrase = consumeKnownTerms("ko gråt vejr ", taxonomy);
assert.deepEqual(consumedPhrase.termIds, ["cow", "overcast"]);
assert.equal(consumedPhrase.remainder, "");

const livePartial = suggestNextTags("kan", situations.profiles, taxonomy, [], 6);
assert.equal(livePartial.some((term) => term.id === "rabbit"), true);
assert.equal(livePartial.some((term) => term.id === "boat"), true);

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
assert.equal("gearChecklist" in recommendation, false);

const childClassification = classifyQuery("barn griner udenfor", taxonomy);
const childProfile = searchProfiles("barn griner udenfor", situations.profiles, taxonomy).results[0].item;
const childRecommendation = buildRecommendation(childProfile, equipment, { classification: childClassification });
assert.equal(childRecommendation.settings.shutter, "1/500");
assert.equal(childRecommendation.settings.focus, "AI Servo");
assert.equal(childRecommendation.settings.mode, "Tv");
assert.equal(childRecommendation.actions[0].id, "setTvMode");
assert.equal(childRecommendation.actions[0].steps.some((step) => step.includes("Tv")), true);
assert.equal(childRecommendation.actions.find((action) => action.id === "setFocalLength").steps.some((step) => step.includes(childRecommendation.settings.focalLength)), true);
assert.equal(childRecommendation.actions.find((action) => action.id === "setShutter").steps.some((step) => step.includes("1/500")), true);
assert.equal(childRecommendation.actions.find((action) => action.id === "setDriveMode").steps.some((step) => step.includes(childRecommendation.settings.drive)), true);

const protectedAstro = buildRecommendation(astroResults.results[0].item, equipment, {
  phase: "night",
  classification: classifyQuery("nordlys løber", taxonomy)
});
assert.equal(protectedAstro.settings.shutter, "6s");

const starTrailSearch = searchProfiles("stjernespor nat", situations.profiles, taxonomy);
assert.equal(starTrailSearch.results[0].item.id, "star-trails-sequence");
const starTrailRecommendation = buildRecommendation(starTrailSearch.results[0].item, equipment, {
  classification: starTrailSearch.classification
});
assert.equal(starTrailRecommendation.settings.shutter, "20s");
assert.equal(starTrailRecommendation.exposurePlan.total, "Ca. 63 min.");
assert.equal(starTrailRecommendation.exposurePlan.frames, "180 billeder");

const nightLandscape = searchProfiles("natlandskab lang eksponering", situations.profiles, taxonomy);
assert.equal(nightLandscape.results[0].item.id, "night-landscape-long");
const lightTrails = searchProfiles("lysspor aften gade", situations.profiles, taxonomy);
assert.equal(lightTrails.results[0].item.id, "light-trails-evening");
const protectedLightTrails = buildRecommendation(lightTrails.results[0].item, equipment, {
  classification: classifyQuery("lysspor løber aften gade", taxonomy)
});
assert.equal(protectedLightTrails.settings.shutter, "10s");

const standardPortrait = searchProfiles("standard portræt dagslys udenfor", situations.profiles, taxonomy);
assert.equal(standardPortrait.results[0].item.id, "portrait-standard-daylight");
assert.equal(buildRecommendation(standardPortrait.results[0].item, equipment, {
  classification: standardPortrait.classification
}).settings.mode, "Av");
assert.equal(searchProfiles("portræt rodet baggrund", situations.profiles, taxonomy).results[0].item.id, "portrait-busy-background");

const carRainNight = searchProfiles("bil kører i regn om natten", situations.profiles, taxonomy);
assert.equal(carRainNight.results[0].item.id, "car-rain-night");
assert.equal(buildRecommendation(carRainNight.results[0].item, equipment, {
  classification: carRainNight.classification
}).settings.mode, "Tv");
assert.equal(searchProfiles("bil i regn om dagen", situations.profiles, taxonomy).results[0].item.id, "car-rain-daylight");
const carPanning = searchProfiles("bil panorering dagslys", situations.profiles, taxonomy);
assert.equal(carPanning.results[0].item.id, "car-panning-daylight");
assert.equal(buildRecommendation(carPanning.results[0].item, equipment, {
  classification: carPanning.classification
}).settings.shutter, "1/80");

const carTrails = searchProfiles("bil lysspor om natten", situations.profiles, taxonomy);
assert.equal(carTrails.results[0].item.id, "car-light-trails-night");
const carTrailsRecommendation = buildRecommendation(carTrails.results[0].item, equipment, {
  classification: carTrails.classification
});
assert.equal(carTrailsRecommendation.settings.mode, "M");
assert.equal(carTrailsRecommendation.settings.iso, "100");
assert.equal(Boolean(carTrailsRecommendation.exposurePlan), true);

const snapshot = searchProfiles("hverdagsbillede af person", situations.profiles, taxonomy);
assert.equal(snapshot.results[0].item.id, "everyday-person-snapshot");
assert.equal(buildRecommendation(snapshot.results[0].item, equipment, {
  classification: snapshot.classification
}).settings.mode, "P");

assert.equal(searchProfiles("barn løber på stranden", situations.profiles, taxonomy).results[0].item.id, "beach-child-running");
assert.equal(searchProfiles("sovende barn indenfor", situations.profiles, taxonomy).results[0].item.id, "child-sleeping-indoor");
assert.equal(searchProfiles("mennesker løber langt væk", situations.profiles, taxonomy).results[0].item.id, "people-running-far");
assert.equal(searchProfiles("mennesker i båd på vandet", situations.profiles, taxonomy).results[0].item.id, "people-on-water-boat");

const indoorPlay = searchProfiles("barn leger indenfor", situations.profiles, taxonomy);
assert.equal(indoorPlay.results[0].item.id, "children-playing-indoor");
const indoorPlayRecommendation = buildRecommendation(indoorPlay.results[0].item, equipment, { classification: indoorPlay.classification });
assert.equal(indoorPlayRecommendation.settings.mode, "M");
assert.equal(indoorPlayRecommendation.settings.shutter, "1/640");
assert.equal(indoorPlayRecommendation.settings.aperture, "f/2.0");

assert.equal(searchProfiles("mennesker hygger indenfor", situations.profiles, taxonomy).results[0].item.id, "indoor-cozy-people");
assert.equal(searchProfiles("mennesker spiser indenfor", situations.profiles, taxonomy).results[0].item.id, "people-eating-indoor");
assert.equal(searchProfiles("mennesker spiser udenfor", situations.profiles, taxonomy).results[0].item.id, "people-eating-outdoor");

assert.equal(findExactTerm(taxonomy, "legeplads").id, "playground");
assert.equal(findExactTerm(taxonomy, "gadefoto").id, "street-photo");
assert.equal(findExactTerm(taxonomy, "cyklist").id, "cycling");
assert.equal(findExactTerm(taxonomy, "vandfald").id, "waterfall");
assert.equal(searchProfiles("hund løber i park", situations.profiles, taxonomy).results[0].item.id, "dog-running-park");
assert.equal(searchProfiles("kat hjemme ved vinduet", situations.profiles, taxonomy).results[0].item.id, "cat-home-window");
assert.equal(searchProfiles("barn hopper på legeplads", situations.profiles, taxonomy).results[0].item.id, "child-playground-action");
assert.equal(searchProfiles("gadefoto i dagslys", situations.profiles, taxonomy).results[0].item.id, "street-photo-daylight");
assert.equal(searchProfiles("mad på restaurant", situations.profiles, taxonomy).results[0].item.id, "restaurant-food-closeup");
assert.equal(searchProfiles("landskab tåge i skov", situations.profiles, taxonomy).results[0].item.id, "foggy-forest-landscape");
assert.equal(searchProfiles("arkitektur i skumring", situations.profiles, taxonomy).results[0].item.id, "architecture-blue-hour");

const indoorSport = searchProfiles("sport i hallen indenfor", situations.profiles, taxonomy);
assert.equal(indoorSport.results[0].item.id, "indoor-sport-action");
const indoorSportRecommendation = buildRecommendation(indoorSport.results[0].item, equipment, { classification: indoorSport.classification });
assert.equal(indoorSportRecommendation.settings.mode, "M");
assert.equal(indoorSportRecommendation.settings.shutter, "1/800");
assert.equal(indoorSportRecommendation.lens.id, "sigma-18-35-f18-art");

const waterfall = searchProfiles("vandfald lang eksponering", situations.profiles, taxonomy);
assert.equal(waterfall.results[0].item.id, "waterfall-long-exposure");
const waterfallRecommendation = buildRecommendation(waterfall.results[0].item, equipment, { classification: waterfall.classification });
assert.equal(waterfallRecommendation.settings.mode, "M");
assert.equal(waterfallRecommendation.settings.shutter, "1/2s");
assert.equal(waterfallRecommendation.settings.aperture, "f/11");

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
assert.equal(versionLog.current, "0.16.0");
assert.equal(versionLog.entries[0].version, "0.16.0");
assert.equal(learning.lessons.length, 6);
assert.equal(learning.lessons.some((lesson) => lesson.id === "modes"), true);
assert.deepEqual(new Set(situations.profiles.map((profile) => profile.baseSettings.mode)), new Set(["P", "Av", "Tv", "M"]));
assert.equal(["setTvMode", "setProgramMode", "setBulbMode"].every((id) => equipment.cameras[0].procedures[id]), true);
assert.equal(learning.lessons.every((lesson) => lesson.answers[lesson.correct]), true);

console.log("Alle søge-, anbefalings- og astro-tests bestod.");
