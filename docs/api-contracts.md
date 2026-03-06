# Sensa API Contracts (MVP v0)

## POST `/api/search`
Generates a masked abstract field from a query and center point.

### Request
```json
{
  "query": "brisket",
  "center": { "lat": 41.8857, "lng": -87.6472 },
  "radiusMeters": 2500,
  "limit": 32,
  "seed": "optional"
}
```

### Response
```json
{
  "sessionId": "sess_xxx",
  "fieldId": "fld_xxx",
  "bounds": { "north": 41.9007, "south": 41.8707, "east": -87.6272, "west": -87.6672 },
  "candidatesMasked": [
    { "id": "c1", "x": 0.22, "y": 0.71, "weight": 0.82 }
  ]
}
```

## POST `/api/resolve`
Resolves user tap position to the nearest hidden candidate.

### Request
```json
{
  "sessionId": "sess_xxx",
  "tap": { "x": 0.25, "y": 0.69 }
}
```

### Response
```json
{
  "picked": {
    "id": "c1",
    "name": "Hidden Ember BBQ #1",
    "address": "120 W Loop St, Chicago, IL",
    "lat": 41.88,
    "lng": -87.64,
    "mapsUrl": "https://www.google.com/maps/search/?api=1&query=41.88,-87.64"
  },
  "distanceMeters": 420
}
```

## POST `/api/waitlist`
Stores waitlist emails for launch updates.

### Request
```json
{
  "email": "you@example.com"
}
```

### Response
```json
{
  "ok": true
}
```

## Local Haptics Bridge (planned)
WebSocket: `ws://127.0.0.1:8787`

### Event
```json
{
  "type": "haptic.update",
  "intensity": 0.63,
  "texture": "grain",
  "pulseHz": 7.5
}
```
