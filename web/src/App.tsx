/**
 * The shell: a header carrying the wordmark and the Live/Simulated chip, one nav, and the
 * routed screen. Routes mirror CLAUDE.md §4 one-for-one.
 */
import { Suspense, lazy } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { StatusChip } from './components/StatusChip';
import Dashboard from './routes/index';
import Help from './routes/help';

/*
 * The dashboard and the help screen load eagerly: one is where a resident lands, the other
 * is the emergency path, and neither may wait on a second request.
 *
 * Everything else is split. Setup alone pulls in Leaflet, which is dead weight on every
 * screen that is not a map — a single bundle came to 935 kB, and parsing that on a
 * mid-range phone costs real time before anything is on screen.
 */
const Setup = lazy(() => import('./routes/setup'));
const Shelters = lazy(() => import('./routes/shelters'));
const Nearby = lazy(() => import('./routes/nearby'));
const Damage = lazy(() => import('./routes/damage'));
const City = lazy(() => import('./routes/city'));
const Styleguide = lazy(() => import('./routes/styleguide'));

/**
 * The header carries only what a resident needs during an event. Eight equal links did not
 * fit a phone — the row clipped mid-word — and a nav that competes with the screen's one
 * idea is chrome doing content's job.
 */
const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/help', label: 'Help', end: false },
  { to: '/shelters', label: 'Shelters', end: false },
  { to: '/nearby', label: 'Nearby', end: false },
];

/** Reachable, but not competing: registration is a one-time flow, and the last two are
 *  for us and for the jury rather than for a resident. */
const SECONDARY = [
  { to: '/setup', label: 'Register your household' },
  { to: '/damage', label: 'Report damage' },
  { to: '/city', label: 'City dashboard' },
  { to: '/styleguide', label: 'Design system' },
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
        <div
          className="mx-auto flex h-14 w-full max-w-[80rem] items-center justify-between"
          style={{ padding: '0 var(--gutter)' }}
        >
          <span
            className="display"
            style={{ fontSize: 'var(--size-caption)', letterSpacing: '0.16em', fontWeight: 700 }}
          >
            Nagaranetra
          </span>
          <StatusChip />
        </div>
        <nav aria-label="Sections" className="ng-nav border-t" style={{ borderColor: 'var(--hairline)' }}>
          <ul
            className="mx-auto flex w-full max-w-[80rem] overflow-x-auto"
            style={{ gap: 'var(--space-md)', padding: 'var(--space-sm) var(--gutter)' }}
          >
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main id="main" className="flex flex-1 flex-col">
        <Suspense
          fallback={
            <p className="mx-auto w-full max-w-[46rem] px-5 py-8" style={{ color: 'var(--fg-muted)' }}>
              Loading…
            </p>
          }
        >
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
        </Suspense>
      </main>

      <footer
        className="ng-nav mt-auto border-t"
        style={{ borderColor: 'var(--hairline)' }}
      >
        <ul
          className="mx-auto flex w-full max-w-[80rem] flex-wrap"
          style={{ gap: 'var(--space-md)', padding: 'var(--space-md) var(--gutter)' }}
        >
          {SECONDARY.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to}>{item.label}</NavLink>
            </li>
          ))}
        </ul>
      </footer>

      <Toaster position="bottom-center" />
    </div>
  );
}
