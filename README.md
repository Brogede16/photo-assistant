# Photo Assistant

Photo Assistant er en dansk, mobile-first PWA til at hjælpe med konkrete kameraindstillinger, 80D-betjening, astro, fejlfinding og egne presets.

Projektet er bevidst bygget uden AI-afhængighed og uden direkte Canon API/SDK-kamerastyring. Appen skal fungere offline til kernefunktioner: søgning, udstyrsvalg, anbefalinger, Canon EOS 80D-guides, astro-beregninger, EXIF-læsning og lokale presets.

## Første scope

- Dansk mobile-first PWA med skarpt, feltvenligt interface og lyst/mørkt tema.
- Lokalt genereret gradientfelt med synlig bevægelse, ny komposition ved hver åbning og en husket pause/play-kontakt.
- Rød nattetilstand slukker gradienten automatisk for at beskytte nattesynet.
- Offline-first service worker: appen bruger den gemte kopi først og opdaterer data i baggrunden, når der er net.
- Transparente glasflader og et editorialt serif/sans-serif-hierarki lader gradienten leve gennem hele appen.
- En monokrom ultramarin gradient og linjebaserede resultater holder farvesproget roligt og reducerer antallet af synlige kasser.
- Den bevægelige baggrund samles i én stor ultramarin lyskugle; glaslaget kan slås fra og holdes meget let, når FX er aktiv.
- Lysfeltet har et koncentreret centrum, fader til den rene temabaggrund og vandrer synligt hen over skærmen.
- Gradientlaget dækker hele dokumentfladen, følger med scroll og bevæger sig ad tilfældige, bløde ruter.
- Modulær arkitektur: data, søgning, anbefalinger, astro, EXIF og UI holdes adskilt.
- Canon EOS 80D som første fuldt understøttede kamera.
- Brugerens udstyr forudindlæst:
  - Sigma 18-35mm f/1.8 DC HSM Art
  - Canon EF-S 18-55mm f/3.5-5.6 IS STM
  - Canon EF 55-200mm f/4.5-5.6 II USM
  - Canon EF 70-300mm f/4-5.6 IS USM
  - Canon Speedlite 430EX II
- Søgning på tværs af motiver, lys, bevægelse, afstand, problemer, teknikker og udstyr.
- Ét levende tagsystem for motiv, handling, afstand, sted, vejr, tidspunkt, lys og stil.
- Scenariemotoren vælger mellem Canon-programmerne P, Av, Tv, M og Bulb ud fra den ønskede kontrol.
- 141 grundscenarier, blandt andet standardportrætter, baggrundstyper, biler, strand, vand, børn, indendørs hverdag, natur, biograf, arkitektur, festival, panorering og lysspor.
- Dyreliv skelner mellem landjord, skov, fugle i luften, dyr på havet og sæl/søløve i eller uden for vandet.
- Astro som central tagfamilie med stjerner, Mælkevejen, nordlys og måne.
- Astro-guides med stjerner, Mælkevejen og meteorregn viser en indbygget brændvidde-beregner for maks lukkertid på EOS 80D.
- Objektivvalg kan forklares med et konkret alternativ fra brugerens kit.
- Lange aften- og Astro-forløb med lukkertid pr. billede, samlet optagetid, startvindue og Bulb-alternativ.
- Lokale presets kan bruges som gennemsigtigt udgangspunkt for matchende guides.
- Billedupload kun til lokal EXIF-læsning og "gem som mit preset".
- Egne presets markeres tydeligt som `MIT PRESET`.
- Appen beder ikke om placering. Lys, vejr, tidspunkt, bylys og måne vælges som tags/scenarier.
- Konkrete indstillingsværdier kan forklares direkte i appen, og Lær-fanen har en lille eksponeringstræner for lukkertid, blænde og ISO.

## Kør lokalt

```bash
npm run serve
```

Åbn derefter `http://127.0.0.1:8000`.

## Test

```bash
npm test
```

## Dokumentation

- [Produktspecifikation](docs/SPEC.md)
- [Milepælsplan](docs/ROADMAP.md)
- [Datamodel](docs/DATA_MODEL.md)
- [Søgetaksonomi](docs/SEARCH_TAXONOMY.md)
- [Research-plan](research/README.md)
