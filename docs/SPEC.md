# Produktspecifikation

## Produkt

Photo Assistant er en personlig fotoassistent til mobil brug ved siden af kameraet. Den skal svare hurtigt på "hvad skal jeg gøre nu?", men også kunne folde svaret ud til præcise trin på Canon EOS 80D.

## Principper

- Dansk først.
- Mobile-first og PWA, så den kan lægges på iPhone-hjemmeskærmen.
- Offline-first: kernefunktioner virker uden internet.
- Ingen AI-afhængighed.
- Ingen direkte Canon API/SDK-kamerastyring.
- Vejr, tidspunkt og sted vælges som almindelige tags; appen anmoder ikke om placering.
- Egne presets må aldrig ligne officielle guides; de markeres tydeligt.
- Foto uploades ikke til en server. EXIF læses lokalt i browseren.

## Hovedområder

1. Byg situation med intelligente tags
2. Mine presets
3. Lær foto og Canon EOS 80D
4. Mit udstyr

## Situationsbygger

Flowet kombinerer brugerens valgte tags. Forslag og resultater ændres løbende uden en søgeknap. Dimensionerne omfatter:

- sted
- tidspunkt
- lysforhold
- motiv
- bevægelse
- afstand
- stil, fx headshot, miljøportræt, gruppeportræt og uopstillet

## Astro

Astro er en central del af det fælles tagsystem, ikke en separat fane. Det dækker:

- stjerner
- Mælkevejen
- nordlys
- måne
- meteorregn
- natlandskab

Astroprofilerne bruger konkrete startindstillinger og maksimal lukkertid ud fra brændvidde og APS-C crop. Vejr og tidspunkt angives som tags. Online skydække og aurora-data er senere udvidelser.

## Lokale erfaringer

Et preset gemt fra en officiel guide husker både profil og valgte tags. Når situationen senere matcher, kan preset-indstillingerne bruges som lokalt udgangspunkt. De aktuelle tags anvendes bagefter og har altid sidste ord, fx hvis motivets bevægelse kræver en hurtigere lukkertid.

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
