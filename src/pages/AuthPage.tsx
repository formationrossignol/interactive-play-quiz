import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg">
            <Zap className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-1">QuizMaster</h1>
          <p className="text-slate-500 text-sm">Bienvenue sur la plateforme de quiz interactifs</p>
        </div>

        {/* Auth card */}
        <div className="rounded-2xl border border-slate-100 bg-white shadow-card p-8">
          <Tabs defaultValue="login">
            <TabsList className="mb-6 w-full rounded-xl bg-slate-100 p-1">
              <TabsTrigger value="login" className="flex-1 rounded-lg text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
                Se connecter
              </TabsTrigger>
              <TabsTrigger value="register" className="flex-1 rounded-lg text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
                S'inscrire
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="login-email" className="text-sm font-medium text-slate-700 mb-1.5 block">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    required
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    className="h-11 rounded-xl border-slate-200 focus-visible:ring-indigo-500"
                    placeholder="votre@email.com"
                  />
                </div>
                <div>
                  <Label htmlFor="login-password" className="text-sm font-medium text-slate-700 mb-1.5 block">Mot de passe</Label>
                  <Input
                    id="login-password"
                    type="password"
                    required
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    className="h-11 rounded-xl border-slate-200 focus-visible:ring-indigo-500"
                    placeholder="••••••••"
                  />
                </div>
                <Button type="submit" className="w-full h-11 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors mt-2">
                  Se connecter
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <Label htmlFor="register-username" className="text-sm font-medium text-slate-700 mb-1.5 block">Nom d'utilisateur</Label>
                  <Input
                    id="register-username"
                    type="text"
                    required
                    value={registerData.username}
                    onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
                    className="h-11 rounded-xl border-slate-200 focus-visible:ring-indigo-500"
                    placeholder="JohnDoe"
                  />
                </div>
                <div>
                  <Label htmlFor="register-email" className="text-sm font-medium text-slate-700 mb-1.5 block">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    required
                    value={registerData.email}
                    onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                    className="h-11 rounded-xl border-slate-200 focus-visible:ring-indigo-500"
                    placeholder="votre@email.com"
                  />
                </div>
                <div>
                  <Label htmlFor="register-password" className="text-sm font-medium text-slate-700 mb-1.5 block">Mot de passe</Label>
                  <Input
                    id="register-password"
                    type="password"
                    required
                    value={registerData.password}
                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                    className="h-11 rounded-xl border-slate-200 focus-visible:ring-indigo-500"
                    placeholder="••••••••"
                  />
                </div>
                <Button type="submit" className="w-full h-11 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors mt-2">
                  S'inscrire
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          En continuant, vous acceptez nos conditions d'utilisation.
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
