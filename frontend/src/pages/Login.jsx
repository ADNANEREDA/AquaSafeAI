import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const FONT = {
  fontFamily: "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
};

const HIGHLIGHTS = [
  { value: '6', label: 'barrages suivis' },
  { value: '+7 jours', label: 'de prévision' },
  { value: '2', label: 'paramètres de simulation : pluie et température' },
];

export default function Welcome() {
  return (
    <div
      style={FONT}
      className="relative min-h-screen w-full flex flex-col bg-slate-950 text-white overflow-hidden"
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/barrage.jpg')" }}
      ></div>
      <div className="absolute inset-0 bg-slate-950/75"></div>
      <div className="absolute inset-x-0 bottom-0 h-1.5 bg-sky-600"></div>

      <header className="relative z-10 w-full max-w-6xl mx-auto px-6 sm:px-10 pt-8 flex items-center gap-3">
        <img
          src="/logo-mri-water.svg"
          alt="AquaSafe AI"
          className="h-10 w-auto"
          draggable={false}
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
        <span className="text-lg font-semibold tracking-tight">
          AquaSafe <span className="text-sky-400">AI</span>
        </span>
      </header>

      <main className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-6 sm:px-10 flex items-center">
        <div className="max-w-2xl py-12">
          <p className="flex items-center gap-3 text-sm font-medium text-slate-300 mb-5">
            <span className="w-8 h-0.5 bg-sky-500"></span>
            Suivi hydrologique du Maroc
          </p>

          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-tight mb-5">
            Bienvenue sur AquaSafe AI
          </h1>

          <p className="text-lg text-slate-300 leading-relaxed mb-9 max-w-xl">
            Consultez le taux de remplissage des barrages, visualisez-les sur la carte et
            comparez la prévision à un scénario de pluie réduite ou de chaleur accrue.
          </p>

          <Link
            to="/overview"
            className="inline-flex items-center gap-2.5 bg-sky-700 hover:bg-sky-600 text-white font-semibold px-6 py-3.5 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Accéder au tableau de bord
            <ArrowRight size={18} />
          </Link>

          <dl className="mt-14 pt-6 border-t border-white/15 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {HIGHLIGHTS.map((item) => (
              <div key={item.label}>
                <dt className="text-2xl font-semibold tabular-nums text-white">{item.value}</dt>
                <dd className="text-sm text-slate-400 mt-1">{item.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </main>

      <footer className="relative z-10 w-full max-w-6xl mx-auto px-6 sm:px-10 pb-8 text-xs text-slate-400">
        © {new Date().getFullYear()} AquaSafe AI.
      </footer>
    </div>
  );
}