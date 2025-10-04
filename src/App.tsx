import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import QuizBuilder from "./pages/QuizBuilder";
import LiveQuizPage from "./pages/LiveQuizPage";
import JoinQuiz from "./pages/JoinQuiz";
import AuthPage from "./pages/AuthPage";
import MyQuizzes from "./pages/MyQuizzes";
import MyPolls from "./pages/MyPolls";
import DiscoverQuizzes from "./pages/DiscoverQuizzes";
import ProfilePage from "./pages/ProfilePage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/builder" element={<QuizBuilder />} />
          <Route path="/my-quizzes" element={<MyQuizzes />} />
          <Route path="/my-polls" element={<MyPolls />} />
          <Route path="/discover" element={<DiscoverQuizzes />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/quiz/:gameCode" element={<LiveQuizPage />} />
          <Route path="/join/:gameCode" element={<JoinQuiz />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
