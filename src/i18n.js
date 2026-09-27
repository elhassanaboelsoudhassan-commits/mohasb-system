import React, { createContext, useContext, useState, useEffect } from 'react';
import arTranslations from './locales/ar.json';
import enTranslations from './locales/en.json';

export const translations = {
  ar: arTranslations,
  en: enTranslations
};

export function t(key, lang = 'ar') {
  // If lang is not provided or null, try reading from localStorage
  const currentLang = lang || (typeof window !== 'undefined' ? localStorage.getItem('suwayan_lang') || 'ar' : 'ar');
  return translations[currentLang]?.[key] || translations['ar']?.[key] || key;
}

export const LanguageContext = createContext({
  lang: 'ar',
  setLang: () => {},
  toggleLang: () => {},
  t: (key) => key,
  isRtl: true
});

export function LanguageProvider({ children, currentLang, onToggleLang }) {
  const [lang, setLangState] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('suwayan_lang') || 'ar';
    }
    return 'ar';
  });

  const activeLang = currentLang || lang;

  const toggleLang = () => {
    const nextLang = activeLang === 'ar' ? 'en' : 'ar';
    if (onToggleLang) {
      onToggleLang(nextLang);
    } else {
      setLangState(nextLang);
      localStorage.setItem('suwayan_lang', nextLang);
      document.documentElement.dir = nextLang === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = nextLang;
    }
  };

  useEffect(() => {
    document.documentElement.dir = activeLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = activeLang;
  }, [activeLang]);

  const translate = (key) => t(key, activeLang);

  return (
    <LanguageContext.Provider value={{
      lang: activeLang,
      setLang: setLangState,
      toggleLang,
      t: translate,
      isRtl: activeLang === 'ar'
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(LanguageContext);
  if (!context) {
    const fallbackLang = typeof window !== 'undefined' ? localStorage.getItem('suwayan_lang') || 'ar' : 'ar';
    return {
      lang: fallbackLang,
      isRtl: fallbackLang === 'ar',
      t: (key) => t(key, fallbackLang),
      toggleLang: () => {}
    };
  }
  return context;
}
