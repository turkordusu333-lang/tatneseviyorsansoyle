import { UserProfile } from '../types';
import { API_BASE_URL } from './apiConfig';

let translations: Record<string, Record<string, string>> = {
  tr: {},
  en: {}
};

const listeners = new Set<() => void>();

export const initTranslations = async (): Promise<any> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/translations`);
    if (res.ok) {
      const data = await res.json();
      translations = data;
      notifyListeners();
    }
  } catch (e) {
    console.error('Failed to fetch translations', e);
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

const notifyListeners = () => {
  listeners.forEach(cb => cb());
};

export const t = (key: string, profile?: UserProfile | null, ...args: any[]): string => {
  const lang = profile?.settings?.language || localStorage.getItem('language') || 'tr';
  const langDict = translations[lang] || translations['tr'] || {};
  let val = langDict[key] || translations['tr']?.[key] || key;

  // Replace args {0}, {1} etc.
  if (args.length > 0) {
    args.forEach((arg, idx) => {
      val = val.replace(`{${idx}}`, String(arg));
    });
  }

  return val;
};

export const getAvailableLanguages = (): string[] => {
  return Object.keys(translations);
};
