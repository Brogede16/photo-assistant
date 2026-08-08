# Validering af indstillinger

Photo Assistant bruger ikke AI ved kørsel. Anbefalingerne kommer fra kontrollerede tags, scenarieprofiler, udstyrsdata og faste regler.

## Fra ord til anbefaling

1. Teksten bliver oversat til kendte tags som motiv, handling, lys, sted, afstand og ønsket teknik.
2. Uforenelige profiler sorteres fra. Et indendørs scenarie kan eksempelvis ikke vinde over et valgt `udenfor`-tag.
3. Den mest specifikke profil leverer et samlet fotografisk udgangspunkt. Indstillingerne bliver ikke valgt enkeltvis fra tilfældige scenarier.
4. Regelmotoren må kun ændre de indstillinger, som et tag fagligt påvirker. Bevægelse påvirker primært lukkertid, AF og drive; afstand påvirker objektiv og brændvidde; lys påvirker primært ISO og eksponering.
5. Objektivet vælges blandt Mads' fire objektiver efter scenariets roller og faktiske styrker.
6. Automatiske tests kontrollerer både søgeresultat, mode, lukkertid, blænde, ISO og objektiv for repræsentative kombinationer.

## Eksempel: vandfald

`Vandfald` alene har ikke én universelt rigtig indstilling, fordi fotografens ønskede udtryk mangler:

- `Vandfald + Lang eksponering` vælger M, 1/2 sek., f/11 og ISO 100 som startpunkt for blødt vand.
- `Vandfald + Frys bevægelsen` vælger Tv, 1/1000 og Auto ISO som startpunkt for tydelige vanddråber.
- Lys, afstand og valgt effekt kan derefter flytte startpunktet inden for profilens dokumenterede interval.

De to effekter er gensidigt udelukkende. Når én vælges, filtrerer motoren den modsatte profil fra. Appen viser derfor et kvalificeret standardvalg og foreslår de tags, der afgør det kreative valg.

## Kilder og principper

- [Canon: Depth of field](https://files.canon-europe.com/files/webcontent/rf-lens-world/knowledge/depth-of-field/index.html) beskriver sammenhængen mellem blænde, afstand, brændvidde og dybdeskarphed.
- [Canon: Camera-shake blur compensation](https://files.canon-europe.com/files/webcontent/rf-lens-world/knowledge/correction/index.html) beskriver den ekstra risiko for kamerarystelser ved langsom lukkertid, tele og nærfoto.
- [Canon EOS close-up guidance](https://files.canon-europe.com/files/soft31311/manual/CUG_EOS1000D_EN_Flat.pdf) beskriver fokusafstand, enkel baggrund og brug af zoomens lange ende ved blomster og små motiver.
- [Canon: Macro lens development](https://files.canon-europe.com/files/webcontent/rf-lens-world/features/development/index.html) beskriver den meget lille dybdeskarphed ved høj forstørrelse.
- [Canon landscape examples](https://files.canon-europe.com/files/webcontent/hpp/fotoalbum_opdrachten_landschap.html) fremhæver komposition, vejr og lys som en samlet del af landskabsbilledet.

Kilderne giver principper og tekniske grænser. De konkrete startværdier tilpasses Canon EOS 80D, APS-C-formatet og brugerens objektiver og verificeres derefter med scenarietests.

## Festival og koncert

Festival- og koncertprofiler opdeles efter dagslys, aften/nat, afstand, motiv og scenelysets karakter:

- Dagslys fra publikum prioriterer Tv og hurtig lukkertid med 70-300mm.
- Aften tæt på scenen prioriterer Sigma 18-35mm, fast lukkertid og stor blænde med Auto ISO.
- Aften langt væk bruger 70-300mm ved åben teleblænde og accepterer højere ISO for at bevare en skarp artist.
- Spotlight er et specialscenarie, der eksponerer efter det belyste ansigt fremfor den mørke baggrund.
- Trommeslager, publikum, band, DJ, regn og backstage har egne profiler og må kun udløses af deres konkrete tag.

[Canons ISO-vejledning](https://files.canon-europe.com/files/soft40253/Manual/PSG10_CUG_ENG.pdf) beskriver, at højere ISO muliggør hurtigere lukkertid i mørke og dermed reducerer motivslør. [Canons vejledning om målemetoder](https://files.canon-europe.com/files/soft32414/manual/PSG9_CUG_eng.pdf) beskriver spotmåling til situationer med stor lysforskel mellem motiv og omgivelser. Profilerne kombinerer disse principper med EOS 80D, Sigma 18-35mm f/1.8 og de to telezooms.

## Astro ved byen

Lysforurening behandles ikke som et generelt ISO-fradrag. Appen skelner mellem sted, retning og motiv, fordi de tre valg påvirker billedet forskelligt:

- `Mod byen` bruger kortere eksponering og lavere ISO for at bevare farve og højlys i lyskuplen.
- `Væk fra byen` over en mark tillader længere eksponering og højere ISO, fordi himmelbaggrunden er mørkere.
- `Mælkevejen` prioriterer retningen væk fra store byer; ekstra lukkertid kan ikke genskabe kontrast, som himmelgløden allerede har skjult.
- `Måne over byen` er et andet tilfælde, fordi månen er lys. Her kan byens silhuet være en del af motivet, især i skumringen.
- `Stjernespor over byen` bygges af mange kortere billeder, så byhimlen ikke bliver overeksponeret i én lang optagelse.

[NASA's guide til mørke observationssteder](https://science.nasa.gov/solar-system/skywatching/how-to-find-good-places-to-stargaze/) beskriver, at lyskuplen kan være kraftig på én horisont og betydeligt svagere i den modsatte retning fra samme sted. [Canons guide til meteorregn](https://www.usa.canon.com/learning/training-articles/training-articles-list/photographing-meteor-showers) skelner tilsvarende mellem at fotografere mod byen for en varm glød og væk fra byen for en mørkere himmel. [National Park Service om lysforurening](https://home.nps.gov/subjects/nightskies/lightpollution.htm) beskriver skyglow og hvordan lys spredes i atmosfæren.

Startværdierne er derefter tilpasset EOS 80D og Sigma 18-35mm ved 18mm. De skal stadig kontrolleres med et testbillede og histogram, fordi byens størrelse, afstand, dis, skyer og direkte lamper varierer fra sted til sted.
