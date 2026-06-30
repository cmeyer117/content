import { Routes, Route, Navigate } from 'react-router-dom'
import { IdeasProvider } from './hooks/useIdeas'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Ideas from './pages/Ideas'
import Pipeline from './pages/Pipeline'
import Analytics from './pages/Analytics'

export default function App() {
  return (
    <IdeasProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/ideas" element={<Ideas />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/analytics" element={<Analytics />} />
        </Routes>
      </Layout>
    </IdeasProvider>
  )
}
