# Søgetaksonomi

Søgningen skal forstå almindeligt dansk uden AI. Den gør det ved at normalisere tekst, slå synonymer op og matche mod en kontrolleret taksonomi.

## Lag

1. Direkte match: `måne` finder måneguiden.
2. Synonymer: `gråvejr` finder `overskyet`.
3. Delvise ord: `fug` finder `fugl`.
4. Simple stavefejl: kort Levenshtein-afstand for kendte termer.
5. Taksonomi: `dyr` finder også fugle, hunde, primater osv.
6. Kombinationer: `fugl mørkt langt væk` bliver til motiv + lys + afstand.

## Dimensioner

- Motiv: menneske, barn, hund, fugl, abe, måne, stjerner, nordlys.
- Bevægelse: stille, går, løber, flyver, hurtig, uforudsigelig.
- Lys: sol, overskyet, skygge, modlys, golden hour, blue hour, skumring, nat, indendørs.
- Afstand: tæt, mellem, langt.
- Teknik: AI Servo, burst, manuel fokus, blitz bounce, Live View.
- Problem: uskarpt, for mørkt, for lyst, grynet, fokus forkert, stjerner streger.
- Udstyr: 80D, Sigma, 18-35, 70-300, Speedlite.

## Ukendte søgninger

Hvis søgningen ikke giver stærke resultater, gemmes søgeteksten lokalt som ukendt term. Det kan senere eksporteres og bruges til at udvide synonymfilerne.
