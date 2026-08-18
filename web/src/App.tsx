/**
 * The shell: a header carrying the wordmark and the Live/Simulated chip, one nav, and the
 * routed screen. Routes mirror CLAUDE.md §4 one-for-one.
 */
import { NavLink, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { StatusChip } from './components/StatusChip';
import Dashboard from './routes/index';
import Setup from './routes/setup';
import Help from './routes/help';
import Shelters from './routes/shelters';
import Nearby from './routes/nearby';
import Damage from './routes/damage';
import City from './routes/city';
import Styleguide from './routes/styleguide';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/setup', label: 'Register', end: false },
  { to: '/help', label: 'Help', end: false },
  { to: '/shelters', label: 'Shelters', end: false },
  { to: '/nearby', label: 'Nearby', end: false },
  { to: '/damage', label: 'Damage', end: false },
  { to: '/city', label: 'City', end: false },
  { to: '/styleguide', label: 'Style', end: false },
];

export default function App() {
  return (
    <div className="flex min-h-dvh flex-col" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
      {/* The emergency path must be reachable by keyboard without tabbing the whole nav. */}
      <a
        href="#main"
        className="display sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:px-3 focus:py-2"
        style={{ background: 'var(--action)', color: 'var(--paper-raised)' }}
      >
        Skip to content
      </a>

      <header
        className="sticky top-0 z-40 border-b"
        style={{ background: 'var(--bg)', borderColor: 'var(--hairline)' }}
      >
        <div className="mx-auto flex h-14 w-full max-w-[80rem] items-center justify-between px-5">
          <span className="display text-sm tracking-[0.16em]" style={{ fontWeight: 700 }}>
            Nagaranetra
          </span>
          <StatusChip />
        </div>
        <nav aria-label="Sections" className="border-t" style={{ borderColor: 'var(--hairline)' }}>
          <ul className="mx-auto flex w-full max-w-[80rem] gap-4 overflow-x-auto px-5 py-2 text-sm">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className="whitespace-nowrap"
                  style={({ isActive }) => ({
                    color: isActive ? 'var(--fg)' : 'var(--fg-muted)',
                    textDecoration: isActive ? 'underline' : 'none',
                    textUnderlineOffset: '4px',
                  })}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main id="main" className="flex flex-1 flex-col">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/help" element={<Help />} />
          <Route path="/shelters" element={<Shelters />} />
          <Route path="/nearby" element={<Nearby />} />
          <Route path="/damage" element={<Damage />} />
          <Route path="/city" element={<City />} />
          <Route path="/styleguide" element={<Styleguide />} />
        </Routes>
      </main>

      <Toaster position="bottom-center" />
    </div>
  );
}
