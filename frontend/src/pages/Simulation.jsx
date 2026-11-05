import React, { useState, useEffect, useMemo } from 'react';
import { ThermometerSun, CloudRain, SlidersHorizontal, RotateCcw, RefreshCw } from 'lucide-react';
import { ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { hydroService } from '../services/hydroService';

const DAMS = ['Al Wahda', 'Al Massira', 'Bin El Ouidane', 'Idriss Ier', 'Oued El Makhazine', 'Mansour Eddahbi'];

const DEFAULT_TEMP = 2;
const DEFAULT_RAIN = 50;

const toApiRain = (pct) => pct / 100;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

const formatShort = (s) => {
  const [, m, d] = String(s).split('-');
  return d && m ? `${d}/${m}` : s;
};

const formatFull = (s) => {
  const [y, m, d] = String(s).split('-');
  return y && m && d ? `${d}/${m}/${y}` : s;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const rows = payload.filter((entry) => isNum(entry.value));
  if (!rows.length) return null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 rounded-md shadow-lg min-w-[220px]">
      <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 mb-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        {formatFull(label)}
      </p>
      <div className="space-y-2">
        {rows.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-6 text-sm">
            <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {entry.value.toFixed(2)} %
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function Simulation() {
  const [selectedDam, setSelectedDam] = useState(DAMS[0]);
  const [chartData, setChartData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [tempDelta, setTempDelta] = useState(DEFAULT_TEMP);
  const [rainPct, setRainPct] = useState(DEFAULT_RAIN);
  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const [baseData, crisisData] = await Promise.all([
          hydroService.getPredictions(selectedDam, 0, toApiRain(100)),
          hydroService.getPredictions(selectedDam, tempDelta, toApiRain(rainPct)),
        ]);
        if (cancelled) return;

        const stressByDate = new Map(crisisData.map((d) => [d.date, d.prevision]));
        setChartData(
          baseData.map((day) => ({
            ...day,
            stress: stressByDate.has(day.date) ? stressByDate.get(day.date) : null,
          }))
        );
        setError(null);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setChartData([]);
          setError('Impossible de calculer la simulation.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedDam, tempDelta, rainPct, reloadKey]);

  const summary = useMemo(() => {
    const last = [...chartData]
      .reverse()
      .find((d) => !isNum(d.historique) && isNum(d.prevision) && isNum(d.stress));
    if (!last) return null;
    return {
      date: last.date,
      normal: last.prevision,
      stress: last.stress,
      gap: last.stress - last.prevision,
    };
  }, [chartData]);

  const isDefault = tempDelta === DEFAULT_TEMP && rainPct === DEFAULT_RAIN;

  const resetParams = () => {
    setTempDelta(DEFAULT_TEMP);
    setRainPct(DEFAULT_RAIN);
  };

  const colors = {
    hist: isDarkMode ? '#cbd5e1' : '#334155',
    normal: isDarkMode ? '#38bdf8' : '#0369a1',
    stress: isDarkMode ? '#fbbf24' : '#d97706',
    grid: isDarkMode ? '#1e293b' : '#e2e8f0',
    axis: isDarkMode ? '#94a3b8' : '#64748b',
    dotFill: isDarkMode ? '#0f172a' : '#ffffff',
  };

  const rainLabel =
    rainPct === 100 ? 'Normale' : rainPct === 0 ? 'Aucune pluie' : `${rainPct} % de la normale`;

  const gapColor = !summary || summary.gap === 0
    ? 'text-slate-900 dark:text-slate-100'
    : summary.gap > 0
      ? 'text-emerald-700 dark:text-emerald-400'
      : 'text-amber-700 dark:text-amber-400';

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-1">Simulation de scénarios</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Comparer la prévision normale à un scénario de pluie réduite et de chaleur accrue sur les jours à venir
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="sim-dam" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Barrage
          </label>
          <select
            id="sim-dam"
            value={selectedDam}
            onChange={(e) => setSelectedDam(e.target.value)}
            className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm font-medium rounded-md px-3 py-2.5 focus:outline-none focus:border-sky-700 focus:ring-1 focus:ring-sky-700 cursor-pointer"
          >
            {DAMS.map((dam) => (
              <option key={dam} value={dam}>{dam}</option>
            ))}
          </select>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-2/3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 sm:p-6 relative">
          <div className="h-[420px] md:h-[480px] w-full relative">
            {isLoading && (
              <div className="absolute inset-0 z-10 bg-white/80 dark:bg-slate-900/80 flex flex-col items-center justify-center">
                <div className="w-10 h-10 border-4 border-slate-200 dark:border-slate-700 border-t-sky-700 rounded-full animate-spin mb-3"></div>
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Calcul de la simulation…</span>
              </div>
            )}

            {error && !isLoading && (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4">
                <p className="text-slate-700 dark:text-slate-300 font-medium">{error}</p>
                <button
                  onClick={() => setReloadKey((k) => k + 1)}
                  className="flex items-center gap-2 bg-sky-700 hover:bg-sky-800 text-white px-4 py-2.5 rounded-md text-sm font-semibold transition-colors"
                >
                  <RefreshCw size={16} />
                  Réessayer
                </button>
              </div>
            )}

            {!error && (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 16, left: 4, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.grid} />

                  <XAxis
                    dataKey="date"
                    tickFormatter={formatShort}
                    tick={{ fill: colors.axis, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    dy={8}
                  />

                  <YAxis
                    domain={['auto', 'auto']}
                    width={56}
                    tick={{ fill: colors.axis, fontSize: 12 }}
                    tickFormatter={(val) => `${val.toFixed(1)} %`}
                    axisLine={false}
                    tickLine={false}
                  />

                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ stroke: colors.axis, strokeWidth: 1, strokeDasharray: '4 4' }}
                  />

                  <Legend
                    iconType="plainline"
                    wrapperStyle={{ paddingTop: 16, fontSize: 12, color: colors.axis }}
                  />

                  <Area
                    type="monotone"
                    dataKey="historique"
                    name="Historique mesuré"
                    stroke={colors.hist}
                    strokeWidth={2.5}
                    fillOpacity={0}
                    dot={false}
                    activeDot={{ r: 4, fill: colors.hist, stroke: colors.dotFill, strokeWidth: 2 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="prevision"
                    name="Prévision normale"
                    stroke={colors.normal}
                    strokeWidth={2.5}
                    strokeDasharray="6 5"
                    fillOpacity={0}
                    dot={{ r: 3, strokeWidth: 2, fill: colors.dotFill, stroke: colors.normal }}
                    activeDot={{ r: 5, fill: colors.normal, stroke: colors.dotFill, strokeWidth: 2 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="stress"
                    name="Scénario simulé"
                    stroke={colors.stress}
                    strokeWidth={2.5}
                    fill={colors.stress}
                    fillOpacity={isDarkMode ? 0.18 : 0.1}
                    dot={{ r: 3, strokeWidth: 2, fill: colors.dotFill, stroke: colors.stress }}
                    activeDot={{ r: 5, fill: colors.stress, stroke: colors.dotFill, strokeWidth: 2 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="w-full lg:w-1/3">
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-sky-700 dark:text-sky-400" />
                Paramètres
              </h3>
              <button
                onClick={resetParams}
                disabled={isDefault}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <RotateCcw size={13} />
                Réinitialiser
              </button>
            </div>

            <div>
              <div className="flex justify-between items-center text-sm mb-3">
                <label htmlFor="temp-range" className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
                  <ThermometerSun size={16} className="text-amber-600 dark:text-amber-400" />
                  Hausse de température
                </label>
                <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">+{tempDelta} °C</span>
              </div>
              <input
                id="temp-range"
                type="range"
                min="0"
                max="5"
                step="0.5"
                value={tempDelta}
                onChange={(e) => setTempDelta(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-600"
              />
            </div>

            <div>
              <div className="flex justify-between items-center text-sm mb-3">
                <label htmlFor="rain-range" className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
                  <CloudRain size={16} className="text-sky-600 dark:text-sky-400" />
                  Pluviométrie
                </label>
                <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{rainLabel}</span>
              </div>
              <input
                id="rain-range"
                type="range"
                min="0"
                max="200"
                step="10"
                value={rainPct}
                onChange={(e) => setRainPct(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-700"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1.5">
                <span>0 %</span>
                <span>100 % = normale</span>
                <span>200 %</span>
              </div>
            </div>

            {summary && !error && (
              <div className="pt-5 border-t border-slate-200 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Résultat au {formatFull(summary.date)}
                </p>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-600 dark:text-slate-400">Prévision normale</dt>
                    <dd className="font-semibold tabular-nums text-sky-700 dark:text-sky-400">{summary.normal.toFixed(2)} %</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-600 dark:text-slate-400">Scénario simulé</dt>
                    <dd className="font-semibold tabular-nums text-amber-600 dark:text-amber-400">{summary.stress.toFixed(2)} %</dd>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                    <dt className="text-slate-600 dark:text-slate-400">Écart</dt>
                    <dd className={`font-semibold tabular-nums ${gapColor}`}>
                      {summary.gap > 0 ? '+' : ''}{summary.gap.toFixed(2)} pt
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Les paramètres s’appliquent uniquement aux jours à venir, pas à la météo déjà observée. Le modèle
              HGB recalcule la trajectoire jour par jour. Les écarts restent donc limités sur un horizon de 7 jours.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}