/**
 * WCAG 2.1 contrast, computed from the live token values.
 *
 * Accessibility is a constraint, not a target (CLAUDE.md §2), so the styleguide computes
 * these ratios in the browser from the actual CSS variables rather than quoting numbers
 * from a design file. If a token drifts, the styleguide fails visibly and immediately.
 */

export type Rgb = { r: number; g: number; b: number };

/** Parse `#RRGGBB`, `#RGB`, or an `rgb()` string — whatever getComputedStyle hands back. */
export function parseColor(input: string): Rgb | null {
  const value = input.trim();

  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((d) => d + d).join('') : hex[1];
    const n = parseInt(digits, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  const rgb = value.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (rgb) return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };

  /* Chrome resolves color-mix() to the modern `color(srgb r g b)` form, whose channels
     are 0..1 rather than 0..255. Without this branch a token built from color-mix reads
     as unmeasurable and the table scores it a failure — which is how this was found. */
  const modern = value.match(/^color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (modern) {
    return {
      r: Number(modern[1]) * 255,
      g: Number(modern[2]) * 255,
      b: Number(modern[3]) * 255,
    };
  }

  return null;
}

/** Relative luminance, per WCAG 2.1 §relative-luminance. */
export function luminance({ r, g, b }: Rgb): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio between two colours, 1..21. */
export function contrastRatio(foreground: Rgb, background: Rgb): number {
  const a = luminance(foreground);
  const b = luminance(background);
  const [lighter, darker] = a > b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
}

export type ContrastVerdict = {
  ratio: number;
  /** WCAG AA for body text: 4.5:1. */
  aa: boolean;
  /** WCAG AA for large text (>=24px, or >=18.66px bold): 3:1. */
  aaLarge: boolean;
  /** WCAG AA for UI component boundaries and graphical objects: 3:1. */
  ui: boolean;
};

export function verdict(foreground: string, background: string): ContrastVerdict | null {
  const fg = parseColor(foreground);
  const bg = parseColor(background);
  if (!fg || !bg) return null;
  const ratio = contrastRatio(fg, bg);
  return {
    ratio: Math.round(ratio * 100) / 100,
    aa: ratio >= 4.5,
    aaLarge: ratio >= 3,
    ui: ratio >= 3,
  };
}

/**
 * Read a token and resolve it to something we can actually measure.
 *
 * A custom property's computed value is whatever text it was declared with, so a token
 * built from `color-mix()` — or `oklch()`, or a named colour — comes back unparseable and
 * would be scored as a failure when nothing is wrong with it. So instead of parsing the
 * declaration, hand it to the browser and read back what it painted: assign the value to a
 * probe element's `color` and take the computed result, which is always an `rgb()`.
 *
 * The probe is inserted INSIDE `element` so that any var() references inside the token
 * resolve in the right surface — a city token read from the document root would silently
 * resolve to its citizen value.
 */
export function readToken(name: string, element?: Element): string {
  const target = (element ?? document.documentElement) as HTMLElement;
  const declared = getComputedStyle(target).getPropertyValue(name).trim();
  if (declared === '') return '';

  const probe = document.createElement('span');
  probe.style.display = 'none';
  probe.style.color = declared;
  target.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();

  // If the browser rejected the value, `color` falls back to the inherited one; the
  // declared text is then the more honest thing to return, and parseColor will say no.
  return resolved || declared;
}
