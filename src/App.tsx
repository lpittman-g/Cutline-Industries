import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { MissionShell } from './components/MissionShell'
import { PublicShell } from './components/PublicShell'
import { CutlineProvider } from './context/CutlineContext'
import { LandingPage } from './pages/LandingPage'
import { BountyPage } from './pages/thermal/BountyPage'
import { DevelopersPage } from './pages/thermal/DevelopersPage'
import { CheckoutPage } from './pages/thermal/CheckoutPage'
import { FeedbackPage } from './pages/FeedbackPage'
import { ApprovePage } from './pages/ApprovePage'
import { SignupPage } from './pages/auth/SignupPage'
import { SigninPage } from './pages/auth/SigninPage'
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage'
import { RequireMissionControl } from './components/RequireMissionControl'
import { DashboardPage } from './pages/app/DashboardPage'
import { StreamsPage } from './pages/app/StreamsPage'
import { ClipsPage } from './pages/app/ClipsPage'
import { BountyBoardPage } from './pages/app/BountyBoardPage'
import { DevCrmPage } from './pages/app/DevCrmPage'
import { RevenuePage } from './pages/app/RevenuePage'
import { StudioPage } from './pages/StudioPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { PacksPage } from './pages/PacksPage'
import { ExportPage } from './pages/ExportPage'
import { PlaybookPage } from './pages/PlaybookPage'
import { AutopilotPage } from './pages/AutopilotPage'
import { CommandPage } from './pages/CommandPage'
import { OutreachPage } from './pages/OutreachPage'
import { MonetizePage } from './pages/MonetizePage'
import { AdsLabPage } from './pages/AdsLabPage'
import { DealsPage } from './pages/DealsPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { MediaKitPage } from './pages/MediaKitPage'
import { MoneyNowPage } from './pages/MoneyNowPage'
import { PipelinePage } from './pages/PipelinePage'
import { BlogPage } from './pages/BlogPage'
import { Sprint73Page } from './pages/Sprint73Page'
import { BlueprintPage } from './pages/BlueprintPage'

function HideInternal() {
  return <Navigate to="/" replace />
}

export default function App() {
  return (
    <CutlineProvider>
      <Routes>
        {/* Thermal public product */}
        <Route element={<PublicShell />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/bounty" element={<BountyPage />} />
          <Route path="/developers" element={<DevelopersPage />} />
          <Route path="/checkout/:clipId" element={<CheckoutPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/approve" element={<ApprovePage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/signin" element={<SigninPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
        </Route>

        {/* Thermal Mission Control (operator+) */}
        <Route
          path="/app"
          element={
            <RequireMissionControl>
              <MissionShell />
            </RequireMissionControl>
          }
        >
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="streams" element={<StreamsPage />} />
          <Route path="clips" element={<ClipsPage />} />
          <Route path="bounty" element={<BountyBoardPage />} />
          <Route path="developers" element={<DevCrmPage />} />
          <Route path="revenue" element={<RevenuePage />} />
        </Route>

        {/* Cutline processing / legacy Creator OS (engine tools) */}
        <Route path="/os" element={<AppShell />}>
          <Route index element={<Navigate to="/os/command" replace />} />
          <Route path="command" element={<CommandPage />} />
          <Route path="blueprint" element={<BlueprintPage />} />
          <Route path="pipeline" element={<PipelinePage />} />
          <Route path="sprint-73" element={<Sprint73Page />} />
          <Route path="studio" element={<StudioPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="packs" element={<PacksPage />} />
          <Route path="export" element={<ExportPage />} />
          <Route path="playbook" element={<PlaybookPage />} />
          <Route path="autopilot" element={<AutopilotPage />} />
          <Route path="outreach" element={<OutreachPage />} />
          <Route path="monetize" element={<MonetizePage />} />
          <Route path="money-now" element={<MoneyNowPage />} />
          <Route path="ads" element={<AdsLabPage />} />
          <Route path="deals" element={<DealsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="media-kit" element={<MediaKitPage />} />
          <Route path="blog" element={<BlogPage />} />
        </Route>

        <Route path="/command" element={<HideInternal />} />
        <Route path="/blueprint" element={<HideInternal />} />
        <Route path="/pipeline" element={<HideInternal />} />
        <Route path="/sprint-73" element={<HideInternal />} />
        <Route path="/studio" element={<HideInternal />} />
        <Route path="/projects" element={<HideInternal />} />
        <Route path="/packs" element={<HideInternal />} />
        <Route path="/export" element={<HideInternal />} />
        <Route path="/playbook" element={<HideInternal />} />
        <Route path="/autopilot" element={<HideInternal />} />
        <Route path="/outreach" element={<HideInternal />} />
        <Route path="/monetize" element={<HideInternal />} />
        <Route path="/money-now" element={<HideInternal />} />
        <Route path="/ads" element={<HideInternal />} />
        <Route path="/analytics" element={<HideInternal />} />
        <Route path="/work" element={<HideInternal />} />
        <Route path="/media-kit" element={<HideInternal />} />
        <Route path="/blog" element={<HideInternal />} />
        <Route path="/deals" element={<HideInternal />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </CutlineProvider>
  )
}
