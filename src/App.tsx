import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import QuizBuilder from "./pages/QuizBuilder";
import QuizBuilderStart from "./pages/QuizBuilderStart";
import LiveQuizPage from "./pages/LiveQuizPage";
import JoinQuiz from "./pages/JoinQuiz";
import AuthPage from "./pages/AuthPage";
import MyQuizzes from "./pages/MyQuizzes";
import MyPolls from "./pages/MyPolls";
import MyFlashcards from "./pages/MyFlashcards";
import MyCourses from "./pages/MyCourses";
import CourseBuilder from "./pages/CourseBuilder";
import CourseViewer from "./pages/CourseViewer";
import DiscoverQuizzes from "./pages/DiscoverQuizzes";
import ProfilePage from "./pages/ProfilePage";
import QuestionBank from "./pages/QuestionBank";
import Features from "./pages/Features";
import Pricing from "./pages/Pricing";
import Contact from "./pages/Contact";
import About from "./pages/About";
import PollResults from "./pages/PollResults";
import QuizResults from "./pages/QuizResults";
import Help from "./pages/Help";
import PreviewPage from "./pages/PreviewPage";
import MentionsLegales from "./pages/MentionsLegales";
import Confidentialite from "./pages/Confidentialite";
import CGU from "./pages/CGU";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <div className="ap-app">
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/builder-start" element={<QuizBuilderStart />} />
          <Route path="/builder" element={<QuizBuilder />} />
          <Route path="/my-quizzes" element={<MyQuizzes />} />
          <Route path="/my-polls" element={<MyPolls />} />
          <Route path="/my-flashcards" element={<MyFlashcards />} />
          <Route path="/my-courses" element={<MyCourses />} />
          <Route path="/course-builder" element={<CourseBuilder />} />
          <Route path="/course/:courseId" element={<CourseViewer />} />
          <Route path="/discover" element={<DiscoverQuizzes />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/question-bank" element={<QuestionBank />} />
          <Route path="/features" element={<Features />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/about" element={<About />} />
          <Route path="/poll-results/:pollId" element={<PollResults />} />
          <Route path="/quiz-results/:quizId" element={<QuizResults />} />
          <Route path="/help" element={<Help />} />
          <Route path="/preview/:quizId" element={<PreviewPage />} />
          <Route path="/mentions-legales" element={<MentionsLegales />} />
          <Route path="/confidentialite" element={<Confidentialite />} />
          <Route path="/cgu" element={<CGU />} />
          <Route path="/quiz/:gameCode" element={<LiveQuizPage />} />
          <Route path="/join/:gameCode" element={<JoinQuiz />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      </div>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
