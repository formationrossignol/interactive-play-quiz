import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentUser, logout, setCurrentUser, User as AuthUser } from "@/lib/auth";
import { getUserQuizzes } from "@/lib/quizStorage";
import { Zap, User, LogOut, BookOpen, Save, Trophy, Clock, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const ProfilePage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [stats, setStats] = useState({
    totalQuizzes: 0,
    publicQuizzes: 0,
    totalQuestions: 0
  });

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      navigate("/auth");
      return;
    }
    
    setUser(currentUser);
    setUsername(currentUser.username);
    setEmail(currentUser.email);

    // Calculate stats
    const userQuizzes = getUserQuizzes(currentUser.id);
    setStats({
      totalQuizzes: userQuizzes.length,
      publicQuizzes: userQuizzes.filter(q => q.isPublic).length,
      totalQuestions: userQuizzes.reduce((sum, q) => sum + q.questions.length, 0)
    });
  }, [navigate]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleSave = () => {
    if (!user) return;
    
    if (!username.trim()) {
      toast.error("Le nom d'utilisateur ne peut pas être vide");
      return;
    }

    const updatedUser: AuthUser = {
      ...user,
      username: username.trim()
    };

    setCurrentUser(updatedUser);
    setUser(updatedUser);
    toast.success("Profil mis à jour avec succès");
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Navigation */}
      <nav className="p-6 border-b border-white/10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate('/')}
          >
            <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">QuizMaster</h1>
              <p className="text-white/60 text-sm">Interactive Quiz Platform</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate('/my-quizzes')}>
              <BookOpen className="w-4 h-4 mr-2" />
              Mes Quiz
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-6">
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>

        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold text-white mb-2">Mon Profil</h2>
          <p className="text-white/80">Gérez vos informations personnelles</p>
        </div>

        <div className="grid gap-6">
          {/* Stats */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-white/10 backdrop-blur-lg border-white/20">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-gradient-primary rounded-lg mx-auto mb-3 flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-white mb-1">{stats.totalQuizzes}</div>
                <div className="text-white/60 text-sm">Quiz Créés</div>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur-lg border-white/20">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-gradient-secondary rounded-lg mx-auto mb-3 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-white mb-1">{stats.publicQuizzes}</div>
                <div className="text-white/60 text-sm">Quiz Publics</div>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur-lg border-white/20">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-gradient-success rounded-lg mx-auto mb-3 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-white mb-1">{stats.totalQuestions}</div>
                <div className="text-white/60 text-sm">Questions</div>
              </CardContent>
            </Card>
          </div>

          {/* Profile Info */}
          <Card className="bg-white/10 backdrop-blur-lg border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <User className="w-5 h-5" />
                Informations du Profil
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="username" className="text-white">Nom d'utilisateur</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60 mt-2"
                />
              </div>

              <div>
                <Label htmlFor="email" className="text-white">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className="bg-white/5 border-white/20 text-white/60 mt-2 cursor-not-allowed"
                />
                <p className="text-white/60 text-xs mt-1">L'email ne peut pas être modifié</p>
              </div>

              <div className="pt-4">
                <Button
                  variant="hero"
                  className="w-full"
                  onClick={handleSave}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer les modifications
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Account Actions */}
          <Card className="bg-white/10 backdrop-blur-lg border-white/20">
            <CardHeader>
              <CardTitle className="text-white">Actions du compte</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Se déconnecter
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
