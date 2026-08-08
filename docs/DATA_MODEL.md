# Datamodel

Photo Assistant består af små dataobjekter, der kan udvides uden at ændre appens UI.

## Camera

```json
{
  "id": "canon-eos-80d",
  "type": "camera",
  "brand": "Canon",
  "model": "EOS 80D",
  "sensor": {
    "format": "APS-C",
    "cropFactor": 1.6
  },
  "capabilities": {
    "manualMode": true,
    "liveView": true,
    "wifi": true,
    "maxMechanicalFps": 7,
    "flashSyncSpeed": "1/250"
  },
  "procedures": {
    "setIso": ["Tryk ISO", "Drej Main Dial", "Bekræft"]
  }
}
```

## Lens

```json
{
  "id": "sigma-18-35-f18-art",
  "type": "lens",
  "mount": "Canon EF-S compatible",
  "focalLength": { "min": 18, "max": 35 },
  "aperture": { "min": 1.8, "maxAtMinFocal": 1.8, "maxAtMaxFocal": 1.8 },
  "stabilization": false,
  "roles": ["astro", "low-light", "people", "wide"]
}
```

## SituationProfile

```json
{
  "id": "bird-flight-daylight",
  "title": "Fugl i flugt",
  "family": "fugle",
  "subjects": ["bird"],
  "conditions": {
    "movement": ["fast", "flight"],
    "light": ["daylight", "overcast"],
    "distance": ["far"]
  },
  "gearStrategy": {
    "preferredLensRoles": ["telephoto"]
  },
  "baseSettings": {
    "mode": "M",
    "shutter": { "start": "1/1600", "range": ["1/1000", "1/2500"] },
    "aperture": { "strategy": "wide-open" },
    "iso": "Auto"
  },
  "cameraActions": ["set-manual-mode", "set-ai-servo", "set-high-speed-continuous"]
}
```

## Preset

Presets gemmes lokalt i browseren.

```json
{
  "id": "local-...",
  "source": "user",
  "badge": "MIT PRESET",
  "name": "Aber i Zoo overskyet",
  "settings": {
    "camera": "Canon EOS 80D",
    "lens": "Canon EF 70-300mm f/4-5.6 IS USM",
    "focalLength": "235mm",
    "aperture": "f/5.6",
    "shutter": "1/800",
    "iso": "1000"
  },
  "tags": ["monkey", "zoo", "overcast"]
}
```
