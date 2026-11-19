# Neon Coast Cover Studio

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/Fadliilmi/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/Fadliilmi/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

An offline web app that turns your own photos and a caption into Vice City-style cover art — the multi-panel poster look with bold display lettering, a neon script subtitle, a badge ribbon and a heat meter — and exports it as a PNG in the sizes people actually post.

## What it does

- **Five layouts** — hero-and-three, four-panel grid, nine-panel grid, tilted snapshots and full bleed.
- **Any photos** — load as many as you like from your machine, click a panel to pick it, drag to position the photo inside it and scroll to zoom. One photo can fill every panel, or each panel can hold a different one.
- **Six colour grades** — real gradient maps (Vice Sunset, Neon Nights, Vice Gold, Tropic Teal, Rose Dusk, Noir Ink) that recolour each panel like a printed poster.
- **Caption editing** — a big Anton title, a glowing Pacifico subtitle, a diagonal badge ribbon and a five-star heat meter, all editable.
- **Exports** — 1080×1080 square, 1080×1350 portrait, 1920×1080 wide and 1080×1920 story, one at a time or all four in one click. Undo and redo cover every change.
- **Offline by design** — every script, font and sample photo is a file under `app/`; nothing is fetched, nothing is uploaded, and your photos never leave your machine.

## Try it

```sh
node serve.ts
# open http://localhost:8080
```

Pick a layout and a grade, type your title, drag the photos where you want them, and hit **Export all four sizes**.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

That copies `app/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library.

## Credits

Lettering uses **Anton**, **Pacifico** and **Inter**, all under the SIL Open Font License 1.1 — the license texts ship in `app/fonts/`. The two sample photos were made with an image model for make.fun and are free to use. No Rockstar artwork, logos or fonts are used anywhere in this app.

Entered on [make.fun](https://make.fun/?ref=bdkjp2b1&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards
