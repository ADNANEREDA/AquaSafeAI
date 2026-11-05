import React, { useState, useEffect, useMemo } from 'react';
import { MapPin, Calendar, CloudRain, Thermometer, Download, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { hydroService } from '../services/hydroService';

const BARRAGES = [
  'Al Wahda', 'Al Massira', 'Bin El Ouidane',
  'Idriss Ier', 'Oued El Makhazine', 'Mansour Eddahbi',
];

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

  const data = payload[0].payload;
  const lines = payload.filter(
    (entry) => (entry.dataKey === 'historique' || entry.dataKey === 'prevision') && isNum(entry.value)
  );

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 rounded-md shadow-lg min-w-[210px]">
      <p className="font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-sm">
        <Calendar size={15} className="text-slate-500" />
        {formatFull(label)}
      </p>

      <div className="space-y-2">
        {lines.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-6">
            <span className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <span className="font-semibold text-sm tabular-nums text-slate-900 dark:text-slate-100">
              {entry.value.toFixed(2)} %
            </span>
          </div>
        ))}
      </div>

      {isNum(data.prevision_low) && isNum(data.prevision_high) && (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Intervalle : {data.prevision_low.toFixed(1)} % à {data.prevision_high.toFixed(1)} %
        </p>
      )}

      {(isNum(data.rain) || isNum(data.temp)) && (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex gap-2">
          {isNum(data.rain) && (
            <div className="flex-1 flex justify-center items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 py-1.5 rounded">
              <CloudRain size={13} className="text-sky-600 dark:text-sky-400" /> {data.rain} mm
            </div>
          )}
          {isNum(data.temp) && (
            <div className="flex-1 flex justify-center items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 py-1.5 rounded">
              <Thermometer size={13} className="text-amber-600 dark:text-amber-400" /> {data.temp} °C
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function Predictions() {
  const [selectedDam, setSelectedDam] = useState(BARRAGES[0]);
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
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
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const apiData = await hydroService.getPredictions(selectedDam);
        if (!cancelled) setData(apiData);
      } catch {
        if (!cancelled) {
          setData([]);
          setError('Impossible de charger les données du modèle.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [selectedDam, reloadKey]);

  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        band: isNum(d.prevision_low) && isNum(d.prevision_high) ? [d.prevision_low, d.prevision_high] : null,
      })),
    [data]
  );

  const summary = useMemo(() => {
    if (!data.length) return null;
    const reversed = [...data].reverse();
    const lastObs = reversed.find((d) => isNum(d.historique));
    const lastPred = reversed.find((d) => isNum(d.prevision_high));
    if (!lastObs || !lastPred) return null;
    return {
      obsDate: lastObs.date,
      obsValue: lastObs.historique,
      predDate: lastPred.date,
      predValue: lastPred.prevision,
      low: lastPred.prevision_low,
      high: lastPred.prevision_high,
      delta: lastPred.prevision - lastObs.historique,
    };
  }, [data]);

  const exportToCSV = () => {
    if (!data || data.length === 0) {
      toast.error('Aucune donnée à exporter.');
      return;
    }

    try {
      const headers = ['Date', 'Taux Historique (%)', 'Taux Prevision (%)', 'Temperature (°C)', 'Pluie (mm)'];
      const toFr = (v) => (v !== undefined && v !== null ? String(v).replace('.', ',') : '');

      const rows = data.map((d) => {
        const historique = toFr(d.historique);
        const prevision = toFr(d.prevision);
        const temp = toFr(d.temp);
        let rainValue = toFr(d.rain);
        if (rainValue === '' && prevision !== '') rainValue = '0';
        return [d.date, historique, prevision, temp, rainValue].join(';');
      });

      const csv = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `Previsions_${selectedDam.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Fichier CSV exporté.');
    } catch {
      toast.error("Erreur lors de l'exportation CSV.");
    }
  };

  const colors = {
    hist: isDarkMode ? '#cbd5e1' : '#334155',
    pred: isDarkMode ? '#38bdf8' : '#0369a1',
    grid: isDarkMode ? '#1e293b' : '#e2e8f0',
    axis: isDarkMode ? '#94a3b8' : '#64748b',
    dotFill: isDarkMode ? '#0f172a' : '#ffffff',
  };

  const deltaText = summary
    ? `${summary.delta > 0 ? '+' : ''}${summary.delta.toFixed(2)} pt`
    : '';

  const deltaColor = !summary || summary.delta === 0
    ? 'text-slate-900 dark:text-slate-100'
    : summary.delta > 0
      ? 'text-emerald-700 dark:text-emerald-400'
      : 'text-amber-700 dark:text-amber-400';

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-1">
          Prévision du taux de remplissage
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Modèle HistGradientBoosting · horizon de 7 jours · météo observée et prévue
        </p>
      </header>

      <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center gap-4">
        <label htmlFor="dam-select" className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <MapPin size={16} className="text-sky-700 dark:text-sky-400" />
          Barrage
        </label>
        <select
          id="dam-select"
          value={selectedDam}
          onChange={(e) => setSelectedDam(e.target.value)}
          className="flex-1 sm:max-w-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm font-medium rounded-md px-3 py-2.5 focus:outline-none focus:border-sky-700 focus:ring-1 focus:ring-sky-700 cursor-pointer"
        >
          {BARRAGES.map((dam) => (
            <option key={dam} value={dam}>{dam}</option>
          ))}
        </select>

        <button
          onClick={exportToCSV}
          disabled={isLoading || !data.length}
          className="sm:ml-auto flex items-center justify-center gap-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 px-4 py-2.5 rounded-md text-sm font-semibold border border-slate-300 dark:border-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={16} />
          Exporter en CSV
        </button>
      </div>

      {summary && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Dernière mesure · {formatFull(summary.obsDate)}</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
              {summary.obsValue.toFixed(2)} %
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Prévision · {formatFull(summary.predDate)}</p>
            <p className="text-2xl font-semibold text-sky-700 dark:text-sky-400 tabular-nums">
              {summary.predValue.toFixed(2)} %
            </p>
            {isNum(summary.low) && isNum(summary.high) && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                Intervalle {summary.low.toFixed(1)} % à {summary.high.toFixed(1)} %
              </p>
            )}
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Variation attendue</p>
            <p className={`text-2xl font-semibold tabular-nums ${deltaColor}`}>{deltaText}</p>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {selectedDam}
          </h2>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-2">
              <span className="w-5 h-0.5" style={{ backgroundColor: colors.hist }}></span>
              Historique mesuré
            </span>
            <span className="flex items-center gap-2">
              <span className="w-5 border-t-2 border-dashed" style={{ borderColor: colors.pred }}></span>
              Prévision
            </span>
            <span className="flex items-center gap-2">
              <span className="w-4 h-3 rounded-sm" style={{ backgroundColor: colors.pred, opacity: 0.18 }}></span>
              Intervalle de confiance
            </span>
          </div>
        </div>

        <div className="p-4 sm:p-6 h-[420px] md:h-[500px] w-full relative">
          {isLoading && (
            <div className="absolute inset-0 z-10 bg-white/85 dark:bg-slate-900/85 flex flex-col items-center justify-center">
              <div className="w-10 h-10 border-4 border-slate-200 dark:border-slate-700 border-t-sky-700 rounded-full animate-spin mb-3"></div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Calcul de la prévision…</p>
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
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatShort}
                  tick={{ fill: colors.axis, fontSize: 12 }}
                  dy={8}
                />

                <YAxis
                  domain={['auto', 'auto']}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                  tick={{ fill: colors.axis, fontSize: 12 }}
                  tickFormatter={(val) => `${val.toFixed(1)} %`}
                />

                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ stroke: colors.axis, strokeWidth: 1, strokeDasharray: '4 4' }}
                />

                {summary && (
                  <ReferenceLine
                    x={summary.obsDate}
                    stroke={colors.axis}
                    strokeDasharray="2 4"
                    label={{ value: 'Dernière mesure', position: 'insideTopLeft', fill: colors.axis, fontSize: 11 }}
                  />
                )}

                <Area
                  type="monotone"
                  dataKey="band"
                  stroke="none"
                  fill={colors.pred}
                  fillOpacity={isDarkMode ? 0.22 : 0.15}
                  activeDot={false}
                  isAnimationActive={false}
                />

                <Line
                  type="monotone"
                  dataKey="historique"
                  name="Historique"
                  stroke={colors.hist}
                  strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 2, fill: colors.dotFill, stroke: colors.hist }}
                  activeDot={{ r: 5, fill: colors.hist, stroke: colors.dotFill, strokeWidth: 2 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="prevision"
                  name="Prévision"
                  stroke={colors.pred}
                  strokeWidth={2.5}
                  strokeDasharray="6 5"
                  dot={{ r: 3, strokeWidth: 2, fill: colors.dotFill, stroke: colors.pred }}
                  activeDot={{ r: 5, fill: colors.pred, stroke: colors.dotFill, strokeWidth: 2 }}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}