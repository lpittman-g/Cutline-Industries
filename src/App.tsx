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

export default function App() {
  return (
    <CutlineProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<AppShell />}>
          <Route path="/studio" element={<StudioPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/packs" element={<PacksPage />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="/playbook" element={<PlaybookPage />} />
          <Route path="/autopilot" element={<AutopilotPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </CutlineProvider>
  )
}
