/**
 * Level presentation — the one place a level becomes a colour or a word.
 *
 * Components never write `var(--lvl-alert)` inline. They ask for the level and get the
 * surface-bound token, so the city dashboard inverts without a single component knowing.
 */
import type { HazardUnit, Level } from './contract';

export const LEVEL_ORDER: Level[] = ['none', 'watch', 'alert', 'warning'];

/** The fill colour for a level, and the only text colour that is legal on it. */
export function levelTokens(level: Level): { fill: string; on: string } {
  return { fill: `var(--lvl-${level})`, on: `var(--on-${level})` };
}

/**
 * The word shown to a resident. IMD publishes colour-coded warnings, and these are the
 * words that ladder uses — not "low/medium/high", which mean nothing on a wet street.
 */
export const LEVEL_WORD: Record<Level, string> = {
  none: 'No warning',
  watch: 'Watch',
  alert: 'Alert',
  warning: 'Warning',
};

/** What each rung actually means, in the resident's terms. */
export const LEVEL_MEANING: Record<Level, string> = {
  none: 'Nothing expected at your address.',
  watch: 'Conditions are building. Nothing to do yet.',
  alert: 'Your limit is close. Act now.',
  warning: 'Your limit is passed. Leave or get help.',
};

/**
 * How a value in this unit is written. Units come from the hazard plug-in (contract §3),
 * so a new hazard adds a row here and changes nothing else.
 */
/** Fixed decimals, but never a trailing zero: "30 cm", not "30.0 cm". */
function decimals(value: number, places: number): string {
  const fixed = value.toFixed(places);
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
}

export function formatValue(value: number, unit: HazardUnit): string {
  switch (unit) {
    case 'probability':
      // A probability is read as a percentage: "65%" is understood, "0.65" is not.
      return `${Math.round(value * 100)}%`;
    // Below 10 the first decimal is worth showing; above it, centimetre precision on a
    // flood forecast is false precision. A whole number never carries a trailing zero.
    case 'cm':
      return `${decimals(value, value < 10 ? 1 : 0)} cm`;
    case 'C_wbgt':
      return `${decimals(value, 1)} °C`;
    case 'm_s':
      return `${decimals(value, 1)} m/s`;
    case 'aqi':
      return String(Math.round(value));
  }
}

/** The unit written on its own, for an axis end or a legend. */
export const UNIT_LABEL: Record<HazardUnit, string> = {
  cm: 'cm',
  probability: 'chance',
  C_wbgt: '°C wet-bulb',
  m_s: 'm/s',
  aqi: 'AQI',
};
