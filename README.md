# Photo Assistant

Photo Assistant er en dansk, mobile-first PWA til at hjælpe med konkrete kameraindstillinger, 80D-betjening, astro, fejlfinding og egne presets.

Projektet er bevidst bygget uden AI-afhængighed og uden direkte Canon API/SDK-kamerastyring. Appen skal fungere offline til kernefunktioner: søgning, udstyrsvalg, anbefalinger, Canon EOS 80D-guides, astro-beregninger, EXIF-læsning og lokale presets.

## Første scope

- Dansk mobile-first PWA med mørkt, feltvenligt interface.
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
- Astro som central tagfamilie med stjerner, Mælkevejen, nordlys og måne.
- Lange aften- og Astro-forløb med lukkertid pr. billede, samlet optagetid, startvindue og Bulb-alternativ.
- Lokale presets kan bruges som gennemsigtigt udgangspunkt for matchende guides.
- Billedupload kun til lokal EXIF-læsning og "gem som mit preset".
- Egne presets markeres tydeligt som `MIT PRESET`.

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
