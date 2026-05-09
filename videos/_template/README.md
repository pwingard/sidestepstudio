# Video template

A self-playing HTML page that runs a 3-scene narrative video, intended to be screen-recorded on iPhone for the final MP4.

## To start a new video

```
cp -R videos/_template videos/<your-name>
cd videos/<your-name>
```

Then drop in:

- **`opening.jpg`** — wide image for scene 1 (a portrait, a hero shot, etc.)
- **`landing.jpg`** — wide image for scene 3
- **`landing-closeup.jpg`** — optional close-up that cross-fades in over the landing
- **`soundtrack.mp3`** — background music
- Any flash images, named however you like — wire them up in the `flashFiles` array

Edit captions, timings, and `transform-origin` in `master.html`. The whole thing is in one file with `// TODO:` markers where content goes.

## To record the final MP4

1. Push the new folder, wait ~30s for GitHub Pages to deploy.
2. Open `https://sidestepstudio.com/videos/<your-name>/master.html` on iPhone Safari.
3. **Share → Add to Home Screen.** Launch from the Home Screen icon — it opens in standalone mode (no Safari chrome).
4. Pull down Control Center → tap the round screen-record icon (single tap, NOT long-press; long-press adds mic which captures room noise).
5. Quickly tap "Click to start" in the page.
6. Stop recording from Control Center after the screen fades to black.

Video lands in Photos as a portrait MP4.

## After updating the page

iOS standalone mode caches the page aggressively. **Delete the Home Screen icon and re-add it** to pick up new code.

## Audio gotcha (already handled)

iOS Safari makes `audio.volume` read-only. The template routes audio through a Web Audio API GainNode for fades to actually work. Don't change that.

## Reference: the first one we built

`videos/messier/` — Charles Messier "Not-a-Comet" piece. Use as a working example.
