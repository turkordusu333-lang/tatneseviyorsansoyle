export interface CountryInfo {
  code: string;
  nameTr: string;
  nameEn: string;
  flag: string;
}

export const COUNTRIES: CountryInfo[] = [
  { code: 'TR', nameTr: 'Türkiye', nameEn: 'Turkey', flag: '🇹🇷' },
  { code: 'US', nameTr: 'ABD', nameEn: 'USA', flag: '🇺🇸' },
  { code: 'DE', nameTr: 'Almanya', nameEn: 'Germany', flag: '🇩🇪' },
  { code: 'GB', nameTr: 'Birleşik Krallık', nameEn: 'United Kingdom', flag: '🇬🇧' },
  { code: 'FR', nameTr: 'Fransa', nameEn: 'France', flag: '🇫🇷' },
  { code: 'IT', nameTr: 'İtalya', nameEn: 'Italy', flag: '🇮🇹' },
  { code: 'ES', nameTr: 'İspanya', nameEn: 'Spain', flag: '🇪🇸' },
  { code: 'BR', nameTr: 'Brezilya', nameEn: 'Brazil', flag: '🇧🇷' },
  { code: 'JP', nameTr: 'Japonya', nameEn: 'Japan', flag: '🇯🇵' },
  { code: 'AZ', nameTr: 'Azerbaycan', nameEn: 'Azerbaijan', flag: '🇦🇿' },
  { code: 'NL', nameTr: 'Hollanda', nameEn: 'Netherlands', flag: '🇳🇱' },
  { code: 'CA', nameTr: 'Kanada', nameEn: 'Canada', flag: '🇨🇦' },
];

export function getCountryByCode(code: string | undefined): CountryInfo {
  const c = COUNTRIES.find((x) => x.code === (code || 'TR').toUpperCase());
  return c || { code: 'TR', nameTr: 'Türkiye', nameEn: 'Turkey', flag: '🇹🇷' };
}
