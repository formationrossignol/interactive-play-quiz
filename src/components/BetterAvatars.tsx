export const ENHANCED_AVATARS = [
  { emoji: "🦁", name: "Lion", color: "from-yellow-500 to-orange-600" },
  { emoji: "🐯", name: "Tigre", color: "from-orange-500 to-red-600" },
  { emoji: "🐻", name: "Ours", color: "from-amber-700 to-amber-900" },
  { emoji: "🐼", name: "Panda", color: "from-gray-700 to-gray-900" },
  { emoji: "🐨", name: "Koala", color: "from-gray-500 to-gray-700" },
  { emoji: "🐸", name: "Grenouille", color: "from-green-500 to-green-700" },
  { emoji: "🐵", name: "Singe", color: "from-amber-600 to-amber-800" },
  { emoji: "🦊", name: "Renard", color: "from-orange-600 to-red-700" },
  { emoji: "🐱", name: "Chat", color: "from-pink-500 to-purple-600" },
  { emoji: "🐶", name: "Chien", color: "from-amber-500 to-amber-700" },
  { emoji: "🐰", name: "Lapin", color: "from-pink-400 to-pink-600" },
  { emoji: "🦄", name: "Licorne", color: "from-purple-500 to-pink-600" },
  { emoji: "🐲", name: "Dragon", color: "from-green-600 to-teal-700" },
  { emoji: "🦖", name: "T-Rex", color: "from-green-700 to-green-900" },
  { emoji: "🐙", name: "Pieuvre", color: "from-purple-600 to-purple-800" },
  { emoji: "🦉", name: "Hibou", color: "from-amber-700 to-amber-900" },
  { emoji: "🦅", name: "Aigle", color: "from-blue-700 to-blue-900" },
  { emoji: "🐬", name: "Dauphin", color: "from-cyan-500 to-blue-600" },
  { emoji: "🦈", name: "Requin", color: "from-blue-600 to-blue-800" },
  { emoji: "🐺", name: "Loup", color: "from-gray-600 to-gray-800" },
];

interface AvatarDisplayProps {
  emoji: string;
  size?: "sm" | "md" | "lg" | "xl";
  showGlow?: boolean;
  className?: string;
}

export const AvatarDisplay = ({ emoji, size = "md", showGlow = false, className = "" }: AvatarDisplayProps) => {
  const avatar = ENHANCED_AVATARS.find(a => a.emoji === emoji) || ENHANCED_AVATARS[0];
  
  const sizeClasses = {
    sm: "w-10 h-10 text-2xl",
    md: "w-14 h-14 text-3xl",
    lg: "w-20 h-20 text-5xl",
    xl: "w-28 h-28 text-7xl"
  };

  return (
    <div className={`relative ${className}`}>
      <div 
        className={`
          ${sizeClasses[size]} 
          rounded-full 
          bg-gradient-to-br ${avatar.color}
          flex items-center justify-center 
          border-4 border-white/20
          shadow-lg
          transition-all duration-300
          hover:scale-110
          ${showGlow ? 'animate-pulse shadow-2xl' : ''}
        `}
      >
        <span className="drop-shadow-lg">{avatar.emoji}</span>
      </div>
    </div>
  );
};
