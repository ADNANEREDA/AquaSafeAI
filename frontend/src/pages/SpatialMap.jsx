import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { MapContainer, GeoJSON, Marker, Popup, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';
import { Waves, ArrowRight, Filter, MapPin, RefreshCw } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const API_URL = 'http://localhost:8000';
const GEOJSON_URL = 'https://raw.githubusercontent.com/manalhama/Morocco-geojson/master/maroc.geojson';

const DAMS_INFO_BASE = [
  { id: 1, name: 'Al Wahda', lat: 34.616, lon: -5.148, capacity: 3800, bassin: 'Sebou', region: 'Fès-Meknès' },
  { id: 2, name: 'Al Massira', lat: 32.475, lon: -7.643, capacity: 2657, bassin: 'Oum Er-Rbia', region: 'Marrakech-Safi' },
  { id: 3, name: 'Bin El Ouidane', lat: 32.125, lon: -6.456, capacity: 1253, bassin: 'Oum Er-Rbia', region: 'Béni Mellal-Khénifra' },
  { id: 4, name: 'Idriss Ier', lat: 34.116, lon: -4.891, capacity: 1186, bassin: 'Sebou', region: 'Fès-Meknès' },
  { id: 5, name: 'Oued El Makhazine', lat: 34.939, lon: -5.845, capacity: 674, bassin: 'Loukkos', region: 'Tanger-Tétouan-Al Hoceïma' },
  { id: 6, name: 'Mansour Eddahbi', lat: 30.913, lon: -6.804, capacity: 428, bassin: 'Drâa-Oued Noun', region: 'Drâa-Tafilalet' },
];

const BASSINS = [...new Set(DAMS_INFO_BASE.map((d) => d.bassin))];

const CITIES_DATA = [
  { name: 'Tanger', lat: 35.75, lon: -5.83 },
  { name: 'Rabat', lat: 34.02, lon: -6.83 },
  { name: 'Casablanca', lat: 33.59, lon: -7.61 },
  { name: 'Fès', lat: 34.03, lon: -5.0 },
  { name: 'Marrakech', lat: 31.62, lon: -7.98 },
  { name: 'Agadir', lat: 30.42, lon: -9.59 },
];

const STATUS = {
  critical: { label: 'Critique', hex: '#dc2626', text: 'text-red-700 dark:text-red-400' },
  warning: { label: 'Alerte', hex: '#d97706', text: 'text-amber-700 dark:text-amber-400' },
  good: { label: 'Normal', hex: '#059669', text: 'text-emerald-700 dark:text-emerald-400' },
  unknown: { label: 'Indisponible', hex: '#64748b', text: 'text-slate-500 dark:text-slate-400' },
};

const PIE_COLORS = ['#0369a1', '#0ea5e9', '#0d9488', '#64748b'];

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

const getStatus = (fill) => {
  if (!isNum(fill)) return 'unknown';
  if (fill <= 40) return 'critical';
  if (fill <= 60) return 'warning';
  return 'good';
};

const getBasinDistribution = (dams) =>
  dams.reduce((acc, dam) => {
    const existing = acc.find((item) => item.name === dam.bassin);
    if (existing) existing.value += dam.capacity;
    else acc.push({ name: dam.bassin, value: dam.capacity });
    return acc;
  }, []);

const MAP_CSS = `
.dam-marker{background:transparent!important;border:0!important;outline:none}
.dam-pin{position:relative;width:32px;height:32px;transition:transform .15s ease;cursor:pointer}
.dam-pin:hover{transform:scale(1.1)}
.dam-pin.is-selected{transform:scale(1.2)}
.dam-pin svg{display:block;width:32px;height:32px;filter:drop-shadow(0 2px 2px rgba(0,0,0,.3))}
.dam-pin .pulse{position:absolute;left:50%;bottom:0;width:14px;height:6px;border-radius:50%;background:var(--c);animation:damPulse 2s ease-out infinite}
.dam-popup .leaflet-popup-content-wrapper{background:transparent;box-shadow:none;padding:0;border-radius:8px}
.dam-popup .leaflet-popup-content{margin:0;width:auto!important}
.dam-popup .leaflet-popup-tip{background:#fff;box-shadow:none}
.dark .dam-popup .leaflet-popup-tip{background:#0f172a}
.city-label{display:block;font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#64748b;white-space:nowrap;text-align:center;pointer-events:none}
.dark .city-label{color:#94a3b8}
@keyframes damPulse{0%{transform:translateX(-50%) scale(.5);opacity:.6}100%{transform:translateX(-50%) scale(2.4);opacity:0}}
`;

const iconCache = new Map();

const createDamMarker = (status, isSelected) => {
  const key = `${status}-${isSelected}`;
  if (iconCache.has(key)) return iconCache.get(key);

  const color = STATUS[status].hex;
  const pulse = status === 'critical' ? '<span class="pulse"></span>' : '';
  const icon = L.divIcon({
    className: 'dam-marker',
    html: `
      <div class="dam-pin ${isSelected ? 'is-selected' : ''}" style="--c:${color}">
        ${pulse}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path d="M12 22s7-5.6 7-12a7 7 0 1 0-14 0c0 6.4 7 12 7 12z" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
          <circle cx="12" cy="10" r="2.6" fill="white"/>
        </svg>
      </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 30],
    popupAnchor: [0, -28],
  });
  iconCache.set(key, icon);
  return icon;
};

const cityCache = new Map();

const createCityLabel = (name) => {
  if (cityCache.has(name)) return cityCache.get(name);
  const icon = L.divIcon({
    className: 'dam-marker',
    html: `<span class="city-label">${name}</span>`,
    iconSize: [90, 16],
    iconAnchor: [45, 8],
  });
  cityCache.set(name, icon);
  return icon;
};

function MapFocus({ focus, markerRefs }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return undefined;
    map.flyTo([focus.lat, focus.lon], Math.max(map.getZoom(), 7), { duration: 0.8 });
    const timer = setTimeout(() => {
      const marker = markerRefs.current[focus.id];
      if (marker) marker.openPopup();
    }, 850);
    return () => clearTimeout(timer);
  }, [focus, map, markerRefs]);
  return null;
}

export default function SpatialMap() {
  const [geoData, setGeoData] = useState(null);
  const [selectedBassin, setSelectedBassin] = useState('ALL');
  const [selectedDam, setSelectedDam] = useState(null);
  const [focus, setFocus] = useState(null);
  const [damsData, setDamsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));
  const markerRefs = useRef({});

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(GEOJSON_URL)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setGeoData(data);
      })
      .catch((err) => console.error('Erreur GeoJSON :', err));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchCurrentLevels = async () => {
      setLoading(true);
      setError(false);
      try {
        const response = await fetch(`${API_URL}/current-levels`);
        if (!response.ok) throw new Error('Erreur réseau');
        const apiData = await response.json();
        if (cancelled) return;

        setDamsData(
          DAMS_INFO_BASE.map((dam) => {
            const apiDam = apiData[dam.name];
            const fill = apiDam && isNum(apiDam.taux_remplissage) ? apiDam.taux_remplissage : null;
            return { ...dam, fill, status: getStatus(fill) };
          })
        );
      } catch (err) {
        console.error('Erreur de connexion :', err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchCurrentLevels();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const filteredDams = useMemo(
    () => (selectedBassin === 'ALL' ? damsData : damsData.filter((d) => d.bassin === selectedBassin)),
    [damsData, selectedBassin]
  );

  const basinDistribution = useMemo(() => getBasinDistribution(filteredDams), [filteredDams]);
  const totalCapacity = basinDistribution.reduce((sum, b) => sum + b.value, 0);

  const geoStyle = useMemo(
    () => ({
      fillColor: isDarkMode ? '#1e293b' : '#f1f5f9',
      weight: 1.2,
      color: isDarkMode ? '#38bdf8' : '#0369a1',
      fillOpacity: 1,
    }),
    [isDarkMode]
  );

  const focusDam = useCallback((dam) => {
    setSelectedDam(dam);
    setFocus({ id: dam.id, lat: dam.lat, lon: dam.lon });
  }, []);

  const legendItems = [
    { key: 'good', text: 'Normal (> 60 %)' },
    { key: 'warning', text: 'Alerte (41 à 60 %)' },
    { key: 'critical', text: 'Critique (≤ 40 %)' },
  ];

  return (
    <div className="max-w-7xl mx-auto flex flex-col space-y-4 lg:h-[calc(100vh-6rem)] pb-4">
      <style>{MAP_CSS}</style>

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-1">Carte des barrages</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Dernier taux de remplissage enregistré, par barrage et par bassin
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Filter size={16} className="text-sky-700 dark:text-sky-400" />
          <label htmlFor="bassin-select" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Bassin
          </label>
          <select
            id="bassin-select"
            value={selectedBassin}
            onChange={(e) => setSelectedBassin(e.target.value)}
            className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm font-medium rounded-md px-3 py-2 focus:outline-none focus:border-sky-700 focus:ring-1 focus:ring-sky-700 cursor-pointer"
          >
            <option value="ALL">Tous les bassins</option>
            {BASSINS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
        <div className="w-full lg:w-[60%] h-[440px] lg:h-full bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden relative">
          <div className="absolute top-3 right-3 z-[400] bg-white dark:bg-slate-900 px-3 py-2.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 flex flex-col gap-1.5 shadow-sm">
            {legendItems.map((item) => (
              <span key={item.key} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS[item.key].hex }}></span>
                {item.text}
              </span>
            ))}
          </div>

          {loading && (
            <div className="flex h-full items-center justify-center flex-col gap-3 text-slate-500">
              <div className="w-10 h-10 border-4 border-slate-200 dark:border-slate-700 border-t-sky-700 rounded-full animate-spin"></div>
              <span className="text-sm font-medium">Chargement de la carte…</span>
            </div>
          )}

          {!loading && error && (
            <div className="flex h-full items-center justify-center flex-col gap-4 text-center px-6">
              <p className="text-slate-700 dark:text-slate-300 font-medium">Les données des barrages n’ont pas pu être chargées.</p>
              <button
                onClick={() => setReloadKey((k) => k + 1)}
                className="flex items-center gap-2 bg-sky-700 hover:bg-sky-800 text-white px-4 py-2.5 rounded-md text-sm font-semibold transition-colors"
              >
                <RefreshCw size={16} />
                Réessayer
              </button>
            </div>
          )}

          {!loading && !error && (
            <MapContainer
              center={[28.5, -8.5]}
              zoom={5.2}
              className={`h-full w-full ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}
              zoomControl={true}
              scrollWheelZoom={true}
              attributionControl={false}
            >
              {geoData && <GeoJSON data={geoData} style={geoStyle} />}

              {CITIES_DATA.map((city) => (
                <Marker key={city.name} position={[city.lat, city.lon]} icon={createCityLabel(city.name)} interactive={false} keyboard={false} />
              ))}

              {filteredDams.map((dam) => {
                const isSelected = selectedDam?.id === dam.id;
                const status = STATUS[dam.status];
                const hasFill = isNum(dam.fill);
                return (
                  <Marker
                    key={dam.id}
                    position={[dam.lat, dam.lon]}
                    icon={createDamMarker(dam.status, isSelected)}
                    zIndexOffset={isSelected ? 1000 : 0}
                    title={dam.name}
                    ref={(el) => {
                      markerRefs.current[dam.id] = el;
                    }}
                    eventHandlers={{ click: () => setSelectedDam(dam) }}
                  >
                    <Popup className="dam-popup" closeButton={false} autoPanPadding={[24, 24]}>
                      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg p-4 min-w-[220px] shadow-lg">
                        <div className="flex items-center gap-1 text-[10px] uppercase font-semibold tracking-wider text-sky-700 dark:text-sky-400 mb-1">
                          <Waves size={11} /> Bassin {dam.bassin}
                        </div>
                        <div className="font-semibold text-base leading-tight">{dam.name}</div>
                        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                          <MapPin size={11} /> {dam.region}
                        </div>

                        <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700">
                          <div className="flex items-end justify-between mb-1.5">
                            <span className="text-xs text-slate-500 dark:text-slate-400">Dernier taux</span>
                            <span className={`text-lg font-semibold tabular-nums ${status.text}`}>
                              {hasFill ? `${dam.fill.toFixed(1)} %` : 'Indisponible'}
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700">
                            {hasFill && (
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${Math.min(Math.max(dam.fill, 0), 100)}%`, background: status.hex }}
                              />
                            )}
                          </div>
                        </div>

                        <div className="flex justify-between text-xs mt-2.5 text-slate-500 dark:text-slate-400 tabular-nums">
                          <span>{hasFill ? `${Math.round((dam.fill * dam.capacity) / 100)} Mm³` : '—'}</span>
                          <span>Capacité {dam.capacity} Mm³</span>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

              <MapFocus focus={focus} markerRefs={markerRefs} />
            </MapContainer>
          )}
        </div>

        <div className="w-full lg:w-[40%] lg:h-full bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
            <section>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Capacité par bassin
              </h2>
              <div className="h-[200px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={basinDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius="58%"
                      outerRadius="82%"
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {basinDistribution.map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value, name) => [`${value} Mm³`, name]}
                      contentStyle={{
                        backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                        border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: isDarkMode ? '#f8fafc' : '#0f172a',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums leading-none">
                    {totalCapacity}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Mm³ au total</div>
                </div>
              </div>

              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                {basinDistribution.map((b, index) => (
                  <li key={b.name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}></span>
                    <span className="truncate">{b.name}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Barrages</h2>
              <ul className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-md">
                {filteredDams.map((dam) => {
                  const status = STATUS[dam.status];
                  const isSelected = selectedDam?.id === dam.id;
                  return (
                    <li key={dam.id}>
                      <button
                        onClick={() => focusDam(dam)}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                          isSelected ? 'bg-sky-50/70 dark:bg-slate-800' : ''
                        }`}
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: status.hex }}></span>
                          <span className="font-medium text-slate-900 dark:text-slate-100 truncate">{dam.name}</span>
                        </span>
                        <span className={`font-semibold tabular-nums shrink-0 ${status.text}`}>
                          {isNum(dam.fill) ? `${dam.fill.toFixed(1)} %` : '—'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <div className="shrink-0 p-4 border-t border-slate-200 dark:border-slate-800">
            <Link
              to="/ml"
              className="w-full flex items-center justify-center gap-2 bg-sky-700 hover:bg-sky-800 text-white font-semibold py-3 rounded-md transition-colors text-sm"
            >
              Ouvrir les prévisions <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}