
import React, { useEffect, useState, useRef } from 'react';
import { AppTab } from '../types';
import {
  CloudSun,
  Thermometer,
  Droplet,
  CircleDot,
  Waves,
  ShieldCheck,
  AlertTriangle,
  Bird,
  ChevronRight,
  PlusCircle,
  Image as ImageIcon,
  X,
  Edit2,
  Trash2,
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';

interface DashboardProps {
  setActiveTab: (tab: AppTab) => void;
}

interface NewsItem {
  id: string | number;
  title: string;
  summary: string;
  image_url?: string | null;
  published_at?: string | null;
}

interface ClimateReading {
  temperature: number;
  ph: number;
  tds: number;
  ntu: number;
  quality: string;
  created_at?: string;
}

const Dashboard: React.FC<DashboardProps> = ({ setActiveTab }) => {
  const wetlandNewsFallbackImage = '/ecovigia-wetland-bg.png';
  const [news, setNews] = useState<NewsItem[]>([]);
  const [climate, setClimate] = useState<ClimateReading | null>(null);
  const [climateError, setClimateError] = useState<string | null>(null);
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [newsTitle, setNewsTitle] = useState('');
  const [newsSummary, setNewsSummary] = useState('');
  const [newsImagePreview, setNewsImagePreview] = useState<string | null>(null);
  const [editingNewsId, setEditingNewsId] = useState<string | number | null>(null);
  const [savingNews, setSavingNews] = useState(false);
  const fileInputCameraRef = useRef<HTMLInputElement | null>(null);
  const fileInputGalleryRef = useRef<HTMLInputElement | null>(null);
  const [showNewsCamera, setShowNewsCamera] = useState(false);
  const newsVideoRef = useRef<HTMLVideoElement | null>(null);
  const newsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const { lang } = useLanguage();

  const qualityBadge = (q?: string | null) => {
    const value = (q || '').toLowerCase();
    if (value.includes('deficiente') || value.includes('mala')) return { label: q || 'Deficiente', cls: 'bg-red-100 text-red-700' };
    if (value.includes('regular')) return { label: q || 'Regular', cls: 'bg-amber-100 text-amber-700' };
    if (value.includes('buena') || value.includes('óptima') || value.includes('optima')) return { label: q || 'Óptima', cls: 'bg-emerald-100 text-emerald-700' };
    return { label: q || 'Sin dato', cls: 'bg-slate-100 text-slate-600' };
  };

  useEffect(() => {
    const loadNews = async () => {
      try {
        if (!navigator.onLine) {
          const cached = window.localStorage.getItem('ecovigia_news');
          if (cached) {
            setNews(JSON.parse(cached));
          }
          return;
        }

        const { data, error } = await supabase
          .from('news')
          .select('id, title, summary, image_url, published_at')
          .order('published_at', { ascending: false })
          .limit(5);

        if (!error && data) {
          const items = data as NewsItem[];
          setNews(items);
          try {
            window.localStorage.setItem('ecovigia_news', JSON.stringify(items));
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore fetch errors, se usará caché si existe
      }
    };

    loadNews().catch(() => {
      // Silenciar errores en UI; se puede loguear si es necesario
    });
  }, []);

  useEffect(() => {
    const loadClimate = async () => {
      try {
        const { data, error } = await supabase
          .from('climate_readings')
          .select('temperature, ph, tds, ntu, quality, created_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!error && data) {
          setClimate(data as ClimateReading);
          setClimateError(null);
        } else if (error) {
          setClimateError(error.message || 'No se pudo cargar climate_readings');
        }
      } catch (e: any) {
        setClimateError(e?.message || 'No se pudo cargar climate_readings');
      }
    };

    loadClimate().catch(() => undefined);

    const channel = supabase
      .channel('dashboard-climate-readings')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'climate_readings' },
        payload => {
          const row = payload.new as any;
          if (!row) return;
          setClimate({
            temperature: Number(row.temperature),
            ph: Number(row.ph),
            tds: Number(row.tds),
            ntu: Number(row.ntu),
            quality: String(row.quality ?? ''),
            created_at: row.created_at,
          });
          setClimateError(null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const loadRole = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (!error && data?.role === 'admin') {
        setIsAdmin(true);
      }
    };
    loadRole().catch(() => undefined);
  }, [user]);

  const startNewsCamera = () => {
    setShowNewsCamera(true);
  };

  const stopNewsCamera = () => {
    if (newsVideoRef.current && newsVideoRef.current.srcObject) {
      const tracks = (newsVideoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      newsVideoRef.current.srcObject = null;
    }
    setShowNewsCamera(false);
  };

  const captureNewsPhoto = () => {
    if (newsVideoRef.current && newsCanvasRef.current) {
      const video = newsVideoRef.current;
      const canvas = newsCanvasRef.current;
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, width, height);
        const imgData = canvas.toDataURL('image/jpeg');
        setNewsImagePreview(imgData);
        stopNewsCamera();
      }
    }
  };

  useEffect(() => {
    const setupNewsStream = async () => {
      if (!showNewsCamera) return;

      const isSecure =
        (window as any).isSecureContext ||
        window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';

      if (!isSecure) {
        alert(
          'La cámara solo funciona en conexiones seguras (https o localhost). Abre la app en https o usa localhost.'
        );
        setShowNewsCamera(false);
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Tu navegador no soporta acceso directo a la cámara.');
        setShowNewsCamera(false);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });

        const video = newsVideoRef.current;
        if (video) {
          video.srcObject = stream;
          const playPromise = video.play();
          if (playPromise && typeof playPromise.then === 'function') {
            playPromise.catch(err => {
              console.warn('No se pudo reproducir el video de la cámara para noticias:', err);
            });
          }
        }
      } catch (err) {
        console.error('Error accediendo a la cámara para noticias:', err);
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
        setShowNewsCamera(false);
      }
    };

    setupNewsStream().catch(() => undefined);

    return () => {
      if (showNewsCamera) {
        if (newsVideoRef.current && newsVideoRef.current.srcObject) {
          const tracks = (newsVideoRef.current.srcObject as MediaStream).getTracks();
          tracks.forEach(track => track.stop());
        }
      }
    };
  }, [showNewsCamera]);

  const handleNewsImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert(
        lang === 'en'
          ? 'Please select a valid image for the news item.'
          : 'Por favor selecciona una imagen válida para la noticia.'
      );
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setNewsImagePreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !newsTitle.trim() || !newsSummary.trim()) return;
    setSavingNews(true);

    let data: any = null;
    let error: any = null;

    if (editingNewsId) {
      const response = await supabase
        .from('news')
        .update({
          title: newsTitle.trim(),
          summary: newsSummary.trim(),
          image_url: newsImagePreview,
        })
        .eq('id', editingNewsId)
        .select('id, title, summary, image_url, published_at')
        .single();
      data = response.data;
      error = response.error;
    } else {
      const response = await supabase
        .from('news')
        .insert({
          title: newsTitle.trim(),
          summary: newsSummary.trim(),
          image_url: newsImagePreview,
        })
        .select('id, title, summary, image_url, published_at')
        .single();
      data = response.data;
      error = response.error;
    }

    if (!error && data) {
      const newItem: NewsItem = {
        id: data.id,
        title: data.title,
        summary: data.summary,
        image_url: data.image_url,
        published_at: data.published_at,
      };
      setNews(prev => {
        const withoutOld = prev.filter(n => n.id !== newItem.id);
        return [newItem, ...withoutOld].slice(0, 5);
      });
      setNewsTitle('');
      setNewsSummary('');
      setNewsImagePreview(null);
      setEditingNewsId(null);
      if (fileInputCameraRef.current) fileInputCameraRef.current.value = '';
      if (fileInputGalleryRef.current) fileInputGalleryRef.current.value = '';
    } else if (error) {
      alert(
        lang === 'en'
          ? 'The news item could not be saved. Check your admin permissions.'
          : 'No se pudo guardar la noticia. Verifica tus permisos de administrador.'
      );
    }

    setSavingNews(false);
  };

  const handleDeleteNews = async (id: string | number) => {
    if (
      !window.confirm(
        lang === 'en'
          ? 'Are you sure you want to delete this news item? This action cannot be undone.'
          : '¿Seguro que deseas eliminar esta noticia? Esta acción no se puede deshacer.'
      )
    ) {
      return;
    }
    const { error } = await supabase.from('news').delete().eq('id', id);
    if (error) {
      alert(
        lang === 'en'
          ? 'The news item could not be deleted.'
          : 'No se pudo eliminar la noticia.'
      );
    } else {
      setNews(prev => prev.filter(n => n.id !== id));
      if (editingNewsId === id) {
        setEditingNewsId(null);
        setNewsTitle('');
        setNewsSummary('');
        setNewsImagePreview(null);
      }
    }
  };

  return (
    <div className="flex flex-col gap-5 p-4 animate-fadeIn text-black">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl leading-[0.95] font-black text-emerald-950 tracking-tight">EcoVigia!</h1>
        <p className="text-slate-600 text-base">
          {lang === 'en'
            ? 'Explore and protect the Techo Wetland'
            : 'Explora y protege el Humedal de Techo'}
        </p>
      </header>

      {/* Acción principal destacada */}
      <button
        onClick={() => setActiveTab(AppTab.MONITORING)}
        className="relative overflow-hidden px-5 py-4 rounded-[24px] flex items-center justify-between gap-3 active:scale-[0.99] transition-transform shadow-[0_12px_28px_rgba(146,64,14,0.35)] border border-amber-100/60"
        style={{
          background:
            'linear-gradient(145deg, rgba(180,83,9,0.95), rgba(217,119,6,0.9) 52%, rgba(245,158,11,0.82))',
        }}
      >
        <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-white/20 blur-xl" />
        <div className="w-11 h-11 rounded-full bg-white/18 text-white flex items-center justify-center shrink-0 border border-white/30">
          <AlertTriangle size={22} />
        </div>
        <div className="text-left flex-1 relative z-10">
          <span className="font-extrabold text-lg block text-white leading-6">
            {lang === 'en' ? 'Report' : 'Reportar'}
          </span>
          <span className="text-[12px] text-amber-50/95">
            {lang === 'en'
              ? 'Report sightings or risks now'
              : 'Reporta avistamientos o riesgos ahora'}
          </span>
        </div>
        <ChevronRight size={24} className="text-white relative z-10" />
      </button>

      {/* Climate data */}
      <section className="eco-card p-4 rounded-[24px]">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <CloudSun size={18} className="text-emerald-700" />
            <div className="leading-tight">
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-800">
                {lang === 'en' ? 'Techo Wetland' : 'Humedal de Techo'}
              </p>
              <p className="text-[10px] text-slate-500">
                {lang === 'en'
                  ? 'Current environmental data'
                  : 'Datos ambientales actuales'}
              </p>
            </div>
          </div>
          <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
            ● {lang === 'en' ? 'Real-time' : 'En tiempo real'}
          </span>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
          <div className="grid grid-cols-1 gap-2.5">
            <div className="rounded-xl bg-white p-3 border border-slate-100 flex items-center justify-between gap-3">
              <div>
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mb-2">
                <Thermometer size={20} className="text-emerald-600" />
              </div>
              <p className="text-[11px] text-slate-500">Temperatura</p>
              </div>
              <div className="text-right">
              <p className="text-md font-extrabold text-slate-900">
                {climate?.temperature ?? '--'}<span className="text-base font-semibold">°C</span>
              </p>
              </div>
            </div>
            <div className="rounded-xl bg-white p-3 border border-slate-100 flex items-center justify-between gap-3">
              <div>
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                <Droplet size={20} className="text-blue-600" />
              </div>
              <p className="text-[11px] text-slate-500">pH</p>
              </div>
              <div className="text-right">
              <p className="text-md font-extrabold text-slate-900">{climate?.ph ?? '--'}</p>
              </div>
            </div>
            <div className="rounded-xl bg-white p-3 border border-slate-100 flex items-center justify-between gap-3">
              <div>
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center mb-2">
                <CircleDot size={20} className="text-indigo-600" />
              </div>
              <p className="text-[11px] text-slate-500">TDS</p>
              </div>
              <div className="text-right">
              <p className="text-md font-extrabold text-slate-900">
                {climate?.tds ?? '--'} <span className="text-sm font-semibold">ppm</span>
              </p>
              </div>
            </div>
            <div className="rounded-xl bg-white p-3 border border-slate-100 flex items-center justify-between gap-3">
              <div>
              <div className="w-10 h-10 rounded-full bg-cyan-100 flex items-center justify-center mb-2">
                <Waves size={20} className="text-cyan-600" />
              </div>
              <p className="text-[11px] text-slate-500">NTU</p>
              </div>
              <div className="text-right">
              <p className="text-md font-extrabold text-slate-900">
                {climate?.ntu ?? '--'} <span className="text-sm font-semibold">NTU</span>
              </p>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-xl bg-white border border-slate-100 px-3 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <ShieldCheck size={20} className="text-emerald-700" />
              </div>
              <span className="text-sm text-slate-600">Calidad del agua</span>
            </div>
            <span className="text-md font-extrabold text-emerald-700">
              {climate?.quality || '--'}
            </span>
          </div>

          {climate?.created_at && (
            <div className="text-[11px] text-slate-500 mt-2">
              Actualizado: {new Date(climate.created_at).toLocaleString()}
            </div>
          )}
          {climateError && (
            <div className="text-[11px] text-amber-700 mt-2">
              No se pudo leer `climate_readings`: {climateError}
            </div>
          )}
        </div>
      </section>

      {/* Featured Card */}
      <div
        className="relative h-40 rounded-[26px] overflow-hidden shadow-xl cursor-pointer group"
        onClick={() => setActiveTab(AppTab.EDUCATION)}
        style={{
          backgroundImage:
            "linear-gradient(145deg, rgba(4,78,52,0.94), rgba(12,87,66,0.88) 52%, rgba(12,109,80,0.82)), url('/ecovigia-wetland-bg.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'bottom center',
        }}
      >
        <div className="absolute inset-0 flex flex-col justify-between p-5">
          <div className="flex justify-between items-center h-full">
            <div className="max-w-[78%]">
              <h2 className="text-white text-[23px] font-extrabold drop-shadow-sm leading-8">
                {lang === 'en' ? 'Local biodiversity' : 'Biodiversidad Local'}
              </h2>
              <p className="text-white/90 text-[15px] leading-6">
                {lang === 'en'
                  ? 'Discover the birds, plants, amphibians and insects of the wetland.'
                  : 'Conoce las aves, plantas, anfibios e insectos del humedal.'}
              </p>
            </div>
            <div className="flex items-center gap-2 text-lime-200/95 drop-shadow-sm">
              <Bird size={24} />
              <ChevronRight size={28} className="text-white/90" />
            </div>
          </div>
        </div>
      </div>

      {showNewsCamera && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-2xl overflow-hidden w-full max-w-sm mx-4 border border-emerald-500/40">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
              <p className="text-xs font-semibold text-emerald-100 uppercase tracking-widest">
                Tomar foto para noticia
              </p>
              <button
                type="button"
                onClick={stopNewsCamera}
                className="text-gray-300 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-3 flex flex-col gap-3">
              <div className="relative rounded-xl overflow-hidden bg-black h-56 flex items-center justify-center">
                <video
                  ref={newsVideoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  autoPlay
                  muted
                />
              </div>
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={captureNewsPhoto}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-full text-xs font-semibold shadow-lg active:scale-95"
                >
                  Capturar foto
                </button>
                <button
                  type="button"
                  onClick={stopNewsCamera}
                  className="text-xs text-gray-300 hover:text-white px-3 py-2"
                >
                  Cancelar
                </button>
              </div>
              <canvas ref={newsCanvasRef} className="hidden" />
            </div>
          </div>
        </div>
      )}

      <section>
        <h3 className="text-xl font-bold text-emerald-50 mb-3 ">
          {lang === 'en' ? 'Recent news' : 'Noticias Recientes'}
        </h3>
        {isAdmin && (
          <form
            onSubmit={handleSaveNews}
            className="mb-4 eco-card rounded-2xl p-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <PlusCircle size={16} className="text-emerald-600" />
                <p className="text-[10px] font-semibold text-gray-500 uppercase">
                  {lang === 'en'
                    ? 'Manage news (admins)'
                    : 'Gestionar noticias (admins)'}
                </p>
              </div>
              {editingNewsId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingNewsId(null);
                    setNewsTitle('');
                    setNewsSummary('');
                    setNewsImagePreview(null);
                    if (fileInputCameraRef.current)
                      fileInputCameraRef.current.value = '';
                    if (fileInputGalleryRef.current)
                      fileInputGalleryRef.current.value = '';
                  }}
                  className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-1"
                >
                  <X size={12} />
                  {lang === 'en' ? 'Cancel' : 'Cancelar'}
                </button>
              )}
            </div>
            <input
              type="text"
              placeholder={
                lang === 'en' ? 'News title' : 'Título de la noticia'
              }
              value={newsTitle}
              onChange={e => setNewsTitle(e.target.value)}
              className="w-full p-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
            <textarea
              placeholder={
                lang === 'en' ? 'News summary' : 'Resumen de la noticia'
              }
              value={newsSummary}
              onChange={e => setNewsSummary(e.target.value)}
              className="w-full p-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              rows={2}
              required
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={startNewsCamera}
                className="flex-1 py-1.5 rounded-xl border border-dashed border-emerald-200 text-[10px] text-emerald-700 flex items-center justify-center gap-1 bg-emerald-50/40"
              >
                <ImageIcon size={14} />
                {lang === 'en' ? 'Take photo' : 'Tomar foto'}
              </button>
              <button
                type="button"
                onClick={() => fileInputGalleryRef.current?.click()}
                className="flex-1 py-1.5 rounded-xl border border-dashed border-emerald-200 text-[10px] text-emerald-700 flex items-center justify-center gap-1 bg-emerald-50/10"
              >
                <ImageIcon size={14} />
                {lang === 'en' ? 'Upload image' : 'Subir imagen'}
              </button>
              <input
                ref={fileInputCameraRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleNewsImageChange}
              />
              <input
                ref={fileInputGalleryRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleNewsImageChange}
              />
            </div>
            {newsImagePreview && (
              <div className="mt-1 rounded-xl overflow-hidden border border-emerald-50">
                <img
                  src={newsImagePreview}
                  alt={
                    lang === 'en'
                      ? 'News preview'
                      : 'Previsualización noticia'
                  }
                  className="w-full h-20 object-cover"
                />
              </div>
            )}
            <button
              type="submit"
              disabled={savingNews}
              className="w-full mt-1 py-1.5 bg-emerald-600 text-white rounded-xl text-[11px] font-semibold disabled:opacity-60"
            >
              {savingNews
                ? lang === 'en'
                  ? 'Saving...'
                  : 'Guardando...'
                : editingNewsId
                ? lang === 'en'
                  ? 'Save changes'
                  : 'Guardar cambios'
                : lang === 'en'
                ? 'Publish news'
                : 'Publicar noticia'}
            </button>
          </form>
        )}
        <div className="flex flex-col gap-3">
          {(news.length ? news : [
            {
              id: 1,
              title:
                lang === 'en'
                  ? 'Community clean‑up day'
                  : 'Jornada de limpieza comunitaria',
              summary:
                lang === 'en'
                  ? 'This Saturday we will gather to restore the northern area of the wetland.'
                  : 'Este sábado nos reuniremos para restaurar la zona norte del humedal.',
              image_url: null,
              published_at: null,
            },
            {
              id: 2,
              title:
                lang === 'en'
                  ? 'Notable sighting of Blue Gallinule'
                  : 'Avistamiento destacado de Tingua Azul',
              summary:
                lang === 'en'
                  ? 'Rangers report an increase in sightings in the central area.'
                  : 'Guardaparques registran aumento de avistamientos en la zona central.',
              image_url: null,
              published_at: null,
            },
          ]).map((item) => (
            <div key={item.id} className="eco-card-soft p-3 rounded-2xl flex gap-3">
              <div className="w-20 h-20 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                <img
                  src={item.image_url || wetlandNewsFallbackImage}
                  alt="News"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col justify-center flex-1">
                <h4 className="font-semibold text-sm line-clamp-1">{item.title}</h4>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.summary}</p>
                {item.published_at && (
                  <span className="text-[10px] text-emerald-600 font-bold mt-2">
                    {new Date(item.published_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              {isAdmin && (
                <div className="flex flex-col gap-1 items-end">
                  <button
                    onClick={() => {
                      setEditingNewsId(item.id);
                      setNewsTitle(item.title);
                      setNewsSummary(item.summary);
                      setNewsImagePreview(item.image_url || null);
                    }}
                    className="text-[10px] text-emerald-600 hover:text-emerald-800 flex items-center gap-1"
                  >
                    <Edit2 size={12} />
                    {lang === 'en' ? 'Edit' : 'Editar'}
                  </button>
                  <button
                    onClick={() => handleDeleteNews(item.id)}
                    className="text-[10px] text-red-500 hover:text-red-700 flex items-center gap-1"
                  >
                    <Trash2 size={12} />
                    {lang === 'en' ? 'Delete' : 'Eliminar'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
