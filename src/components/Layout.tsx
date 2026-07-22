import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import PushSubscribeButton from './PushSubscribeButton'

const nav = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/ideas', label: 'Ideas' },
  { to: '/pipeline', label: 'Pipeline' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/intel', label: 'Intel' },
]

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface flex">
      <aside className="w-48 bg-card border-r border-border flex flex-col p-4 gap-2 shrink-0">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Content</p>
        <PushSubscribeButton />
        {nav.map(n => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              `px-3 py-2 rounded text-sm transition-colors ${
                isActive ? 'bg-accent text-white' : 'text-gray-400 hover:text-white hover:bg-border'
              }`
            }
          >
            {n.label}
          </NavLink>
        ))}
      </aside>
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  )
}
