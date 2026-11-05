import React, { useState, useEffect, useCallback } from 'react';
import { Droplets, TrendingDown, TrendingUp, AlertTriangle, Activity, ArrowRight, FileText, MapPin, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';

const API_URL = 'http://localhost:8000';

const DAMS_INFO_BASE = [
  { id: 1, name: 'Al Wahda', capacity: 3800, bassin: 'Sebou', region: 'Fès-Meknès' },
  { id: 2, name: 'Al Massira', capacity: 2657, bassin: 'Oum Er-Rbia', region: 'Marrakech-Safi' },
  { id: 3, name: 'Bin El Ouidane', capacity: 1253, bassin: 'Oum Er-Rbia', region: 'Béni Mellal-Khénifra' },
  { id: 4, name: 'Idriss Ier', capacity: 1186, bassin: 'Sebou', region: 'Fès-Meknès' },
  { id: 5, name: 'Oued El Makhazine', capacity: 674, bassin: 'Loukkos', region: 'Tanger-Tétouan-Al Hoceïma' },
  { id: 6, name: 'Mansour Eddahbi', capacity: 428, bassin: 'Drâa-Oued Noun', region: 'Drâa-Tafilalet' },
];

const STATUS = {
  critical: { label: 'Critique', text: 'text-red-700 dark:text-red-400', bar: 'bg-red-600 dark:bg-red-500' },
  warning: { label: 'Alerte', text: 'text-amber-700 dark:text-amber-400', bar: 'bg-amber-500 dark:bg-amber-500' },
  good: { label: 'Normal', text: 'text-emerald-700 dark:text-emerald-400', bar: 'bg-emerald-600 dark:bg-emerald-500' },
};

const getStatus = (fill) => (fill <= 40 ? 'critical' : fill <= 60 ? 'warning' : 'good');

const KpiCard = ({ title, value, unit, subtitle, icon: Icon, trend, trendValue, variant = 'primary' }) => {
  const isPositive = trendValue > 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;
  const trendClass = isPositive
    ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900'
    : 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900';

  const iconClass = variant === 'danger'
    ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
    : 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400';

  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2.5 rounded-md ${iconClass}`}>
          <Icon size={20} />
        </div>
        {trend && (
          <span className={`flex items-center text-xs font-semibold px-2 py-1 rounded border ${trendClass}`}>
            <TrendIcon size={13} className="mr-1" />
            {trend}
          </span>
        )}
      </div>
      <h3 className="text-slate-600 dark:text-slate-400 font-medium text-sm mb-1">{title}</h3>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">{value}</span>
        <span className="text-base text-slate-500">{unit}</span>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-500 mt-1.5">{subtitle}</p>
    </div>
  );
};

export default function Overview() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [damsData, setDamsData] = useState([]);

  const fetchCurrentLevels = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch(`${API_URL}/current-levels`);
      if (!response.ok) throw new Error('Erreur réseau');
      const apiData = await response.json();

      const mergedData = DAMS_INFO_BASE.map((dam) => {
        const apiDam = apiData[dam.name];
        const fillRate = apiDam ? apiDam.taux_remplissage : 0;
        const prevFillRate = apiDam ? apiDam.taux_precedent : fillRate;
        return { ...dam, fill: fillRate, prevFill: prevFillRate, status: getStatus(fillRate) };
      });

      setDamsData(mergedData);
    } catch {
      setError(true);
      toast.error('Impossible de se connecter à la base de données.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentLevels();
  }, [fetchCurrentLevels]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-slate-500">
        <div className="w-10 h-10 border-4 border-slate-200 dark:border-slate-700 border-t-sky-700 rounded-full animate-spin mb-4"></div>
        <p className="font-medium text-sm">Chargement des données…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center gap-4">
        <p className="text-slate-700 dark:text-slate-300 font-medium">Les données n’ont pas pu être chargées.</p>
        <button
          onClick={fetchCurrentLevels}
          className="flex items-center gap-2 bg-sky-700 hover:bg-sky-800 text-white px-4 py-2.5 rounded-md text-sm font-semibold transition-colors"
        >
          <RefreshCw size={16} />
          Réessayer
        </button>
      </div>
    );
  }

  const totalCapacity = damsData.reduce((acc, dam) => acc + dam.capacity, 0);
  const totalStoredVolume = damsData.reduce((acc, dam) => acc + (dam.fill * dam.capacity) / 100, 0);
  const totalPrevStoredVolume = damsData.reduce((acc, dam) => acc + (dam.prevFill * dam.capacity) / 100, 0);
  const averageFillRate = (totalStoredVolume / totalCapacity) * 100 || 0;
  const criticalDamsCount = damsData.filter((dam) => dam.status === 'critical').length;

  let volumeTrendValue = 0;
  if (totalPrevStoredVolume > 0) {
    volumeTrendValue = ((totalStoredVolume - totalPrevStoredVolume) / totalPrevStoredVolume) * 100;
  }
  const volumeTrendText = `${volumeTrendValue > 0 ? '+' : ''}${volumeTrendValue.toFixed(2)}%`;
  const showTrend = volumeTrendValue !== 0;

  const genererPDF = () => {
    const doc = new jsPDF();
    const dateJour = new Date().toLocaleDateString('fr-FR');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('AquaSafe AI', 105, 15, { align: 'center' });

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('BULLETIN HYDROLOGIQUE NATIONAL', 105, 30, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date d'édition : ${dateJour}`, 14, 42);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(3, 105, 161);
    doc.text('1. Synthèse nationale', 14, 56);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(`Taux de remplissage global : ${averageFillRate.toFixed(2)} %`, 20, 66);
    doc.text(`Volume total stocké : ${totalStoredVolume.toFixed(0)} Mm3 sur une capacité de ${totalCapacity} Mm3`, 20, 73);
    doc.text(`Ouvrages critiques (taux <= 40 %) : ${criticalDamsCount} sur ${damsData.length}`, 20, 80);
    if (showTrend) {
      doc.text(`Évolution du volume (vs veille) : ${volumeTrendText}`, 20, 87);
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(3, 105, 161);
    doc.text('2. Détail par ouvrage', 14, 104);

    autoTable(doc, {
      startY: 110,
      head: [['Ouvrage', 'Bassin', 'Capacité (Mm3)', 'Volume (Mm3)', 'Taux', 'Statut']],
      body: damsData.map((dam) => [
        dam.name,
        dam.bassin,
        dam.capacity,
        ((dam.fill * dam.capacity) / 100).toFixed(0),
        `${dam.fill.toFixed(1)} %`,
        STATUS[dam.status].label,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 4 },
      columnStyles: { 4: { fontStyle: 'bold' }, 5: { fontStyle: 'bold' } },
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Généré par AquaSafe AI - Page ${i}/${pageCount}`, 105, 285, { align: 'center' });
    }

    doc.save(`Rapport_Hydrologique_${dateJour.replace(/\//g, '-')}.pdf`);
    toast.success('Rapport PDF généré.');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-1">Vue d’ensemble nationale</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Dernières valeurs enregistrées pour les six barrages suivis</p>
        </div>

        <button
          onClick={genererPDF}
          className="flex items-center justify-center gap-2 bg-sky-700 hover:bg-sky-800 text-white px-4 py-2.5 rounded-md font-semibold text-sm transition-colors"
        >
          <FileText size={17} />
          Générer le rapport PDF
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Taux de remplissage"
          value={averageFillRate.toFixed(1)}
          unit="%"
          subtitle="Moyenne nationale pondérée"
          icon={Activity}
        />

        <KpiCard
          title="Volume stocké total"
          value={totalStoredVolume.toFixed(0)}
          unit="Mm³"
          subtitle={`Sur ${totalCapacity} Mm³`}
          icon={Droplets}
          trend={showTrend ? volumeTrendText : null}
          trendValue={volumeTrendValue}
        />

        <KpiCard
          title="Barrages critiques"
          value={criticalDamsCount}
          unit={`/ ${damsData.length}`}
          subtitle="Taux inférieur ou égal à 40 %"
          icon={AlertTriangle}
          variant="danger"
        />

        <div className="bg-slate-900 dark:bg-slate-800 p-5 rounded-lg text-white flex flex-col justify-between border border-slate-800 dark:border-slate-700">
          <div>
            <h3 className="text-sky-400 font-medium text-xs mb-2 uppercase tracking-wider">Prévisions</h3>
            <p className="text-xl font-semibold leading-snug mb-5">Prévision du taux de remplissage à 7 jours</p>
          </div>
          <Link
            to="/ml"
            className="flex items-center justify-between bg-sky-700 hover:bg-sky-600 px-4 py-2.5 rounded-md font-semibold text-sm transition-colors"
          >
            Ouvrir les prévisions
            <ArrowRight size={17} />
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">État détaillé par barrage</h2>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {damsData.map((dam) => {
            const currentVolume = (dam.fill * dam.capacity) / 100;
            const status = STATUS[dam.status];
            return (
              <div
                key={dam.id}
                className="px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="md:w-1/3">
                  <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">{dam.name}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <MapPin size={12} /> {dam.region} · Bassin du {dam.bassin}
                  </p>
                </div>

                <div className="flex-1 max-w-2xl">
                  <div className="flex justify-between items-baseline text-sm mb-2">
                    <span className="text-slate-600 dark:text-slate-400">
                      <strong className="text-slate-900 dark:text-slate-200 font-semibold tabular-nums">{currentVolume.toFixed(0)} Mm³</strong>
                      {' '}/ {dam.capacity} Mm³
                    </span>
                    <span className={`font-semibold tabular-nums ${status.text}`}>
                      {dam.fill.toFixed(1)} % · {status.label}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${status.bar}`}
                      style={{ width: `${Math.min(Math.max(dam.fill, 0), 100)}%` }}
                    />
                  </div>
                </div>

                <div className="md:w-32 flex md:justify-end">
                  <Link
                    to="/map"
                    className="text-sm font-semibold text-sky-700 dark:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800 px-4 py-2 rounded-md border border-slate-300 dark:border-slate-700 transition-colors"
                  >
                    Localiser
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}