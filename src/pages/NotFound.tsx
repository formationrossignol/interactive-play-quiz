import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";

const NotFound = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Header />
      <div className="flex flex-col items-center justify-center py-32 text-center px-6">
        <p className="text-8xl font-extrabold text-indigo-100 mb-4">404</p>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Page introuvable</h1>
        <p className="text-slate-500 mb-8">La page que vous cherchez n'existe pas.</p>
        <Button
          onClick={() => navigate("/")}
          className="rounded-full bg-indigo-600 text-white font-semibold px-6 hover:bg-indigo-700 transition-colors"
        >
          Retour à l'accueil
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
