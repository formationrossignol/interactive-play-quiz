import React from "react";

export type EnhancedAvatar = {
  emoji: string;
  name: string;
  color: string;
  render: () => React.ReactElement;
};

export const ENHANCED_AVATARS: EnhancedAvatar[] = [
  // 1. Zorg — Alien à 3 yeux
  {
    emoji: "zorg",
    name: "Zorg",
    color: "from-lime-400 to-green-600",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#D4FFD4" />
        <ellipse cx="50" cy="60" rx="36" ry="38" fill="#6DC96D" />
        <line x1="38" y1="24" x2="30" y2="6" stroke="#4A9E4A" strokeWidth="3" strokeLinecap="round" />
        <line x1="62" y1="24" x2="70" y2="6" stroke="#4A9E4A" strokeWidth="3" strokeLinecap="round" />
        <circle cx="30" cy="5" r="5" fill="#00CCFF" />
        <circle cx="70" cy="5" r="5" fill="#FF66FF" />
        <circle cx="50" cy="40" r="9" fill="#0A0A1A" />
        <circle cx="31" cy="57" r="9" fill="#0A0A1A" />
        <circle cx="69" cy="57" r="9" fill="#0A0A1A" />
        <circle cx="52" cy="37" r="2.8" fill="white" />
        <circle cx="33" cy="54" r="2.8" fill="white" />
        <circle cx="71" cy="54" r="2.8" fill="white" />
        <circle cx="44" cy="63" r="2.5" fill="#3A8A3A" />
        <circle cx="56" cy="63" r="2.5" fill="#3A8A3A" />
        <circle cx="50" cy="64.5" r="2" fill="#3A8A3A" />
        <path d="M26 72 Q50 86 74 72 Q74 80 50 84 Q26 80 26 72Z" fill="#3A8A3A" />
        <path d="M32 72 L32 77M42 72 L42 78M52 72 L52 78M62 72 L62 78M70 72 L70 77" stroke="#D4FFD4" strokeWidth="2.5" />
      </svg>
    ),
  },

  // 2. Capitaine — Pirate
  {
    emoji: "capitaine",
    name: "Capitaine",
    color: "from-red-700 to-red-900",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#D0E8FF" />
        <ellipse cx="50" cy="64" rx="28" ry="34" fill="#8B5E3C" />
        <path d="M28 72 Q50 64 72 72 Q60 84 50 88 Q40 84 28 72Z" fill="#CC2200" />
        <path d="M8 44 Q50 18 92 44 Q80 48 68 44 Q50 32 32 44 Q20 48 8 44Z" fill="#1A1A1A" />
        <path d="M6 44 Q50 56 94 44" fill="none" stroke="#CC9900" strokeWidth="2.5" />
        <circle cx="50" cy="33" r="7" fill="#F0F0F0" />
        <circle cx="47" cy="32" r="1.3" fill="#1A1A1A" /><circle cx="53" cy="32" r="1.3" fill="#1A1A1A" />
        <path d="M47 37 Q50 40 53 37" fill="none" stroke="#1A1A1A" strokeWidth="1.2" />
        <path d="M44 45 Q50 42 56 45" fill="#CC2200" stroke="#CC2200" strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="35" cy="56" rx="10" ry="8" fill="#1A1A1A" />
        <line x1="20" y1="48" x2="44" y2="54" stroke="#0A0A0A" strokeWidth="2.5" />
        <circle cx="65" cy="57" r="5.5" fill="#1A1A2E" />
        <circle cx="66.5" cy="55.5" r="1.5" fill="white" />
        <path d="M56 50 Q65 47 74 50" fill="none" stroke="#4A2A18" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M60 46 Q66 58 62 68" fill="none" stroke="#CC7060" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M37 74 Q52 82 66 72" fill="none" stroke="#7A3A2A" strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),
  },

  // 3. Prof. Bouleau — Savant fou
  {
    emoji: "prof",
    name: "Prof. Bouleau",
    color: "from-cyan-400 to-blue-500",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#E8F8FF" />
        <ellipse cx="50" cy="64" rx="28" ry="34" fill="#FDDBB4" />
        <path d="M22 46 Q10 20 18 8 Q26 22 28 44" fill="#F0F0F0" />
        <path d="M30 38 Q24 12 32 4 Q36 18 36 38" fill="#F0F0F0" />
        <path d="M42 34 Q40 8 48 2 Q50 16 48 34" fill="#F0F0F0" />
        <path d="M58 34 Q60 8 52 2 Q50 16 52 34" fill="#F0F0F0" />
        <path d="M64 38 Q72 12 68 4 Q64 18 62 38" fill="#F0F0F0" />
        <path d="M76 44 Q90 20 82 8 Q74 22 72 44" fill="#F0F0F0" />
        <rect x="32" y="88" width="36" height="12" rx="4" fill="white" stroke="#DDD" strokeWidth="1" />
        <circle cx="35" cy="60" r="12" fill="rgba(200,240,255,0.5)" stroke="#1A1A2E" strokeWidth="2.5" />
        <circle cx="65" cy="60" r="12" fill="rgba(200,240,255,0.5)" stroke="#1A1A2E" strokeWidth="2.5" />
        <line x1="47" y1="60" x2="53" y2="60" stroke="#1A1A2E" strokeWidth="2" />
        <line x1="4" y1="58" x2="23" y2="58" stroke="#1A1A2E" strokeWidth="1.5" />
        <line x1="77" y1="58" x2="96" y2="58" stroke="#1A1A2E" strokeWidth="1.5" />
        <circle cx="35" cy="60" r="5.5" fill="#1A1A2E" />
        <circle cx="65" cy="60" r="5.5" fill="#1A1A2E" />
        <circle cx="37" cy="58" r="2" fill="white" />
        <circle cx="67" cy="58" r="2" fill="white" />
        <path d="M31 74 Q50 88 69 74" fill="#CC5050" stroke="#CC5050" strokeWidth="1" />
        <path d="M31 74 Q50 84 69 74" fill="white" />
        <path d="M38 77 L62 77" fill="none" stroke="#FFAAAA" strokeWidth="1" />
      </svg>
    ),
  },

  // 4. Kage — Ninja
  {
    emoji: "kage",
    name: "Kage",
    color: "from-gray-700 to-gray-900",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#2A1010" />
        <ellipse cx="50" cy="62" rx="36" ry="38" fill="#1A1A1A" />
        <rect x="8" y="40" width="84" height="12" rx="2" fill="#CC0000" />
        <path d="M82 40 Q92 34 88 52 Q84 46 82 52Z" fill="#CC0000" />
        <path d="M82 52 Q92 58 88 40 Q84 46 82 40Z" fill="#AA0000" />
        <rect x="12" y="42" width="76" height="8" rx="1" fill="#2A0A0A" />
        <ellipse cx="34" cy="46" rx="9" ry="5" fill="#0A0A0A" />
        <ellipse cx="66" cy="46" rx="9" ry="5" fill="#0A0A0A" />
        <ellipse cx="34" cy="46" rx="6" ry="3.5" fill="#1A5A5A" />
        <ellipse cx="66" cy="46" rx="6" ry="3.5" fill="#1A5A5A" />
        <ellipse cx="34" cy="46" rx="3" ry="2.5" fill="#0A1A1A" />
        <ellipse cx="66" cy="46" rx="3" ry="2.5" fill="#0A1A1A" />
        <circle cx="35" cy="45" r="1.1" fill="white" />
        <circle cx="67" cy="45" r="1.1" fill="white" />
        <text x="50" y="49" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold" fontFamily="serif">忍</text>
      </svg>
    ),
  },

  // 5. Vladimord — Vampire
  {
    emoji: "vladimord",
    name: "Vladimord",
    color: "from-purple-800 to-purple-950",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#1A0A2E" />
        <path d="M10 82 Q18 50 14 30 Q30 50 50 54 Q70 50 86 30 Q82 50 90 82Z" fill="#2A0A4E" />
        <ellipse cx="50" cy="52" rx="28" ry="34" fill="#D4C4E8" />
        <path d="M22 40 Q30 18 42 26 Q50 16 58 26 Q70 18 78 40 Q66 30 50 32 Q34 30 22 40Z" fill="#0A0A1A" />
        <ellipse cx="37" cy="48" rx="8" ry="5.5" fill="#CC0000" />
        <ellipse cx="63" cy="48" rx="8" ry="5.5" fill="#CC0000" />
        <circle cx="37" cy="48" r="4" fill="#880000" />
        <circle cx="63" cy="48" r="4" fill="#880000" />
        <circle cx="38.5" cy="46.5" r="1.3" fill="#FF4444" />
        <circle cx="64.5" cy="46.5" r="1.3" fill="#FF4444" />
        <path d="M28 42 Q37 38 44 42" fill="none" stroke="#0A0A1A" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M56 42 Q63 38 72 42" fill="none" stroke="#0A0A1A" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M47 56 Q50 62 53 56" fill="none" stroke="#B090C8" strokeWidth="1.5" />
        <path d="M36 66 Q50 76 64 66" fill="#AA0030" stroke="#AA0030" strokeWidth="1" />
        <path d="M36 66 Q50 72 64 66" fill="#D4C4E8" />
        <path d="M44 66 L42 73 L46 66" fill="white" />
        <path d="M56 66 L54 73 L58 66" fill="white" />
      </svg>
    ),
  },

  // 6. Buck — Cowboy
  {
    emoji: "buck",
    name: "Buck",
    color: "from-yellow-600 to-amber-700",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#FFF3E0" />
        <ellipse cx="50" cy="64" rx="28" ry="34" fill="#EDB98A" />
        <path d="M28 72 Q50 66 72 72 Q60 84 50 88 Q40 84 28 72Z" fill="#CC2200" />
        <ellipse cx="52" cy="38" rx="40" ry="8" fill="#8B5A2B" />
        <path d="M18 36 Q22 16 50 14 Q78 16 82 36 Q66 28 50 28 Q34 28 18 36Z" fill="#A06830" />
        <polygon points="50,67 52,73 58,73 53,77 55,83 50,79 45,83 47,77 42,73 48,73" fill="#FFD700" stroke="#CC9900" strokeWidth="0.5" />
        <ellipse cx="37" cy="56" rx="6.5" ry="4.5" fill="#1A1A2E" />
        <ellipse cx="63" cy="56" rx="6.5" ry="4.5" fill="#1A1A2E" />
        <circle cx="38" cy="55" r="1.6" fill="white" />
        <circle cx="64" cy="55" r="1.6" fill="white" />
        <path d="M28 51 Q37 48 45 51" fill="none" stroke="#8B5E3C" strokeWidth="2" strokeLinecap="round" />
        <path d="M55 51 Q63 49 72 51" fill="none" stroke="#8B5E3C" strokeWidth="2" strokeLinecap="round" />
        <path d="M37 64 Q50 72 63 64" fill="none" stroke="#8B5E3C" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="30" cy="68" r="1.3" fill="#B08060" opacity="0.6" /><circle cx="35" cy="72" r="1.3" fill="#B08060" opacity="0.6" />
        <circle cx="65" cy="68" r="1.3" fill="#B08060" opacity="0.6" /><circle cx="70" cy="72" r="1.3" fill="#B08060" opacity="0.6" />
      </svg>
    ),
  },

  // 7. Chef Gustave
  {
    emoji: "gustave",
    name: "Chef Gustave",
    color: "from-white to-gray-200",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#FFFEF0" />
        <ellipse cx="50" cy="66" rx="28" ry="32" fill="#FDDBB4" />
        <ellipse cx="50" cy="34" rx="26" ry="6" fill="#EEEEEE" stroke="#DDD" strokeWidth="1" />
        <rect x="24" y="10" width="52" height="26" rx="8" fill="white" stroke="#DDDDDD" strokeWidth="1" />
        <path d="M28 82 Q50 74 72 82 Q60 92 50 94 Q40 92 28 82Z" fill="#CC1100" />
        <ellipse cx="30" cy="70" rx="7" ry="5" fill="#FFB0A0" opacity="0.5" />
        <ellipse cx="70" cy="70" rx="7" ry="5" fill="#FFB0A0" opacity="0.5" />
        <path d="M50 70 Q38 64 28 68 Q32 74 38 70 Q50 68 62 70 Q68 74 72 68 Q62 64 50 70Z" fill="#5A3018" />
        <path d="M28 68 Q22 62 26 58 Q30 64 30 68" fill="#5A3018" />
        <path d="M72 68 Q78 62 74 58 Q70 64 70 68" fill="#5A3018" />
        <circle cx="38" cy="62" r="5.5" fill="#2D1B00" />
        <circle cx="62" cy="62" r="5.5" fill="#2D1B00" />
        <circle cx="39.5" cy="60.5" r="1.6" fill="white" />
        <circle cx="63.5" cy="60.5" r="1.6" fill="white" />
        <path d="M30 56 Q38 53 44 56" fill="none" stroke="#5A3018" strokeWidth="2" strokeLinecap="round" />
        <path d="M56 56 Q62 53 70 56" fill="none" stroke="#5A3018" strokeWidth="2" strokeLinecap="round" />
        <path d="M36 78 Q50 88 64 78" fill="none" stroke="#B07060" strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),
  },

  // 8. DJ Turbo
  {
    emoji: "djturbo",
    name: "DJ Turbo",
    color: "from-yellow-400 to-orange-500",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#1A0A3E" />
        <ellipse cx="50" cy="62" rx="28" ry="34" fill="#EDB98A" />
        <path d="M14 54 Q14 22 50 22 Q86 22 86 54" fill="none" stroke="#FFD700" strokeWidth="9" strokeLinecap="round" />
        <rect x="7" y="52" width="14" height="22" rx="6" fill="#FFB800" stroke="#CC9900" strokeWidth="1.5" />
        <rect x="79" y="52" width="14" height="22" rx="6" fill="#FFB800" stroke="#CC9900" strokeWidth="1.5" />
        <ellipse cx="52" cy="36" rx="32" ry="9" fill="#CC2200" />
        <path d="M20 34 Q24 22 50 20 Q76 22 80 34 Q64 28 50 28 Q36 28 20 34Z" fill="#EE3300" />
        <ellipse cx="74" cy="36" rx="18" ry="6" fill="#AA1800" />
        <rect x="20" y="50" width="24" height="14" rx="6" fill="rgba(0,200,255,0.35)" stroke="#1A1A1A" strokeWidth="2" />
        <rect x="56" y="50" width="24" height="14" rx="6" fill="rgba(0,200,255,0.35)" stroke="#1A1A1A" strokeWidth="2" />
        <line x1="44" y1="57" x2="56" y2="57" stroke="#1A1A1A" strokeWidth="2.2" />
        <line x1="4" y1="56" x2="20" y2="56" stroke="#1A1A1A" strokeWidth="1.5" />
        <line x1="80" y1="56" x2="96" y2="56" stroke="#1A1A1A" strokeWidth="1.5" />
        <path d="M24 52 Q30 50 36 52" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M60 52 Q66 50 72 52" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="32" cy="57" r="3.5" fill="#2D1B00" />
        <circle cx="68" cy="57" r="3.5" fill="#2D1B00" />
        <path d="M38 72 Q54 80 66 70" fill="none" stroke="#B07060" strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),
  },

  // 9. Turboflash — Super-héros
  {
    emoji: "turboflash",
    name: "Turboflash",
    color: "from-blue-500 to-blue-700",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#E0EAFF" />
        <path d="M10 30 Q22 72 22 82 L50 62 L78 82 Q78 72 90 30 Q70 52 50 54 Q30 52 10 30Z" fill="#CC1100" opacity="0.9" />
        <ellipse cx="50" cy="62" rx="28" ry="34" fill="#FDDBB4" />
        <path d="M22 46 Q28 22 50 20 Q72 22 78 46 Q64 36 52 38 Q50 28 48 38 Q36 36 22 46Z" fill="#1A1A2E" />
        <path d="M48 38 Q44 26 48 20 Q52 28 52 38" fill="#1A1A2E" />
        <path d="M18 52 Q26 44 38 50 Q44 48 50 50 Q56 48 62 50 Q74 44 82 52 Q72 58 62 54 Q56 56 50 54 Q44 56 38 54 Q28 58 18 52Z" fill="#1A1A1A" />
        <ellipse cx="35" cy="52" rx="6.5" ry="4" fill="#00CC44" />
        <ellipse cx="65" cy="52" rx="6.5" ry="4" fill="#00CC44" />
        <circle cx="35" cy="52" r="3" fill="#008822" />
        <circle cx="65" cy="52" r="3" fill="#008822" />
        <circle cx="36.5" cy="50.5" r="1.2" fill="white" />
        <circle cx="66.5" cy="50.5" r="1.2" fill="white" />
        <polygon points="52,28 47,36 52,36 47,44 55,35 50,35" fill="#FFD700" stroke="#CC9900" strokeWidth="0.5" />
        <path d="M38 68 Q50 76 62 68" fill="none" stroke="#B07060" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },

  // 10. Biniou — Clown
  {
    emoji: "biniou",
    name: "Biniou",
    color: "from-pink-400 to-yellow-400",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#FFF0F8" />
        <circle cx="12" cy="54" r="17" fill="#FF6B6B" />
        <circle cx="88" cy="54" r="17" fill="#FFD700" />
        <circle cx="20" cy="35" r="13" fill="#FF88FF" />
        <circle cx="80" cy="35" r="13" fill="#88FFBB" />
        <ellipse cx="50" cy="64" rx="28" ry="34" fill="#FDDBB4" />
        <ellipse cx="30" cy="68" rx="11" ry="9" fill="white" opacity="0.8" />
        <ellipse cx="70" cy="68" rx="11" ry="9" fill="white" opacity="0.8" />
        <ellipse cx="50" cy="32" rx="20" ry="4" fill="#2D2D2D" />
        <rect x="36" y="18" width="28" height="16" rx="4" fill="#2D2D2D" />
        <circle cx="50" cy="62" r="9" fill="#FF2200" />
        <circle cx="52" cy="60" r="2.2" fill="#FF6655" />
        <circle cx="34" cy="52" r="6.5" fill="white" stroke="#2D1B00" strokeWidth="1.5" />
        <circle cx="66" cy="52" r="6.5" fill="white" stroke="#2D1B00" strokeWidth="1.5" />
        <circle cx="34" cy="52" r="3.8" fill="#2D1B00" />
        <circle cx="66" cy="52" r="3.8" fill="#2D1B00" />
        <circle cx="35.5" cy="50.5" r="1.3" fill="white" />
        <circle cx="67.5" cy="50.5" r="1.3" fill="white" />
        <path d="M25 74 Q50 94 75 74 Q75 84 50 88 Q25 84 25 74Z" fill="#CC2200" />
        <path d="M25 74 Q50 86 75 74 Q75 78 50 82 Q25 78 25 74Z" fill="white" />
        <path d="M34 78 L66 78" fill="none" stroke="#FFAAAA" strokeWidth="1" />
      </svg>
    ),
  },

  // 11. Sir Gontran — Chevalier
  {
    emoji: "gontran",
    name: "Sir Gontran",
    color: "from-gray-400 to-gray-600",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#E0E0E0" />
        <ellipse cx="50" cy="72" rx="30" ry="22" fill="#9A9A9A" />
        <path d="M20 62 Q22 56 24 62 Q26 56 28 62 Q30 56 32 62 Q34 56 36 62 Q38 56 40 62 Q42 56 44 62 Q46 56 48 62 Q50 56 52 62 Q54 56 56 62 Q58 56 60 62 Q62 56 64 62 Q66 56 68 62 Q70 56 72 62 Q74 56 76 62 Q78 56 80 62" fill="none" stroke="#888" strokeWidth="1" />
        <rect x="20" y="16" width="60" height="24" rx="12" fill="#C0C8D8" />
        <rect x="16" y="36" width="68" height="8" rx="2" fill="#8A9AB0" />
        <ellipse cx="50" cy="42" rx="32" ry="8" fill="#B0B8C8" />
        <path d="M18 44 Q24 38 28 36 Q28 48 18 44Z" fill="#8A9AB0" />
        <path d="M82 44 Q76 38 72 36 Q72 48 82 44Z" fill="#8A9AB0" />
        <circle cx="26" cy="20" r="2.2" fill="#8A9AB0" /><circle cx="74" cy="20" r="2.2" fill="#8A9AB0" /><circle cx="50" cy="16" r="2.2" fill="#8A9AB0" />
        <ellipse cx="50" cy="56" rx="22" ry="22" fill="#FDDBB4" />
        <path d="M28 48 Q38 44 44 48" fill="none" stroke="#CC3300" strokeWidth="4.5" strokeLinecap="round" />
        <path d="M56 48 Q62 44 72 48" fill="none" stroke="#CC3300" strokeWidth="4.5" strokeLinecap="round" />
        <circle cx="37" cy="54" r="4.5" fill="#1A1A2E" />
        <circle cx="63" cy="54" r="4.5" fill="#1A1A2E" />
        <circle cx="38.5" cy="52.5" r="1.4" fill="white" />
        <circle cx="64.5" cy="52.5" r="1.4" fill="white" />
        <path d="M36 64 Q50 76 64 64 Q64 70 58 68 L54 74 L50 68 L46 74 L42 68 Q36 70 36 64Z" fill="#CC5050" />
        <path d="M36 64 Q50 72 64 64 Q64 67 58 65 L54 71 L50 65 L46 71 L42 65 Q36 67 36 64Z" fill="white" />
      </svg>
    ),
  },

  // 12. Björn — Viking
  {
    emoji: "bjorn",
    name: "Björn",
    color: "from-blue-700 to-indigo-900",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#C8E0F0" />
        <ellipse cx="50" cy="60" rx="30" ry="36" fill="#C8936C" />
        <ellipse cx="50" cy="34" rx="28" ry="14" fill="#8B7040" />
        <path d="M22 36 Q10 16 14 6 Q24 18 24 34" fill="#8B7040" stroke="#6B5020" strokeWidth="1" />
        <path d="M78 36 Q90 16 86 6 Q76 18 76 34" fill="#8B7040" stroke="#6B5020" strokeWidth="1" />
        <ellipse cx="10" cy="12" rx="5.5" ry="10" fill="#F0EAD0" transform="rotate(-20 10 12)" />
        <ellipse cx="90" cy="12" rx="5.5" ry="10" fill="#F0EAD0" transform="rotate(20 90 12)" />
        <rect x="22" y="40" width="56" height="8" rx="2" fill="#1E3A8A" opacity="0.7" />
        <path d="M16 58 Q18 92 50 98 Q82 92 84 58 Q72 74 50 76 Q28 74 16 58Z" fill="#CC4400" />
        <path d="M26 56 Q38 50 50 56 Q62 50 74 56 Q62 66 50 62 Q38 66 26 56Z" fill="#EE5500" />
        <path d="M24 72 Q20 82 22 92" stroke="#CC4400" strokeWidth="6" strokeLinecap="round" />
        <path d="M76 72 Q80 82 78 92" stroke="#CC4400" strokeWidth="6" strokeLinecap="round" />
        <circle cx="22" cy="90" r="3.2" fill="#B0A060" /><circle cx="78" cy="90" r="3.2" fill="#B0A060" />
        <circle cx="37" cy="50" r="5.5" fill="#1A1A2E" />
        <circle cx="63" cy="50" r="5.5" fill="#1A1A2E" />
        <circle cx="38.5" cy="48.5" r="1.6" fill="white" /><circle cx="64.5" cy="48.5" r="1.6" fill="white" />
        <path d="M28 44 Q37 40 44 44" fill="none" stroke="#6B3A2A" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M56 44 Q63 40 72 44" fill="none" stroke="#6B3A2A" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
    ),
  },

  // 13. Ramsès — Pharaon
  {
    emoji: "ramses",
    name: "Ramsès",
    color: "from-yellow-500 to-amber-600",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#FFF0C0" />
        <path d="M22 36 Q24 8 50 4 Q76 8 78 36 Q70 28 50 26 Q30 28 22 36Z" fill="#1E3A8A" />
        <line x1="30" y1="10" x2="28" y2="30" stroke="#FFD700" strokeWidth="2.5" />
        <line x1="40" y1="6" x2="38" y2="28" stroke="#FFD700" strokeWidth="2.5" />
        <line x1="50" y1="4" x2="50" y2="26" stroke="#FFD700" strokeWidth="2.5" />
        <line x1="60" y1="6" x2="62" y2="28" stroke="#FFD700" strokeWidth="2.5" />
        <line x1="70" y1="10" x2="72" y2="30" stroke="#FFD700" strokeWidth="2.5" />
        <path d="M22 36 Q16 44 14 64 Q20 62 24 52 Q28 42 28 56" fill="#1E3A8A" />
        <path d="M78 36 Q84 44 86 64 Q80 62 76 52 Q72 42 72 56" fill="#1E3A8A" />
        <path d="M46 6 Q44 2 50 0 Q56 2 54 6 Q52 10 50 8 Q48 10 46 6Z" fill="#CC1100" />
        <ellipse cx="50" cy="58" rx="26" ry="30" fill="#C8936C" />
        <path d="M24 78 Q50 88 76 78 Q76 84 50 88 Q24 84 24 78Z" fill="#FFD700" stroke="#CC9900" strokeWidth="1" />
        <ellipse cx="35" cy="54" rx="10" ry="6" fill="#1A1A1A" />
        <ellipse cx="65" cy="54" rx="10" ry="6" fill="#1A1A1A" />
        <ellipse cx="35" cy="54" rx="7" ry="4" fill="#C8936C" />
        <ellipse cx="65" cy="54" rx="7" ry="4" fill="#C8936C" />
        <circle cx="35" cy="54" r="3.5" fill="#1A1A2E" />
        <circle cx="65" cy="54" r="3.5" fill="#1A1A2E" />
        <circle cx="36.5" cy="52.5" r="1.2" fill="white" /><circle cx="66.5" cy="52.5" r="1.2" fill="white" />
        <line x1="45" y1="52" x2="24" y2="48" stroke="#1A1A1A" strokeWidth="1.5" />
        <line x1="75" y1="52" x2="76" y2="48" stroke="#1A1A1A" strokeWidth="1.5" />
        <path d="M38 68 Q50 76 62 68" fill="none" stroke="#A06040" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },

  // 14. Groar — Zombie
  {
    emoji: "groar",
    name: "Groar",
    color: "from-green-700 to-green-900",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#B8CCB0" />
        <ellipse cx="50" cy="60" rx="28" ry="36" fill="#7A9A6A" />
        <path d="M22 42 Q18 20 24 10 Q28 24 30 40" fill="#4A6A3A" />
        <path d="M34 36 Q32 14 38 6 Q42 20 42 36" fill="#4A6A3A" />
        <path d="M58 36 Q60 14 56 6 Q52 20 52 36" fill="#4A6A3A" />
        <path d="M68 40 Q72 18 68 8 Q64 22 64 40" fill="#4A6A3A" />
        <rect x="68" y="66" width="12" height="8" rx="2" fill="#888" />
        <rect x="66" y="64" width="16" height="4" rx="2" fill="#999" />
        <line x1="32" y1="44" x2="44" y2="40" stroke="#3A5A2A" strokeWidth="1.5" />
        <line x1="35" y1="40" x2="35" y2="44" stroke="#3A5A2A" strokeWidth="1.5" />
        <line x1="40" y1="39" x2="40" y2="43" stroke="#3A5A2A" strokeWidth="1.5" />
        <line x1="56" y1="40" x2="68" y2="44" stroke="#3A5A2A" strokeWidth="1.5" />
        <line x1="60" y1="39" x2="60" y2="43" stroke="#3A5A2A" strokeWidth="1.5" />
        <line x1="64" y1="40" x2="64" y2="44" stroke="#3A5A2A" strokeWidth="1.5" />
        <line x1="28" y1="50" x2="40" y2="62" stroke="#3A5A2A" strokeWidth="3" strokeLinecap="round" />
        <line x1="40" y1="50" x2="28" y2="62" stroke="#3A5A2A" strokeWidth="3" strokeLinecap="round" />
        <circle cx="65" cy="57" r="9" fill="#CCEEAA" stroke="#4A6A3A" strokeWidth="1.5" />
        <circle cx="65" cy="57" r="5.5" fill="#1A2A0A" />
        <circle cx="66.5" cy="55.5" r="1.6" fill="white" />
        <path d="M30 72 Q50 88 70 72 Q70 82 50 86 Q30 82 30 72Z" fill="#2A4A1A" />
        <path d="M34 72 Q50 82 66 72 Q66 76 50 78 Q34 76 34 72Z" fill="#4A6A3A" />
        <path d="M42 78 Q50 88 58 78 Q58 86 50 90 Q42 86 42 78Z" fill="#CC4444" />
      </svg>
    ),
  },

  // 15. Buzz — Astronaute
  {
    emoji: "buzz",
    name: "Buzz",
    color: "from-blue-300 to-blue-500",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#080818" />
        <circle cx="10" cy="10" r="1.2" fill="white" />
        <circle cx="85" cy="15" r="1.5" fill="white" />
        <circle cx="20" cy="80" r="1" fill="white" />
        <circle cx="90" cy="70" r="1.2" fill="white" />
        <circle cx="5" cy="50" r="1" fill="white" />
        <circle cx="95" cy="40" r="1.5" fill="white" />
        <circle cx="50" cy="50" r="42" fill="#E8E8E8" stroke="#CCCCCC" strokeWidth="2.5" />
        <ellipse cx="50" cy="52" rx="30" ry="26" fill="#8B6914" opacity="0.7" />
        <circle cx="50" cy="52" r="26" fill="#1A4A8A" opacity="0.4" />
        <circle cx="46" cy="46" r="11" fill="#2A5A00" opacity="0.5" />
        <circle cx="54" cy="58" r="9" fill="#1A4A8A" opacity="0.6" />
        <ellipse cx="42" cy="52" rx="7" ry="5" fill="white" opacity="0.25" />
        <circle cx="37" cy="52" r="5.5" fill="#FDDBB4" />
        <circle cx="63" cy="52" r="5.5" fill="#FDDBB4" />
        <ellipse cx="50" cy="52" rx="19" ry="15" fill="#FDDBB4" />
        <circle cx="40" cy="50" r="4.5" fill="#2D1B00" />
        <circle cx="60" cy="50" r="4.5" fill="#2D1B00" />
        <circle cx="41.5" cy="48.5" r="1.4" fill="white" /><circle cx="61.5" cy="48.5" r="1.4" fill="white" />
        <path d="M38 58 Q50 68 62 58" fill="none" stroke="#C07060" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="77" cy="32" r="9" fill="#CC1100" />
        <text x="77" y="35.5" textAnchor="middle" fill="white" fontSize="5.5" fontWeight="bold" fontFamily="sans-serif">NASA</text>
        <circle cx="50" cy="50" r="42" fill="none" stroke="#AAAAAA" strokeWidth="3" />
        <circle cx="50" cy="50" r="38" fill="none" stroke="#888888" strokeWidth="1" />
      </svg>
    ),
  },

  // 16. Merlin — Sorcier
  {
    emoji: "merlin",
    name: "Merlin",
    color: "from-indigo-600 to-purple-800",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#1A0A3E" />
        <path d="M50 2 L70 42 Q60 38 50 40 Q40 38 30 42 Z" fill="#1E1A6A" stroke="#3A2A8A" strokeWidth="1" />
        <ellipse cx="50" cy="42" rx="22" ry="6" fill="#2A2A8A" />
        <circle cx="44" cy="14" r="3.2" fill="#FFD700" />
        <circle cx="56" cy="21" r="2.2" fill="#FFD700" />
        <path d="M60 10 Q64 6 68 10 Q64 8 60 10Z" fill="#FFD700" />
        <path d="M36 26 Q34 22 38 20 Q38 24 36 26Z" fill="#C0C0FF" />
        <circle cx="50" cy="30" r="2" fill="#C0C0FF" />
        <ellipse cx="50" cy="62" rx="26" ry="28" fill="#FDDBB4" />
        <path d="M24 64 Q22 88 34 96 Q42 100 50 98 Q58 100 66 96 Q78 88 76 64 Q66 80 50 82 Q34 80 24 64Z" fill="#E8E8E8" />
        <path d="M32 72 Q28 80 34 84" fill="none" stroke="#CCC" strokeWidth="2.2" />
        <path d="M68 72 Q72 80 66 84" fill="none" stroke="#CCC" strokeWidth="2.2" />
        <path d="M40 78 Q38 84 44 88" fill="none" stroke="#DDD" strokeWidth="2" />
        <path d="M60 78 Q62 84 56 88" fill="none" stroke="#DDD" strokeWidth="2" />
        <circle cx="38" cy="58" r="9" fill="rgba(255,255,200,0.25)" stroke="#C0A060" strokeWidth="2" />
        <circle cx="62" cy="58" r="9" fill="rgba(255,255,200,0.25)" stroke="#C0A060" strokeWidth="2" />
        <line x1="47" y1="58" x2="53" y2="58" stroke="#C0A060" strokeWidth="1.5" />
        <line x1="18" y1="56" x2="29" y2="56" stroke="#C0A060" strokeWidth="1.5" />
        <line x1="71" y1="56" x2="82" y2="56" stroke="#C0A060" strokeWidth="1.5" />
        <circle cx="38" cy="58" r="4.5" fill="#1A1A5A" />
        <circle cx="62" cy="58" r="4.5" fill="#1A1A5A" />
        <circle cx="39.5" cy="56.5" r="1.4" fill="white" /><circle cx="63.5" cy="56.5" r="1.4" fill="white" />
        <path d="M28 52 Q38 48 46 52" fill="none" stroke="#CCC" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M54 52 Q62 48 72 52" fill="none" stroke="#CCC" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M42 70 Q50 76 58 70" fill="none" stroke="#B07060" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },

  // 17. R2B2 — Robot
  {
    emoji: "r2b2",
    name: "R2B2",
    color: "from-gray-300 to-gray-500",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#B0C0D0" />
        <line x1="50" y1="8" x2="50" y2="20" stroke="#888" strokeWidth="3" strokeLinecap="round" />
        <circle cx="50" cy="6" r="4.5" fill="#00FF88" />
        <line x1="36" y1="14" x2="50" y2="14" stroke="#888" strokeWidth="2" />
        <circle cx="34" cy="14" r="3.5" fill="#FF4444" />
        <rect x="12" y="20" width="76" height="72" rx="10" fill="#B0B8C8" stroke="#8A9AB0" strokeWidth="2" />
        <rect x="18" y="26" width="64" height="60" rx="6" fill="#C8D0E0" />
        <rect x="20" y="32" width="24" height="18" rx="4" fill="#1A1A2E" />
        <rect x="56" y="32" width="24" height="18" rx="4" fill="#1A1A2E" />
        <circle cx="27" cy="47" r="2.2" fill="#00FF88" /><circle cx="33" cy="45" r="2.2" fill="#00FF88" /><circle cx="39" cy="45" r="2.2" fill="#00FF88" />
        <circle cx="27" cy="41" r="2.2" fill="#00AA55" /><circle cx="33" cy="39" r="2.2" fill="#00FF88" /><circle cx="39" cy="41" r="2.2" fill="#00AA55" />
        <circle cx="61" cy="47" r="2.2" fill="#00FF88" /><circle cx="67" cy="45" r="2.2" fill="#00FF88" /><circle cx="73" cy="45" r="2.2" fill="#00FF88" />
        <circle cx="61" cy="41" r="2.2" fill="#00AA55" /><circle cx="67" cy="39" r="2.2" fill="#00FF88" /><circle cx="73" cy="41" r="2.2" fill="#00AA55" />
        <rect x="28" y="60" width="44" height="14" rx="3" fill="#1A1A2E" />
        <circle cx="35" cy="67" r="2.2" fill="#00FF88" /><circle cx="42" cy="67" r="2.2" fill="#00FF88" />
        <circle cx="50" cy="65" r="2.2" fill="#00FF88" />
        <circle cx="58" cy="67" r="2.2" fill="#00FF88" /><circle cx="65" cy="67" r="2.2" fill="#00FF88" />
        <circle cx="16" cy="30" r="2.8" fill="#9AA0B0" stroke="#8A9AB0" strokeWidth="1" />
        <circle cx="84" cy="30" r="2.8" fill="#9AA0B0" stroke="#8A9AB0" strokeWidth="1" />
        <circle cx="16" cy="60" r="2.8" fill="#9AA0B0" stroke="#8A9AB0" strokeWidth="1" />
        <circle cx="84" cy="60" r="2.8" fill="#9AA0B0" stroke="#8A9AB0" strokeWidth="1" />
        <rect x="36" y="80" width="28" height="8" rx="2" fill="#1A1A2E" />
        <rect x="37" y="81" width="18" height="6" rx="1" fill="#00FF88" />
      </svg>
    ),
  },

  // 18. Oméga-7 — Espion
  {
    emoji: "omega7",
    name: "Oméga-7",
    color: "from-gray-800 to-gray-950",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#F0F0F0" />
        <ellipse cx="50" cy="60" rx="28" ry="34" fill="#FDDBB4" />
        <path d="M22 82 Q30 70 40 74 L50 68 L60 74 Q70 70 78 82Z" fill="#1A1A1A" />
        <path d="M40 74 L50 70 L60 74 Q56 82 50 80 Q44 82 40 74Z" fill="white" />
        <path d="M44 76 Q50 72 56 76 Q50 80 44 76Z" fill="#CC0000" />
        <circle cx="50" cy="76" r="1.8" fill="#880000" />
        <path d="M22 46 Q26 22 50 20 Q74 22 78 46 Q64 36 54 38 Q52 28 50 38 Q48 28 46 38 Q36 36 22 46Z" fill="#1A1A1A" />
        <path d="M46 38 Q44 26 48 20 Q52 26 54 38" fill="#1A1A1A" />
        <path d="M36 28 Q44 24 52 26" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" />
        <rect x="17" y="48" width="28" height="13" rx="6" fill="#0A0A0A" />
        <rect x="55" y="48" width="28" height="13" rx="6" fill="#0A0A0A" />
        <rect x="45" y="52" width="10" height="5" rx="2" fill="#1A1A1A" />
        <line x1="4" y1="54" x2="17" y2="54" stroke="#1A1A1A" strokeWidth="2.2" />
        <line x1="83" y1="54" x2="96" y2="54" stroke="#1A1A1A" strokeWidth="2.2" />
        <path d="M21 50 Q27 48 33 50" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M57 50 Q63 48 69 50" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="80" cy="60" r="3.5" fill="#C0C0C0" />
        <path d="M81 63.5 Q83 68 81 72" stroke="#C0C0C0" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M39 68 Q52 76 62 66" fill="none" stroke="#B07060" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },

  // 19. Belladone — Sorcière
  {
    emoji: "belladone",
    name: "Belladone",
    color: "from-green-600 to-green-800",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#0A1A04" />
        <path d="M50 2 L66 44 Q58 40 50 42 Q42 40 34 44 Z" fill="#0A0A0A" />
        <ellipse cx="50" cy="44" rx="26" ry="7" fill="#1A1A1A" />
        <path d="M36 40 Q50 46 64 40 Q62 44 50 46 Q38 44 36 40Z" fill="#6A0080" />
        <rect x="44" y="36" width="12" height="10" rx="2" fill="#6A0080" />
        <circle cx="50" cy="41" r="3.5" fill="#AA00CC" />
        <path d="M24 44 Q16 50 12 64" stroke="#1A4A0A" strokeWidth="9" strokeLinecap="round" fill="none" />
        <path d="M76 44 Q84 50 88 64" stroke="#0A3A00" strokeWidth="9" strokeLinecap="round" fill="none" />
        <ellipse cx="50" cy="64" rx="26" ry="30" fill="#5A8A3A" />
        <path d="M46 66 Q50 74 54 66" fill="none" stroke="#3A6A1A" strokeWidth="2" />
        <circle cx="54" cy="64" r="4" fill="#4A7A2A" />
        <circle cx="55.5" cy="62.5" r="1.2" fill="#6A9A4A" />
        <ellipse cx="36" cy="58" rx="8.5" ry="6.5" fill="#0A0A0A" />
        <ellipse cx="64" cy="58" rx="8.5" ry="6.5" fill="#0A0A0A" />
        <ellipse cx="36" cy="58" rx="5.5" ry="4.5" fill="#DDCC00" />
        <ellipse cx="64" cy="58" rx="5.5" ry="4.5" fill="#DDCC00" />
        <ellipse cx="36" cy="58" rx="2.8" ry="4.5" fill="#0A0A0A" />
        <ellipse cx="64" cy="58" rx="2.8" ry="4.5" fill="#0A0A0A" />
        <circle cx="37" cy="56.5" r="1.1" fill="white" /><circle cx="65" cy="56.5" r="1.1" fill="white" />
        <path d="M26 52 Q36 48 44 52" fill="none" stroke="#0A0A0A" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M56 52 Q64 48 74 52" fill="none" stroke="#0A0A0A" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M34 74 Q50 88 66 74 Q66 82 50 86 Q34 82 34 74Z" fill="#1A4A0A" />
        <path d="M34 74 Q50 82 66 74 Q66 77 50 80 Q34 77 34 74Z" fill="#7AAA5A" />
        <path d="M42 74 L40 81 L44 76" fill="white" />
      </svg>
    ),
  },

  // 20. Grug — Homme des cavernes
  {
    emoji: "grug",
    name: "Grug",
    color: "from-amber-700 to-stone-700",
    render: () => (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <rect width="100" height="100" fill="#E8D4B0" />
        <path d="M16 84 Q14 68 16 56 Q22 72 26 78 Q32 64 36 78 Q42 64 48 78 Q52 64 56 78 Q62 64 66 78 Q72 64 76 78 Q80 72 84 56 Q86 68 84 84Z" fill="#8B5A2B" />
        <ellipse cx="50" cy="58" rx="30" ry="34" fill="#EDB98A" />
        <path d="M20 48 Q14 24 20 10 Q28 28 30 44" fill="#6B3A1A" />
        <path d="M28 38 Q22 16 30 6 Q36 22 36 40" fill="#8B4A2A" />
        <path d="M42 34 Q38 10 46 4 Q50 20 48 36" fill="#6B3A1A" />
        <path d="M58 34 Q64 10 54 4 Q50 20 52 36" fill="#8B4A2A" />
        <path d="M68 38 Q76 16 70 6 Q64 22 64 40" fill="#6B3A1A" />
        <path d="M76 44 Q84 22 78 10 Q70 26 70 44" fill="#8B4A2A" />
        <rect x="53" y="8" width="17" height="5" rx="2.5" fill="#F0EAD0" />
        <circle cx="53" cy="10.5" r="4" fill="#F0EAD0" /><circle cx="70" cy="10.5" r="4" fill="#F0EAD0" />
        <path d="M20 50 Q50 44 80 50" fill="#5A2A10" stroke="#5A2A10" strokeWidth="5.5" strokeLinecap="round" />
        <circle cx="38" cy="57" r="5.5" fill="#1A1A2E" />
        <circle cx="62" cy="57" r="5.5" fill="#1A1A2E" />
        <circle cx="39.5" cy="55.5" r="1.6" fill="white" /><circle cx="63.5" cy="55.5" r="1.6" fill="white" />
        <ellipse cx="50" cy="65" rx="7.5" ry="5.5" fill="#DDA070" />
        <circle cx="47" cy="65" r="2.2" fill="#CC8060" /><circle cx="53" cy="65" r="2.2" fill="#CC8060" />
        <circle cx="30" cy="62" r="2.2" fill="#B07840" opacity="0.6" /><circle cx="34" cy="66" r="2.2" fill="#B07840" opacity="0.6" />
        <circle cx="70" cy="62" r="2.2" fill="#B07840" opacity="0.6" /><circle cx="66" cy="66" r="2.2" fill="#B07840" opacity="0.6" />
        <path d="M28 74 Q50 92 72 74 Q72 84 50 88 Q28 84 28 74Z" fill="#CC5040" />
        <path d="M28 74 Q50 84 72 74 Q72 78 50 82 Q28 78 28 74Z" fill="white" />
        <rect x="46" y="74" width="8" height="8" rx="0" fill="#CC5040" />
      </svg>
    ),
  },
];

export const getAvatarRender = (emojiId: string) => {
  const avatar = ENHANCED_AVATARS.find(a => a.emoji === emojiId) || ENHANCED_AVATARS[0];
  return avatar.render();
};

interface AvatarDisplayProps {
  emoji: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showGlow?: boolean;
  className?: string;
}

export const AvatarDisplay = ({ emoji, size = "md", showGlow = false, className = "" }: AvatarDisplayProps) => {
  const avatar = ENHANCED_AVATARS.find(a => a.emoji === emoji) || ENHANCED_AVATARS[0];

  const outerSize = {
    xs: "w-6 h-6",
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
