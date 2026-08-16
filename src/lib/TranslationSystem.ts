import { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { API_BASE_URL } from './apiConfig';
import defaultTranslations from '../../translations.json';

let translations: Record<string, Record<string, string>> = (defaultTranslations as any) || {
  tr: {},
  en: {}
};

const listeners = new Set<() => void>();

export const initTranslations = async (): Promise<any> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/translations`);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        translations = {
          ...translations,
          ...data
        };
        notifyListeners();
      }
    }
  } catch (e) {
    // Keep using bundled static translations if offline or network error
  }
  return translations;
};

export const getTranslationsDict = () => translations;

export const updateTranslationsDict = async (newDict: any) => {
  translations = newDict;
  notifyListeners();
  try {
    await fetch(`${API_BASE_URL}/api/translations/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ translations: newDict }),
    });
  } catch (e) {
    console.error('Failed to save translations to server', e);
  }
};

export const addTranslationListener = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export const notifyListeners = () => {
  listeners.forEach(cb => {
    try {
      cb();
    } catch (err) {
      console.error('Translation listener error:', err);
    }
  });
};

export const getCurrentLanguage = (profile?: UserProfile | null): string => {
  return profile?.settings?.language || localStorage.getItem('language') || 'tr';
};

export const changeLanguage = (lang: string) => {
  localStorage.setItem('language', lang);
  notifyListeners();
};

export const t = (key: string, profile?: UserProfile | null, ...args: any[]): string => {
  const lang = getCurrentLanguage(profile);
  const langDict = translations[lang] || translations['tr'] || {};
  let val = langDict[key] || translations['tr']?.[key] || key;

  // Replace args {0}, {1} etc.
  if (args.length > 0) {
    args.forEach((arg, idx) => {
      val = val.replace(new RegExp(`\\{${idx}\\}`, 'g'), String(arg));
    });
  }

  return val;
};

export const useTranslation = (profile?: UserProfile | null) => {
  const [_, setTick] = useState(0);
  useEffect(() => {
    return addTranslationListener(() => setTick((t) => t + 1));
  }, []);

  const translate = (key: string, ...args: any[]) => t(key, profile, ...args);
  const currentLang = getCurrentLanguage(profile);

  return {
    t: translate,
    lang: currentLang,
    setLanguage: changeLanguage,
    allLanguages: getAvailableLanguages(),
  };
};

export const getAvailableLanguages = (): string[] => {
  return Object.keys(translations);
};

