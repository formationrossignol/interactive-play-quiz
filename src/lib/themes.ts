export interface Theme {
  id: string;
  name: string;
  preview: string;
  background: string;
}

export const THEMES: Theme[] = [
  {
    id: "gradient-purple",
    name: "Dégradé Violet",
    preview: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
  },
  {
    id: "gradient-sunset",
    name: "Coucher de soleil",
    preview: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
  },
  {
    id: "gradient-ocean",
    name: "Océan",
    preview: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
  },
  {
    id: "gradient-forest",
    name: "Forêt",
    preview: "linear-gradient(135deg, #0ba360 0%, #3cba92 100%)",
    background: "linear-gradient(135deg, #0ba360 0%, #3cba92 100%)"
  },
  {
    id: "gradient-fire",
    name: "Feu",
    preview: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)"
  },
  {
    id: "geometric-blue",
    name: "Géométrique Bleu",
    preview: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
    background: `
      linear-gradient(135deg, #667eea 0%, #764ba2 100%),
      repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(255,255,255,.05) 35px, rgba(255,255,255,.05) 70px)
    `
  },
  {
    id: "dots-pattern",
    name: "Motif Points",
    preview: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    background: `
      radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px),
      linear-gradient(135deg, #667eea 0%, #764ba2 100%)
    `,
  },
  {
    id: "waves",
    name: "Vagues",
    preview: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    background: `
      linear-gradient(135deg, #4facfe 0%, #00f2fe 100%),
      url("data:image/svg+xml,%3Csvg width='100' height='20' viewBox='0 0 100 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M21.184 20c.357-.13.72-.264 1.088-.402l1.768-.661C33.64 15.347 39.647 14 50 14c10.271 0 15.362 1.222 24.629 4.928.955.383 1.869.74 2.75 1.072h6.225c-2.51-.73-5.139-1.691-8.233-2.928C65.888 13.278 60.562 12 50 12c-10.626 0-16.855 1.397-26.66 5.063l-1.767.662c-2.475.923-4.66 1.674-6.724 2.275h6.335zm0-20C13.258 2.892 8.077 4 0 4V2c5.744 0 9.951-.574 14.85-2h6.334zM77.38 0C85.239 2.966 90.502 4 100 4V2c-6.842 0-11.386-.542-16.396-2h-6.225zM0 14c8.44 0 13.718-1.21 22.272-4.402l1.768-.661C33.64 5.347 39.647 4 50 4c10.271 0 15.362 1.222 24.629 4.928C84.112 12.722 89.438 14 100 14v-2c-10.271 0-15.362-1.222-24.629-4.928C65.888 3.278 60.562 2 50 2 39.374 2 33.145 3.397 23.34 7.063l-1.767.662C13.223 10.84 8.163 12 0 12v2z' fill='%23ffffff' fill-opacity='0.1' fill-rule='evenodd'/%3E%3C/svg%3E")
    `
  },
  {
    id: "pattern-stripes",
    name: "Rayures",
    preview: "repeating-linear-gradient(0deg, #0e7490 0 16px, #a5f3fc 16px 32px)",
    background: "theme-pattern bg-pattern-stripes"
  },
  {
    id: "pattern-diag",
    name: "Diagonales",
    preview: "repeating-linear-gradient(45deg, #0e7490 0 14px, #a5f3fc 14px 28px)",
    background: "theme-pattern bg-pattern-diag"
  },
  {
    id: "pattern-polka",
    name: "Pois",
    preview: "radial-gradient(circle, #0e7490 2px, #f9fafb 2px)",
    background: "theme-pattern bg-pattern-polka"
  },
  {
    id: "pattern-checker",
    name: "Damier",
    preview: "conic-gradient(#0e7490 90deg, #a5f3fc 0)",
    background: "theme-pattern bg-pattern-checker"
  },
  {
    id: "pattern-grid",
    name: "Grille",
    preview: "linear-gradient(#a5f3fc 1px, transparent 1px), linear-gradient(90deg, #a5f3fc 1px, transparent 1px)",
    background: "theme-pattern bg-pattern-grid"
  },
  {
    id: "pattern-cross",
    name: "Grille épaisse",
    preview: "linear-gradient(#0e7490 2px, transparent 2px), linear-gradient(90deg, #0e7490 2px, transparent 2px)",
    background: "theme-pattern bg-pattern-cross"
  },
  {
    id: "pattern-zigzag",
    name: "Zigzag",
    preview: "conic-gradient(from 135deg, #0e7490 90deg, transparent 0)",
    background: "theme-pattern bg-pattern-zigzag"
  },
  {
    id: "pattern-herringbone",
    name: "Chevron",
    preview: "repeating-linear-gradient(135deg, #0e7490 0 6px, transparent 6px 14px)",
    background: "theme-pattern bg-pattern-herringbone"
  },
  {
    id: "pattern-cubes",
    name: "Cubes",
    preview: "linear-gradient(30deg, #0e7490 50%, transparent 50%)",
    background: "theme-pattern bg-pattern-cubes"
  },
  {
    id: "pattern-waves",
    name: "Ondes",
    preview: "radial-gradient(ellipse, #a5f3fc, #0e7490)",
    background: "theme-pattern bg-pattern-waves"
  },
  {
    id: "pattern-confetti",
    name: "Confetti",
    preview: "radial-gradient(circle 2px, #0e7490 98%, transparent)",
    background: "theme-pattern bg-pattern-confetti"
  },
  {
    id: "pattern-rays",
    name: "Rayons",
    preview: "radial-gradient(circle at 30% 30%, #a5f3fc, transparent), conic-gradient(from -10deg at 30% 30%, #0e7490 10deg, transparent 10deg)",
    background: "theme-pattern bg-pattern-rays"
  },
  {
    id: "cyber-neon",
    name: "Cyber Neon",
    preview: "linear-gradient(135deg, #0f0c29 0%, #302b63 40%, #24243e 70%, #00ffe0 100%)",
    background: "linear-gradient(135deg, #0f0c29 0%, #302b63 40%, #24243e 70%, #00ffe0 100%)"
  },
  {
    id: "paper-classroom",
    name: "Paper Classroom",
    preview: "linear-gradient(135deg, #fffaf3 0%, #ffd166 35%, #06d6a0 70%, #073b4c 100%)",
    background: "linear-gradient(135deg, #fffaf3 0%, #ffd166 35%, #06d6a0 70%, #073b4c 100%)"
  },
  {
    id: "minimal-zen",
    name: "Minimal Zen",
    preview: "linear-gradient(135deg, #f4f1de 0%, #e07a5f 25%, #3d405b 55%, #81b29a 80%, #f2cc8f 100%)",
    background: "linear-gradient(135deg, #f4f1de 0%, #e07a5f 25%, #3d405b 55%, #81b29a 80%, #f2cc8f 100%)"
  },
  {
    id: "retro-arcade",
    name: "Retro Arcade",
    preview: "linear-gradient(135deg, #000000 0%, #1a1a40 35%, #00ffff 65%, #ff00c8 100%)",
    background: "linear-gradient(135deg, #000000 0%, #1a1a40 35%, #00ffff 65%, #ff00c8 100%)"
  },
  {
    id: "nature-aventure",
    name: "Nature & Aventure",
    preview: "linear-gradient(135deg, #283618 0%, #606c38 30%, #fefae0 60%, #dda15e 80%, #bc6c25 100%)",
    background: "linear-gradient(135deg, #283618 0%, #606c38 30%, #fefae0 60%, #dda15e 80%, #bc6c25 100%)"
  },
  {
    id: "corporate-elegant",
    name: "Corporate Elegant",
    preview: "linear-gradient(135deg, #ffffff 0%, #f2f2f2 35%, #1c1c1e 65%, #007aff 100%)",
    background: "linear-gradient(135deg, #ffffff 0%, #f2f2f2 35%, #1c1c1e 65%, #007aff 100%)"
  },
  {
    id: "galactic-space",
    name: "Galactic Space",
    preview: "linear-gradient(135deg, #0b0033 0%, #1b1b3a 35%, #6930c3 60%, #64dfdf 80%, #80ffdb 100%)",
    background: "linear-gradient(135deg, #0b0033 0%, #1b1b3a 35%, #6930c3 60%, #64dfdf 80%, #80ffdb 100%)"
  },
  {
    id: "festival-pop",
    name: "Festival Pop",
    preview: "linear-gradient(135deg, #ff006e 0%, #ffbe0b 35%, #8338ec 65%, #3a86ff 100%)",
    background: "linear-gradient(135deg, #ff006e 0%, #ffbe0b 35%, #8338ec 65%, #3a86ff 100%)"
  },
  {
    id: "dark-matter",
    name: "Dark Matter",
    preview: "linear-gradient(135deg, #0d1117 0%, #161b22 40%, #1f6feb 70%, #58a6ff 85%, #8b949e 100%)",
    background: "linear-gradient(135deg, #0d1117 0%, #161b22 40%, #1f6feb 70%, #58a6ff 85%, #8b949e 100%)"
  },
  {
    id: "museum-chic",
    name: "Museum Chic",
    preview: "linear-gradient(135deg, #f5f3e7 0%, #c6a664 40%, #a68b5b 70%, #4b4237 100%)",
    background: "linear-gradient(135deg, #f5f3e7 0%, #c6a664 40%, #a68b5b 70%, #4b4237 100%)"
  }
];

export const getTheme = (id: string): Theme | undefined => {
  return THEMES.find(t => t.id === id);
};
