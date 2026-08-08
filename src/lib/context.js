import { astroStatus, describeLightContext } from "./astro.js";

export function defaultContext() {
  const now = new Date();
  return {
    source: "manual",
    date: now.toISOString(),
    coords: null,
    lightOverride: "",
    ...describeLightContext(now)
  };
}

export function getAutomaticContext() {
  return new Promise((resolve) => {
    const now = new Date();
    if (!navigator.geolocation) {
      resolve({
        source: "automatic",
        date: now.toISOString(),
        coords: null,
        ...describeLightContext(now),
        astro: astroStatus(now)
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        resolve({
          source: "automatic",
          date: now.toISOString(),
          coords,
          ...describeLightContext(now, coords),
          astro: astroStatus(now, coords)
        });
      },
      () => {
        resolve({
          source: "automatic",
          date: now.toISOString(),
          coords: null,
          ...describeLightContext(now),
          astro: astroStatus(now)
        });
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 15 * 60 * 1000 }
    );
  });
}

export function applyManualOverride(context, override) {
  const date = override.date ? new Date(override.date) : new Date(context.date);
  const next = {
    ...context,
    ...override,
    source: override.source || "manual",
    date: date.toISOString()
  };
  return {
    ...next,
    ...describeLightContext(date, next.coords),
    astro: astroStatus(date, next.coords)
  };
}
