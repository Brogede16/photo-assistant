# Produktspecifikation

## Produkt

Photo Assistant er en personlig fotoassistent til mobil brug ved siden af kameraet. Den skal svare hurtigt på "hvad skal jeg gøre nu?", men også kunne folde svaret ud til præcise trin på Canon EOS 80D.

## Principper

- Dansk først.
- Mobile-first og PWA, så den kan lægges på iPhone-hjemmeskærmen.
- Offline-first: kernefunktioner virker uden internet.
- Ingen AI-afhængighed.
- Ingen direkte Canon API/SDK-kamerastyring.
- Automatisk kontekst er hjælp, ikke facit: manuel override vinder altid.
- Egne presets må aldrig ligne officielle guides; de markeres tydeligt.
- Foto uploades ikke til en server. EXIF læses lokalt i browseren.

## Hovedområder

1. Fotografer nu
2. Søg motiv eller problem
3. Astro
4. Mine presets
5. Lær Canon EOS 80D
6. Mit udstyr

## Fotografér nu

Flowet bruger aktuel tid og, hvis brugeren tillader det, placering. Appen beregner kontekst som dag, golden hour, blue hour, skumring, nat, astronomisk mørke og månefase. Brugeren kan overskrive:

- sted
- tidspunkt
- lysforhold
- motiv
- bevægelse
- afstand
- håndholdt/stativ

## Astro

Astro er en central funktion, ikke en ekstra beregner. Den skal dække:

- stjerner
- Mælkevejen
- nordlys
- måne
- meteorregn
- natlandskab

Første version bruger lokale beregninger for månefase, sol/tusmørke-kontekst og maksimal lukkertid ud fra brændvidde og APS-C crop. Online vejr, skydække og aurora-data er senere udvidelser.

## Billedupload

Kun dette flow er i scope:

1. Vælg billede.
2. Læs EXIF lokalt.
3. Vis fundne indstillinger.
4. Giv preset et navn.
5. Gem lokalt som `MIT PRESET`.

Ikke i scope:

- billedanalyse
- motivgenkendelse
- upload til server
- AI-fortolkning

## Ikke i scope

- Checklister
- Fotologbog
- Social deling
- Konti/login
- Direct control via Canon EDSDK/CCAPI
- App Store-native iPhone-app i første fase
