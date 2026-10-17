# Section versions

A section version is a different layout for one big part of the store: the header, the home hero, the product card, the category display on the home page, the product page and the footer. Every store starts on **Classic**, the template's own look. Versions change layout only; colours, fonts, radius and logo come from the theme, so any version works with any theme.

**A client copy has no section screenshots beside it:** the `template-shots/` folders named below sit next to the template repo only, outside git. In a copy, regenerate them with `node scripts/qa/section-shots.mjs --product <a product id>` (dev server up; see Screenshots below), or use the `?sections=` preview.

- **Pick:** set the versions in `src/config/sections.ts` (`SECTIONS`) in Phase 2 (look), together with the homepage mockup, not after the client's yes. A "no" from the client changes them.
- **Preview without editing code:** add `?sections=` to any URL in dev, for example `/?sections=header:centered,hero:split` or `/products?sections=productCard:compact`. The pick is remembered for the browser tab; `?sections=reset` clears it. Unknown names are ignored.
- **The preview is read on a full page load:** after you change `?sections=` in the address bar, press Enter or reload. A link inside the store does not switch it.
- **Preview on a demo build for a client:** build with `VITE_SECTION_PREVIEW=1`. Leave it empty on the live store, where `?sections=` does nothing.

| Section | Version | Name | Pick it when | Screenshots |
|---|---|---|---|---|
| `header` | `classic` | Classic | Search-first stores: logo left, a wide search box in the middle, icons right. | `template-shots/sections/header-classic/` |
| `header` | `centered` | Centred logo | Brand-led stores with a strong logo: the logo sits in the centre, search moves left. | `template-shots/sections/header-centered/` |
| `hero` | `classic` | Classic | Banners made as full photos: the image fills the width and the text sits on it. | `template-shots/sections/hero-classic/` |
| `hero` | `split` | Split | Product photos on plain backgrounds, or busy photos where text on top is hard to read. | `template-shots/sections/hero-split/` |
| `productCard` | `classic` | Classic | Most stores: square photo, name, stars and price, with the add button beside the price. | `template-shots/sections/productCard-classic/` |
| `productCard` | `compact` | Compact | Large catalogues where shoppers scan many products and add straight from the grid. | `template-shots/sections/productCard-compact/` |
| `productCard` | `detailed` | Detailed | Considered purchases: category, one key detail and a separate wishlist button. | `template-shots/sections/productCard-detailed/` |
| `categoryDisplay` | `classic` | Classic | Few categories with strong photos: a large first tile and a mixed-size grid. | `template-shots/sections/categoryDisplay-classic/` |
| `categoryDisplay` | `tiles` | Tiles | Many categories, or photos of mixed quality: equal tiles with the name below the photo. | `template-shots/sections/categoryDisplay-tiles/` |
| `productPage` | `classic` | Classic | Most products: a photo with thumbnails beside the buying details, half and half. | `template-shots/sections/productPage-classic/` |
| `productPage` | `stacked` | Stacked photos | Products sold on detail (fabric, finish, texture): every photo large, details stay in view. | `template-shots/sections/productPage-stacked/` |
| `footer` | `classic` | Classic | Stores with many pages and a shop address: link columns, contact details and a map. | `template-shots/sections/footer-classic/` |
| `footer` | `compact` | Compact | Small stores with few pages: one centred block with the key links and contact line. | `template-shots/sections/footer-compact/` |

Two things the table does not say:

- **Detailed** shows one key detail under the name. It comes from the product's specifications (a short value, best spec first) or, failing that, its weight. A product with neither shows nothing there.
- **Classic** shows a star row on every grid card, empty until the product has real reviews (an owner decision, `docs/ui-system.md`). Compact and Detailed have no star row, which suits a store that will only ever show real reviews.

## Screenshots

Every version has a folder of screenshots at 390 px and 1440 px, light and dark, named in the Screenshots column. The folders sit beside the repo (outside git), under `template-shots/sections/` on the Desktop. They are local and not committed. Make or refresh them with the dev server running (`npx vite --port 5182 --strictPort --host 127.0.0.1`), from the repo root:

```bash
node scripts/qa/section-shots.mjs --product <a product id>
```

What each folder holds, with the file name ending:

- header, hero, productCard: the first screen of the home page (header, hero) or `/products` (productCard), `-fold.png`.
- categoryDisplay, footer: the home page scrolled one screen at a time, `-v01.png`, `-v02.png` and so on. The category display is about the sixth and seventh image; the footer is in the last image.
- productPage: the product page in two-screen slices, `-s01.png`, `-s02.png`. The demo product has one photo, so Stacked shows one large photo here; a product with several photos shows them one under the other on desktop (phones keep the swipe gallery).

## How to pick in Phase 2

1. Read the client's brief for hints: a large catalogue or a small one, photos on plain backgrounds or busy ones, a strong logo or a plain name, many pages or few.
2. Open the store in dev with `?sections=` combinations and compare them against the "Pick it when" column. For example `/?sections=header:centered,hero:split,categoryDisplay:tiles`, `/products?sections=productCard:compact`, `/product/<id>?sections=productPage:stacked` and `/?sections=footer:compact`. Add `?sections=reset` to go back.
3. Make ONE homepage mockup with the chosen combination (start from `docs/template/mockups/home-mockup-starter.html`) at 390 px and 1440 px, light and dark, and show it to the client. Do not mock up every combination.
4. Set the picks in `src/config/sections.ts` (`SECTIONS`) now, with the mockup, then run `node scripts/check.mjs`: it builds and renders the combination, so a pairing that breaks shows up before the client sees anything. If the client says no, change the picks there and run it again. The store keeps Classic for any section left alone.
