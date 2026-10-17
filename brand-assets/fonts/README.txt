Fonts in this folder are build inputs only. scripts/make-wordmark.mjs reads them to turn the store name
into outlines (brand-assets/logo.svg and mark.svg); nothing here is loaded by the site or ships in the
build. (The fonts the site itself shows are linked in index.html.)

  wordmark.ttf   the store name
  monogram.ttf   optional: the monogram letter in the tile. A display cut of the same family looks best;
                 without this file wordmark.ttf is used.

ICONOIQ (Phase 3): both files are now Marcellus (c) The Marcellus Project Authors, SIL Open Font License 1.1,
https://fonts.google.com/specimen/Marcellus. They drew only the IQ monogram (mark.svg); the wordmark is the client's
picture logo (brand-assets/logo.png and logo-light.png). The template's own pair was Fraunces:
  Fraunces (c) The Fraunces Project Authors, SIL Open Font License 1.1
  https://fonts.google.com/specimen/Fraunces  /  https://openfontlicense.org
  wordmark.ttf   Fraunces optical size 24, weight 500 (the cut the headings use at about 24 px)
  monogram.ttf   Fraunces optical size 72, weight 500 (the display cut)
The demo logo was drawn with:  node scripts/make-wordmark.mjs --pad-x 1.3 --pad-y 0.66
then:                          node scripts/build-logo-assets.mjs

For a client with no logo: use the heading font from the Phase 2 look and replace both files. The Google
Fonts CSS API answers a plain curl (send no browser User-Agent) with a static .ttf url for any axis pin,
so no variable-font instancing is needed:

  url=$(curl -s "https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@24,500" | grep -o 'https://[^)]*\.ttf')
  curl -s -o brand-assets/fonts/wordmark.ttf "$url"

Put the family and its axis pins after "family=" (spaces in a name become +, a family without an optical
size axis is just Nunito+Sans:wght@500). Use only fonts that are free to embed (Google Fonts are OFL).
