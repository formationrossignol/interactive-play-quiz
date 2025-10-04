import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { login, register } from "@/lib/auth";
import { toast } from "sonner";
import { Zap } from "lucide-react";

const AuthPage = () => {
  const navigate = useNavigate();
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({ email: "", username: "", password: "" });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = login(loginData.email, loginData.password);
    
    if (user) {
      toast.success("Connexion réussie !");
      navigate("/");
    } else {
      toast.error("Email ou mot de passe incorrect");
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const user = register(registerData.email, registerData.username, registerData.password);
    
    if (user) {
      toast.success("Inscription réussie !");
      navigate("/");
    } else {
      toast.error("Cet email est déjà utilisé");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-primary rounded-lg flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">QuizMaster</h1>
          <p className="text-white/80">Bienvenue sur la plateforme de quiz interactifs</p>
        </div>

        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
          <CardContent className="p-6">
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Connexion</TabsTrigger>
                <TabsTrigger value="register">Inscription</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Label htmlFor="login-email" className="text-white">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      required
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                      placeholder="votre@email.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="login-password" className="text-white">Mot de passe</Label>
                    <Input
                      id="login-password"
                      type="password"
                      required
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                      placeholder="••••••••"
                    />
                  </div>
                  <Button type="submit" variant="hero" className="w-full">
                    Se connecter
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <Label htmlFor="register-username" className="text-white">Nom d'utilisateur</Label>
                    <Input
                      id="register-username"
                      type="text"
                      required
                      value={registerData.username}
                      onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                      placeholder="JohnDoe"
                    />
                  </div>
                  <div>
                    <Label htmlFor="register-email" className="text-white">Email</Label>
                    <Input
                      id="register-email"
                      type="email"
                      required
                      value={registerData.email}
                      onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                      placeholder="votre@email.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="register-password" className="text-white">Mot de passe</Label>
                    <Input
                      id="register-password"
                      type="password"
                      required
                      value={registerData.password}
                      onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                      placeholder="••••••••"
                    />
                  </div>
                  <Button type="submit" variant="hero" className="w-full">
                    S'inscrire
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthPage;
