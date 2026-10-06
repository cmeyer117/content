import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import PushSubscribeButton from './PushSubscribeButton'

const nav = [
  { to: '/capture', label: 'Capture' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/ideas', label: 'Ideas' },
  { to: '/pipeline', label: 'Pipeline' },
  { to: '/film', label: 'Film' },
  { to: '/queue', label: 'Queue' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/intel', label: 'Intel' },
]

// One nav serves both layouts: a horizontally scrolling bar across the top on phones, the fixed sidebar from md up.
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface flex flex-col md:flex-row">
      <nav className="bg-card border-b md:border-b-0 md:border-r border-border flex flex-row md:flex-col items-center md:items-stretch overflow-x-auto md:overflow-visible p-2 md:p-4 gap-2 shrink-0 md:w-48">
        <p className="hidden md:block text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Content</p>
        <PushSubscribeButton />
        {nav.map(n => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              `px-3 py-2 rounded text-sm whitespace-nowrap transition-colors ${
                isActive ? 'bg-accent text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-border'
              }`
            }
          >
            {n.label}
          </NavLink>
        ))}
      </nav>
      <main className="flex-1 min-w-0 p-3 md:p-6 overflow-auto">{children}</main>
    </div>
  )
}
