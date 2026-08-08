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
assert.equal(findExactTerm(taxonomy, "enkeltmand").id, "single-portrait");
assert.equal(findExactTerm(taxonomy, "portræt af en mand").id, "single-portrait");
assert.equal(findExactTerm(taxonomy, "rodet baggrund").id, "busy-background");
assert.equal(findExactTerm(taxonomy, "hverdagsbillede").id, "snapshot");
assert.equal(findExactTerm(taxonomy, "bykant").id, "city-edge");
assert.equal(findExactTerm(taxonomy, "bylys").id, "light-pollution");
assert.equal(findExactTerm(taxonomy, "ind over byen").id, "toward-city");
assert.equal(findExactTerm(taxonomy, "væk fra byen").id, "away-from-city");
assert.equal(findExactTerm(taxonomy, "ud over marken").id, "field");
assert.equal(findExactTerm(taxonomy, "biografen").id, "cinema");
assert.equal(findExactTerm(taxonomy, "lærredet").id, "cinema-screen");
assert.equal(findExactTerm(taxonomy, "Himmelbio").id, "film-roof");
assert.equal(findExactTerm(taxonomy, "salelys tændt").id, "house-lights-on");
assert.equal(findExactTerm(taxonomy, "biograf uden lys").id, "house-lights-off");
assert.equal(findExactTerm(taxonomy, "filmvisning").id, "watching-film");
assert.equal(findExactTerm(taxonomy, "i skumringen").id, "twilight");
assert.equal(findExactTerm(taxonomy, "museum").id, "museum");
assert.equal(findExactTerm(taxonomy, "slottet").id, "castle");
assert.equal(findExactTerm(taxonomy, "stor bygning").id, "large-building");
assert.equal(findExactTerm(taxonomy, "lille hus").id, "small-building");
assert.equal(findExactTerm(taxonomy, "på landet").id, "countryside");
assert.equal(findExactTerm(taxonomy, "lys restaurant").id, "bright-interior");
assert.equal(findExactTerm(taxonomy, "mørk restaurant").id, "dim-interior");
assert.equal(classifyQuery("morgen", taxonomy).facets.subject?.includes("castle") || false, false);

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
assert.deepEqual(mergeTagIds(taxonomy, ["toward-city"], ["away-from-city"]), ["away-from-city"]);
assert.deepEqual(mergeTagIds(taxonomy, ["light-pollution"], ["dark-sky"]), ["dark-sky"]);

const birdResults = searchProfiles("fugl flyver langt væk", situations.profiles, taxonomy);
assert.equal(birdResults.results[0].item.id, "bird-flight-daylight");

const astroResults = searchProfiles("nordlys", situations.profiles, taxonomy);
assert.equal(astroResults.results[0].item.id, "aurora-weak");

const milkyWayResults = searchProfiles("mælkevejen", situations.profiles, taxonomy);
assert.equal(milkyWayResults.results[0].item.id, "milky-way-wide");

const cityStars = searchProfiles("stjerner i byen lysforurening mod byen", situations.profiles, taxonomy);
assert.equal(cityStars.results[0].item.id, "stars-city-light-pollution");
const cityStarsRecommendation = buildRecommendation(cityStars.results[0].item, equipment, { classification: cityStars.classification });
assert.equal(cityStarsRecommendation.settings.shutter, "4s");
assert.equal(cityStarsRecommendation.settings.aperture, "f/2.8");
assert.equal(cityStarsRecommendation.settings.iso, "800");
assert.equal(cityStarsRecommendation.lens.id, "sigma-18-35-f18-art");

assert.equal(searchProfiles("stjerner ved bykanten", situations.profiles, taxonomy).results[0].item.id, "stars-city-edge");
const fieldStars = searchProfiles("stjerner ved bykanten væk fra byen ud over marken mørk himmel", situations.profiles, taxonomy);
assert.equal(fieldStars.results[0].item.id, "stars-field-away-city");
const fieldStarsRecommendation = buildRecommendation(fieldStars.results[0].item, equipment, { classification: fieldStars.classification });
assert.equal(fieldStarsRecommendation.settings.shutter, "10s");
assert.equal(fieldStarsRecommendation.settings.aperture, "f/1.8");
assert.equal(fieldStarsRecommendation.settings.iso, "1600");

const cityEdgeMilkyWay = searchProfiles("mælkevejen væk fra byen ud over marken", situations.profiles, taxonomy);
assert.equal(cityEdgeMilkyWay.results[0].item.id, "milky-way-city-edge-away");
assert.equal(buildRecommendation(cityEdgeMilkyWay.results[0].item, equipment, { classification: cityEdgeMilkyWay.classification }).settings.shutter, "8s");
assert.equal(searchProfiles("måne over byen", situations.profiles, taxonomy).results[0].item.id, "moon-city-skyline");
assert.equal(searchProfiles("stjernespor over byen", situations.profiles, taxonomy).results[0].item.id, "star-trails-city");
assert.equal(searchProfiles("meteorregn væk fra byen ud over marken", situations.profiles, taxonomy).results[0].item.id, "meteor-shower-field-away-city");
assert.equal(cityStars.results.some((result) => result.item.conditions?.direction?.includes("away-from-city")), false);

const cityAstroTags = suggestNextTags("Stjerner", situations.profiles, taxonomy, ["stars"], 16);
assert.equal(cityAstroTags.some((term) => term.id === "city-edge"), true);
assert.equal(cityAstroTags.some((term) => term.id === "away-from-city"), true);

const cinemaOverview = searchProfiles("biograf", situations.profiles, taxonomy);
assert.equal(cinemaOverview.results[0].item.id, "cinema-room-overview");
const cinemaLightsOn = searchProfiles("biograf med lys", situations.profiles, taxonomy);
assert.equal(cinemaLightsOn.results[0].item.id, "cinema-room-lights-on");
assert.equal(buildRecommendation(cinemaLightsOn.results[0].item, equipment, { classification: cinemaLightsOn.classification }).settings.aperture, "f/4");
const cinemaLightsOff = searchProfiles("biograf uden lys", situations.profiles, taxonomy);
assert.equal(cinemaLightsOff.results[0].item.id, "cinema-room-lights-off");
assert.equal(buildRecommendation(cinemaLightsOff.results[0].item, equipment, { classification: cinemaLightsOff.classification }).settings.shutter, "1/15");

const cinemaScreen = searchProfiles("lærred i biograf", situations.profiles, taxonomy);
assert.equal(cinemaScreen.results[0].item.id, "cinema-screen-exposure");
const cinemaScreenRecommendation = buildRecommendation(cinemaScreen.results[0].item, equipment, { classification: cinemaScreen.classification });
assert.equal(cinemaScreenRecommendation.settings.shutter, "1/50");
assert.equal(cinemaScreenRecommendation.settings.iso, "400");
assert.equal(cinemaScreenRecommendation.actions.some((action) => action.id === "setAntiFlicker"), true);

const cinemaAudience = searchProfiles("publikum ser film i biograf", situations.profiles, taxonomy);
assert.equal(cinemaAudience.results[0].item.id, "cinema-audience-watching");
assert.equal(buildRecommendation(cinemaAudience.results[0].item, equipment, { classification: cinemaAudience.classification }).settings.iso, "3200");
const cinemaSilhouettes = searchProfiles("lærred og publikum i biograf", situations.profiles, taxonomy);
assert.equal(cinemaSilhouettes.results[0].item.id, "cinema-screen-audience-silhouette");
const cinemaReaction = searchProfiles("publikum griner i biograf med salelys tændt", situations.profiles, taxonomy);
assert.equal(cinemaReaction.results[0].item.id, "cinema-audience-house-lights-reaction");
assert.equal(buildRecommendation(cinemaReaction.results[0].item, equipment, { classification: cinemaReaction.classification }).settings.shutter, "1/250");

assert.equal(searchProfiles("Filmtaget", situations.profiles, taxonomy).results[0].item.id, "filmtaget-rooftop-event");
assert.equal(searchProfiles("Filmtaget i dagslys", situations.profiles, taxonomy).results[0].item.id, "filmtaget-daytime-screen");
const filmRoofScreen = searchProfiles("Himmelbio lærred i skumringen", situations.profiles, taxonomy);
assert.equal(filmRoofScreen.results[0].item.id, "filmtaget-screen-twilight");
assert.equal(buildRecommendation(filmRoofScreen.results[0].item, equipment, { classification: filmRoofScreen.classification }).settings.shutter, "1/100");
assert.equal(searchProfiles("Filmtaget publikum om aftenen", situations.profiles, taxonomy).results[0].item.id, "filmtaget-audience-evening");
assert.equal(searchProfiles("udsigt fra Filmtaget", situations.profiles, taxonomy).results[0].item.id, "filmtaget-city-view");

const cinemaTags = suggestNextTags("Biograf", situations.profiles, taxonomy, ["cinema"], 16);
assert.equal(cinemaTags.some((term) => term.id === "cinema-screen"), true);
assert.equal(cinemaTags.some((term) => term.id === "house-lights-off"), true);
assert.equal(cinemaTags.some((term) => term.id === "audience"), true);

assert.equal(searchProfiles("barn i skoven", situations.profiles, taxonomy).results[0].item.id, "child-forest-exploring");
const childForestStill = searchProfiles("barn står stille i skoven", situations.profiles, taxonomy);
assert.equal(childForestStill.results[0].item.id, "child-forest-still");
assert.equal(buildRecommendation(childForestStill.results[0].item, equipment, { classification: childForestStill.classification }).settings.aperture, "f/2.8");
const childForestRunning = searchProfiles("barn løber i skoven", situations.profiles, taxonomy);
assert.equal(childForestRunning.results[0].item.id, "child-forest-running");
assert.equal(buildRecommendation(childForestRunning.results[0].item, equipment, { classification: childForestRunning.classification }).settings.shutter, "1/1000");

const beachPeopleStill = searchProfiles("mennesker står stille på stranden", situations.profiles, taxonomy);
assert.equal(beachPeopleStill.results[0].item.id, "beach-people-still");
assert.equal(buildRecommendation(beachPeopleStill.results[0].item, equipment, { classification: beachPeopleStill.classification }).settings.aperture, "f/4");
const beachGroupStill = searchProfiles("gruppe står stille på stranden", situations.profiles, taxonomy);
assert.equal(beachGroupStill.results[0].item.id, "beach-group-still");
assert.equal(buildRecommendation(beachGroupStill.results[0].item, equipment, { classification: beachGroupStill.classification }).settings.aperture, "f/5.6");

assert.equal(searchProfiles("mennesker på restaurant", situations.profiles, taxonomy).results[0].item.id, "restaurant-people-overview");
const brightRestaurant = searchProfiles("mennesker på lys restaurant", situations.profiles, taxonomy);
assert.equal(brightRestaurant.results[0].item.id, "restaurant-people-bright");
assert.equal(buildRecommendation(brightRestaurant.results[0].item, equipment, { classification: brightRestaurant.classification }).settings.shutter, "1/320");
const dimRestaurant = searchProfiles("mennesker på mørk restaurant", situations.profiles, taxonomy);
assert.equal(dimRestaurant.results[0].item.id, "restaurant-people-dim");
assert.equal(buildRecommendation(dimRestaurant.results[0].item, equipment, { classification: dimRestaurant.classification }).settings.aperture, "f/2");
assert.equal(dimRestaurant.results.every((result) => result.item.conditions?.place?.includes("restaurant")), true);

const largeCityDay = searchProfiles("stor bygning i byen om dagen", situations.profiles, taxonomy);
assert.equal(largeCityDay.results[0].item.id, "architecture-large-city-day");
assert.equal(buildRecommendation(largeCityDay.results[0].item, equipment, { classification: largeCityDay.classification }).settings.aperture, "f/8");
const largeCityNight = searchProfiles("stor bygning i byen om natten", situations.profiles, taxonomy);
assert.equal(largeCityNight.results[0].item.id, "architecture-large-city-night");
assert.equal(buildRecommendation(largeCityNight.results[0].item, equipment, { classification: largeCityNight.classification }).settings.shutter, "1s");
assert.equal(searchProfiles("lille bygning i byen om dagen", situations.profiles, taxonomy).results[0].item.id, "architecture-small-city-day");
const smallCountryBuilding = searchProfiles("lille bygning på landet", situations.profiles, taxonomy);
assert.equal(smallCountryBuilding.results[0].item.id, "architecture-small-countryside-day");
assert.equal(buildRecommendation(smallCountryBuilding.results[0].item, equipment, { classification: smallCountryBuilding.classification }).lens.id, "canon-ef-70-300-is-usm");
assert.equal(searchProfiles("stor bygning på landet", situations.profiles, taxonomy).results[0].item.id, "architecture-large-countryside-day");

assert.equal(searchProfiles("museum", situations.profiles, taxonomy).results[0].item.id, "museum-exterior-day");
assert.equal(searchProfiles("museum indenfor lyst lokale", situations.profiles, taxonomy).results[0].item.id, "museum-interior-bright");
const dimMuseum = searchProfiles("museum indenfor dæmpet lokale", situations.profiles, taxonomy);
assert.equal(dimMuseum.results[0].item.id, "museum-interior-dim");
assert.equal(buildRecommendation(dimMuseum.results[0].item, equipment, { classification: dimMuseum.classification }).settings.iso, "3200");
assert.equal(searchProfiles("museum om natten", situations.profiles, taxonomy).results[0].item.id, "museum-exterior-night");
assert.equal(searchProfiles("slot om dagen", situations.profiles, taxonomy).results[0].item.id, "castle-day");
assert.equal(searchProfiles("slot om natten", situations.profiles, taxonomy).results[0].item.id, "castle-night");

const architectureTags = suggestNextTags("Arkitektur", situations.profiles, taxonomy, ["architecture"], 20);
assert.equal(architectureTags.some((term) => term.id === "large-building"), true);
assert.equal(architectureTags.some((term) => term.id === "small-building"), true);
assert.equal(architectureTags.some((term) => term.id === "museum"), true);
assert.equal(architectureTags.some((term) => term.id === "castle"), true);

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
const festivalEveningRain = searchProfiles("festival aften regn", situations.profiles, taxonomy);
assert.equal(festivalEveningRain.results[0].item.id, "festival-rain-evening");
assert.equal(festivalEveningRain.results.some((result) => result.item.id.startsWith("concert-outdoor")), false);
assert.equal(festivalEveningRain.results.some((result) => result.item.id === "concert-indoor-stage"), false);
const concertLowLightOnly = searchProfiles("koncert lavt lys", situations.profiles, taxonomy);
assert.equal(concertLowLightOnly.results[0].item.id, "concert-indoor-stage");
assert.equal(concertLowLightOnly.results.some((result) => result.item.family === "festival"), false);
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

const singlePortrait = searchProfiles("portræt enkeltmand", situations.profiles, taxonomy);
assert.equal(singlePortrait.results[0].item.id, "portrait-single-person");
const singlePortraitRecommendation = buildRecommendation(singlePortrait.results[0].item, equipment, { classification: singlePortrait.classification });
assert.equal(singlePortraitRecommendation.settings.mode, "Av");
assert.equal(singlePortraitRecommendation.settings.shutter, "1/250");
assert.equal(singlePortraitRecommendation.settings.aperture, "f/2.8");
assert.equal(singlePortraitRecommendation.lens.id, "sigma-18-35-f18-art");
assert.equal(singlePortrait.results.every((result) => result.item.conditions?.style?.includes("single-portrait")), true);
assert.equal(searchProfiles("enkeltportræt i regn", situations.profiles, taxonomy).results[0].item.id, "portrait-rain");

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

assert.equal(findExactTerm(taxonomy, "natur").id, "nature");
assert.equal(findExactTerm(taxonomy, "træstamme").id, "tree");
assert.equal(findExactTerm(taxonomy, "græsstrå").id, "grass");
assert.equal(findExactTerm(taxonomy, "paddehat").id, "mushroom");
assert.equal(findExactTerm(taxonomy, "vandløb").id, "river");
assert.equal(findExactTerm(taxonomy, "dugdråber").id, "dew");
assert.equal(findExactTerm(taxonomy, "frys vandet").id, "freeze-motion");
assert.equal(searchProfiles("natur", situations.profiles, taxonomy).results[0].item.id, "nature-landscape-daylight");
assert.equal(searchProfiles("træer i skov overskyet", situations.profiles, taxonomy).results[0].item.id, "trees-forest-overcast");
assert.equal(searchProfiles("træ i modlys aften", situations.profiles, taxonomy).results[0].item.id, "tree-backlight-evening");
assert.equal(searchProfiles("dug på græs close-up morgen", situations.profiles, taxonomy).results[0].item.id, "grass-dew-morning-closeup");
assert.equal(searchProfiles("blomstereng landskab", situations.profiles, taxonomy).results[0].item.id, "flower-meadow-wide");
assert.equal(searchProfiles("svamp close-up i skov", situations.profiles, taxonomy).results[0].item.id, "mushroom-forest-closeup");
assert.equal(searchProfiles("blade i modlys tæt på", situations.profiles, taxonomy).results[0].item.id, "leaves-backlight-closeup");
assert.equal(searchProfiles("å lang eksponering", situations.profiles, taxonomy).results[0].item.id, "river-soft-flow");
assert.equal(searchProfiles("sø morgen langt væk", situations.profiles, taxonomy).results[0].item.id, "lake-reflection-calm");
assert.equal(searchProfiles("bjerglandskab dagslys", situations.profiles, taxonomy).results[0].item.id, "mountain-landscape-daylight");

const frozenWaterfall = searchProfiles("vandfald frys bevægelsen", situations.profiles, taxonomy);
assert.equal(frozenWaterfall.results[0].item.id, "waterfall-frozen-motion");
const frozenWaterfallRecommendation = buildRecommendation(frozenWaterfall.results[0].item, equipment, { classification: frozenWaterfall.classification });
assert.equal(frozenWaterfallRecommendation.settings.mode, "Tv");
assert.equal(frozenWaterfallRecommendation.settings.shutter, "1/1000");
assert.equal(frozenWaterfall.results.some((result) => result.item.id === "waterfall-long-exposure"), false);
assert.equal(waterfall.results[0].item.id, "waterfall-long-exposure");
assert.equal(waterfall.results.some((result) => result.item.id === "waterfall-frozen-motion"), false);
assert.deepEqual(mergeTagIds(taxonomy, ["long-exposure"], ["freeze-motion"]), ["freeze-motion"]);
assert.equal(new Set(taxonomy.terms.map((term) => term.id)).size, taxonomy.terms.length);
assert.equal(taxonomy.terms.length >= 140, true);
assert.equal(situations.profiles.length >= 82, true);

assert.equal(findExactTerm(taxonomy, "musikfestival").id, "festival");
assert.equal(findExactTerm(taxonomy, "forsanger").id, "singer");
assert.equal(findExactTerm(taxonomy, "menneskehav").id, "crowd-shot");
assert.equal(findExactTerm(taxonomy, "spotlys").id, "spotlight");
assert.equal(findExactTerm(taxonomy, "farvet scenelys").id, "colored-stage-light");
assert.equal(findExactTerm(taxonomy, "trommer").id, "drummer");
assert.equal(findExactTerm(taxonomy, "festivalplads").id, "festival-site");
assert.equal(findExactTerm(taxonomy, "om dagen").id, "day-time");

const festivalDay = searchProfiles("festival dag", situations.profiles, taxonomy);
assert.equal(festivalDay.results[0].item.id, "festival-day-artist");
const festivalDayRecommendation = buildRecommendation(festivalDay.results[0].item, equipment, { classification: festivalDay.classification });
assert.equal(festivalDayRecommendation.settings.mode, "Tv");
assert.equal(festivalDayRecommendation.settings.shutter, "1/1000");
assert.equal(festivalDayRecommendation.lens.id, "canon-ef-70-300-is-usm");

const festivalEvening = searchProfiles("festival aften", situations.profiles, taxonomy);
assert.equal(festivalEvening.results[0].item.id, "festival-evening-artist-near");
assert.equal(festivalEvening.results.some((result) => result.item.id === "festival-rain-evening"), false);
const festivalEveningRecommendation = buildRecommendation(festivalEvening.results[0].item, equipment, { classification: festivalEvening.classification });
assert.equal(festivalEveningRecommendation.settings.mode, "M");
assert.equal(festivalEveningRecommendation.settings.aperture, "f/2");
assert.equal(festivalEveningRecommendation.lens.id, "sigma-18-35-f18-art");

assert.equal(searchProfiles("festival aften langt væk", situations.profiles, taxonomy).results[0].item.id, "festival-evening-artist-far");
assert.equal(searchProfiles("festival publikum dag", situations.profiles, taxonomy).results[0].item.id, "festival-crowd-day");
assert.equal(searchProfiles("festival publikum aften", situations.profiles, taxonomy).results[0].item.id, "festival-crowd-evening");
assert.equal(searchProfiles("festival regn aften", situations.profiles, taxonomy).results[0].item.id, "festival-rain-evening");
assert.equal(searchProfiles("trommeslager koncert lavt lys", situations.profiles, taxonomy).results[0].item.id, "concert-drummer-action");
assert.equal(searchProfiles("band på scenen lavt lys", situations.profiles, taxonomy).results[0].item.id, "concert-band-wide-stage");
assert.equal(searchProfiles("artist farvet scenelys aften", situations.profiles, taxonomy).results[0].item.id, "concert-colored-stage-light");
assert.equal(searchProfiles("artist backstage", situations.profiles, taxonomy).results[0].item.id, "backstage-performer-candid");
assert.equal(searchProfiles("dj festival nat", situations.profiles, taxonomy).results[0].item.id, "festival-dj-night");

const spotlightConcert = searchProfiles("koncert spotlight", situations.profiles, taxonomy);
assert.equal(spotlightConcert.results[0].item.id, "concert-singer-spotlight");
const spotlightRecommendation = buildRecommendation(spotlightConcert.results[0].item, equipment, { classification: spotlightConcert.classification });
assert.equal(spotlightRecommendation.settings.shutter, "1/500");
assert.equal(spotlightRecommendation.settings.iso, "800");
assert.equal(spotlightRecommendation.actions.some((action) => action.id === "setSpotMetering"), true);
const festivalSpotlight = searchProfiles("festival aften spotlight", situations.profiles, taxonomy);
assert.equal(festivalSpotlight.results[0].item.id, "concert-singer-spotlight");
assert.equal(buildRecommendation(festivalSpotlight.results[0].item, equipment, { classification: festivalSpotlight.classification }).settings.iso, "800");
assert.equal(searchProfiles("koncert lavt lys", situations.profiles, taxonomy).results[0].item.id, "concert-indoor-stage");
assert.equal(taxonomy.terms.length >= 160, true);
assert.equal(situations.profiles.length >= 95, true);

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
assert.equal(versionLog.current, "0.21.0");
assert.equal(versionLog.entries[0].version, "0.21.0");
assert.equal(learning.lessons.length, 6);
assert.equal(learning.lessons.some((lesson) => lesson.id === "modes"), true);
const modesLesson = learning.lessons.find((lesson) => lesson.id === "modes");
assert.deepEqual(modesLesson.explanations.map((mode) => mode.value), ["P", "Av", "Tv", "M", "Bulb"]);
assert.equal(modesLesson.explanations.every((mode) => mode.name && mode.meaning && mode.bestFor), true);
assert.deepEqual(new Set(situations.profiles.map((profile) => profile.baseSettings.mode)), new Set(["P", "Av", "Tv", "M"]));
assert.equal(["setTvMode", "setProgramMode", "setBulbMode", "setAntiFlicker"].every((id) => equipment.cameras[0].procedures[id]), true);
assert.equal(learning.lessons.every((lesson) => lesson.answers[lesson.correct]), true);

console.log("Alle søge-, anbefalings- og astro-tests bestod.");
