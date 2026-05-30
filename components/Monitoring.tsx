
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Camera, MapPin, PlusCircle, AlertTriangle, X, Check, Bell, ShieldAlert, Calendar, Share2, BarChart3, LayoutGrid, List, ChevronDown, ChevronUp, Eye, Trash2, Navigation2, Crosshair, TrendingUp, PieChart as PieChartIcon, Bird, Leaf, Edit2, Plus, Minus } from 'lucide-react';
import L from 'leaflet';
import { Capacitor } from '@capacitor/core';
// Para app nativa, usar el plugin de Geolocation de Capacitor
// Recuerda instalarlo y sincronizar Android:
// npm install @capacitor/geolocation
// npx cap sync android
import { Geolocation } from '@capacitor/geolocation';
import { useMonitoringViewModel } from '../useMonitoringViewModel';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabaseClient';
import { useNetworkStatus } from './useNetworkStatus';
import { useLanguage } from './LanguageContext';

const Monitoring: React.FC = () => {
  const vm = useMonitoringViewModel();
  const isOnline = useNetworkStatus();
  const { lang } = useLanguage();
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const [showConfirmSelection, setShowConfirmSelection] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<[number, number] | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [tempMarkerCoords, setTempMarkerCoords] = useState<[number, number] | null>(null);
  const [showStats, setShowStats] = useState(false);

  const [newReportDraft, setNewReportDraft] = useState({ type: 'fauna' as 'fauna' | 'flora' | 'emergency', title: '', description: '' });

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: number]: L.Marker }>({});
  const tempMarkerRef = useRef<L.Marker | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [page, setPage] = useState(0);
  const { user } = useAuth();
  const [username, setUsername] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const getReportPlaceholderByType = (type: 'fauna' | 'flora' | 'emergency') => {
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
  const [lastReportPreview, setLastReportPreview] = useState<{ title: string; imageUrl: string } | null>(null);
  const [activeReportPreview, setActiveReportPreview] = useState<{ title: string; imageUrl: string; description: string; user: string; date: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingReportId, setEditingReportId] = useState<number | null>(null);

  // Helper para obtener la ubicación tanto en web como en app nativa
  const getCurrentCoords = async (): Promise<[number, number] | null> => {
    try {
      if (Capacitor.isNativePlatform()) {
        const perm = await Geolocation.checkPermissions();
        if (perm.location === 'denied' || perm.location === 'prompt') {
          await Geolocation.requestPermissions();
        }
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
        });
        return [pos.coords.latitude, pos.coords.longitude];
      }

      if ('geolocation' in navigator) {
        return await new Promise<[number, number]>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
            (err) => reject(err),
            { enableHighAccuracy: true, timeout: 10000 }
          );
        });
      }
      return null;
    } catch (err) {
      console.warn('Error al obtener ubicación', err);
      return null;
    }
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    
    const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([4.642, -74.148], 15);
    mapInstanceRef.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      const coords: [number, number] = [e.latlng.lat, e.latlng.lng];
      setPendingCoords(coords);
      setShowConfirmSelection(true);
      
      if (tempMarkerRef.current) tempMarkerRef.current.remove();
      tempMarkerRef.current = L.marker(coords, {
        icon: L.divIcon({
          className: 'custom-div-icon',
          html: `<div style="background-color: #059669; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3); animation: pulse 1.5s infinite;"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        })
      }).addTo(map);
    });

    // Intentar centrar el mapa en la ubicación del usuario (web o app nativa)
    getCurrentCoords()
      .then((coords) => {
        if (!coords) return;
        vm.setUserCoords(coords);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView(coords, 17);
        }
      })
      .catch((err) => console.warn('Error de geolocalización inicial.', err));

    return () => { 
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setUsername(null);
      return;
    }
    const loadProfile = async () => {
      setLoadingProfile(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('username, display_name, role')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        const uname =
          (data.username as string | null) ||
          (data.display_name as string | null) ||
          null;
        if (uname) {
          setUsername(uname);
        } else {
          const fallback =
            ((user.user_metadata as any)?.username as string | undefined) ||
            (user.email || '').split('@')[0] ||
            null;
          setUsername(fallback);
        }
        if ((data as any).role === 'admin') {
          setIsAdmin(true);
        }
      } else {
        const fallback =
          ((user.user_metadata as any)?.username as string | undefined) ||
          (user.email || '').split('@')[0] ||
          null;
        setUsername(fallback);
      }
      setLoadingProfile(false);
    };
    loadProfile().catch(() => setLoadingProfile(false));
  }, [user]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    
    // Clear existing markers
    Object.keys(markersRef.current).forEach(key => {
      const marker = markersRef.current[Number(key)];
      if (marker) marker.remove();
    });
    markersRef.current = {};

    // Add new styled markers
    vm.filteredReports.forEach(r => {
      const config = {
        fauna: { color: '#3b82f6', icon: '🐦' },
        flora: { color: '#10b981', icon: '🌱' },
        emergency: { color: '#ef4444', icon: '⚠️' }
      }[r.type] || { color: '#6b7280', icon: '📍' };

      const markerIcon = L.divIcon({
        className: 'custom-report-marker',
        html: `
          <div style="
            background-color: ${config.color};
            width: 32px;
            height: 32px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          ">
            <div style="transform: rotate(45deg); font-size: 16px;">${config.icon}</div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });

      markersRef.current[r.id] = L.marker(r.coords, { icon: markerIcon })
        .addTo(mapInstanceRef.current!)
        .bindPopup(`
          <div style="min-width: 120px; font-family: 'Inter', sans-serif; padding: 4px;">
            <div style="font-weight: 800; color: #064e3b; margin-bottom: 2px; font-size: 13px;">${r.title}</div>
            <div style="font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;">${r.type === 'emergency' ? 'Riesgo' : r.type}</div>
          </div>
        `);
    });
  }, [vm.filteredReports]);

  const handleLocate = async () => {
    const coords = await getCurrentCoords();
    if (!coords) {
      alert(
        lang === 'en'
          ? 'Location is not available. Please check GPS permissions on your device.'
          : 'La ubicación no está disponible. Revisa los permisos de GPS en tu dispositivo.'
      );
      return;
    }
    vm.setUserCoords(coords);
    mapInstanceRef.current?.setView(coords, 17);
  };

  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  const confirmMapSelection = () => {
    if (pendingCoords) {
      setTempMarkerCoords(pendingCoords);
      setIsReporting(true);
      setShowConfirmSelection(false);
      setPendingCoords(null);
    }
  };

  const cancelMapSelection = () => {
    setShowConfirmSelection(false);
    setPendingCoords(null);
    if (tempMarkerRef.current) {
      tempMarkerRef.current.remove();
      tempMarkerRef.current = null;
    }
  };

  const handleOnSubmit = () => {
    if (!newReportDraft.title) return;
    if (!isOnline) {
      alert(
        lang === 'en'
          ? 'You cannot create or edit reports while you are offline.'
          : 'No puedes crear o editar reportes mientras estás sin conexión.'
      );
      return;
    }
    if (!username) {
      alert(
        lang === 'en'
          ? 'Your username was not found. Please complete your profile and try again.'
          : 'No se encontró tu nombre de usuario. Completa tu perfil e intenta de nuevo.'
      );
      return;
    }
    const finalCoords = tempMarkerCoords || vm.userCoords || [4.642, -74.148];
    const finalImage = capturedImage || getReportPlaceholderByType(newReportDraft.type);

    if (editingReportId) {
      vm.updateReport(editingReportId, {
        title: newReportDraft.title,
        description: newReportDraft.description,
        type: newReportDraft.type,
        coords: finalCoords,
        imageUrl: finalImage,
      });
    } else {
      vm.addReport(
        {
          ...newReportDraft,
          coords: finalCoords,
          imageUrl: finalImage,
        },
        username,
        user.id
      );
    }

    setIsReporting(false);
    setEditingReportId(null);
    setNewReportDraft({ type: 'fauna', title: '', description: '' });
    setCapturedImage(null);
    setTempMarkerCoords(null);
    if (tempMarkerRef.current) {
      tempMarkerRef.current.remove();
      tempMarkerRef.current = null;
    }
    stopCamera();
    setLastReportPreview({ title: newReportDraft.title, imageUrl: finalImage });
    setShowConfirmation(true);
  };

  const summaryItems = useMemo(() => {
    const total = vm.stats.total || 0;
    const items = [
      {
        key: 'flora',
        label: lang === 'en' ? 'Flora' : 'Flora',
        value: vm.stats.flora,
        icon: Leaf,
        color: '#22c55e',
      },
      {
        key: 'fauna',
        label: lang === 'en' ? 'Fauna' : 'Fauna',
        value: vm.stats.fauna,
        icon: Bird,
        color: '#3b82f6',
      },
      {
        key: 'risk',
        label: lang === 'en' ? 'Risk' : 'Riesgo',
        value: vm.stats.emergency,
        icon: ShieldAlert,
        color: '#ef4444',
      },
    ];

    return items.map(item => ({
      ...item,
      pct: total > 0 ? Math.round((item.value / total) * 100) : 0,
    }));
  }, [vm.stats.total, vm.stats.flora, vm.stats.fauna, vm.stats.emergency, lang]);

  const ringTicks = useMemo(() => {
    const totalTicks = 56;
    const total = vm.stats.total || 0;
    const floraTicks = total > 0 ? Math.round((vm.stats.flora / total) * totalTicks) : 0;
    const faunaTicks = total > 0 ? Math.round((vm.stats.fauna / total) * totalTicks) : 0;
    const riskTicks = Math.max(0, totalTicks - floraTicks - faunaTicks);

    const colors: string[] = [];
    for (let i = 0; i < floraTicks; i++) colors.push('#22c55e');
    for (let i = 0; i < faunaTicks; i++) colors.push('#3b82f6');
    for (let i = 0; i < riskTicks; i++) colors.push('#ef4444');
    while (colors.length < totalTicks) colors.push('#d1d5db');

    return Array.from({ length: totalTicks }).map((_, index) => {
      const angle = -90 + index * (360 / totalTicks);
      const rad = (angle * Math.PI) / 180;
      const inner = 77;
      const outer = 93;
      const cx = 100;
      const cy = 100;
      return {
        x1: cx + inner * Math.cos(rad),
        y1: cy + inner * Math.sin(rad),
        x2: cx + outer * Math.cos(rad),
        y2: cy + outer * Math.sin(rad),
        color: colors[index],
      };
    });
  }, [vm.stats.total, vm.stats.flora, vm.stats.fauna, vm.stats.emergency]);

  const { pagedReports, totalLimited } = useMemo(() => {
    const ordered = [...vm.filteredReports].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
    const limited = ordered.slice(0, 15);
    const start = page * 5;
    const pageItems = limited.slice(start, start + 5);
    return { pagedReports: pageItems, totalLimited: limited.length };
  }, [vm.filteredReports, page]);

  const canPrev = page > 0;
  const canNext = (page + 1) * 5 < totalLimited;

  const startCamera = () => {
    setCapturedImage(null);
    setShowCamera(true);
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      // Si el video aún no reporta dimensiones, usamos un tamaño por defecto
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, width, height);
        const imgData = canvas.toDataURL('image/jpeg');
        setCapturedImage(imgData);
        stopCamera();
      }
    }
  };

  useEffect(() => {
    const setupStream = async () => {
      if (!showCamera) return;

      const isSecure =
        (window as any).isSecureContext ||
        window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';

      if (!isSecure) {
        alert(
          'La cámara solo funciona en conexiones seguras (https o localhost). Abre la app en https o usa localhost.'
        );
        setShowCamera(false);
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Tu navegador no soporta acceso directo a la cámara.');
        setShowCamera(false);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          const playPromise = video.play();
          if (playPromise && typeof playPromise.then === 'function') {
            playPromise.catch(err => {
              console.warn('No se pudo reproducir el video de la cámara:', err);
            });
          }
        }
      } catch (err) {
        console.error('Error accediendo a la cámara:', err);
        const error = err as DOMException;
        if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
          alert(
            'El navegador bloqueó el acceso a la cámara. Ve a la barra de direcciones y permite el uso de la cámara para localhost.'
          );
        } else if (error.name === 'NotFoundError') {
          alert('No se encontró ninguna cámara disponible en este dispositivo.');
        } else {
          alert('No se pudo acceder a la cámara. Revisa los permisos del navegador.');
        }
        setShowCamera(false);
      }
    };

    setupStream().catch(() => setShowCamera(false));
  }, [showCamera]);

  return (
    <div className="p-4 animate-fadeIn pb-24 relative">

      {!isOnline && (
        <p className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-2xl px-3 py-2">
          {lang === 'en'
            ? 'You are offline. You can review reports already loaded if available, but you cannot create, edit or delete reports until you reconnect.'
            : 'Estás sin conexión. Puedes revisar reportes ya cargados si están disponibles, pero no podrás crear, editar ni eliminar reportes hasta recuperar la conexión.'}
        </p>
      )}

      <div className="relative mb-6">
        <div className="eco-forest-card h-64 rounded-3xl relative overflow-hidden z-0">
          <div ref={mapContainerRef} className="w-full h-full" />
          <button 
            onClick={handleLocate} 
            className="absolute top-4 left-4 z-[400] eco-forest-btn p-2.5 rounded-xl text-emerald-50 active:scale-90 transition-all"
          >
            <Navigation2 size={20} fill={vm.userCoords ? "currentColor" : "none"} />
          </button>
          <div className="absolute bottom-4 right-4 z-[400] flex flex-col gap-2">
            <button
              onClick={handleZoomIn}
              className="eco-forest-btn p-2 rounded-xl text-emerald-50 active:scale-95"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={handleZoomOut}
              className="eco-forest-btn p-2 rounded-xl text-emerald-50 active:scale-95"
            >
              <Minus size={16} />
            </button>
          </div>
        </div>

        {showConfirmSelection && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center p-4 bg-emerald-900/10 backdrop-blur-[2px] rounded-3xl overflow-hidden animate-fadeIn">
            <div className="eco-forest-card rounded-2xl p-4 w-full max-w-[200px] animate-slideUp">
              <div className="flex flex-col items-center gap-3">
                <div className="bg-emerald-100 p-2 rounded-full text-emerald-600">
                  <MapPin size={20} />
                </div>
                <p className="text-[10px] font-bold text-center text-emerald-900 uppercase tracking-tight">¿Reportar en este punto?</p>
                <div className="flex gap-2 w-full">
                  <button onClick={confirmMapSelection} className="flex-1 eco-forest-btn p-2 rounded-lg active:scale-90 transition-transform"><Check size={18} className="mx-auto" /></button>
                  <button onClick={cancelMapSelection} className="flex-1 eco-card-soft text-gray-500 p-2 rounded-lg active:scale-90 transition-transform"><X size={18} className="mx-auto" /></button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <section className="mb-6 animate-fadeIn text-black">
        <div className="eco-card-soft rounded-3xl p-4 border border-white/75 shadow-[0_12px_26px_rgba(8,28,20,0.28)]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-extrabold text-black flex items-center gap-2">
              <BarChart3 size={20} className="text-black" />
              {lang === 'en' ? 'Distribution of reports' : 'Distribución de Reportes'}
            </h3>
            <button
              onClick={() => setShowStats(!showStats)}
              className="px-3 py-1.5 rounded-full eco-forest-btn text-white border border-emerald-300/30 text-xs font-extrabold tracking-wide flex items-center gap-1.5 shadow-md"
            >
              <Eye size={13} />
              {showStats ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
              {lang === 'en'
                ? (showStats ? 'Hide report chart' : 'View report chart!')
                : (showStats ? 'Ocultar gráfico' : 'Ver gráfico de reportes!')}
            </button>
          </div>

          {showStats && (
          <div className="eco-card-soft p-4 rounded-3xl animate-fadeIn border border-white/75 shadow-[0_12px_28px_rgba(8,28,20,1.22)]">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-extrabold text-black">
                {lang === 'en' ? 'Report summary' : 'Resumen de reportes'}
              </h4>

            </div>
            <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-center">
              <div className="mx-auto relative w-[200px] h-[200px]">
                <svg viewBox="0 0 200 200" className="w-full h-full">
                  {ringTicks.map((tick, i) => (
                    <line
                      key={i}
                      x1={tick.x1}
                      y1={tick.y1}
                      x2={tick.x2}
                      y2={tick.y2}
                      stroke={tick.color}
                      strokeWidth="4.5"
                      strokeLinecap="round"
                    />
                  ))}
                  <circle cx="100" cy="100" r="67" fill="rgba(255,255,255,0.92)" />
                  <text x="100" y="96" textAnchor="middle" className="fill-black text-[40px] font-extrabold">
                    {vm.stats.total}
                  </text>
                  <text x="100" y="122" textAnchor="middle" className="fill-black text-[18px] font-semibold">
                    {lang === 'en' ? 'Total' : 'Total'}
                  </text>
                  <text x="100" y="146" textAnchor="middle" className="fill-black text-[20px]">
                    🍃
                  </text>
                </svg>
              </div>

              <div className="flex flex-col gap-2.5">
                {summaryItems.map(item => (
                  <div key={item.key} className="bg-white/88 border border-white rounded-2xl p-3 shadow-sm">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <item.icon size={18} style={{ color: item.color }} />
                        <span className="text-sm font-bold text-black">{item.label}</span>
                      </div>
                      <div className="text-right leading-tight">
                        <p className="text-2xl font-extrabold text-black">{item.value}</p>
                        <p className="text-xs font-semibold text-black">{item.pct}%</p>
                      </div>
                    </div>
                    <div className="w-full h-3 rounded-full bg-emerald-50 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${item.pct}%`,
                          background: `linear-gradient(90deg, ${item.color}, ${item.color}CC)`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          )}
        </div>
      </section>

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          {['all', 'fauna', 'flora', 'riesgo'].map(f => (
            <button
              key={f}
              onClick={() => vm.setActiveFilter(f)}
              className={`px-4 py-2 rounded-full text-xs font-bold capitalize transition-all whitespace-nowrap ${
                vm.activeFilter === f
                  ? f === 'fauna'
                    ? 'bg-blue-600 text-white border border-blue-500 shadow-md'
                    : f === 'flora'
                    ? 'bg-emerald-600 text-white border border-emerald-500 shadow-md'
                    : f === 'riesgo'
                    ? 'bg-red-600 text-white border border-red-500 shadow-md'
                    : 'eco-forest-btn text-white shadow-md'
                  : 'eco-card text-emerald-800 border border-white/70'
              }`}
            >
              {f === 'all'
                ? lang === 'en'
                  ? 'All'
                  : 'Todos'
                : f === 'riesgo'
                ? lang === 'en'
                  ? 'Risk'
                  : 'Riesgo'
                : f}
            </button>
          ))}
        </div>

        {totalLimited > 0 && (
          <div className="eco-card-soft rounded-3xl p-4 border border-white/75 shadow-[0_12px_26px_rgba(8,28,20,0.28)] flex items-center justify-center gap-3">
            <button
              onClick={() => setPage(0)}
              disabled={page === 0}
              className="text-sm md:text-base font-extrabold text-black drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] disabled:opacity-80"
            >
              {lang === 'en' ? 'Latest reports' : 'Últimos reportes'}
            </button>
            <button
              onClick={() => canPrev && setPage(p => p - 1)}
              disabled={!canPrev}
              className="px-4 py-2 rounded-full text-xs md:text-sm font-semibold eco-forest-btn disabled:opacity-50"
            >{lang === 'en' ? 'Previous' : 'Anterior'}
              
            </button>
            <button
              onClick={() => canNext && setPage(p => p + 1)}
              disabled={!canNext}
              className="px-4 py-2 rounded-full text-xs md:text-sm font-semibold eco-forest-btn disabled:opacity-50"
            >{lang === 'en' ? 'Next' : 'Siguiente'}
              
            </button>
          </div>
        )}
      </div>

      <div className="mb-4">
        <button
          onClick={() => {
            setIsReporting(true);
            setTempMarkerCoords(null);
          }}
          className="w-full eco-forest-btn px-4 py-3 rounded-2xl active:scale-[0.99] transition-all flex items-center justify-center gap-2"
        >
          <PlusCircle size={20} />
          <span className="text-xs font-semibold uppercase tracking-wide">
            {lang === 'en' ? 'Create report' : 'Reportar'}
          </span>
        </button>
      </div>

      <div className="space-y-4 mb-6">
        {pagedReports.map(report => {
          const isOwner =
            (!!report.ownerId && !!user && report.ownerId === user.id) ||
            (!!username && report.user === `@${username}`);
          const canEdit = isOwner;
          const canDelete = isAdmin;

          return (
            <div
              key={report.id}
              className={`eco-card-soft p-4 rounded-2xl border transition-all ${
                selectedReportId === report.id
                  ? 'border-emerald-500 shadow-md ring-1 ring-emerald-500/20'
                  : 'border-emerald-50 shadow-sm'
              }`}
            >
              <div className="flex justify-between gap-4">
                <button
                  className="flex gap-4 text-left flex-1"
                  onClick={() => {
                    setSelectedReportId(report.id);
                    mapInstanceRef.current?.setView(report.coords, 17, { animate: true });
                    setActiveReportPreview({
                      title: report.title,
                      imageUrl: report.imageUrl,
                      description: report.description,
                      user: report.user,
                      date: report.date,
                    });
                  }}
                >
                  <div
                    className={`p-3 rounded-xl shrink-0 ${
                      report.type === 'fauna'
                        ? 'bg-blue-50 text-blue-600'
                        : report.type === 'emergency'
                        ? 'bg-red-50 text-red-600'
                        : 'bg-green-50 text-green-600'
                    }`}
                  >
                    {report.type === 'fauna' ? (
                      <Bird size={20} />
                    ) : report.type === 'emergency' ? (
                      <AlertTriangle size={20} />
                    ) : (
                      <Leaf size={20} />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-800 text-sm">{report.title}</h4>
                    <p className="text-[10px] text-gray-400 uppercase font-bold">
                      {report.user} • {report.date}
                    </p>
                  </div>
                </button>
                <div className="flex flex-col items-end gap-2">
                  {canEdit && (
                    <button
                      onClick={() => {
                        setEditingReportId(report.id);
                        setNewReportDraft({
                          type: report.type,
                          title: report.title,
                          description: report.description,
                        });
                        setTempMarkerCoords(report.coords);
                        setIsReporting(true);
                      }}
                      className="text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-1"
                    >
                      <Edit2 size={14} />
                      {lang === 'en'
                        ? 'Edit'
                        : 'Editar'}
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => {
                        if (
                          window.confirm(
                            '¿Seguro que deseas eliminar este reporte? Esta acción no se puede deshacer.'
                          )
                        ) {
                          vm.deleteReport(report.id);
                        }
                      }}
                      className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                    >
                      <Trash2 size={14} />
                      {lang === 'en'
                        ? 'Delete'
                        : 'Eliminar'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isReporting && (
        <div className="fixed inset-0 z-[2000] bg-black/40 backdrop-blur-sm flex items-end p-4">
          <div className="eco-card-soft w-full rounded-t-[2.5rem] rounded-b-3xl p-6 animate-slideUp max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-emerald-900">Nuevo Reporte</h3>
              <button onClick={() => { setIsReporting(false); setCapturedImage(null); stopCamera(); }} className="p-2 text-gray-400"><X size={24}/></button>
            </div>
            
            <div className="mb-6">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 ml-1">Evidencia Visual</label>
              {!capturedImage && !showCamera && (
                <button onClick={startCamera} className="w-full aspect-video rounded-3xl border-2 border-dashed border-emerald-100 bg-emerald-50/30 flex flex-col items-center justify-center gap-2 text-emerald-600 hover:bg-emerald-50 transition-colors">
                  <Camera size={32} />
                  <span className="text-xs font-bold">Tomar Foto</span>
                </button>
              )}
              {showCamera && (
                <div className="relative w-full aspect-video rounded-3xl overflow-hidden bg-black shadow-inner">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                    <button onClick={capturePhoto} className="bg-white text-emerald-600 p-3 rounded-full shadow-xl active:scale-90 transition-transform"><Check size={24} /></button>
                    <button onClick={stopCamera} className="bg-red-500 text-white p-3 rounded-full shadow-xl active:scale-90 transition-transform"><X size={24} /></button>
                  </div>
                </div>
              )}
              {capturedImage && (
                <div className="relative w-full aspect-video rounded-3xl overflow-hidden shadow-md">
                  <img src={capturedImage} className="w-full h-full object-cover" alt="Captura" />
                  <button onClick={() => setCapturedImage(null)} className="absolute top-3 right-3 bg-red-500 text-white p-2 rounded-full shadow-lg active:scale-90 transition-transform"><Trash2 size={16} /></button>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>
            
            {(tempMarkerCoords || vm.userCoords) && (
              <div className="mb-6 bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center gap-4">
                 <div className="bg-emerald-600 text-white p-2.5 rounded-xl shadow-sm"><MapPin size={20} /></div>
                 <div className="flex-1">
                    <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest block">{tempMarkerCoords ? 'Punto Seleccionado' : 'Tu Ubicación Actual'}</span>
                    <span className="text-xs text-emerald-600 font-bold">{(tempMarkerCoords || vm.userCoords)![0].toFixed(5)}, {(tempMarkerCoords || vm.userCoords)![1].toFixed(5)}</span>
                 </div>
                 {tempMarkerCoords && <button onClick={() => setTempMarkerCoords(null)} className="text-emerald-300 hover:text-red-500"><Trash2 size={18} /></button>}
              </div>
            )}

            <div className="space-y-4 mb-8">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 ml-1">¿Qué observaste?</label>
                <input 
                  type="text" 
                  placeholder="Ej: Avistamiento de Tingua Azul" 
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all" 
                  onChange={e => setNewReportDraft(prev => ({...prev, title: e.target.value}))}
                  value={newReportDraft.title}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['fauna', 'flora', 'emergency'] as const).map(type => (
                  <button 
                    key={type}
                    onClick={() => setNewReportDraft(prev => ({...prev, type}))}
                    className={`p-3 rounded-xl border text-[10px] font-bold uppercase transition-all ${
                      newReportDraft.type === type
                        ? type === 'fauna'
                          ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                          : type === 'flora'
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                          : 'bg-red-600 text-white border-red-500 shadow-md'
                        : 'eco-card text-gray-600 border-white/70'
                    }`}
                  >
                    {type === 'emergency' ? 'Riesgo' : type}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleOnSubmit}
              disabled={!newReportDraft.title}
              className="w-full py-4 eco-forest-btn rounded-2xl font-bold uppercase tracking-widest disabled:opacity-50 active:scale-95 transition-all"
            >
              Enviar Reporte
            </button>
          </div>
        </div>
      )}

      {showConfirmation && lastReportPreview && (
        <div className="fixed inset-0 z-[2100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="eco-forest-card rounded-3xl max-w-xs w-full p-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-bold text-emerald-900">Reporte guardado</h4>
              <button
                onClick={() => setShowConfirmation(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden mb-3 bg-gray-100">
              <img
                src={lastReportPreview.imageUrl}
                alt="Evidencia del reporte"
                className="w-full h-40 object-cover"
              />
            </div>
            <p className="text-xs text-gray-500 mb-1">Título del reporte</p>
            <p className="text-sm font-semibold text-gray-800">
              {lastReportPreview.title || 'Reporte sin título'}
            </p>
            <button
              onClick={() => setShowConfirmation(false)}
              className="mt-4 w-full py-2 eco-forest-btn rounded-xl text-xs font-semibold"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {activeReportPreview && (
        <div
          className="fixed inset-0 z-[2200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setActiveReportPreview(null)}
        >
          <div
            className="eco-forest-card rounded-3xl max-w-sm w-full p-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-bold text-emerald-900">Detalle del reporte</h4>
              <button
                onClick={() => setActiveReportPreview(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden mb-3 bg-gray-100">
              <img
                src={activeReportPreview.imageUrl}
                alt="Evidencia del reporte"
                className="w-full h-52 object-cover"
              />
            </div>
            <p className="text-xs text-gray-500 mb-1">
              {activeReportPreview.user} • {activeReportPreview.date}
            </p>
            <p className="text-sm font-semibold text-gray-800 mb-1">
              {activeReportPreview.title}
            </p>
            {activeReportPreview.description && (
              <p className="text-xs text-gray-600">
                {activeReportPreview.description}
              </p>
            )}
            <button
              onClick={() => setActiveReportPreview(null)}
              className="mt-4 w-full py-2 eco-forest-btn rounded-xl text-xs font-semibold"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-slideUp { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        /* Ensure popup styles are consistent */
        .leaflet-popup-content-wrapper {
          border-radius: 12px;
          padding: 0;
          overflow: hidden;
        }
        .leaflet-popup-content {
          margin: 8px 12px;
        }
        .leaflet-popup-tip {
          box-shadow: none;
        }
      `}</style>
    </div>
  );
};

export default Monitoring;
