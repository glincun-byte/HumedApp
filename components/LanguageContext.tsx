import React, { createContext, useContext, useEffect, useState } from 'react';

export type LanguageCode = 'es' | 'en';

interface LanguageContextValue {
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  t: (key: string, fallback: string) => string;
}

const translations: Record<LanguageCode, Record<string, string>> = {
  es: {
    'nav.home': 'Inicio',
    'nav.monitoring': 'Monitoreo',
    'nav.education': 'Educación',
    'nav.community': 'Comunidad',
    'nav.memory': 'Memoria',
    'nav.bot': 'Bot',
  },
  en: {
    'nav.home': 'Home',
    'nav.monitoring': 'Monitoring',
    'nav.education': 'Education',
    'nav.community': 'Community',
    'nav.memory': 'Memory',
    'nav.bot': 'Bot',
  },
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<LanguageCode>('es');

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('ecovigia_lang');
      if (stored === 'es' || stored === 'en') {
        setLangState(stored);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const setLang = (next: LanguageCode) => {
    setLangState(next);
    try {
      window.localStorage.setItem('ecovigia_lang', next);
    } catch {
      // ignore storage errors
    }
  };

  const t = (key: string, fallback: string) => {
    const dict = translations[lang] || {};
    return dict[key] ?? fallback;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage debe usarse dentro de LanguageProvider');
  }
  return ctx;
};

