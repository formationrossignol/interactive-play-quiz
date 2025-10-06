import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getCurrentUser, logout } from "@/lib/auth";
import { Zap, LogOut, User, BookOpen, BarChart3, Globe } from "lucide-react";
import { useState, useEffect } from "react";
import { getLanguage, setLanguage, t, type Language } from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  subtitle?: string;
}

export const Header = ({ subtitle }: HeaderProps) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(getCurrentUser());
  const [currentLanguage, setCurrentLanguage] = useState<Language>(getLanguage());

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (currentUser?.id !== user?.id || currentUser?.username !== user?.username) {
      setUser(currentUser);
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    setUser(null);
    navigate("/");
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    setCurrentLanguage(lang);
    window.location.reload(); // Reload to apply language changes
  };

  return (
    <nav className="p-6 border-b border-white/10 bg-background/50 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div 
          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => navigate('/')}
        >
          <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('quizMaster')}</h1>
            {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Globe className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-popover z-50">
              <DropdownMenuItem onClick={() => handleLanguageChange('en')}>
                🇬🇧 English
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleLanguageChange('fr')}>
                🇫🇷 Français
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {user ? (
            <>
              <Button variant="outline" onClick={() => navigate('/my-quizzes')}>
                <BookOpen className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">{t('myQuizzes')}</span>
              </Button>
              <Button variant="outline" onClick={() => navigate('/my-polls')}>
                <BarChart3 className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">{t('myPolls')}</span>
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/profile')}
                className="flex items-center gap-2"
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">{user.username}</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => navigate('/auth')}>
              <User className="w-4 h-4 mr-2" />
              {t('login')}
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
};
