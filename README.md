# Sensa

Feel your way to the right place.

## What exists now
- Branded web app with abstract discovery field
- Query presets (Brisket, Breakfast, Climbing, Muay Thai)
- Reveal animation + subtle audio cue
- Browser vibration fallback
- Real place search via OpenStreetMap Overpass API (with synthetic fallback)
- Waitlist endpoint storing emails to `apps/web/data/waitlist.csv`
- Desktop bridge stub (`ws://127.0.0.1:8787`) for haptic companion integration
- iPhone wrapper starter (`apps/mobile`)

## Run web
```bash
cd apps/web
npm install
npm run dev
```

## Run desktop bridge
```bash
cd apps/desktop-bridge
npm install
npm run dev
```

Then open the web app and hover the field; it will stream `haptic.update` events to the bridge.
