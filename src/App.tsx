import { Routes, Route, Navigate } from 'react-router-dom'
import { IdeasProvider } from './hooks/useIdeas'
import Layout from './components/Layout'
import AuthGate from './components/AuthGate'
import Capture from './pages/Capture'
import Dashboard from './pages/Dashboard'
import Ideas from './pages/Ideas'
import Pipeline from './pages/Pipeline'
import Analytics from './pages/Analytics'
import Intel from './pages/Intel'
import PublishQueue from './pages/PublishQueue'

export default function App() {
  return (
    <AuthGate>
      <IdeasProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/capture" replace />} />
            <Route path="/capture" element={<Capture />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/ideas" element={<Ideas />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/queue" element={<PublishQueue />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/intel" element={<Intel />} />
          </Routes>
        </Layout>
      </IdeasProvider>
    </AuthGate>
  )
}
