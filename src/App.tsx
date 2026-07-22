import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { initAuth } from "@/lib/auth";
import { RouteTransition } from "@/components/RouteTransition";
import { RouteFallback } from "@/components/RouteFallback";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CookieConsentProvider } from "@/contexts/CookieConsentContext";
import { CookieConsent } from "@/components/CookieConsent";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Critical player path — loaded first, separate chunks from builder deps
const JoinQuiz = lazy(() => import("./pages/JoinQuiz"));
const LiveQuizPage = lazy(() => import("./pages/LiveQuizPage"));

// Landing + auth — loaded on first visit
const Index = lazy(() => import("./pages/Index"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Marketing pages
const Features = lazy(() => import("./pages/Features"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Contact = lazy(() => import("./pages/Contact"));
const About = lazy(() => import("./pages/About"));
const Help = lazy(() => import("./pages/Help"));
const Guides = lazy(() => import("./pages/Guides"));
const Communaute = lazy(() => import("./pages/Communaute"));
const Temoignages = lazy(() => import("./pages/Temoignages"));
const Roadmap = lazy(() => import("./pages/Roadmap"));
const Report = lazy(() => import("./pages/Report"));
const Changelog = lazy(() => import("./pages/Changelog"));
const DiscoverQuizzes = lazy(() => import("./pages/DiscoverQuizzes"));

// Legal pages
const MentionsLegales = lazy(() => import("./pages/MentionsLegales"));
const Confidentialite = lazy(() => import("./pages/Confidentialite"));
const CGU = lazy(() => import("./pages/CGU"));

// Authenticated / builder pages — heavy deps (TipTap, xlsx, dnd-kit)
const QuizBuilder = lazy(() => import("./pages/QuizBuilder"));
const QuizBuilderStart = lazy(() => import("./pages/QuizBuilderStart"));
const MyQuizzes = lazy(() => import("./pages/MyQuizzes"));
const MyPolls = lazy(() => import("./pages/MyPolls"));
const MyFlashcards = lazy(() => import("./pages/MyFlashcards"));
const MySlides = lazy(() => import("./pages/MySlides"));
const MyCourses = lazy(() => import("./pages/MyCourses"));
const CourseBuilder = lazy(() => import("./pages/CourseBuilder"));
const CourseViewer = lazy(() => import("./pages/CourseViewer"));
const MyExams = lazy(() => import("./pages/MyExams"));
const ExamBuilder = lazy(() => import("./pages/ExamBuilder"));
const ExamRoom = lazy(() => import("./pages/ExamRoom"));
const ExamResults = lazy(() => import("./pages/ExamResults"));
const ExamAdmin = lazy(() => import("./pages/ExamAdmin"));
const JoinExam = lazy(() => import("./pages/JoinExam"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const QuestionBank = lazy(() => import("./pages/QuestionBank"));
const PollResults = lazy(() => import("./pages/PollResults"));
const QuizResults = lazy(() => import("./pages/QuizResults"));
const PreviewPage = lazy(() => import("./pages/PreviewPage"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Admin = lazy(() => import("./pages/admin/Admin"));
const PresentationEditorPage = lazy(() => import("./pages/PresentationEditorPage"));

const queryClient = new QueryClient();

/** Blocks route rendering until the Supabase session has been restored,
    so getCurrentUser() is reliable from the first page mount. */
const AuthGate = ({ children }: { children: ReactNode }) => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void initAuth().then(() => setReady(true));
  }, []);
  if (!ready) return null;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CookieConsentProvider>
      <div className="ap-app">
        <Toaster />
        <Sonner />
        <CookieConsent />
        <AuthGate>
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <RouteTransition>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/builder-start" element={<QuizBuilderStart />} />
              <Route path="/builder" element={<QuizBuilder />} />
              <Route path="/my-quizzes" element={<MyQuizzes />} />
              <Route path="/my-polls" element={<MyPolls />} />
              <Route path="/my-flashcards" element={<MyFlashcards />} />
              <Route path="/my-slides" element={<MySlides />} />
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
              <Route path="/guides" element={<Guides />} />
              <Route path="/community" element={<Communaute />} />
              <Route path="/reviews" element={<Temoignages />} />
              <Route path="/roadmap" element={<Roadmap />} />
              <Route path="/report" element={<Report />} />
              <Route path="/changelog" element={<Changelog />} />
              <Route path="/preview/:quizId" element={<PreviewPage />} />
              <Route path="/mentions-legales" element={<MentionsLegales />} />
              <Route path="/confidentialite" element={<Confidentialite />} />
              <Route path="/cgu" element={<CGU />} />
              <Route path="/quiz/:gameCode" element={<LiveQuizPage />} />
              <Route path="/join/:gameCode" element={<JoinQuiz />} />
              <Route path="/join-exam" element={<JoinExam />} />
              <Route path="/join-exam/:joinCode" element={<JoinExam />} />
              <Route path="/my-exams" element={<MyExams />} />
              <Route path="/exam-builder" element={<ExamBuilder />} />
              <Route path="/take/:joinCode" element={<ExamRoom />} />
              <Route path="/exam/:attemptId/results" element={<ExamResults />} />
              <Route path="/exam/:examId/admin" element={<ExamAdmin />} />
              <Route path="/presentation-editor" element={<PresentationEditorPage />} />
              <Route path="/admin" element={<Admin />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </RouteTransition>
          </Suspense>
        </BrowserRouter>
        </AuthGate>
      </div>
      </CookieConsentProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
