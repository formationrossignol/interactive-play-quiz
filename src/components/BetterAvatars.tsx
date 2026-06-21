import React from "react";

export type EnhancedAvatar = {
  emoji: string; // ID string (kept for backward compat)
  name: string;
  color: string;
  render: () => React.ReactElement;
};

export const ENHANCED_AVATARS: EnhancedAvatar[] = [
  // 1. Béatrice - blonde bob, big red glasses
  {
    emoji: "beatrice",
    name: "Béatrice",
    color: "from-pink-400 to-rose-500",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#FFE4F0" />
        <ellipse cx="50" cy="48" rx="38" ry="40" fill="#E8C547" />
        <ellipse cx="50" cy="60" rx="29" ry="34" fill="#FDDBB4" />
        <rect x="13" y="46" width="13" height="38" rx="6" fill="#E8C547" />
        <rect x="74" y="46" width="13" height="38" rx="6" fill="#E8C547" />
        <rect x="18" y="46" width="26" height="16" rx="6" fill="none" stroke="#CC2200" strokeWidth="3" />
        <rect x="56" y="46" width="26" height="16" rx="6" fill="none" stroke="#CC2200" strokeWidth="3" />
        <line x1="44" y1="54" x2="56" y2="54" stroke="#CC2200" strokeWidth="2.5" />
        <line x1="6" y1="52" x2="18" y2="52" stroke="#CC2200" strokeWidth="2" />
        <line x1="82" y1="52" x2="94" y2="52" stroke="#CC2200" strokeWidth="2" />
        <circle cx="31" cy="54" r="3.5" fill="#2D1B00" />
        <circle cx="69" cy="54" r="3.5" fill="#2D1B00" />
        <circle cx="32.5" cy="52.5" r="1.1" fill="white" />
        <circle cx="70.5" cy="52.5" r="1.1" fill="white" />
        <path d="M47 63 Q50 67 53 63" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" />
        <path d="M38 72 Q50 80 62 72" fill="none" stroke="#D07070" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },

  // 2. Marguerite - grandmother, white curly hair, rosy cheeks
  {
    emoji: "marguerite",
    name: "Marguerite",
    color: "from-purple-300 to-purple-500",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#EFE8FF" />
        <circle cx="50" cy="32" r="27" fill="#D8D8D8" />
        <circle cx="26" cy="44" r="16" fill="#D8D8D8" />
        <circle cx="74" cy="44" r="16" fill="#D8D8D8" />
        <ellipse cx="50" cy="62" rx="28" ry="32" fill="#FDDBB4" />
        <ellipse cx="30" cy="68" rx="8" ry="5" fill="#FFB0B0" opacity="0.45" />
        <ellipse cx="70" cy="68" rx="8" ry="5" fill="#FFB0B0" opacity="0.45" />
        <path d="M30 53 Q37 50 44 53" fill="none" stroke="#999" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M56 53 Q63 50 70 53" fill="none" stroke="#999" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="37" cy="58" r="4" fill="#2D1B00" />
        <circle cx="63" cy="58" r="4" fill="#2D1B00" />
        <circle cx="38.5" cy="56.5" r="1.2" fill="white" />
        <circle cx="64.5" cy="56.5" r="1.2" fill="white" />
        <path d="M38 72 Q50 82 62 72" fill="none" stroke="#D07070" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="21" cy="64" r="3.5" fill="#BBAACC" />
        <circle cx="79" cy="64" r="3.5" fill="#BBAACC" />
      </svg>
    ),
  },

  // 3. Gisèle - black topknot, golden earrings, medium skin
  {
    emoji: "gisele",
    name: "Gisèle",
    color: "from-amber-400 to-orange-500",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#FFF3E0" />
        <ellipse cx="50" cy="58" rx="28" ry="34" fill="#EDB98A" />
        {/* Bun on top */}
        <circle cx="50" cy="22" r="14" fill="#1A1A2E" />
        <ellipse cx="50" cy="33" rx="20" ry="10" fill="#1A1A2E" />
        {/* Chopstick through bun */}
        <line x1="38" y1="12" x2="62" y2="32" stroke="#E8A030" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="38" cy="12" r="3" fill="#E8A030" />
        <path d="M30 52 Q37 49 44 52" fill="none" stroke="#6B3A2A" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M56 52 Q63 49 70 52" fill="none" stroke="#6B3A2A" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="37" cy="57" r="4" fill="#1A1A2E" />
        <circle cx="63" cy="57" r="4" fill="#1A1A2E" />
        <circle cx="38.5" cy="55.5" r="1.2" fill="white" />
        <circle cx="64.5" cy="55.5" r="1.2" fill="white" />
        <path d="M47 65 Q50 69 53 65" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" />
        <path d="M40 73 Q50 80 60 73" fill="none" stroke="#C07060" strokeWidth="2.5" strokeLinecap="round" />
        {/* Hoop earrings */}
        <circle cx="21" cy="62" r="5" fill="none" stroke="#E8A030" strokeWidth="2.5" />
        <circle cx="79" cy="62" r="5" fill="none" stroke="#E8A030" strokeWidth="2.5" />
      </svg>
    ),
  },

  // 4. Nathalie - brown pigtails, freckles, light skin
  {
    emoji: "nathalie",
    name: "Nathalie",
    color: "from-green-400 to-teal-500",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#E0F8F0" />
        <ellipse cx="50" cy="58" rx="29" ry="34" fill="#FDDBB4" />
        {/* Hair top */}
        <ellipse cx="50" cy="32" rx="28" ry="16" fill="#6B3A2A" />
        {/* Pigtails */}
        <ellipse cx="18" cy="52" rx="12" ry="20" fill="#6B3A2A" />
        <ellipse cx="82" cy="52" rx="12" ry="20" fill="#6B3A2A" />
        {/* Pigtail ties */}
        <circle cx="27" cy="38" r="5" fill="#FF6B6B" />
        <circle cx="73" cy="38" r="5" fill="#FF6B6B" />
        <path d="M29 47 Q37 44 44 47" fill="none" stroke="#4A2A18" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M56 47 Q63 44 71 47" fill="none" stroke="#4A2A18" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="37" cy="53" r="4" fill="#2D1B00" />
        <circle cx="63" cy="53" r="4" fill="#2D1B00" />
        <circle cx="38.5" cy="51.5" r="1.2" fill="white" />
        <circle cx="64.5" cy="51.5" r="1.2" fill="white" />
        {/* Freckles */}
        <circle cx="28" cy="60" r="1.5" fill="#C07850" opacity="0.6" />
        <circle cx="33" cy="63" r="1.5" fill="#C07850" opacity="0.6" />
        <circle cx="67" cy="60" r="1.5" fill="#C07850" opacity="0.6" />
        <circle cx="72" cy="63" r="1.5" fill="#C07850" opacity="0.6" />
        <circle cx="50" cy="62" r="1.2" fill="#C07850" opacity="0.5" />
        <path d="M40 70 Q50 78 60 70" fill="none" stroke="#D07070" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },

  // 5. Claudette - silver waves, pearl earrings
  {
    emoji: "claudette",
    name: "Claudette",
    color: "from-blue-300 to-indigo-400",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#E8F0FF" />
        <ellipse cx="50" cy="52" rx="36" ry="40" fill="#AAAAAA" />
        <ellipse cx="50" cy="60" rx="28" ry="34" fill="#FDDBB4" />
        {/* Wave hair detail */}
        <path d="M14 50 Q20 40 26 50 Q32 40 38 48" fill="none" stroke="#888" strokeWidth="4" strokeLinecap="round" />
        <path d="M62 48 Q68 40 74 50 Q80 40 86 50" fill="none" stroke="#888" strokeWidth="4" strokeLinecap="round" />
        <path d="M28 52 Q37 48 44 52" fill="none" stroke="#777" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M56 52 Q63 48 72 52" fill="none" stroke="#777" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="37" cy="58" r="3.8" fill="#2D1B00" />
        <circle cx="63" cy="58" r="3.8" fill="#2D1B00" />
        <circle cx="38.5" cy="56.5" r="1.1" fill="white" />
        <circle cx="64.5" cy="56.5" r="1.1" fill="white" />
        {/* Small glasses on nose */}
        <circle cx="37" cy="58" r="7" fill="none" stroke="#888" strokeWidth="1.5" opacity="0.5" />
        <circle cx="63" cy="58" r="7" fill="none" stroke="#888" strokeWidth="1.5" opacity="0.5" />
        <line x1="44" y1="58" x2="56" y2="58" stroke="#888" strokeWidth="1.5" opacity="0.5" />
        <path d="M40 72 Q50 80 60 72" fill="none" stroke="#D07070" strokeWidth="2.5" strokeLinecap="round" />
        {/* Pearl earrings */}
        <circle cx="21" cy="64" r="4" fill="#F0F0F0" stroke="#DDD" strokeWidth="1" />
        <circle cx="79" cy="64" r="4" fill="#F0F0F0" stroke="#DDD" strokeWidth="1" />
      </svg>
    ),
  },

  // 6. Simone - pink mohawk, dark skin
  {
    emoji: "simone",
    name: "Simone",
    color: "from-fuchsia-500 to-purple-600",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#F0E0FF" />
        <ellipse cx="50" cy="60" rx="28" ry="34" fill="#8B5E3C" />
        {/* Mohawk spikes */}
        <polygon points="42,38 50,8 58,38" fill="#FF1493" />
        <polygon points="37,40 44,12 52,40" fill="#FF69B4" />
        <polygon points="48,40 55,10 63,40" fill="#FF1493" />
        <path d="M32 48 Q39 45 44 48" fill="none" stroke="#5C3D1E" strokeWidth="2" strokeLinecap="round" />
        <path d="M56 48 Q61 45 68 48" fill="none" stroke="#5C3D1E" strokeWidth="2" strokeLinecap="round" />
        <circle cx="38" cy="54" r="4" fill="#1A1A2E" />
        <circle cx="62" cy="54" r="4" fill="#1A1A2E" />
        <circle cx="39.5" cy="52.5" r="1.2" fill="white" />
        <circle cx="63.5" cy="52.5" r="1.2" fill="white" />
        <path d="M47 63 Q50 67 53 63" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5" />
        {/* Neutral bold mouth */}
        <path d="M40 71 L60 71" stroke="#7A3A2A" strokeWidth="2.5" strokeLinecap="round" />
        {/* Nose stud */}
        <circle cx="50" cy="61" r="2" fill="#FF1493" />
      </svg>
    ),
  },

  // 7. Monique - big afro, medium skin, big smile
  {
    emoji: "monique",
    name: "Monique",
    color: "from-yellow-400 to-amber-500",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#FFF8E0" />
        {/* Big afro */}
        <circle cx="50" cy="40" r="40" fill="#3D1C02" />
        <circle cx="24" cy="30" r="14" fill="#3D1C02" />
        <circle cx="76" cy="30" r="14" fill="#3D1C02" />
        <circle cx="14" cy="50" r="12" fill="#3D1C02" />
        <circle cx="86" cy="50" r="12" fill="#3D1C02" />
        <ellipse cx="50" cy="62" rx="26" ry="30" fill="#C8936C" />
        <ellipse cx="29" cy="68" rx="7" ry="5" fill="#B07040" opacity="0.3" />
        <ellipse cx="71" cy="68" rx="7" ry="5" fill="#B07040" opacity="0.3" />
        <path d="M30 54 Q37 51 44 54" fill="none" stroke="#6B3A2A" strokeWidth="2" strokeLinecap="round" />
        <path d="M56 54 Q63 51 70 54" fill="none" stroke="#6B3A2A" strokeWidth="2" strokeLinecap="round" />
        <circle cx="37" cy="60" r="4.5" fill="#1A1A2E" />
        <circle cx="63" cy="60" r="4.5" fill="#1A1A2E" />
        <circle cx="38.5" cy="58.5" r="1.3" fill="white" />
        <circle cx="64.5" cy="58.5" r="1.3" fill="white" />
        <path d="M47 68 Q50 72 53 68" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5" />
        {/* Big smile with teeth */}
        <path d="M36 74 Q50 86 64 74" fill="#CC5050" stroke="#CC5050" strokeWidth="1" />
        <path d="M36 74 Q50 82 64 74" fill="white" />
      </svg>
    ),
  },

  // 8. Hortense - cat-eye glasses, auburn updo
  {
    emoji: "hortense",
    name: "Hortense",
    color: "from-red-400 to-orange-400",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#FFE8E0" />
        {/* Auburn updo */}
        <ellipse cx="50" cy="30" rx="26" ry="18" fill="#8B2500" />
        <ellipse cx="50" cy="42" rx="30" ry="12" fill="#8B2500" />
        {/* Small bun */}
        <circle cx="50" cy="14" r="10" fill="#A03000" />
        <ellipse cx="50" cy="60" rx="28" ry="34" fill="#FDDBB4" />
        {/* Cat-eye glasses */}
        <path d="M18 50 Q20 44 32 45 Q40 44 44 52 Q40 58 30 57 Q18 56 18 50 Z" fill="none" stroke="#2D1B00" strokeWidth="2.5" />
        <path d="M56 52 Q60 44 72 45 Q80 44 82 50 Q82 56 70 57 Q58 58 56 52 Z" fill="none" stroke="#2D1B00" strokeWidth="2.5" />
        <line x1="44" y1="52" x2="56" y2="52" stroke="#2D1B00" strokeWidth="2" />
        <circle cx="31" cy="52" r="3" fill="#1A1A2E" />
        <circle cx="69" cy="52" r="3" fill="#1A1A2E" />
        <circle cx="32.5" cy="50.5" r="1" fill="white" />
        <circle cx="70.5" cy="50.5" r="1" fill="white" />
        <path d="M47 63 Q50 67 53 63" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" />
        <path d="M39 71 Q50 79 61 71" fill="none" stroke="#D07070" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },

  // 9. Madeleine - blonde waves, star hairclip
  {
    emoji: "madeleine",
    name: "Madeleine",
    color: "from-cyan-400 to-blue-400",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#E0F8FF" />
        {/* Wavy blonde hair */}
        <ellipse cx="50" cy="50" rx="38" ry="42" fill="#E8C547" />
        <ellipse cx="50" cy="62" rx="28" ry="34" fill="#FDDBB4" />
        {/* Wave details on sides */}
        <path d="M12 48 Q16 38 22 48 Q28 38 34 46" fill="none" stroke="#D4A830" strokeWidth="4" strokeLinecap="round" />
        <path d="M66 46 Q72 38 78 48 Q84 38 88 48" fill="none" stroke="#D4A830" strokeWidth="4" strokeLinecap="round" />
        {/* Star hair clip */}
        <polygon points="28,32 30,38 36,38 31,42 33,48 28,44 23,48 25,42 20,38 26,38" fill="#FFD700" />
        <path d="M30 52 Q37 49 44 52" fill="none" stroke="#C4963A" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M56 52 Q63 49 70 52" fill="none" stroke="#C4963A" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="37" cy="57" r="4" fill="#2D1B00" />
        <circle cx="63" cy="57" r="4" fill="#2D1B00" />
        <circle cx="38.5" cy="55.5" r="1.2" fill="white" />
        <circle cx="64.5" cy="55.5" r="1.2" fill="white" />
        <path d="M47 65 Q50 69 53 65" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" />
        <path d="M39 73 Q50 81 61 73" fill="none" stroke="#D07070" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },

  // 10. Lucie - short black hair, hoop earring, dark skin
  {
    emoji: "lucie",
    name: "Lucie",
    color: "from-teal-500 to-emerald-600",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#E0FFF4" />
        <ellipse cx="50" cy="43" rx="32" ry="22" fill="#1A1A2E" />
        <ellipse cx="50" cy="62" rx="26" ry="32" fill="#5C3D1E" />
        {/* Short hair sides */}
        <ellipse cx="24" cy="52" rx="8" ry="18" fill="#1A1A2E" />
        <ellipse cx="76" cy="52" rx="8" ry="18" fill="#1A1A2E" />
        <path d="M32 50 Q39 47 44 50" fill="none" stroke="#3D1C02" strokeWidth="2" strokeLinecap="round" />
        <path d="M56 50 Q61 47 68 50" fill="none" stroke="#3D1C02" strokeWidth="2" strokeLinecap="round" />
        <circle cx="37" cy="57" r="4" fill="#1A1A2E" />
        <circle cx="63" cy="57" r="4" fill="#1A1A2E" />
        <circle cx="38.5" cy="55.5" r="1.2" fill="white" />
        <circle cx="64.5" cy="55.5" r="1.2" fill="white" />
        <path d="M47 65 Q50 69 53 65" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5" />
        <path d="M40 73 Q50 80 60 73" fill="none" stroke="#A05040" strokeWidth="2.5" strokeLinecap="round" />
        {/* Hoop earrings */}
        <circle cx="21" cy="64" r="5.5" fill="none" stroke="#E8C547" strokeWidth="2.5" />
        <circle cx="79" cy="64" r="5.5" fill="none" stroke="#E8C547" strokeWidth="2.5" />
      </svg>
    ),
  },

  // 11. Fernand - bowler hat, gray mustache
  {
    emoji: "fernand",
    name: "Fernand",
    color: "from-slate-500 to-slate-700",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#E8EAF0" />
        <ellipse cx="50" cy="62" rx="28" ry="34" fill="#FDDBB4" />
        {/* Bowler hat */}
        <rect x="18" y="40" width="64" height="6" rx="3" fill="#2D2D2D" />
        <ellipse cx="50" cy="26" rx="28" ry="20" fill="#2D2D2D" />
        {/* Eyebrows - thick and stern */}
        <path d="M29 53 Q37 50 44 53" fill="none" stroke="#555" strokeWidth="3" strokeLinecap="round" />
        <path d="M56 53 Q63 50 71 53" fill="none" stroke="#555" strokeWidth="3" strokeLinecap="round" />
        <circle cx="37" cy="58" r="4" fill="#2D1B00" />
        <circle cx="63" cy="58" r="4" fill="#2D1B00" />
        <circle cx="38.5" cy="56.5" r="1.2" fill="white" />
        <circle cx="64.5" cy="56.5" r="1.2" fill="white" />
        <path d="M47 66 Q50 70 53 66" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" />
        {/* Gray walrus mustache */}
        <path d="M34 72 Q42 68 50 72 Q58 68 66 72" fill="#888" stroke="#888" strokeWidth="1" />
        <path d="M34 72 Q42 76 50 72 Q58 76 66 72" fill="#888" />
        {/* Neutral mouth */}
        <path d="M40 78 L60 78" stroke="#A07050" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },

  // 12. Kevin - black messy spiky hair
  {
    emoji: "kevin",
    name: "Kevin",
    color: "from-blue-500 to-indigo-600",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#E8F0FF" />
        <ellipse cx="50" cy="60" rx="28" ry="34" fill="#FDDBB4" />
        {/* Messy spiky hair */}
        <polygon points="50,8 56,28 62,12 66,30 74,16 72,36 80,24 74,42 66,38 58,38 42,38 34,38 26,42 20,24 28,36 26,16 34,30 38,12 44,28" fill="#1A1A2E" />
        <ellipse cx="50" cy="36" rx="26" ry="14" fill="#1A1A2E" />
        <path d="M30 50 Q37 47 44 50" fill="none" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" />
        <path d="M56 50 Q63 47 70 50" fill="none" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" />
        <circle cx="37" cy="56" r="4.5" fill="#2D1B00" />
        <circle cx="63" cy="56" r="4.5" fill="#2D1B00" />
        <circle cx="38.5" cy="54.5" r="1.3" fill="white" />
        <circle cx="64.5" cy="54.5" r="1.3" fill="white" />
        <path d="M47 64 Q50 68 53 64" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" />
        <path d="M40 72 Q50 79 60 72" fill="none" stroke="#D07070" strokeWidth="2.5" strokeLinecap="round" />
        {/* Earring */}
        <circle cx="21" cy="62" r="2.5" fill="#C0C0C0" />
      </svg>
    ),
  },

  // 13. Gaston - blue beret, dark beard
  {
    emoji: "gaston",
    name: "Gaston",
    color: "from-blue-600 to-blue-800",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#E0EAFF" />
        <ellipse cx="50" cy="58" rx="28" ry="35" fill="#C8936C" />
        {/* Dark beard */}
        <path d="M22 65 Q30 90 50 92 Q70 90 78 65 Q70 72 50 74 Q30 72 22 65 Z" fill="#2D1B00" />
        {/* Blue beret */}
        <ellipse cx="54" cy="32" rx="34" ry="16" fill="#1E3A8A" />
        <ellipse cx="50" cy="36" rx="26" ry="6" fill="#1E3A8A" />
        <circle cx="72" cy="26" r="4" fill="#1E3A8A" />
        {/* Brim */}
        <ellipse cx="50" cy="40" rx="30" ry="4" fill="#162C6A" />
        <path d="M32 52 Q39 49 44 52" fill="none" stroke="#6B3A2A" strokeWidth="2" strokeLinecap="round" />
        <path d="M56 52 Q63 49 68 52" fill="none" stroke="#6B3A2A" strokeWidth="2" strokeLinecap="round" />
        <circle cx="37" cy="57" r="4" fill="#1A1A2E" />
        <circle cx="63" cy="57" r="4" fill="#1A1A2E" />
        <circle cx="38.5" cy="55.5" r="1.2" fill="white" />
        <circle cx="64.5" cy="55.5" r="1.2" fill="white" />
        <path d="M47 65 Q50 69 53 65" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5" />
        <path d="M40 72 Q50 78 60 72" fill="none" stroke="#7A3A2A" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },

  // 14. Maurice - bald, huge round glasses
  {
    emoji: "maurice",
    name: "Maurice",
    color: "from-gray-400 to-gray-600",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#F0F0F0" />
        {/* Bald head shine */}
        <ellipse cx="50" cy="46" rx="32" ry="34" fill="#FDDBB4" />
        <ellipse cx="40" cy="30" rx="6" ry="4" fill="white" opacity="0.3" />
        {/* Fringe sides */}
        <ellipse cx="18" cy="54" rx="6" ry="12" fill="#888" />
        <ellipse cx="82" cy="54" rx="6" ry="12" fill="#888" />
        {/* Big round thick glasses */}
        <circle cx="35" cy="52" r="13" fill="none" stroke="#2D1B00" strokeWidth="4" />
        <circle cx="65" cy="52" r="13" fill="none" stroke="#2D1B00" strokeWidth="4" />
        <line x1="48" y1="52" x2="52" y2="52" stroke="#2D1B00" strokeWidth="3" />
        <line x1="4" y1="50" x2="22" y2="50" stroke="#2D1B00" strokeWidth="2.5" />
        <line x1="78" y1="50" x2="96" y2="50" stroke="#2D1B00" strokeWidth="2.5" />
        <circle cx="35" cy="52" r="4" fill="#2D1B00" />
        <circle cx="65" cy="52" r="4" fill="#2D1B00" />
        <circle cx="36.5" cy="50.5" r="1.3" fill="white" />
        <circle cx="66.5" cy="50.5" r="1.3" fill="white" />
        <path d="M47 66 Q50 70 53 66" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" />
        <path d="M38 75 Q50 82 62 75" fill="none" stroke="#D07070" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },

  // 15. Roger - red backwards cap, stubble
  {
    emoji: "roger",
    name: "Roger",
    color: "from-red-500 to-red-700",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#FFE8E0" />
        <ellipse cx="50" cy="60" rx="28" ry="35" fill="#EDB98A" />
        {/* Backwards red cap */}
        <ellipse cx="50" cy="34" rx="30" ry="14" fill="#CC1100" />
        <rect x="18" y="36" width="64" height="8" rx="4" fill="#CC1100" />
        {/* Bill sticking out back */}
        <ellipse cx="76" cy="38" rx="18" ry="6" fill="#AA0000" />
        {/* Stubble */}
        <rect x="30" y="72" width="40" height="14" rx="4" fill="#B8A090" opacity="0.4" />
        <path d="M30 52 Q37 49 44 52" fill="none" stroke="#8B5E3C" strokeWidth="2" strokeLinecap="round" />
        <path d="M56 52 Q63 49 70 52" fill="none" stroke="#8B5E3C" strokeWidth="2" strokeLinecap="round" />
        <circle cx="37" cy="57" r="4.5" fill="#2D1B00" />
        <circle cx="63" cy="57" r="4.5" fill="#2D1B00" />
        <circle cx="38.5" cy="55.5" r="1.3" fill="white" />
        <circle cx="64.5" cy="55.5" r="1.3" fill="white" />
        <path d="M47 65 Q50 69 53 65" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5" />
        <path d="M40 73 Q50 79 60 73" fill="none" stroke="#C07060" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },

  // 16. Jacques - man bun, full beard
  {
    emoji: "jacques",
    name: "Jacques",
    color: "from-amber-600 to-amber-800",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#FFF3E0" />
        <ellipse cx="50" cy="58" rx="28" ry="35" fill="#EDB98A" />
        {/* Full beard */}
        <path d="M22 62 Q28 88 50 92 Q72 88 78 62 Q68 74 50 76 Q32 74 22 62 Z" fill="#6B3A2A" />
        {/* Man bun */}
        <ellipse cx="50" cy="32" rx="20" ry="10" fill="#6B3A2A" />
        <circle cx="50" cy="22" r="10" fill="#6B3A2A" />
        <path d="M30 48 Q37 45 44 48" fill="none" stroke="#4A2A18" strokeWidth="2" strokeLinecap="round" />
        <path d="M56 48 Q63 45 70 48" fill="none" stroke="#4A2A18" strokeWidth="2" strokeLinecap="round" />
        <circle cx="37" cy="53" r="4" fill="#1A1A2E" />
        <circle cx="63" cy="53" r="4" fill="#1A1A2E" />
        <circle cx="38.5" cy="51.5" r="1.2" fill="white" />
        <circle cx="64.5" cy="51.5" r="1.2" fill="white" />
        <path d="M47 62 Q50 66 53 62" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5" />
        <path d="M40 70 Q50 76 60 70" fill="none" stroke="#A06040" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },

  // 17. Gégé - brown mullet, big grin
  {
    emoji: "gege",
    name: "Gégé",
    color: "from-lime-500 to-green-600",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#E8FFE0" />
        <ellipse cx="50" cy="60" rx="28" ry="34" fill="#FDDBB4" />
        {/* Mullet: short on top, long in back */}
        <ellipse cx="50" cy="36" rx="24" ry="12" fill="#8B5A2B" />
        {/* Long back part */}
        <rect x="24" y="40" width="12" height="40" rx="6" fill="#8B5A2B" />
        <rect x="64" y="40" width="12" height="40" rx="6" fill="#8B5A2B" />
        <path d="M28 44 Q50 35 72 44" fill="#8B5A2B" />
        <path d="M30 52 Q37 49 44 52" fill="none" stroke="#6B4020" strokeWidth="2" strokeLinecap="round" />
        <path d="M56 52 Q63 49 70 52" fill="none" stroke="#6B4020" strokeWidth="2" strokeLinecap="round" />
        <circle cx="37" cy="58" r="4" fill="#2D1B00" />
        <circle cx="63" cy="58" r="4" fill="#2D1B00" />
        <circle cx="38.5" cy="56.5" r="1.2" fill="white" />
        <circle cx="64.5" cy="56.5" r="1.2" fill="white" />
        <path d="M47 66 Q50 70 53 66" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" />
        {/* Big grin */}
        <path d="M34 72 Q50 86 66 72" fill="#D05050" stroke="#D05050" strokeWidth="1" />
        <path d="M34 72 Q50 82 66 72" fill="white" />
        <path d="M42 75 L58 75" fill="none" stroke="#FFAAAA" strokeWidth="1" />
      </svg>
    ),
  },

  // 18. Hubert - wild white hair sticking up
  {
    emoji: "hubert",
    name: "Hubert",
    color: "from-violet-500 to-purple-700",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#F0E8FF" />
        <ellipse cx="50" cy="62" rx="28" ry="34" fill="#FDDBB4" />
        {/* Wild hair - lots of crazy strands */}
        <path d="M30 40 Q20 10 28 4 Q32 20 34 38" fill="#E8E8E8" />
        <path d="M40 36 Q38 8 44 2 Q46 18 44 36" fill="#E8E8E8" />
        <path d="M50 34 Q52 6 56 2 Q56 18 54 34" fill="#E8E8E8" />
        <path d="M60 36 Q64 8 68 4 Q66 20 62 38" fill="#E8E8E8" />
        <path d="M70 40 Q78 12 82 8 Q76 24 68 42" fill="#E8E8E8" />
        <path d="M22 46 Q10 20 16 14 Q24 28 26 46" fill="#E8E8E8" />
        <path d="M78 46 Q90 20 84 14 Q76 28 74 46" fill="#E8E8E8" />
        {/* Head base under wild hair */}
        <ellipse cx="50" cy="50" rx="28" ry="16" fill="#E8E8E8" />
        {/* Thick old-man eyebrows */}
        <path d="M28 55 Q36 50 44 55" fill="none" stroke="#CCC" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M56 55 Q64 50 72 55" fill="none" stroke="#CCC" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="36" cy="60" r="4" fill="#2D1B00" />
        <circle cx="64" cy="60" r="4" fill="#2D1B00" />
        <circle cx="37.5" cy="58.5" r="1.2" fill="white" />
        <circle cx="65.5" cy="58.5" r="1.2" fill="white" />
        <path d="M47 68 Q50 72 53 68" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" />
        <path d="M37 76 Q50 84 63 76" fill="none" stroke="#D07070" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },

  // 19. Bernard - handlebar mustache, brown hair
  {
    emoji: "bernard",
    name: "Bernard",
    color: "from-orange-500 to-amber-600",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#FFF0E0" />
        <ellipse cx="50" cy="58" rx="28" ry="34" fill="#EDB98A" />
        {/* Side-parted brown hair */}
        <path d="M20 44 Q30 22 50 28 Q70 22 80 44 Q68 36 50 38 Q32 36 20 44 Z" fill="#6B3A2A" />
        <path d="M30 50 Q37 47 44 50" fill="none" stroke="#4A2A18" strokeWidth="2" strokeLinecap="round" />
        <path d="M56 50 Q63 47 70 50" fill="none" stroke="#4A2A18" strokeWidth="2" strokeLinecap="round" />
        <circle cx="37" cy="56" r="4" fill="#2D1B00" />
        <circle cx="63" cy="56" r="4" fill="#2D1B00" />
        <circle cx="38.5" cy="54.5" r="1.2" fill="white" />
        <circle cx="64.5" cy="54.5" r="1.2" fill="white" />
        <path d="M47 64 Q50 68 53 64" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" />
        {/* Enormous handlebar mustache */}
        <path d="M50 70 Q38 65 26 70 Q34 76 42 72 Q50 70 58 72 Q66 76 74 70 Q62 65 50 70 Z" fill="#5A2A18" />
        {/* Curled tips */}
        <path d="M26 70 Q20 68 22 62 Q26 66 28 70" fill="#5A2A18" />
        <path d="M74 70 Q80 68 78 62 Q74 66 72 70" fill="#5A2A18" />
        <path d="M38 78 Q50 84 62 78" fill="none" stroke="#A07050" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },

  // 20. André - tall black pompadour, dark skin
  {
    emoji: "andre",
    name: "André",
    color: "from-indigo-500 to-purple-600",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#E8E0FF" />
        <ellipse cx="50" cy="62" rx="26" ry="34" fill="#5C3D1E" />
        {/* Pompadour base */}
        <ellipse cx="50" cy="38" rx="24" ry="8" fill="#1A1A2E" />
        {/* Pompadour tall wave */}
        <path d="M26 38 Q30 16 50 10 Q70 16 74 38 Q62 28 50 26 Q38 28 26 38 Z" fill="#1A1A2E" />
        {/* Pompadour shine */}
        <path d="M40 20 Q46 14 54 18" fill="none" stroke="white" strokeWidth="1.5" opacity="0.3" strokeLinecap="round" />
        <path d="M30 53 Q37 50 44 53" fill="none" stroke="#3D1C02" strokeWidth="2" strokeLinecap="round" />
        <path d="M56 53 Q63 50 70 53" fill="none" stroke="#3D1C02" strokeWidth="2" strokeLinecap="round" />
        <circle cx="37" cy="59" r="4" fill="#1A1A2E" />
        <circle cx="63" cy="59" r="4" fill="#1A1A2E" />
        <circle cx="38.5" cy="57.5" r="1.2" fill="white" />
        <circle cx="64.5" cy="57.5" r="1.2" fill="white" />
        <path d="M47 67 Q50 71 53 67" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" />
        <path d="M39 75 Q50 82 61 75" fill="none" stroke="#A06040" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

interface AvatarDisplayProps {
  emoji: string;
  size?: "sm" | "md" | "lg" | "xl";
  showGlow?: boolean;
  className?: string;
}

export const AvatarDisplay = ({ emoji, size = "md", showGlow = false, className = "" }: AvatarDisplayProps) => {
  const avatar = ENHANCED_AVATARS.find(a => a.emoji === emoji) || ENHANCED_AVATARS[0];

  const outerSize = {
    sm: "w-10 h-10",
    md: "w-14 h-14",
    lg: "w-20 h-20",
    xl: "w-28 h-28",
  };

  return (
    <div className={`relative ${className}`}>
      <div
        className={`
          ${outerSize[size]}
          rounded-full
          bg-gradient-to-br ${avatar.color}
          p-0.5
          shadow-lg
          transition-all duration-300
          hover:scale-110
          ${showGlow ? "animate-pulse shadow-2xl" : ""}
        `}
      >
        <div className="w-full h-full rounded-full overflow-hidden">
          {avatar.render()}
        </div>
      </div>
    </div>
  );
};
