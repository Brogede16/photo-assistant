# Søgetaksonomi

Søgningen skal forstå almindeligt dansk uden AI. Den gør det ved at normalisere tekst, slå synonymer op og matche mod en kontrolleret taksonomi.

## Lag

1. Direkte match: `måne` finder måneguiden.
2. Synonymer: `gråvejr` finder `overskyet`.
3. Delvise ord: `fug` finder `fugl`.
4. Simple stavefejl: kort Levenshtein-afstand for kendte termer.
5. Taksonomi: `dyr` finder også fugle, hunde, primater osv.
6. Kombinationer: `fugl mørkt langt væk` bliver til motiv + lys + afstand.
7. Implikationer: `sover` betyder stille motiv, mens `danser` betyder aktiv bevægelse.
8. Konflikter: et nyt afstands-, tids-, lys- eller bevægelsestag erstatter det gamle i samme gruppe.

## Dimensioner

- Motiv: mennesker, børn, grupper, husdyr, vilde dyr, fugle, astro og events.
- Handling: sover, spiser, griner, leger, poserer, danser, svømmer og kører.
- Bevægelse: stille, rolig, aktiv, løber og flyver.
- Sted: hjemme, udenfor, strand, skov, mark, by, gade, zoo, fest og natklub.
- Tid: morgen, middag, eftermiddag, aften, skumring og nat.
- Vejr: sol, regn, sne, tåge og blæst.
- Lys: sol, overskyet, skygge, modlys, golden hour, blue hour, skumring, nat, indendørs.
- Afstand: tæt, mellem, langt.
- Teknik: AI Servo, burst, manuel fokus, blitz bounce, Live View.
- Problem: uskarpt, for mørkt, for lyst, grynet, fokus forkert, stjerner streger.
- Udstyr: 80D, Sigma, 18-35, 70-300, Speedlite.

## Ukendte søgninger

Hvis søgningen ikke giver stærke resultater, gemmes søgeteksten lokalt som ukendt term. Det kan senere eksporteres og bruges til at udvide synonymfilerne.

## Triangulering

Profilen giver et fotografisk udgangspunkt. De valgte tags lægges derefter på i faste lag: motiv og handling, bevægelse, lys, afstand, sted og tid. Hvert lag må kun ændre de indstillinger, det har faglig betydning for. Eksempelvis styrer bevægelse primært lukkertid, fokus og serieoptagelse, mens afstand styrer objektivprioritet. Astro og effektmotiver som fyrværkeri er beskyttede mod almindelige bevægelsesregler.
