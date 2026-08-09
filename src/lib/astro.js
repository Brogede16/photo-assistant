export function maxStarShutterSeconds(focalLengthMm, cropFactor = 1.6, rule = 400) {
  const safeFocal = Number(focalLengthMm) || 18;
  return Math.max(1, Math.floor(rule / (safeFocal * cropFactor)));
}
