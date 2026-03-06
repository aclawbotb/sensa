# Sensa MVP Architecture

## Stack
- Next.js (App Router) + TypeScript
- Canvas-based abstract field rendering
- In-memory session store for masked candidates
- Vibration API fallback for tactile feedback in browser

## Monorepo Layout
- `apps/web` — UI + API routes
- `packages/field-engine` — reusable field + nearest-pick logic
- `packages/shared-types` — contract and shared types
- `docs` — API + architecture notes

## Current Behavior
1. User lands on branded hero + waitlist CTA
2. Query presets (Brisket, Breakfast, Climbing, Muay Thai) quickly regenerate the field
3. `/api/search` generates hidden candidates around Chicago center
4. UI renders abstract field from masked candidate intensity
5. Pointer movement triggers intensity-based vibration (where supported)
6. Click/tap runs reveal animation and resolves nearest hidden candidate with `/api/resolve`
7. Selection is revealed with Maps deep-link
8. Waitlist submissions persist to `apps/web/data/waitlist.csv` via `/api/waitlist`

## Next Steps
- Integrate real Places provider (Google/Foursquare/Yelp)
- Add browser extension + desktop companion WebSocket
- Add iPhone native haptics wrapper (React Native/SwiftUI)
