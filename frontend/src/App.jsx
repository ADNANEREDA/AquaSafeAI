import React, { Component, useEffect, useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
  Navigate,
  Link,
  Outlet,
  useLocation,
} from 'react-router-dom';
import { LayoutGrid, Map as MapIcon, Activity, SlidersHorizontal, Sun, Moon } from 'lucide-react';
import { Toaster } from 'react-hot-toast';

import Overview from './pages/Overview';
import SpatialMap from './pages/SpatialMap';
import Predictions from './pages/Predictions';
import Simulation from './pages/Simulation';
import Welcome from './pages/Login';
import './App.css';

try {
  if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.classList.add('dark');
  }
  localStorage.removeItem('mri_user');
} catch {}

const LOGO_SRC = '/logo-mri-water.svg';

const FONT = {
  fontFamily: "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
};

const NAV_ITEMS = [
  { to: '/overview', label: "Vue d'ensemble", icon: LayoutGrid },
  { to: '/map', label: 'Carte', icon: MapIcon },
  { to: '/ml', label: 'Prévisions', icon: Activity },
  { to: '/simulation', label: 'Simulation', icon: SlidersHorizontal },
];

class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Erreur d’affichage :', error, info);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center gap-3">
        <p className="text-slate-800 dark:text-slate-200 font-semibold">
          Une erreur est survenue sur cette page.
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md break-words">
          {String(this.state.error?.message || this.state.error)}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 bg-sky-700 hover:bg-sky-800 text-white px-4 py-2.5 rounded-md text-sm font-semibold transition-colors"
        >
          Recharger la page
        </button>
      </div>
    );
  }
}

function TopNav() {
  const [dark, setDark] = useState(document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const observer = new MutationObserver(() =>
      setDark(document.documentElement.classList.contains('dark'))
    );
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {}
    setDark(next);
  };

  return (
    <header className="sticky top-0 z-[1100] w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
        <Link to="/overview" className="shrink-0 flex items-center gap-2.5">
          <img
            src={LOGO_SRC}
            alt="AquaSafe AI"
            className="h-8 w-auto object-contain"
            draggable={false}
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
          <span className="font-semibold text-lg text-slate-900 dark:text-slate-100 tracking-tight hidden sm:block">
            AquaSafe <span className="text-sky-600 dark:text-sky-400">AI</span>
          </span>
        </Link>

        <nav className="flex items-stretch h-full gap-1" aria-label="Navigation principale">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={label}
              aria-label={label}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 sm:px-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'text-sky-700 dark:text-sky-400 border-sky-700 dark:border-sky-400'
                    : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-slate-100'
                }`
              }
            >
              <Icon size={18} />
              <span className="hidden md:inline">{label}</span>
            </NavLink>
          ))}
        </nav>

        <button
          onClick={toggleTheme}
          aria-label={dark ? 'Passer au thème clair' : 'Passer au thème sombre'}
          title={dark ? 'Thème clair' : 'Thème sombre'}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
}

function Layout() {
  const { pathname } = useLocation();
  return (
    <div
      style={FONT}
      className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 flex flex-col"
    >
      <TopNav />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6">
        <ErrorBoundary resetKey={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#0f172a',
            color: '#f8fafc',
            border: '1px solid #334155',
            borderRadius: '6px',
            fontSize: '14px',
            fontFamily: FONT.fontFamily,
          },
          success: { iconTheme: { primary: '#0369a1', secondary: '#f8fafc' } },
        }}
      />

      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route element={<Layout />}>
          <Route path="/overview" element={<Overview />} />
          <Route path="/map" element={<SpatialMap />} />
          <Route path="/ml" element={<Predictions />} />
          <Route path="/simulation" element={<Simulation />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;