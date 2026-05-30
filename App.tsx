
import React, { useEffect, useRef, useState } from 'react';
import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import Monitoring from './components/Monitoring';
import Education from './components/Education';
import Participation from './components/Participation';
import Culture from './components/Culture';
import Chatbot from './components/Chatbot';
import { AppTab } from './types';
import { AuthProvider, useAuth } from './components/AuthContext';
import AuthScreen from './components/AuthScreen';
import UserProfilePanel from './components/UserProfilePanel';
import { Menu } from 'lucide-react';
import { NotificationProvider, useNotifications } from './components/NotificationContext';
import { supabase } from './services/supabaseClient';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.HOME);
  const { user, loading } = useAuth();
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const { requestPermission, notify } = useNotifications();
  const seenNewsIdsRef = useRef<Set<string>>(new Set());
  const seenRiskReportIdsRef = useRef<Set<string>>(new Set());
  const seenEducationEventIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    requestPermission().catch(() => undefined);
  }, [requestPermission]);

  useEffect(() => {
    const newsChannel = supabase
      .channel('global-news-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'news' },
        payload => {
          const row = payload.new as any;
          if (!row?.id || seenNewsIdsRef.current.has(row.id)) return;
          seenNewsIdsRef.current.add(row.id);
          notify('Nueva noticia publicada', {
            body: row.title ? String(row.title) : 'Hay una nueva noticia del humedal.',
          });
        }
      )
      .subscribe();

    const reportsChannel = supabase
      .channel('global-risk-reports-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reports' },
        payload => {
          const row = payload.new as any;
          if (!row?.id || seenRiskReportIdsRef.current.has(row.id)) return;
          if (row.type !== 'emergency') return;
          seenRiskReportIdsRef.current.add(row.id);
          notify('Nuevo reporte de riesgo', {
            body: row.title ? String(row.title) : 'Se registró un nuevo riesgo en el humedal.',
          });
        }
      )
      .subscribe();

    const educationEventsChannel = supabase
      .channel('global-education-events-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'education_events' },
        payload => {
          const row = payload.new as any;
          if (!row?.id || seenEducationEventIdsRef.current.has(row.id)) return;
          seenEducationEventIdsRef.current.add(row.id);
          notify('Nuevo evento de educación ambiental', {
            body: row.title
              ? `${String(row.title)} · ${row.event_date ?? ''}${row.event_time ? ` ${String(row.event_time).slice(0, 5)}` : ''}`.trim()
              : 'Se publicó un nuevo evento ambiental.',
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(newsChannel);
      supabase.removeChannel(reportsChannel);
      supabase.removeChannel(educationEventsChannel);
    };
  }, [notify]);

  const renderContent = () => {
    switch (activeTab) {
      case AppTab.HOME:
        return <Dashboard setActiveTab={setActiveTab} />;
      case AppTab.MONITORING:
        return user ? <Monitoring /> : <AuthScreen />;
      case AppTab.EDUCATION:
        return <Education />;
      case AppTab.PARTICIPATION:
        return user ? <Participation /> : <AuthScreen />;
      case AppTab.CULTURE:
        return <Culture />;
      case AppTab.CHAT:
        return <Chatbot />;
      default:
        return <Dashboard setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div
      className="h-[100dvh] safe-area-bottom overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url('/ecovigia-wetland-bg.png')` }}
    >
      <main
        className="max-w-md mx-auto h-[100dvh] relative overflow-x-hidden overflow-y-auto overscroll-none shadow-2xl border border-emerald-900/20 bg-cover bg-center"
        style={{
          backgroundImage: `url('/ecovigia-wetland-bg.png')`,
        }}
      >
        <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-white/30 via-transparent to-emerald-950/30" />
        {user && (
          <div
            className="sticky top-0 z-30 px-4 pb-2 bg-gradient-to-b from-white/35 via-white/15 to-transparent backdrop-blur-[1px]"
            style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 38px)' }}
          >
            <div className="w-full flex items-center justify-between gap-3">
              <div className="bg-white/85 px-3 py-1.5 rounded-full shadow-md border border-white/80 flex items-center gap-2 min-w-0 backdrop-blur-md">
                <span className="text-1xl font-extrabold text-emerald-900 tracking-tight">
                  EcoVigia!
                </span>
                <span className="w-px h-5 bg-emerald-200" />
                <img
                  src="/Logo-Pagina-Uniagustiniana.webp"
                  alt="Universidad Uniagustiniana"
                  className="h-6 md:h-7 object-contain"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowProfilePanel(true)}
                className="bg-white/85 backdrop-blur-md border border-white/80 shadow-md w-11 h-11 rounded-full flex items-center justify-center text-emerald-800 active:scale-95 transition-transform shrink-0"
                aria-label="Abrir menú de perfil"
                disabled={loading || !user}
              >
                <Menu size={20} />
              </button>
            </div>
          </div>
        )}
        <div
          className="relative z-10"
          style={{
            paddingTop: user ? 0 : 'max(env(safe-area-inset-top, 0px), 38px)',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 112px)',
          }}
        >
          {loading ? (
            <div className="p-6 text-center text-gray-500 text-sm">Cargando sesión...</div>
          ) : (
            renderContent()
          )}
        </div>
      </main>
      {showProfilePanel && <UserProfilePanel onClose={() => setShowProfilePanel(false)} />}
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      
      {/* Global CSS for animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out forwards;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .eco-card {
          background: rgba(255, 255, 255, 0.88);
          border: 1px solid rgba(255, 255, 255, 0.78);
          backdrop-filter: blur(6px);
          box-shadow: 0 10px 28px rgba(15, 35, 26, 0.14);
        }
        .eco-card-soft {
          background: rgba(248, 252, 250, 0.82);
          border: 1px solid rgba(255, 255, 255, 0.72);
          backdrop-filter: blur(5px);
          box-shadow: 0 6px 20px rgba(15, 35, 26, 0.1);
        }
        .eco-forest-card {
          background: linear-gradient(145deg, rgba(4,78,52,0.94), rgba(12,87,66,0.88) 52%, rgba(12,109,80,0.82));
          border: 1px solid rgba(220, 252, 231, 0.25);
          box-shadow: 0 12px 28px rgba(5, 46, 35, 0.36);
          color: #ecfdf5;
        }
        .eco-forest-soft-card {
          background: linear-gradient(145deg, rgba(4,78,52,0.78), rgba(12,87,66,0.72) 52%, rgba(12,109,80,0.66));
          border: 1px solid rgba(220, 252, 231, 0.2);
          box-shadow: 0 10px 24px rgba(5, 46, 35, 0.28);
          color: #ecfdf5;
        }
        .eco-forest-btn {
          background: linear-gradient(145deg, rgba(4,78,52,0.94), rgba(12,87,66,0.88) 52%, rgba(12,109,80,0.82));
          border: 1px solid rgba(220, 252, 231, 0.28);
          color: #f0fdf4;
          box-shadow: 0 10px 24px rgba(5, 46, 35, 0.35);
        }
        .eco-forest-soft-card .text-black,
        .eco-forest-soft-card .text-gray-800,
        .eco-forest-soft-card .text-gray-700,
        .eco-forest-soft-card .text-gray-600,
        .eco-forest-soft-card .text-gray-500,
        .eco-forest-soft-card .text-gray-400,
        .eco-forest-soft-card .text-emerald-900,
        .eco-forest-soft-card .text-emerald-800,
        .eco-forest-soft-card .text-emerald-700,
        .eco-forest-soft-card .text-emerald-600 {
          color: #d1fae5 !important;
        }
        .eco-forest-card .text-black,
        .eco-forest-card .text-gray-800,
        .eco-forest-card .text-gray-700,
        .eco-forest-card .text-gray-600,
        .eco-forest-card .text-gray-500,
        .eco-forest-card .text-gray-400,
        .eco-forest-card .text-emerald-900,
        .eco-forest-card .text-emerald-800,
        .eco-forest-card .text-emerald-700,
        .eco-forest-card .text-emerald-600 {
          color: #d1fae5 !important;
        }
      `}</style>
    </div>
  );
};

const App: React.FC = () => (
  <AuthProvider>
    <NotificationProvider>
      <AppContent />
    </NotificationProvider>
  </AuthProvider>
);

export default App;
