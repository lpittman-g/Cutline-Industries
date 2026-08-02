import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { CutlineProvider } from './context/CutlineContext'
import { LandingPage } from './pages/LandingPage'
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

export default function App() {
  return (
    <CutlineProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<AppShell />}>
          <Route path="/command" element={<CommandPage />} />
          <Route path="/blueprint" element={<BlueprintPage />} />
          <Route path="/pipeline" element={<PipelinePage />} />
          <Route path="/sprint-73" element={<Sprint73Page />} />
          <Route path="/studio" element={<StudioPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/packs" element={<PacksPage />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="/playbook" element={<PlaybookPage />} />
          <Route path="/autopilot" element={<AutopilotPage />} />
          <Route path="/outreach" element={<OutreachPage />} />
          <Route path="/monetize" element={<MonetizePage />} />
          <Route path="/money-now" element={<MoneyNowPage />} />
          <Route path="/ads" element={<AdsLabPage />} />
          <Route path="/deals" element={<DealsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/media-kit" element={<MediaKitPage />} />
          <Route path="/blog" element={<BlogPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </CutlineProvider>
  )
}
