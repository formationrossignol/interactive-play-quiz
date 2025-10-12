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
