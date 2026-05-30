
import React from 'react';
import { Home, Eye, GraduationCap, Users, Map, MessageSquare } from 'lucide-react';
import { AppTab } from '../types';
import { useLanguage } from './LanguageContext';

interface NavigationProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
}

const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => {
  const { t } = useLanguage();

  const navItems = [
    { id: AppTab.HOME, icon: Home, labelKey: 'nav.home', fallback: 'Inicio' },
    { id: AppTab.MONITORING, icon: Eye, labelKey: 'nav.monitoring', fallback: 'Monitoreo' },
    { id: AppTab.EDUCATION, icon: GraduationCap, labelKey: 'nav.education', fallback: 'Educación' },
    { id: AppTab.PARTICIPATION, icon: Users, labelKey: 'nav.community', fallback: 'Comunidad' },
    { id: AppTab.CULTURE, icon: Map, labelKey: 'nav.memory', fallback: 'Memoria' },
    { id: AppTab.CHAT, icon: MessageSquare, labelKey: 'nav.bot', fallback: 'Bot' },
  ];

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-[2600] px-4 pb-3"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)' }}
    >
      <div className="bg-white/95 backdrop-blur-md border border-white rounded-[26px] px-2 py-2 shadow-[0_-6px_24px_rgba(0,0,0,0.2)] flex justify-around items-center">
        {navItems.map(({ id, icon: Icon, labelKey, fallback }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex flex-col items-center gap-0.5 transition-colors min-w-[44px] ${
              activeTab === id ? 'text-emerald-700' : 'text-slate-500'
            }`}
          >
            <Icon size={22} className={activeTab === id ? 'stroke-[2.5]' : ''} />
            {activeTab === id && (
              <span className="text-[9px] font-semibold uppercase tracking-tight">
                {t(labelKey, fallback)}
              </span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
};

export default Navigation;
