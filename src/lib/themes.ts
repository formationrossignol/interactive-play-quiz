export interface Theme {
  id: string;
  name: string;
  preview: string;
  background: string;
  palette: string[];
  imageDescription: string;
}

const createSvgDataUri = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;

const HORIZON_SYNTHWAVE_PALETTE = ["#ff0080", "#7928ca", "#2d00f7", "#120458"] as const;
const horizonSynthwaveArt = createSvgDataUri(`
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600'>
    <rect width='800' height='600' fill='${HORIZON_SYNTHWAVE_PALETTE[3]}' />
    <linearGradient id='hs-glow' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='${HORIZON_SYNTHWAVE_PALETTE[0]}' stop-opacity='0.55' />
      <stop offset='100%' stop-color='${HORIZON_SYNTHWAVE_PALETTE[2]}' stop-opacity='0.8' />
    </linearGradient>
    <rect width='800' height='600' fill='url(#hs-glow)' />
    <circle cx='400' cy='360' r='160' fill='${HORIZON_SYNTHWAVE_PALETTE[0]}' fill-opacity='0.35' />
    <path d='M0 420 Q200 340 400 380 T800 360 L800 600 H0 Z' fill='${HORIZON_SYNTHWAVE_PALETTE[2]}' opacity='0.6' />
    <path d='M0 460 Q220 400 400 420 T800 410 L800 600 H0 Z' fill='${HORIZON_SYNTHWAVE_PALETTE[1]}' opacity='0.45' />
    <path d='M0 500 Q210 470 400 490 T800 470 L800 600 H0 Z' fill='${HORIZON_SYNTHWAVE_PALETTE[0]}' opacity='0.4' />
    <g stroke='${HORIZON_SYNTHWAVE_PALETTE[2]}' stroke-width='1' opacity='0.4'>
      <line x1='0' y1='520' x2='800' y2='520' />
      <line x1='0' y1='560' x2='800' y2='560' />
      <line x1='0' y1='440' x2='800' y2='440' />
    </g>
  </svg>
`);

const ATELIER_NATUREL_PALETTE = ["#d9d0b4", "#a7b38d", "#606c38", "#283618"] as const;
const atelierNaturelArt = createSvgDataUri(`
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600'>
    <rect width='800' height='600' fill='${ATELIER_NATUREL_PALETTE[0]}' />
    <rect y='320' width='800' height='280' fill='${ATELIER_NATUREL_PALETTE[3]}' />
    <g opacity='0.25'>
      <rect x='40' y='60' width='120' height='480' rx='16' fill='${ATELIER_NATUREL_PALETTE[1]}' />
      <rect x='220' y='80' width='140' height='460' rx='20' fill='${ATELIER_NATUREL_PALETTE[2]}' />
      <rect x='420' y='100' width='160' height='440' rx='24' fill='${ATELIER_NATUREL_PALETTE[1]}' />
      <rect x='620' y='70' width='120' height='470' rx='18' fill='${ATELIER_NATUREL_PALETTE[2]}' />
    </g>
    <path d='M0 340 Q120 300 220 340 T420 360 T620 330 T800 360 L800 600 H0 Z' fill='${ATELIER_NATUREL_PALETTE[1]}' opacity='0.65' />
    <g fill='none' stroke='${ATELIER_NATUREL_PALETTE[2]}' stroke-width='2' opacity='0.35'>
      <path d='M120 180 C170 140 210 200 260 160' />
      <path d='M460 200 C520 150 560 220 620 180' />
      <path d='M320 260 C360 210 420 260 460 220' />
    </g>
  </svg>
`);

const QUARTZ_DIGITAL_PALETTE = ["#e0e0e0", "#a0aec0", "#1a202c", "#4fd1c5"] as const;
const quartzDigitalArt = createSvgDataUri(`
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600'>
    <rect width='800' height='600' fill='${QUARTZ_DIGITAL_PALETTE[2]}' />
    <g stroke='${QUARTZ_DIGITAL_PALETTE[3]}' stroke-width='2' opacity='0.5'>
      <path d='M60 80 H220 V200 H340 V320 H520 V440 H700' fill='none' />
      <path d='M60 200 H200 V320 H420 V520 H700' fill='none' />
      <path d='M140 520 H340 V400 H540 V260 H720' fill='none' />
    </g>
    <g fill='${QUARTZ_DIGITAL_PALETTE[3]}' opacity='0.7'>
      <circle cx='220' cy='200' r='8' />
      <circle cx='340' cy='320' r='8' />
      <circle cx='520' cy='440' r='8' />
      <circle cx='200' cy='320' r='8' />
      <circle cx='420' cy='520' r='8' />
    </g>
    <rect x='0' y='0' width='800' height='600' fill='${QUARTZ_DIGITAL_PALETTE[1]}' opacity='0.12' />
  </svg>
`);

const LUNE_PALE_PALETTE = ["#1b1b2f", "#3d5af1", "#b2b1cf", "#f0f0f0"] as const;
const lunePaleArt = createSvgDataUri(`
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600'>
    <rect width='800' height='600' fill='${LUNE_PALE_PALETTE[0]}' />
    <radialGradient id='lp-moon' cx='65%' cy='30%' r='35%'>
      <stop offset='0%' stop-color='${LUNE_PALE_PALETTE[3]}' stop-opacity='0.85' />
      <stop offset='100%' stop-color='${LUNE_PALE_PALETTE[2]}' stop-opacity='0.05' />
    </radialGradient>
    <circle cx='520' cy='180' r='120' fill='url(#lp-moon)' />
    <g fill='${LUNE_PALE_PALETTE[1]}' opacity='0.25'>
      <circle cx='200' cy='120' r='4' />
      <circle cx='140' cy='220' r='3' />
      <circle cx='360' cy='100' r='3' />
      <circle cx='640' cy='260' r='4' />
      <circle cx='700' cy='140' r='3' />
      <circle cx='420' cy='200' r='3' />
      <circle cx='240' cy='260' r='2' />
    </g>
    <path d='M0 420 Q160 380 320 420 T640 410 T800 430 L800 600 H0 Z' fill='${LUNE_PALE_PALETTE[1]}' opacity='0.25' />
    <path d='M0 460 Q200 430 400 460 T800 450 L800 600 H0 Z' fill='${LUNE_PALE_PALETTE[2]}' opacity='0.2' />
  </svg>
`);

const STUDIO_CREATIF_PALETTE = ["#ff595e", "#ffca3a", "#8ac926", "#1982c4"] as const;
const studioCreatifArt = createSvgDataUri(`
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600'>
    <rect width='800' height='600' fill='${STUDIO_CREATIF_PALETTE[3]}' />
    <g transform='rotate(-6 400 300)'>
      <rect x='120' y='80' width='200' height='260' rx='18' fill='${STUDIO_CREATIF_PALETTE[0]}' opacity='0.9' />
      <rect x='340' y='130' width='220' height='280' rx='18' fill='${STUDIO_CREATIF_PALETTE[1]}' opacity='0.85' />
      <rect x='200' y='300' width='280' height='180' rx='18' fill='${STUDIO_CREATIF_PALETTE[2]}' opacity='0.85' />
      <rect x='500' y='80' width='160' height='200' rx='18' fill='${STUDIO_CREATIF_PALETTE[0]}' opacity='0.8' />
    </g>
    <g stroke='${STUDIO_CREATIF_PALETTE[1]}' stroke-width='6' stroke-linecap='round' opacity='0.6'>
      <path d='M140 520 L660 520' />
      <path d='M200 560 L600 560' />
    </g>
    <g fill='${STUDIO_CREATIF_PALETTE[1]}' opacity='0.7'>
      <circle cx='140' cy='120' r='10' />
      <circle cx='620' cy='140' r='12' />
      <circle cx='520' cy='360' r='8' />
    </g>
  </svg>
`);

const MONOLITHE_NOIR_PALETTE = ["#0a0a0a", "#1e1e1e", "#2d2d2d", "#4b4b4b"] as const;
const monolitheNoirArt = createSvgDataUri(`
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600'>
    <rect width='800' height='600' fill='${MONOLITHE_NOIR_PALETTE[0]}' />
    <g>
      <rect x='120' y='60' width='140' height='480' fill='${MONOLITHE_NOIR_PALETTE[1]}' />
      <rect x='300' y='100' width='160' height='440' fill='${MONOLITHE_NOIR_PALETTE[2]}' />
      <rect x='500' y='40' width='180' height='500' fill='${MONOLITHE_NOIR_PALETTE[1]}' />
    </g>
    <linearGradient id='mn-light' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='${MONOLITHE_NOIR_PALETTE[3]}' stop-opacity='0.4' />
      <stop offset='100%' stop-color='${MONOLITHE_NOIR_PALETTE[0]}' stop-opacity='0.1' />
    </linearGradient>
    <rect width='800' height='600' fill='url(#mn-light)' />
    <g stroke='${MONOLITHE_NOIR_PALETTE[3]}' stroke-width='2' opacity='0.25'>
      <line x1='0' y1='520' x2='800' y2='520' />
      <line x1='0' y1='560' x2='800' y2='560' />
    </g>
  </svg>
`);

const VIVA_POP_PALETTE = ["#ff006e", "#fb5607", "#ffbe0b", "#8338ec", "#3a86ff"] as const;
const vivaPopArt = createSvgDataUri(`
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600'>
    <rect width='800' height='600' fill='${VIVA_POP_PALETTE[4]}' />
    <g opacity='0.9'>
      <circle cx='160' cy='140' r='80' fill='${VIVA_POP_PALETTE[0]}' />
      <circle cx='520' cy='160' r='100' fill='${VIVA_POP_PALETTE[3]}' />
      <circle cx='320' cy='360' r='120' fill='${VIVA_POP_PALETTE[2]}' />
      <circle cx='640' cy='380' r='100' fill='${VIVA_POP_PALETTE[1]}' />
    </g>
    <g fill='${VIVA_POP_PALETTE[2]}' opacity='0.65'>
      <circle cx='200' cy='80' r='12' />
      <circle cx='420' cy='120' r='10' />
      <circle cx='580' cy='80' r='14' />
      <circle cx='700' cy='160' r='10' />
      <circle cx='120' cy='260' r='10' />
      <circle cx='260' cy='480' r='14' />
      <circle cx='680' cy='500' r='16' />
    </g>
  </svg>
`);

const SABLE_A_AUBE_PALETTE = ["#f7ede2", "#f5cac3", "#84a59d", "#f28482"] as const;
const sableAubeArt = createSvgDataUri(`
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600'>
    <rect width='800' height='600' fill='${SABLE_A_AUBE_PALETTE[0]}' />
    <linearGradient id='sa-sky' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0%' stop-color='${SABLE_A_AUBE_PALETTE[1]}' stop-opacity='0.75' />
      <stop offset='100%' stop-color='${SABLE_A_AUBE_PALETTE[0]}' stop-opacity='0.35' />
    </linearGradient>
    <rect width='800' height='320' fill='url(#sa-sky)' />
    <path d='M0 320 Q200 280 320 300 T560 290 T800 320 L800 600 H0 Z' fill='${SABLE_A_AUBE_PALETTE[2]}' opacity='0.4' />
    <path d='M0 360 Q220 330 400 360 T800 340 L800 600 H0 Z' fill='${SABLE_A_AUBE_PALETTE[3]}' opacity='0.35' />
    <path d='M0 420 Q180 390 360 420 T800 410 L800 600 H0 Z' fill='${SABLE_A_AUBE_PALETTE[1]}' opacity='0.45' />
  </svg>
`);

const AGORA_MODERNE_PALETTE = ["#ffffff", "#e5e5e5", "#3d405b", "#81b29a", "#e07a5f"] as const;
const agoraModerneArt = createSvgDataUri(`
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600'>
    <rect width='800' height='600' fill='${AGORA_MODERNE_PALETTE[1]}' />
    <g>
      <rect x='80' y='80' width='160' height='440' rx='24' fill='${AGORA_MODERNE_PALETTE[3]}' opacity='0.85' />
      <rect x='280' y='120' width='200' height='400' rx='24' fill='${AGORA_MODERNE_PALETTE[2]}' opacity='0.85' />
      <rect x='520' y='60' width='200' height='460' rx='24' fill='${AGORA_MODERNE_PALETTE[4]}' opacity='0.85' />
    </g>
    <rect x='0' y='0' width='800' height='600' fill='${AGORA_MODERNE_PALETTE[0]}' opacity='0.4' />
    <g stroke='${AGORA_MODERNE_PALETTE[2]}' stroke-width='4' opacity='0.3'>
      <line x1='40' y1='520' x2='760' y2='520' />
      <line x1='40' y1='560' x2='760' y2='560' />
    </g>
  </svg>
`);

const OR_IMPERIAL_PALETTE = ["#f5f3e7", "#d2b48c", "#a67c52", "#4b4237"] as const;
const orImperialArt = createSvgDataUri(`
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600'>
    <rect width='800' height='600' fill='${OR_IMPERIAL_PALETTE[0]}' />
    <linearGradient id='oi-marble' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='${OR_IMPERIAL_PALETTE[0]}' />
      <stop offset='100%' stop-color='${OR_IMPERIAL_PALETTE[1]}' />
    </linearGradient>
    <rect width='800' height='600' fill='url(#oi-marble)' opacity='0.6' />
    <g stroke='${OR_IMPERIAL_PALETTE[3]}' stroke-width='3' opacity='0.25'>
      <path d='M0 100 C200 160 400 60 600 120 C720 160 800 140 800 140' fill='none' />
      <path d='M0 260 C200 220 420 320 620 260 C720 230 800 260 800 260' fill='none' />
      <path d='M0 420 C200 380 420 460 620 420 C720 390 800 420 800 420' fill='none' />
    </g>
    <rect x='100' y='140' width='600' height='320' rx='28' fill='${OR_IMPERIAL_PALETTE[2]}' opacity='0.45' />
    <rect x='140' y='180' width='520' height='240' rx='20' fill='${OR_IMPERIAL_PALETTE[3]}' opacity='0.35' />
  </svg>
`);

export const THEMES: Theme[] = [
  {
    id: "horizon-synthwave",
    name: "Horizon Synthwave",
    preview: `linear-gradient(135deg, rgba(255,0,128,0.72), rgba(18,4,88,0.92)), url(${horizonSynthwaveArt})`,
    background: `linear-gradient(135deg, rgba(255,0,128,0.72), rgba(18,4,88,0.92)), url(${horizonSynthwaveArt})`,
    palette: [...HORIZON_SYNTHWAVE_PALETTE],
    imageDescription: "Horizon rétro futuriste avec néons roses et violets"
  },
  {
    id: "atelier-naturel",
    name: "Atelier Naturel",
    preview: `linear-gradient(135deg, rgba(40,54,24,0.78), rgba(160,173,132,0.65)), url(${atelierNaturelArt})`,
    background: `linear-gradient(135deg, rgba(40,54,24,0.78), rgba(160,173,132,0.65)), url(${atelierNaturelArt})`,
    palette: [...ATELIER_NATUREL_PALETTE],
    imageDescription: "Ambiance atelier botanique avec bois et feuillages"
  },
  {
    id: "quartz-digital",
    name: "Quartz Digital",
    preview: `linear-gradient(135deg, rgba(26,32,44,0.9), rgba(79,209,197,0.55)), url(${quartzDigitalArt})`,
    background: `linear-gradient(135deg, rgba(26,32,44,0.9), rgba(79,209,197,0.55)), url(${quartzDigitalArt})`,
    palette: [...QUARTZ_DIGITAL_PALETTE],
    imageDescription: "Textures high-tech avec circuits et reflets métalliques"
  },
  {
    id: "lune-pale",
    name: "Lune Pâle",
    preview: `linear-gradient(135deg, rgba(27,27,47,0.85), rgba(178,177,207,0.45)), url(${lunePaleArt})`,
    background: `linear-gradient(135deg, rgba(27,27,47,0.85), rgba(178,177,207,0.45)), url(${lunePaleArt})`,
    palette: [...LUNE_PALE_PALETTE],
    imageDescription: "Ciel nocturne doux avec lune et nuages légers"
  },
  {
    id: "studio-creatif",
    name: "Studio Créatif",
    preview: `linear-gradient(135deg, rgba(25,130,196,0.85), rgba(255,89,94,0.6)), url(${studioCreatifArt})`,
    background: `linear-gradient(135deg, rgba(25,130,196,0.85), rgba(255,89,94,0.6)), url(${studioCreatifArt})`,
    palette: [...STUDIO_CREATIF_PALETTE],
    imageDescription: "Matériel créatif coloré et compositions dynamiques"
  },
  {
    id: "monolithe-noir",
    name: "Monolithe Noir",
    preview: `linear-gradient(135deg, rgba(10,10,10,0.95), rgba(75,75,75,0.55)), url(${monolitheNoirArt})`,
    background: `linear-gradient(135deg, rgba(10,10,10,0.95), rgba(75,75,75,0.55)), url(${monolitheNoirArt})`,
    palette: [...MONOLITHE_NOIR_PALETTE],
    imageDescription: "Volumes sombres et reflets minimalistes"
  },
  {
    id: "viva-pop",
    name: "Viva Pop",
    preview: `linear-gradient(135deg, rgba(255,0,110,0.7), rgba(58,134,255,0.75)), url(${vivaPopArt})`,
    background: `linear-gradient(135deg, rgba(255,0,110,0.7), rgba(58,134,255,0.75)), url(${vivaPopArt})`,
    palette: [...VIVA_POP_PALETTE],
    imageDescription: "Explosion de couleurs saturées et confettis pop art"
  },
  {
    id: "sable-aube",
    name: "Sable & Aube",
    preview: `linear-gradient(135deg, rgba(132,165,157,0.55), rgba(242,132,130,0.6)), url(${sableAubeArt})`,
    background: `linear-gradient(135deg, rgba(132,165,157,0.55), rgba(242,132,130,0.6)), url(${sableAubeArt})`,
    palette: [...SABLE_A_AUBE_PALETTE],
    imageDescription: "Dunes baignées de la lumière douce du lever du jour"
  },
  {
    id: "agora-moderne",
    name: "Agora Moderne",
    preview: `linear-gradient(135deg, rgba(61,64,91,0.82), rgba(129,178,154,0.55)), url(${agoraModerneArt})`,
    background: `linear-gradient(135deg, rgba(61,64,91,0.82), rgba(129,178,154,0.55)), url(${agoraModerneArt})`,
    palette: [...AGORA_MODERNE_PALETTE],
    imageDescription: "Espaces modernes et bibliothèques aux formes géométriques"
  },
  {
    id: "or-imperial",
    name: "Or Impérial",
    preview: `linear-gradient(135deg, rgba(166,124,82,0.7), rgba(75,66,55,0.65)), url(${orImperialArt})`,
    background: `linear-gradient(135deg, rgba(166,124,82,0.7), rgba(75,66,55,0.65)), url(${orImperialArt})`,
    palette: [...OR_IMPERIAL_PALETTE],
    imageDescription: "Marbre et dorures avec une lumière chaleureuse"
  }
];

export const DEFAULT_THEME_ID = THEMES[0]?.id ?? "horizon-synthwave";

export const getTheme = (id: string): Theme | undefined => {
  return THEMES.find(t => t.id === id);
};
