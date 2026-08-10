import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { initAuth, getCurrentUser } from "@/lib/auth";
import { applySiteTheme, resolveSiteThemeForPath } from "@/lib/siteTheme";
import { RouteTransition } from "@/components/RouteTransition";
import { RouteFallback } from "@/components/RouteFallback";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CookieConsentProvider } from "@/contexts/CookieConsentContext";
import { CookieConsent } from "@/components/CookieConsent";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { FloatingChronometer } from "@/components/tools/FloatingChronometer";
import { posthog, isPostHogEnabled } from "@/lib/monitoring";

/** Fires a PostHog $pageview on every route change — capture_pageview is off
 *  in monitoring.ts's init() specifically so this is the only trigger,
 *  avoiding the double-count PostHog's own history-API autocapture would
 *  otherwise produce in an SPA. No-ops when PostHog isn't configured. */
const PostHogPageview = () => {
  const location = useLocation();
  useEffect(() => {
    if (isPostHogEnabled()) posthog.capture('$pageview');
  }, [location.pathname, location.search]);
  return null;
};

/** Keeps <html data-theme> in sync on every navigation. Product themes are a
 *  user preference and apply consistently across the application. */
const SiteThemeEnforcer = () => {
  const location = useLocation();
  useEffect(() => {
    applySiteTheme(resolveSiteThemeForPath(location.pathname, getCurrentUser()?.siteTheme));
  }, [location.pathname]);
  return null;
};

// Critical player path — loaded first, separate chunks from builder deps
const JoinQuiz = lazy(() => import("./pages/JoinQuiz"));
const LiveQuizPage = lazy(() => import("./pages/LiveQuizPage"));

// Auth — loaded on first visit
const AuthPage = lazy(() => import("./pages/AuthPage"));
const OnboardingOrgPage = lazy(() => import("./pages/OnboardingOrgPage"));
const InvitePage = lazy(() => import("./pages/InvitePage"));
const OrgInvitations = lazy(() => import("./pages/OrgInvitations"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Public community pages that belong inside the product shell.
const Communaute = lazy(() => import("./pages/Communaute"));
const DiscoverQuizzes = lazy(() => import("./pages/DiscoverQuizzes"));
const Roadmap = lazy(() => import("./pages/Roadmap"));
const Changelog = lazy(() => import("./pages/Changelog"));
const Report = lazy(() => import("./pages/Report"));
const HelpCenter = lazy(() => import("./pages/HelpCenter"));
const Notifications = lazy(() => import("./pages/Notifications"));
const History = lazy(() => import("./pages/History"));
const MyCertificates = lazy(() => import("./pages/MyCertificates"));

// Legal pages: mentions-legales/confidentialite/cgu now live in apps/marketing
// (see docs/marketing-app-decoupling.md) — no longer routed here.

// Authenticated / builder pages — heavy deps (TipTap, xlsx, dnd-kit)
const QuizBuilder = lazy(() => import("./pages/QuizBuilder"));
const QuizBuilderStart = lazy(() => import("./pages/QuizBuilderStart"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const RecentWorksPage = lazy(() => import("./pages/RecentWorksPage"));
const SharedWithMe = lazy(() => import("./pages/SharedWithMe"));
const Groups = lazy(() => import("./pages/Groups"));
const Signatures = lazy(() => import("./pages/Signatures"));
const ManualGrading = lazy(() => import("./pages/ManualGrading"));
const MyGrades = lazy(() => import("./pages/MyGrades"));
const MyQuizzes = lazy(() => import("./pages/MyQuizzes"));
const MyPolls = lazy(() => import("./pages/MyPolls"));
const MyFlashcards = lazy(() => import("./pages/MyFlashcards"));
const MySlides = lazy(() => import("./pages/MySlides"));
const MyCourses = lazy(() => import("./pages/MyCourses"));
const CourseBuilder = lazy(() => import("./pages/CourseBuilder"));
const CourseViewer = lazy(() => import("./pages/CourseViewer"));
const CourseScormReport = lazy(() => import("./pages/CourseScormReport"));
const MyLearningPaths = lazy(() => import("./pages/MyLearningPaths"));
const LearningPathBuilder = lazy(() => import("./pages/LearningPathBuilder"));
const LearningPathViewer = lazy(() => import("./pages/LearningPathViewer"));
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
const PresentationAudience = lazy(() => import("./pages/PresentationAudience"));

// Standalone tools library — independent classroom mini-apps, no auth required
const ToolsLibrary = lazy(() => import("./pages/ToolsLibrary"));
const WheelTool = lazy(() => import("./pages/tools/WheelTool"));
const ChronometerTool = lazy(() => import("./pages/tools/ChronometerTool"));

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

/** apps/app has no route of its own at "/" — in production it's reached
 *  behind apps/marketing's fallback rewrite, whose own home page owns that
 *  URL (see docs/marketing-app-decoupling.md). But dozens of call sites in
 *  this app (AppLayout's logo, AuthPage post-login, "Retour à l'accueil"
 *  buttons, breadcrumb Home buttons…) already assume window.location.href =
 *  "/" lands somewhere real within the app itself — true for direct visits
 *  to the app's own *.vercel.app URL, and needed as a sane fallback
 *  regardless of the marketing split. */
const RootRedirect = () => <Navigate to={getCurrentUser() ? "/dashboard" : "/auth"} replace />;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CookieConsentProvider>
      <div className="ap-app">
        <Sonner />
        <CookieConsent />
        <AuthGate>
        <BrowserRouter>
          <PostHogPageview />
          <SiteThemeEnforcer />
          <Suspense fallback={<RouteFallback />}>
            <RouteTransition>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/onboarding/org" element={<OnboardingOrgPage />} />
              <Route path="/invite/:token" element={<InvitePage />} />
              <Route path="/org/invitations" element={<OrgInvitations />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/builder-start" element={<QuizBuilderStart />} />
              <Route path="/builder" element={<QuizBuilder />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/recent" element={<RecentWorksPage />} />
              <Route path="/shared-with-me" element={<SharedWithMe />} />
              <Route path="/groups" element={<Groups />} />
              <Route path="/signatures" element={<Signatures />} />
              <Route path="/grading" element={<ManualGrading />} />
              <Route path="/my-grades" element={<MyGrades />} />
              <Route path="/my-quizzes" element={<MyQuizzes />} />
              <Route path="/my-polls" element={<MyPolls />} />
              <Route path="/my-flashcards" element={<MyFlashcards />} />
              <Route path="/my-slides" element={<MySlides />} />
              <Route path="/my-courses" element={<MyCourses />} />
              <Route path="/course-builder" element={<CourseBuilder />} />
              <Route path="/course/:courseId" element={<CourseViewer />} />
              <Route path="/course/:courseId/scorm-report/:lessonId" element={<CourseScormReport />} />
              <Route path="/my-learning-paths" element={<MyLearningPaths />} />
              <Route path="/learning-path-builder" element={<LearningPathBuilder />} />
              <Route path="/learning-path/:pathId" element={<LearningPathViewer />} />
              <Route path="/discover" element={<DiscoverQuizzes />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/question-bank" element={<QuestionBank />} />
              <Route path="/poll-results/:pollId" element={<PollResults />} />
              <Route path="/quiz-results/:quizId" element={<QuizResults />} />
              <Route path="/community" element={<Communaute />} />
              <Route path="/roadmap" element={<Roadmap />} />
              <Route path="/changelog" element={<Changelog />} />
              <Route path="/report" element={<Report />} />
              <Route path="/help" element={<HelpCenter />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/history" element={<History />} />
              <Route path="/certificates" element={<MyCertificates />} />
              <Route path="/preview/:quizId" element={<PreviewPage />} />
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
              <Route path="/presentation-audience" element={<PresentationAudience />} />
              <Route path="/tools" element={<ToolsLibrary />} />
              <Route path="/tools/wheel" element={<WheelTool />} />
              <Route path="/tools/chronometre" element={<ChronometerTool />} />
              <Route path="/admin" element={<Admin />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </RouteTransition>
          </Suspense>
          <FloatingChronometer />
        </BrowserRouter>
        </AuthGate>
      </div>
      </CookieConsentProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
