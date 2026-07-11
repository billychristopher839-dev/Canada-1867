# Dominion 1867 — Govern Canada 🇨🇦

A 2D trivia role-playing game. You play the **Government of Canada**, starting at Confederation on **July 1, 1867**.

- Answer **622** trivia questions on Canadian history, economy, and politics.
- Every **2 correct answers** accomplishes **1 real milestone** — 311 documented policies and events, in chronological order, across all 24 Prime Ministers.
- Missed questions return to the order paper later, so nothing is skipped.
- When all 622 questions are answered and all 311 milestones accomplished: **Canada becomes № 1 in the world in Quality of Life and HDI.**

## Features

- 🚂 **Railway progress bar** — a little CPR train travels from 1867 to today as you govern.
- 🗺️ **Interactive map of the Dominion** — tap any province or territory to see its capital, when it joined, and what makes it unique. Provinces light up red as they join Confederation in your timeline.
- 📜 **Milestone Journal** — every accomplishment recorded under the Prime Minister of the day, presented as an Order-in-Council proclamation when unlocked.
- 🎵 **11-track Canadian soundtrack** — plays in the listed order and repeats the same order when finished. Toggle with the music button.
- 💾 **Autosave** — progress is kept in your browser (localStorage). Continue any time.
- ⌨️ Keyboard play: **1–4** to answer, **Enter** to continue.

## Publish on GitHub Pages

1. Create a new repository on GitHub (e.g. `dominion-1867`).
2. Upload **everything in this folder** (keep the folder structure: `index.html`, `css/`, `js/`, `assets/`).
   - Easiest: on the repo page, *Add file → Upload files*, drag the whole folder contents in, commit.
   - Or with git:
     ```bash
     git init
     git add .
     git commit -m "Dominion 1867"
     git branch -M main
     git remote add origin https://github.com/YOURNAME/dominion-1867.git
     git push -u origin main
     ```
3. In the repo: **Settings → Pages → Source: Deploy from a branch → Branch: `main` / root → Save**.
4. Your game will be live at `https://YOURNAME.github.io/dominion-1867/` within a minute or two.

> Note: the audio files total ~40 MB, well within GitHub's limits (max 100 MB per file).

## Run locally

Because the map is fetched at runtime, open the game through a local server rather than double-clicking `index.html`:

```bash
cd dominion-1867
python3 -m http.server 8000
# then open http://localhost:8000
```

## Structure

```
index.html          Game shell
css/style.css       Styling
js/data.js          622 questions, 311 milestones, 24 PMs, 13 provinces/territories (generated from the source markdowns)
js/game.js          Game engine
assets/img/         Flag, wordmark, interactive Canada map (SVG)
assets/audio/       11 soundtrack tracks
build_data.py       (Optional) regenerates js/data.js from the source markdown files
```
