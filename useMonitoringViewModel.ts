
import { useState, useEffect, useMemo } from 'react';
import { EnvironmentalReport, WeatherData } from './types';
import { getWetlandWeather } from './services/geminiService';
import { supabase } from './services/supabaseClient';

const buildReportPlaceholder = (type: 'fauna' | 'flora' | 'emergency') => {
  const config =
    type === 'fauna'
      ? { emoji: '🐦', label: 'FAUNA', bg: '#1d4ed8' }
      : type === 'flora'
      ? { emoji: '🌿', label: 'FLORA', bg: '#047857' }
      : { emoji: '⚠️', label: 'RIESGO', bg: '#b91c1c' };

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${config.bg}" stop-opacity="0.95" />
          <stop offset="100%" stop-color="#0f172a" stop-opacity="0.78" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)" />
      <circle cx="400" cy="250" r="110" fill="#ffffff22" stroke="#ffffff55" stroke-width="4"/>
      <text x="400" y="285" text-anchor="middle" font-size="90">${config.emoji}</text>
      <text x="400" y="430" text-anchor="middle" fill="#ffffff" font-family="Inter, Arial" font-size="56" font-weight="700">${config.label}</text>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const deltaP = ((lat2 - lat1) * Math.PI) / 180;
  const deltaL = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(deltaP / 2) * Math.sin(deltaP / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(deltaL / 2) * Math.sin(deltaL / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

export const useMonitoringViewModel = () => {
  const [reports, setReports] = useState<EnvironmentalReport[]>([]);

  const [activeFilter, setActiveFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [radiusFilter, setRadiusFilter] = useState<number | null>(null);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);

  const fetchWeather = async () => {
    setLoadingWeather(true);
    const data = await getWetlandWeather();
    if (data) setWeather(data);
    setLoadingWeather(false);
  };

  useEffect(() => {
    const loadReports = async () => {
      setLoadingReports(true);
      const { data, error } = await supabase
        .from('reports')
        .select('id, user_id, type, title, description, reporter_username, created_at, lat, lng, image_url, likes_count')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        const mapped: EnvironmentalReport[] = data.map((r: any, index: number) => ({
          id: Date.now() + index,
          type: r.type,
          title: r.title,
          user: r.reporter_username ? `@${r.reporter_username}` : '@reporte',
          date: new Date(r.created_at).toLocaleString(),
          description: r.description || '',
          timestamp: new Date(r.created_at),
          coords: [r.lat ?? 4.642, r.lng ?? -74.148],
          imageUrl: r.image_url || buildReportPlaceholder(r.type),
          remoteId: r.id,
          ownerId: r.user_id || null,
        }));
        setReports(mapped);
      } else if (error) {
        console.warn('No se pudieron cargar reportes desde Supabase, usando datos locales de ejemplo.');
        setReports([
          {
            id: 1,
            type: 'fauna',
            title: 'Tingua Azul avistada',
            user: '@eco_andina',
            date: 'Hoy, 10:30 AM',
            description:
              'Avistamiento de una Tingua Azul alimentándose en la zona de juncos.',
            timestamp: new Date(),
            coords: [4.643, -74.149],
            imageUrl: 'https://picsum.photos/seed/tingua/400/300',
          },
          {
            id: 2,
            type: 'emergency',
            title: 'Escombros en zona de ronda',
            user: '@vecino_techo',
            date: 'Ayer, 4:00 PM',
            description: 'Descarga ilegal de residuos de construcción.',
            timestamp: new Date(Date.now() - 86400000),
            coords: [4.641, -74.147],
            imageUrl: 'https://picsum.photos/seed/trash/400/300',
          },
          {
            id: 3,
            type: 'flora',
            title: 'Margarita de Pantano',
            user: '@biologa_bog',
            date: 'Hace 5 días',
            description: 'Senecio carbonelli en floración.',
            timestamp: new Date(Date.now() - 86400000 * 5),
            coords: [4.644, -74.15],
            imageUrl: 'https://picsum.photos/seed/flower/400/300',
          },
        ]);
      }

      setLoadingReports(false);
    };

    loadReports().catch(() => setLoadingReports(false));
  }, []);

  const addReport = (
    report: Omit<EnvironmentalReport, 'id' | 'timestamp' | 'user' | 'date' | 'remoteId' | 'ownerId'>,
    username: string,
    userId: string
  ) => {
    const localId = Date.now();
    const newReport: EnvironmentalReport = {
      ...report,
      id: localId,
      timestamp: new Date(),
      user: `@${username}`,
      date: 'Justo ahora',
      ownerId: userId,
    };
    setReports(prev => [newReport, ...prev]);

    (async () => {
      const { data, error } = await supabase
        .from('reports')
        .insert({
          type: report.type,
          title: report.title,
          description: report.description,
          reporter_username: username,
          user_id: userId,
          lat: report.coords[0],
          lng: report.coords[1],
          image_url: report.imageUrl,
          likes_count: 0,
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error guardando reporte en Supabase:', error.message);
        return;
      }

      if (data?.id) {
        setReports(prev =>
          prev.map(r =>
            r.id === localId ? { ...r, remoteId: data.id as string } : r
          )
        );
      }
    })();

    return newReport;
  };

  const updateReport = (
    localId: number,
    changes: Partial<Omit<EnvironmentalReport, 'id' | 'timestamp' | 'user' | 'date'>>,
  ) => {
    setReports(prev =>
      prev.map(r => (r.id === localId ? { ...r, ...changes } : r))
    );

    const target = reports.find(r => r.id === localId);
    if (!target || !target.remoteId) return;

    const payload: any = {};
    if (changes.title !== undefined) payload.title = changes.title;
    if (changes.description !== undefined) payload.description = changes.description;
    if (changes.type !== undefined) payload.type = changes.type;
    if (changes.coords !== undefined) {
      payload.lat = changes.coords[0];
      payload.lng = changes.coords[1];
    }
    if (changes.imageUrl !== undefined) {
      payload.image_url = changes.imageUrl;
    }

    supabase
      .from('reports')
      .update(payload)
      .eq('id', target.remoteId)
      .then(({ error }) => {
        if (error) {
          console.error('Error actualizando reporte en Supabase:', error.message);
        }
      });
  };

  const deleteReport = (localId: number) => {
    const target = reports.find(r => r.id === localId);
    setReports(prev => prev.filter(r => r.id !== localId));

    if (!target?.remoteId) return;

    supabase
      .from('reports')
      .delete()
      .eq('id', target.remoteId)
      .then(({ error }) => {
        if (error) {
          console.error('Error eliminando reporte en Supabase:', error.message);
        }
      });
  };

  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      if (activeFilter !== 'all' && r.type !== activeFilter && !(activeFilter === 'riesgo' && r.type === 'emergency')) return false;
      const now = new Date();
      if (dateFilter === 'today' && r.timestamp.toDateString() !== now.toDateString()) return false;
      if (dateFilter === 'last7' && r.timestamp.getTime() < now.getTime() - 7 * 86400000) return false;
      if (radiusFilter !== null && userCoords) {
        if (getDistance(userCoords[0], userCoords[1], r.coords[0], r.coords[1]) > radiusFilter) return false;
      }
      return true;
    });
  }, [reports, activeFilter, dateFilter, radiusFilter, userCoords]);

  const stats = useMemo(
    () => ({
      fauna: reports.filter(r => r.type === 'fauna').length,
      flora: reports.filter(r => r.type === 'flora').length,
      emergency: reports.filter(r => r.type === 'emergency').length,
      total: reports.length,
    }),
    [reports]
  );

  return {
    reports,
    filteredReports,
    stats,
    weather,
    loadingWeather,
    activeFilter,
    setActiveFilter,
    dateFilter,
    setDateFilter,
    radiusFilter,
    setRadiusFilter,
    userCoords,
    setUserCoords,
    fetchWeather,
    addReport,
    updateReport,
    deleteReport,
    getDistance,
  };
};
