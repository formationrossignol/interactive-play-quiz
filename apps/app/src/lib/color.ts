const parseHex = (hex: string): [number, number, number] | null => {
  if (!hex) return null;
  let sanitized = hex.replace('#', '');
  if (sanitized.length === 3) {
    sanitized = sanitized.split('').map((char) => char + char).join('');
  }
  const parsed = Number.parseInt(sanitized, 16);
  if (Number.isNaN(parsed)) return null;
  return [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255];
};

// WCAG relative luminance (0 = black, 1 = white)
export const relativeLuminance = (hex: string): number => {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const darkestColor = (palette: string[]): string | undefined => {
  if (!palette.length) return undefined;
  return [...palette].sort((a, b) => relativeLuminance(a) - relativeLuminance(b))[0];
};

export const hexToRgba = (hex: string, alpha = 1) => {
  if (!hex) {
    return `rgba(0, 0, 0, ${alpha})`;
  }

  let sanitized = hex.replace('#', '');

  if (sanitized.length === 3) {
    sanitized = sanitized
      .split('')
      .map((char) => char + char)
      .join('');
  }

  const parsed = Number.parseInt(sanitized, 16);

  if (Number.isNaN(parsed)) {
    return `rgba(0, 0, 0, ${alpha})`;
  }

  const r = (parsed >> 16) & 255;
  const g = (parsed >> 8) & 255;
  const b = parsed & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
