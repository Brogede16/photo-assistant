# Milepælsplan

## M0: Repo og fundament

- Opret GitHub-repo.
- Etabler PWA-skelet, service worker og manifest.
- Dokumenter produktprincipper, datamodel, taksonomi og udviklingsplan.
- Indlæs brugerens Canon EOS 80D, fire objektiver og Speedlite 430EX II.

## M1: Søgning og taksonomi

- Normaliser danske søgeord, synonymer og stavevarianter.
- Match motiv, lys, bevægelse, afstand, teknik, problemer og udstyr.
- Bland officielle guides og egne presets i samme søgning.
- Registrer ukendte søgninger lokalt.

## M2: Regelmotor og 100 grundprofiler

- Research 10-15 kerneprofiler grundigt først.
- Udvid derefter til ca. 100 veldokumenterede grundprofiler.
- Lad motiver/synonymer pege på profiler fremfor at hardcode 500 opskrifter.
- Indstillinger skal være intervaller og startpunkter, ikke falsk præcision.
- Kombinér grundprofiler og tags til langt flere konkrete situationer; målet er ikke 1.000 kopierede JSON-opskrifter.
- Test konflikter og særregler, så fx astro, fyrværkeri og bevægelse ikke overskriver hinanden forkert.

## M3: Canon EOS 80D-guide

- Byg genbrugelige procedures for mode, lukkertid, blænde, ISO, AF, drive, metering og Live View.
- Tilføj visuelle 80D-hotspots for top, bagside, programhjul og objektivkontakter.
- Hver anbefaling skal kunne foldes ud til "vis mig præcis hvordan".

## M4: Astro Assistant

- Gør astro til en hovedindgang.
- Tilføj stjerner, Mælkevejen, måne, nordlys, meteorregn og natlandskab.
- Brug valgte tidspunkt-, vejr- og lystags samt brændviddeberegninger.
- Integrer Canon Camera Connect som guide, ikke direkte API-styring.
- Astro er en central tagfamilie i den fælles scenariebygger fremfor en separat søgeoplevelse.

## M5: Presets og EXIF

- Lokal EXIF-læsning.
- "Gem som mit preset" med tydelig markering.
- Rediger navn, noter, tags og indstillinger.
- Sammenlign eget preset med aktuel Photo Assistant-anbefaling.

## M6: Fejlfinding og læring

- "Det virkede ikke" efter hver anbefaling.
- Problemindgange som uskarpt, for mørkt, for lyst, grynet, forkert fokus, måne hvid, stjerner streger.
- Eksponeringstræner og "hvad sker der hvis jeg ændrer denne?"

## M7: Første deployment

- Deploy til Render, når PWA-skelet, navigation, offline-cache og første anbefalinger virker stabilt.
- Test på rigtig iPhone med "Føj til hjemmeskærm".
