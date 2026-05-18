import { useEffect, useMemo, useRef, useState, useCallback, createContext, useContext } from 'react';
import Papa from 'papaparse';
import { NavLink, Route, Routes, useSearchParams } from 'react-router-dom';
import ecnaLogo from './assets/logo.png';
import { t, type Lang } from './i18n';

declare const google: any;

// ── Language Context ──
const LangContext = createContext<{ lang: Lang; toggleLang: () => void }>({
  lang: 'tr',
  toggleLang: () => {},
});
const useLang = () => useContext(LangContext);

type RadiusKm = 30 | 50 | 100 | 'all';

type RawStation = {
  id: string;
  ad: string;
  hizmet: string;
  marka: string;
  adres: string;
  sehir: string;
  yesil: boolean;
  ac_fiyat: number | null;
  dc_fiyat: number | null;
  soket_ozet: string;
  soket_sayisi: number;
  max_guc: number;
  has_ac: boolean;
  has_dc: boolean;
  lat?: number;
  lng?: number;
};

type Station = {
  id: string;
  name: string;
  brand: string;
  serviceType: string;
  address: string;
  city: string;
  isGreen: boolean;
  acPrice: number | null;
  dcPrice: number | null;
  socketSummary: string;
  socketCount: number;
  maxPower: number;
  hasAC: boolean;
  hasDC: boolean;
  lat: number;
  lng: number;
};

/* ─── constants ─── */
const CITY_COORDS: Record<string, [number, number]> = {
  'İSTANBUL': [41.0082, 28.9784], 'ISTANBUL': [41.0082, 28.9784],
  'ANKARA': [39.9334, 32.8597],
  'İZMİR': [38.4237, 27.1428], 'IZMIR': [38.4237, 27.1428],
  'BURSA': [40.1885, 29.061],
  'ANTALYA': [36.8969, 30.7133],
  'ADANA': [37.0, 35.3213],
  'KONYA': [37.8746, 32.4932],
  'KOCAELİ': [40.7654, 29.9408], 'KOCAELI': [40.7654, 29.9408],
  'MUĞLA': [37.2153, 28.3636], 'MUGLA': [37.2153, 28.3636],
  'BALIKESİR': [39.6484, 27.8826], 'BALIKESIR': [39.6484, 27.8826],
  'ESKİŞEHİR': [39.7767, 30.5206], 'ESKISEHIR': [39.7767, 30.5206],
  'DENİZLİ': [37.7765, 29.0864], 'DENIZLI': [37.7765, 29.0864],
  'KAYSERİ': [38.7225, 35.4875], 'KAYSERI': [38.7225, 35.4875],
  'SAKARYA': [40.7569, 30.3781],
  'TRABZON': [41.0027, 39.7168],
  'MERSİN': [36.8121, 34.6415], 'MERSIN': [36.8121, 34.6415],
  'GAZİANTEP': [37.0662, 37.3833], 'GAZIANTEP': [37.0662, 37.3833],
  'DİYARBAKIR': [37.9144, 40.2306], 'DIYARBAKIR': [37.9144, 40.2306],
  'SAMSUN': [41.2867, 36.33],
  'HATAY': [36.4018, 36.3498],
  'TEKİRDAĞ': [41.0, 27.5], 'TEKIRDAG': [41.0, 27.5],
  'AYDIN': [37.856, 27.8416],
  'MANİSA': [38.6191, 27.4289], 'MANISA': [38.6191, 27.4289],
  'EDİRNE': [41.6818, 26.5623], 'EDIRNE': [41.6818, 26.5623],
  'ÇANAKKALE': [40.1553, 26.4142], 'CANAKKALE': [40.1553, 26.4142],
  'DÜZCE': [40.8438, 31.1565], 'DUZCE': [40.8438, 31.1565],
  'BOLU': [40.7306, 31.6061],
  'YALOVA': [40.6560, 29.2756],
  'AFYONKARAHİSAR': [38.7507, 30.5567], 'AFYONKARAHISAR': [38.7507, 30.5567],
  'ISPARTA': [37.7648, 30.5566],
  'BURDUR': [37.7203, 30.2906],
  'UŞAK': [38.6746, 29.4058], 'USAK': [38.6746, 29.4058],
  'KÜTAHYA': [39.4242, 29.9833], 'KUTAHYA': [39.4242, 29.9833],
  'BİLECİK': [40.0567, 30.0153], 'BILECIK': [40.0567, 30.0153],
  'ZONGULDAK': [41.4564, 31.7987],
  'KARABÜK': [41.2061, 32.6204], 'KARABUK': [41.2061, 32.6204],
  'BARTIN': [41.6344, 32.3375],
  'SİNOP': [42.0231, 35.1531], 'SINOP': [42.0231, 35.1531],
  'KASTAMONU': [41.3887, 33.7827],
  'ÇORUM': [40.5506, 34.9556], 'CORUM': [40.5506, 34.9556],
  'AMASYA': [40.6499, 35.8353],
  'TOKAT': [40.3167, 36.5544],
  'SİVAS': [39.7477, 37.0179], 'SIVAS': [39.7477, 37.0179],
  'YOZGAT': [39.818, 34.8147],
  'KIRŞEHİR': [39.1425, 34.1709], 'KIRSEHIR': [39.1425, 34.1709],
  'NEVŞEHİR': [38.6939, 34.6857], 'NEVSEHIR': [38.6939, 34.6857],
  'NİĞDE': [37.9667, 34.6833], 'NIGDE': [37.9667, 34.6833],
  'AKSARAY': [38.3687, 34.0370],
  'KIRIKKALe': [39.8468, 33.5153], 'KIRIKKALE': [39.8468, 33.5153],
  'ÇANKIRI': [40.6013, 33.6134], 'CANKIRI': [40.6013, 33.6134],
  'ORDU': [40.9839, 37.8764],
  'GİRESUN': [40.9128, 38.3895], 'GIRESUN': [40.9128, 38.3895],
  'RİZE': [41.0201, 40.5234], 'RIZE': [41.0201, 40.5234],
  'ARTVİN': [41.1828, 41.8183], 'ARTVIN': [41.1828, 41.8183],
  'GÜMÜŞHANE': [40.4386, 39.5086], 'GUMUSHANE': [40.4386, 39.5086],
  'ERZİNCAN': [39.7500, 39.5000], 'ERZINCAN': [39.7500, 39.5000],
  'ERZURUM': [39.9334, 41.2769],
  'KARS': [40.6167, 43.0975],
  'IĞDIR': [39.9200, 44.0450], 'IGDIR': [39.9200, 44.0450],
  'AĞRI': [39.7191, 43.0503], 'AGRI': [39.7191, 43.0503],
  'MUŞ': [38.7432, 41.5064], 'MUS': [38.7432, 41.5064],
  'BİTLİS': [38.4, 42.12], 'BITLIS': [38.4, 42.12],
  'VAN': [38.4946, 43.38],
  'HAKKARİ': [37.5744, 43.7408], 'HAKKARI': [37.5744, 43.7408],
  'SİİRT': [37.9333, 41.9500], 'SIIRT': [37.9333, 41.9500],
  'ŞIRNAK': [37.4187, 42.4918], 'SIRNAK': [37.4187, 42.4918],
  'BATMAN': [37.8812, 41.1351],
  'MARDİN': [37.3212, 40.7245], 'MARDIN': [37.3212, 40.7245],
  'ŞANLIURFA': [37.1591, 38.7969], 'SANLIURFA': [37.1591, 38.7969],
  'ADIYAMAN': [37.7648, 38.2786],
  'MALATYA': [38.3554, 38.3335],
  'ELAZIĞ': [38.6810, 39.2264], 'ELAZIG': [38.6810, 39.2264],
  'TUNCELİ': [39.1079, 39.5401], 'TUNCELI': [39.1079, 39.5401],
  'BİNGÖL': [38.8854, 40.4966], 'BINGOL': [38.8854, 40.4966],
  'KAHRAMANMARAŞ': [37.5858, 36.9371], 'KAHRAMANMARAS': [37.5858, 36.9371],
  'OSMANİYE': [37.0742, 36.2478], 'OSMANIYE': [37.0742, 36.2478],
  'KİLİS': [36.7184, 37.1212], 'KILIS': [36.7184, 37.1212],
  'ARDAHAN': [41.1105, 42.7022],
  'BAYBURT': [40.2552, 40.2249],
};

const TURKEY_CENTER: [number, number] = [39.1, 35.2];

/* ─── utils ─── */
const normalizeCity = (value: string): string =>
  value
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z]/g, '');

const kmBetween = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earth = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earth * Math.asin(Math.sqrt(a));
};

const asFiniteCoord = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value.replace(',', '.').trim());
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};

/** Read latitude/longitude from JSON with common alternate field names */
const readLatLngFromRaw = (raw: RawStation): [number, number] | undefined => {
  const rec = raw as Record<string, unknown>;
  const lat = asFiniteCoord(raw.lat ?? rec.latitude ?? rec.enlem ?? rec.lat_deg);
  const lng = asFiniteCoord(raw.lng ?? rec.longitude ?? rec.boylam ?? rec.lng_deg ?? rec.lon);
  if (lat == null || lng == null) return undefined;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  return [lat, lng];
};



const normalizeServiceLabel = (value: string): string =>
  String(value ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();

const toStation = (raw: RawStation, greenIds: ReadonlySet<string>): Station | null => {
  const cityKey = raw.sehir;
  const base = CITY_COORDS[cityKey] ?? CITY_COORDS[normalizeCity(cityKey)] ?? TURKEY_CENTER;
  let coords = readLatLngFromRaw(raw);

  if (coords && base !== TURKEY_CENTER) {
    const dist = kmBetween(coords[0], coords[1], base[0], base[1]);
    // 200 km'den uzak uyuşmazlıkları ve hatalı geocoding kayıtlarını ele
    if (dist > 200) coords = undefined;
  }

  // Sadece gerçek geocode edilmiş koordinatları kabul et, jitter fallback yapma!
  if (!coords) return null;

  const [lat, lng] = coords;
  const isGreen = Boolean(raw.yesil) || greenIds.has(String(raw.id).trim());

  return {
    id: raw.id,
    name: raw.ad || 'Adsız İstasyon',
    brand: raw.marka || 'Bilinmiyor',
    serviceType: normalizeServiceLabel(raw.hizmet || ''),
    address: raw.adres,
    city: raw.sehir,
    isGreen,
    acPrice: raw.ac_fiyat,
    dcPrice: raw.dc_fiyat,
    socketSummary: raw.soket_ozet,
    socketCount: raw.soket_sayisi,
    maxPower: raw.max_guc,
    hasAC: raw.has_ac,
    hasDC: raw.has_dc,
    lat,
    lng,
  };
};

let cachedStationsPromise: Promise<Station[]> | null = null;

function getStations(): Promise<Station[]> {
  if (cachedStationsPromise) return cachedStationsPromise;
  cachedStationsPromise = (async () => {
    let res = await fetch('/data/stations_v2.geocoded.json');
    if (!res.ok) res = await fetch('/data/stations.json');
    const rawStations: RawStation[] = await res.json();

    const greenIds = new Set<string>();
    try {
      const csvRes = await fetch('/data/green_stations.csv');
      if (csvRes.ok) {
        const parsed = Papa.parse<Record<string, string>>(await csvRes.text(), {
          header: true,
          skipEmptyLines: true,
        });
        const idColumn = parsed.meta.fields?.[0] ?? 'İstasyon No';
        for (const row of parsed.data) {
          const idVal = row[idColumn] ?? '';
          const trimmed = String(idVal).trim();
          if (trimmed) greenIds.add(trimmed);
        }
      }
    } catch {
      /* omit */
    }

    // Sadece koordinatı olan (null dönmeyen) istasyonları haritaya yükle!
    return rawStations
      .map((row) => toStation(row, greenIds))
      .filter((s): s is Station => s !== null);
  })();
  return cachedStationsPromise;
}

/* ─── PWA Install Hook ─── */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function usePwaInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const installed = () => setIsInstalled(true);
    window.addEventListener('appinstalled', installed);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  const install = useCallback(async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    setInstallPrompt(null);
  }, [installPrompt]);

  return { canInstall: !!installPrompt && !isInstalled, install, isInstalled };
}

/* ─── Animated Counter ─── */
function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) {
      setDisplay(value);
      return;
    }
    hasAnimated.current = true;
    const duration = 2000;
    const startTime = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);

  return (
    <span ref={ref}>
      {display.toLocaleString('tr-TR')}{suffix}
    </span>
  );
}

/* ─── ECNALogo ─── */
const ECNALogo = ({ size = 38 }: { size?: number }) => (
  <img
    src={ecnaLogo}
    alt="ECNA Logo"
    width={size}
    height={size}
    className="ecna-logo-img"
    style={{ objectFit: 'contain', display: 'block' }}
  />
);

/* ─── ThemeToggleIcon ─── */
const ThemeToggleIcon = ({ theme }: { theme: 'light' | 'dark' }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ transition: 'transform 0.5s ease', transform: theme === 'dark' ? 'rotate(40deg)' : 'rotate(0deg)' }}
  >
    {theme === 'dark' ? (
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" fill="currentColor" />
    ) : (
      <>
        <circle cx="12" cy="12" r="4" fill="currentColor" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </>
    )}
  </svg>
);

/* ─── Navbar ─── */
function Navbar({ theme, toggleTheme }: { theme: 'light' | 'dark'; toggleTheme: () => void }) {
  const { lang, toggleLang } = useLang();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { canInstall, install } = usePwaInstall();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
    <>
      <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="navbar-inner">
          <NavLink to="/" className="navbar-logo" onClick={() => setMobileOpen(false)}>
            <ECNALogo size={38} />
            <span className="navbar-brand-text">ECNA</span>
          </NavLink>
          <div className="navbar-menu">
            <NavLink to="/" end>{t('nav_home', lang)}</NavLink>
            <NavLink to="/platform">{t('nav_platform', lang)}</NavLink>
            <NavLink to="/map">{t('nav_map', lang)}</NavLink>
            <NavLink to="/route-planner">{t('nav_route', lang)}</NavLink>
            <NavLink to="/stations">{t('nav_stations', lang)}</NavLink>
            <NavLink to="/contact">{t('nav_contact', lang)}</NavLink>
          </div>
          <div className="navbar-right">
            {canInstall && (
              <button className="navbar-install" onClick={install} type="button">
                {t('nav_install', lang)}
              </button>
            )}
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              type="button"
              aria-label="Toggle theme"
            >
              <ThemeToggleIcon theme={theme} />
            </button>
            {/* Language Toggle */}
            <button
              className="lang-toggle"
              onClick={toggleLang}
              type="button"
              title={lang === 'tr' ? 'Switch to English' : "Türkçe'ye Geç"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 5, verticalAlign: 'middle'}}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              <span className="lang-toggle-text">{lang === 'tr' ? 'EN' : 'TR'}</span>
            </button>
            <button
              className="hamburger"
              onClick={() => setMobileOpen(!mobileOpen)}
              type="button"
              aria-label="Menüyü aç"
            >
              <span className={`hamburger-line ${mobileOpen ? 'open' : ''}`} />
              <span className={`hamburger-line ${mobileOpen ? 'open' : ''}`} />
              <span className={`hamburger-line ${mobileOpen ? 'open' : ''}`} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer */}
      <div className={`mobile-drawer ${mobileOpen ? 'open' : ''}`}>
        <div className="mobile-drawer-overlay" onClick={() => setMobileOpen(false)} />
        <div className="mobile-drawer-panel">
          <NavLink to="/" end onClick={() => setMobileOpen(false)}>🏠 {t('nav_home', lang)}</NavLink>
          <NavLink to="/platform" onClick={() => setMobileOpen(false)}>⚙️ {t('nav_platform', lang)}</NavLink>
          <NavLink to="/map" onClick={() => setMobileOpen(false)}>🗺️ {t('nav_map', lang)}</NavLink>
          <NavLink to="/route-planner" onClick={() => setMobileOpen(false)}>🚗 {t('nav_route', lang)}</NavLink>
          <NavLink to="/stations" onClick={() => setMobileOpen(false)}>📍 {t('nav_stations', lang)}</NavLink>
          <NavLink to="/contact" onClick={() => setMobileOpen(false)}>📬 {t('nav_contact', lang)}</NavLink>
          <div className="mobile-drawer-divider" />

          <button className="mobile-theme-toggle" onClick={toggleTheme} type="button">
            <ThemeToggleIcon theme={theme} />
            <span>{theme === 'dark' ? t('theme_light', lang) : t('theme_dark', lang)}</span>
          </button>

          <button className="mobile-theme-toggle" onClick={toggleLang} type="button" style={{gap: 10}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            <span>{lang === 'tr' ? 'English' : 'Türkçe'}</span>
          </button>

          <NavLink to="/map" className="mobile-drawer-cta" onClick={() => setMobileOpen(false)}>
            {t('mobile_explore', lang)}
          </NavLink>
          {canInstall && (
            <button className="mobile-drawer-install" onClick={() => { install(); setMobileOpen(false); }} type="button">
              {t('mobile_install', lang)}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Footer ─── */
function Footer() {
  const { lang } = useLang();
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <ECNALogo size={32} />
          <span>ECNA</span>
        </div>
        <div className="footer-links">
          <NavLink to="/">{t('nav_home', lang)}</NavLink>
          <NavLink to="/platform">{t('nav_platform', lang)}</NavLink>
          <NavLink to="/map">{t('nav_map', lang)}</NavLink>
          <NavLink to="/route-planner">{t('nav_route', lang)}</NavLink>
          <NavLink to="/stations">{t('nav_stations', lang)}</NavLink>
          <NavLink to="/contact">{t('nav_contact', lang)}</NavLink>
        </div>
        <span className="footer-copy">{t('footer_copy', lang)}</span>
      </div>
    </footer>
  );
}

/* ━━━━━━━━ APP ━━━━━━━━ */
function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem('lang');
    return saved === 'en' ? 'en' : 'tr';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.setAttribute('lang', lang === 'tr' ? 'tr-TR' : 'en');
  }, [lang]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  const toggleLang  = () => setLang(prev  => prev === 'tr'    ? 'en'   : 'tr');

  return (
    <LangContext.Provider value={{ lang, toggleLang }}>
      <div className="app">
        <Navbar theme={theme} toggleTheme={toggleTheme} />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/platform" element={<PlatformPage />} />
          <Route path="/map" element={<MapPage theme={theme} />} />
          <Route path="/route-planner" element={<RoutePlannerPage theme={theme} />} />
          <Route path="/stations" element={<StationsPage />} />
          <Route path="/contact" element={<ContactPage />} />
        </Routes>
      </div>
    </LangContext.Provider>
  );
}

/* ━━━━━━━━ HOME PAGE ━━━━━━━━ */
function HomePage() {
  const { lang } = useLang();
  return (
    <>
      {/* Hero */}
      <section className="hero-section">
        <div className="hero-bg">
          <img src="/hero-bg.png" alt="" aria-hidden="true" />
          <div className="hero-bg-overlay" />
        </div>
        <div className="hero-content">
          <div>
            <div className="hero-badge">
              <span className="hero-badge-dot" />
              {t('hero_badge', lang)}
            </div>
            <h1 className="hero-title">
              {t('hero_title1', lang)}<br />
              <span className="gradient-text">{t('hero_title2', lang)}</span>
            </h1>
            <p className="hero-description">{t('hero_desc', lang)}</p>
            <div className="hero-actions">
              <NavLink to="/map" className="btn-primary">{t('hero_cta_map', lang)}</NavLink>
              <NavLink to="/platform" className="btn-secondary">{t('hero_cta_how', lang)}</NavLink>
            </div>
          </div>
          <div className="hero-panel">
            <div className="hero-stats-card">
              <div className="stats-header">
                <span className="stats-live-dot" />
                <span>{t('stats_live', lang)}</span>
              </div>
              <div className="stats-grid">
                <div className="stat-item">
                  <div className="stat-value"><AnimatedNumber value={15188} /></div>
                  <div className="stat-label">{t('stat_stations', lang)}</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value"><AnimatedNumber value={84} /></div>
                  <div className="stat-label">{t('stat_cities', lang)}</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value"><AnimatedNumber value={11334} /></div>
                  <div className="stat-label">{t('stat_public', lang)}</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value"><AnimatedNumber value={181} /></div>
                  <div className="stat-label">{t('stat_brands', lang)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Strip */}
      <div className="trust-strip">
        <div className="trust-strip-inner">
          <div className="trust-item">
            <div className="trust-value"><AnimatedNumber value={15188} /></div>
            <div className="trust-label">{t('trust_stations', lang)}</div>
          </div>
          <div className="trust-item">
            <div className="trust-value"><AnimatedNumber value={11334} /></div>
            <div className="trust-label">{t('trust_public', lang)}</div>
          </div>
          <div className="trust-item">
            <div className="trust-value"><AnimatedNumber value={84} /></div>
            <div className="trust-label">{t('trust_cities', lang)}</div>
          </div>
          <div className="trust-item">
            <div className="trust-value"><AnimatedNumber value={181} /></div>
            <div className="trust-label">{t('trust_brands', lang)}</div>
          </div>
        </div>
      </div>

      {/* Features */}
      <section className="section">
        <div className="section-label">{t('feat_label', lang)}</div>
        <h2 className="section-title">{t('feat_title', lang)}</h2>
        <p className="section-desc">{t('feat_desc', lang)}</p>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🗺️</div>
            <h3>{t('feat1_title', lang)}</h3>
            <p>{t('feat1_desc', lang)}</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📍</div>
            <h3>{t('feat2_title', lang)}</h3>
            <p>{t('feat2_desc', lang)}</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔋</div>
            <h3>{t('feat3_title', lang)}</h3>
            <p>{t('feat3_desc', lang)}</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3>{t('feat4_title', lang)}</h3>
            <p>{t('feat4_desc', lang)}</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🛡️</div>
            <h3>{t('feat5_title', lang)}</h3>
            <p>{t('feat5_desc', lang)}</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>{t('feat6_title', lang)}</h3>
            <p>{t('feat6_desc', lang)}</p>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* Plans */}
      <section className="section">
        <div className="section-label">{t('plans_label', lang)}</div>
        <h2 className="section-title">{t('plans_title', lang)}</h2>
        <p className="section-desc">{t('plans_desc', lang)}</p>
        <div className="plans-grid">
          <div className="plan-card">
            <div className="plan-name">Go</div>
            <div className="plan-desc">{t('plan_go_desc', lang)}</div>
            <div className="plan-price">{t('plan_free', lang)}</div>
            <ul className="plan-features">
              <li>{t('plan_go_f1', lang)}</li>
              <li>{t('plan_go_f2', lang)}</li>
              <li>{t('plan_go_f3', lang)}</li>
              <li>{t('plan_go_f4', lang)}</li>
            </ul>
          </div>
          <div className="plan-card featured">
            <div className="plan-name">Motion</div>
            <div className="plan-desc">{t('plan_motion_desc', lang)}</div>
            <div className="plan-price">{t('plan_premium', lang)}</div>
            <ul className="plan-features">
              <li>{t('plan_motion_f1', lang)}</li>
              <li>{t('plan_motion_f2', lang)}</li>
              <li>{t('plan_motion_f3', lang)}</li>
              <li>{t('plan_motion_f4', lang)}</li>
              <li>{t('plan_motion_f5', lang)}</li>
            </ul>
          </div>
          <div className="plan-card">
            <div className="plan-name">Power</div>
            <div className="plan-desc">{t('plan_power_desc', lang)}</div>
            <div className="plan-price">{t('plan_enterprise', lang)}</div>
            <ul className="plan-features">
              <li>{t('plan_power_f1', lang)}</li>
              <li>{t('plan_power_f2', lang)}</li>
              <li>{t('plan_power_f3', lang)}</li>
              <li>{t('plan_power_f4', lang)}</li>
              <li>{t('plan_power_f5', lang)}</li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="cta-card">
          <h2>{t('cta_title', lang)}</h2>
          <p>{t('cta_desc', lang)}</p>
          <NavLink to="/map" className="btn-primary">{t('cta_btn', lang)}</NavLink>
        </div>
      </section>

      <Footer />
    </>
  );
}
      {/* Hero */}
      <section className="hero-section">
        <div className="hero-bg">
          <img src="/hero-bg.png" alt="" aria-hidden="true" />
          <div className="hero-bg-overlay" />
        </div>
        <div className="hero-content">
          <div>
            <div className="hero-badge">
              <span className="hero-badge-dot" />
              Türkiye'nin #1 EV Şarj Platformu
            </div>
            <h1 className="hero-title">
              Şarj noktanı bul,<br />
              <span className="gradient-text">yolculuğuna güvenle devam et.</span>
            </h1>
            <p className="hero-description">
              ECNA, Türkiye genelindeki 15.000+ elektrikli araç şarj istasyonunu tek bir haritada toplar.
              180 marka, AC/DC fiyat karşılaştırması ve konum bazlı arama ile en uygun şarj noktasını saniyeler içinde keşfet.
            </p>
            <div className="hero-actions">
              <NavLink to="/map" className="btn-primary">
                🗺️ Şarj Noktalarını Keşfet
              </NavLink>
              <NavLink to="/platform" className="btn-secondary">
                Nasıl Çalışıyor →
              </NavLink>
            </div>
          </div>
          <div className="hero-panel">
            <div className="hero-stats-card">
              <div className="stats-header">
                <span className="stats-live-dot" />
                <span>Canlı Platform Verileri</span>
              </div>
              <div className="stats-grid">
                <div className="stat-item">
                  <div className="stat-value"><AnimatedNumber value={15188} /></div>
                  <div className="stat-label">Aktif İstasyon</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value"><AnimatedNumber value={84} /></div>
                  <div className="stat-label">Şehir Kapsamı</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value"><AnimatedNumber value={11334} /></div>
                  <div className="stat-label">Halka Açık Nokta</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value"><AnimatedNumber value={181} /></div>
                  <div className="stat-label">Marka</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Strip */}
      <div className="trust-strip">
        <div className="trust-strip-inner">
          <div className="trust-item">
            <div className="trust-value"><AnimatedNumber value={15188} /></div>
            <div className="trust-label">Aktif İstasyon Kaydı</div>
          </div>
          <div className="trust-item">
            <div className="trust-value"><AnimatedNumber value={11334} /></div>
            <div className="trust-label">Halka Açık Nokta</div>
          </div>
          <div className="trust-item">
            <div className="trust-value"><AnimatedNumber value={84} /></div>
            <div className="trust-label">Şehir Kapsamı</div>
          </div>
          <div className="trust-item">
            <div className="trust-value"><AnimatedNumber value={181} /></div>
            <div className="trust-label">Marka</div>
          </div>
        </div>
      </div>

/* ━━━━━━━━ PLATFORM PAGE ━━━━━━━━ */
function PlatformPage() {
  const { lang } = useLang();
  return (
    <>
      <section className="section">
        <div className="section-label">{t('plat_label', lang)}</div>
        <h2 className="section-title">{t('plat_title', lang)}</h2>
        <p className="section-desc">{t('plat_desc', lang)}</p>
        <div className="features-grid" style={{ marginTop: 48 }}>
          <div className="feature-card"><div className="feature-icon">⚡</div><h3>{t('plat_f1_title', lang)}</h3><p>{t('plat_f1_desc', lang)}</p></div>
          <div className="feature-card"><div className="feature-icon">🔋</div><h3>{t('plat_f2_title', lang)}</h3><p>{t('plat_f2_desc', lang)}</p></div>
          <div className="feature-card"><div className="feature-icon">🧠</div><h3>{t('plat_f3_title', lang)}</h3><p>{t('plat_f3_desc', lang)}</p></div>
        </div>
      </section>
      <div className="section-divider" />
      <section className="section">
        <div className="section-label">{t('tech_label', lang)}</div>
        <h2 className="section-title">{t('tech_title', lang)}</h2>
        <div className="tech-grid">
          <div className="tech-card"><h3>{t('tech1_title', lang)}</h3><ul><li>{t('tech1_f1', lang)}</li><li>{t('tech1_f2', lang)}</li><li>{t('tech1_f3', lang)}</li><li>{t('tech1_f4', lang)}</li></ul></div>
          <div className="tech-card"><h3>{t('tech2_title', lang)}</h3><ul><li>{t('tech2_f1', lang)}</li><li>{t('tech2_f2', lang)}</li><li>{t('tech2_f3', lang)}</li><li>{t('tech2_f4', lang)}</li></ul></div>
          <div className="tech-card"><h3>{t('tech3_title', lang)}</h3><ul><li>{t('tech3_f1', lang)}</li><li>{t('tech3_f2', lang)}</li><li>{t('tech3_f3', lang)}</li><li>{t('tech3_f4', lang)}</li></ul></div>
          <div className="tech-card"><h3>{t('tech4_title', lang)}</h3><ul><li>{t('tech4_f1', lang)}</li><li>{t('tech4_f2', lang)}</li><li>{t('tech4_f3', lang)}</li><li>{t('tech4_f4', lang)}</li></ul></div>
        </div>
      </section>
      <Footer />
    </>
  );
}

const GOOGLE_MAPS_DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#0d0f17" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#61687d" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0d0f17" }] },
  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ color: "#1b1e2c" }],
  },
  {
    featureType: "administrative.country",
    elementType: "labels.text.fill",
    stylers: [{ color: "#778099" }],
  },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9aa4be" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#61687d" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#111421" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#4f5569" }],
  },
  {
    featureType: "road",
    elementType: "geometry.fill",
    stylers: [{ color: "#181c2e" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6f7b99" }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#20253d" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#2b3252" }],
  },
  {
    featureType: "road.highway.controlled_access",
    elementType: "geometry",
    stylers: [{ color: "#363f68" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#06080e" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#3b4356" }],
  },
];

/* ━━━━━━━━ MAP PAGE ━━━━━━━━ */
function MapPage({ theme }: { theme: 'light' | 'dark' }) {
  const { lang } = useLang();
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerByIdRef = useRef<Map<string, any>>(new Map());
  const directionsRendererRef = useRef<any>(null);
  const infoWindowRef = useRef<any>(null);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setOptions({
        styles: theme === 'dark' ? GOOGLE_MAPS_DARK_STYLE : [],
      });
    }
  }, [theme]);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [greenFilter, setGreenFilter] = useState<'all' | 'green' | 'normal'>('all');
  const [serviceFilter, setServiceFilter] = useState<'all' | 'Halka Açık' | 'Özel'>('all');
  const [radiusKm, setRadiusKm] = useState<RadiusKm>(50);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [searchParams] = useSearchParams();

  // Map layer and traffic controls
  const [mapType, setMapType] = useState<'roadmap' | 'hybrid'>('roadmap');
  const [showTraffic, setShowTraffic] = useState(false);
  const trafficLayerRef = useRef<any>(null);
  const layerControlsRef = useRef<HTMLDivElement | null>(null);

  const hasCenteredRef = useRef(false);

  const requestLocation = useCallback(async (forceCenter = false) => {
    if (forceCenter) {
      hasCenteredRef.current = false;
    }

    const fallbackToIP = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        if (res.ok) {
          const data = await res.json();
          if (data.latitude && data.longitude) {
            console.log("IP tabanlı konum başarıyla alındı:", data.latitude, data.longitude);
            const loc = { lat: data.latitude, lng: data.longitude };
            setUserLocation(loc);
            return loc;
          }
        }
      } catch (e) {
        console.warn("IP tabanlı konum alma başarısız:", e);
      }
      return null;
    };

    if (!navigator.geolocation) {
      console.warn("Tarayıcı GPS'i desteklenmiyor. IP sorgusuna geçiliyor...");
      await fallbackToIP();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        console.log("Tarayıcı GPS konumu alındı:", pos.coords.latitude, pos.coords.longitude);
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      async (err) => {
        console.warn(`Tarayıcı GPS'i başarısız (${err.message}). IP sorgusuna geçiliyor...`);
        await fallbackToIP();
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
    );
  }, []);

  useEffect(() => {
    getStations().then(data => {
      setStations(data);
      setLoading(false);
    });
    // Uygulama yüklenir yüklenmez konum alma talebini otomatik tetikle!
    requestLocation();
  }, [requestLocation]);

  const filteredByGeoFilters = useMemo(
    () =>
      stations.filter((s) => {
        if (greenFilter === 'all') return true;
        if (greenFilter === 'green') return s.isGreen;
        return !s.isGreen;
      })
        .filter((s) =>
          serviceFilter === 'all' ? true : s.serviceType === normalizeServiceLabel(serviceFilter),
        )
        .filter((s) => {
          if (!userLocation || radiusKm === 'all') return true;
          return kmBetween(userLocation.lat, userLocation.lng, s.lat, s.lng) <= radiusKm;
        }),
    [stations, greenFilter, serviceFilter, userLocation, radiusKm],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return filteredByGeoFilters;
    return filteredByGeoFilters.filter((s) => (
      s.name.toLowerCase().includes(q)
      || s.city.toLowerCase().includes(q)
      || s.brand.toLowerCase().includes(q)
      || s.address.toLowerCase().includes(q)
    ));
  }, [filteredByGeoFilters, search]);

  const mapCenter: [number, number] = userLocation ? [userLocation.lat, userLocation.lng] : TURKEY_CENTER;
  const publicCountAll = useMemo(
    () => stations.filter((s) => s.serviceType === normalizeServiceLabel('Halka Açık')).length,
    [stations],
  );

  // requestLocation has been moved to component initialization for auto-mounting.

  const focusStationOnMap = useCallback((station: Station) => {
    const map = mapRef.current;
    if (!map) return;
    map.setCenter({ lat: station.lat, lng: station.lng });
    map.setZoom(15);
    setTimeout(() => {
      const marker = markerByIdRef.current.get(station.id);
      if (marker && infoWindowRef.current) {
        const priceHTML = (station.acPrice || station.dcPrice)
          ? `<div style="margin-top:6px;font-size:12px;display:flex;gap:8px">
              ${station.acPrice ? `<span style="padding:2px 6px;border-radius:4px;background:#e0f2fe;color:#0369a1">AC: ${station.acPrice} ₺/kWh</span>` : ''}
              ${station.dcPrice ? `<span style="padding:2px 6px;border-radius:4px;background:#fce7f3;color:#9d174d">DC: ${station.dcPrice} ₺/kWh</span>` : ''}
             </div>`
          : '';
        const popupHTML = `
          <div style="font-family:Inter,sans-serif;padding:4px 0;min-width:200px;color:#000;">
            <strong style="font-size:14px">${station.name}</strong><br/>
            <span style="color:#666;font-size:12px">${station.city} • ${station.brand}</span><br/>
            <span style="display:inline-block;margin-top:4px;padding:2px 8px;border-radius:99px;font-size:11px;background:${station.serviceType === 'Halka Açık' ? '#dcfce7;color:#166534' : '#fef3c7;color:#92400e'}">${station.serviceType === 'Halka Açık' ? t('map_public', lang) : t('map_private', lang)}</span>
            ${station.isGreen ? `<span style="display:inline-block;margin-top:4px;margin-left:4px;padding:2px 8px;border-radius:99px;font-size:11px;background:#dcfce7;color:#166534">${t('map_green', lang)}</span>` : ''}
            ${priceHTML}
            <div style="margin-top:4px;font-size:11px;color:#888">${station.socketCount} ${lang === 'tr' ? 'soket' : 'sockets'} • Max ${station.maxPower} kW</div>
            <button onclick="window.startNavigation('${station.id}')" style="margin-top:10px;width:100%;padding:8px;border:none;border-radius:6px;background:var(--accent-teal);color:#000;font-weight:600;cursor:pointer;font-size:12px;">${t('map_nav_start', lang)}</button>
          </div>
        `;
        infoWindowRef.current.setContent(popupHTML);
        infoWindowRef.current.open(map, marker);
      }
    }, 500);
  }, [lang]);

  const carMarkerRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);
  const routeCoordsRef = useRef<[number, number][]>([]);
  const routeInstructionsRef = useRef<any[]>([]);
  const lastSpokenIndexRef = useRef<number>(-1);
  const [navActive, setNavActive] = useState(false);
  const [navSpeed, setNavSpeed] = useState(0);
  const [_navHeading, setNavHeading] = useState(0); // used internally by updateCarIcon
  const trVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const prevSimCoordRef = useRef<[number, number] | null>(null);

  // Türkçe sesi önceden bul ve kaydet (en kaliteli olanı seç)
  useEffect(() => {
    const findVoice = () => {
      const voices = window.speechSynthesis?.getVoices() || [];
      const trVoices = voices.filter(v => v.lang === 'tr-TR' || v.lang.startsWith('tr'));
      // Google > Microsoft > diğer sırasıyla en kaliteli sesi seç
      const best = trVoices.find(v => v.name.includes('Google'))
        || trVoices.find(v => v.name.includes('Natural'))
        || trVoices.find(v => v.name.includes('Online'))
        || trVoices.find(v => !v.localService) // Cloud sesler daha kaliteli
        || trVoices[0];
      if (best) trVoiceRef.current = best;
    };
    findVoice();
    window.speechSynthesis?.addEventListener('voiceschanged', findVoice);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', findVoice);
  }, []);

  const speakTurkish = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;

    // Anlık yol yönlendirme komutlarının birbiri üzerine binmemesi ve en güncel komutun
    // anında seslendirilmesi için önceki konuşmaları hemen iptal et.
    window.speechSynthesis.cancel();

    setTimeout(() => {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'tr-TR';
      utter.rate = 0.9; // Daha akıcı ve doğal bir sürüş asistanı sesi
      utter.pitch = 1.0;
      utter.volume = 1.0;
      if (trVoiceRef.current) utter.voice = trVoiceRef.current;
      window.speechSynthesis.speak(utter);
    }, 60);
  }, []);

  const translateInstruction = useCallback((text: string): string => {
    let t = text;
    // Tam cümle kalıpları (önce uzunlar)
    t = t.replace(/You have arrived at your destination,?\s*(on the left|on the right)?\.?/gi, (_, side) =>
      'Hedefinize ulaştınız!' + (side ? (side.includes('left') ? ' Hedef solunuzda.' : ' Hedef sağınızda.') : ''));
    t = t.replace(/Destination will be on the (left|right)/gi, (_, s) => 'Hedef ' + (s === 'left' ? 'solunuzda' : 'sağınızda'));
    t = t.replace(/Arrive at .+/gi, 'Hedefinize ulaştınız!');
    t = t.replace(/Head (north|south|east|west|northeast|northwest|southeast|southwest)\b/gi, (_, d) => {
      const dirs: Record<string, string> = {
        north: 'kuzeye', south: 'güneye', east: 'doğuya', west: 'batıya',
        northeast: 'kuzeydoğuya', northwest: 'kuzeybatıya', southeast: 'güneydoğuya', southwest: 'güneybatıya'
      };
      return `${dirs[d.toLowerCase()] || d} doğru ilerleyin`;
    });
    // Dönüş komutları
    t = t.replace(/Turn sharp left/gi, 'Keskin sola dönün');
    t = t.replace(/Turn sharp right/gi, 'Keskin sağa dönün');
    t = t.replace(/Turn slight left/gi, 'Hafif sola dönün');
    t = t.replace(/Turn slight right/gi, 'Hafif sağa dönün');
    t = t.replace(/Turn left/gi, 'Sola dönün');
    t = t.replace(/Turn right/gi, 'Sağa dönün');
    t = t.replace(/Make a U-turn/gi, 'U dönüşü yapın');
    t = t.replace(/Make a sharp/gi, 'Keskin');
    // Devam/yol komutları
    t = t.replace(/Keep left/gi, 'Soldan devam edin');
    t = t.replace(/Keep right/gi, 'Sağdan devam edin');
    t = t.replace(/Go straight/gi, 'Düz devam edin');
    t = t.replace(/Continue straight/gi, 'Düz devam edin');
    t = t.replace(/Continue/gi, 'Devam edin');
    t = t.replace(/Slight left/gi, 'Hafif sol');
    t = t.replace(/Slight right/gi, 'Hafif sağ');
    // Kavşak/çıkış
    t = t.replace(/Exit the traffic circle/gi, 'Dönel kavşaktan çıkın');
    t = t.replace(/Exit the roundabout/gi, 'Dönel kavşaktan çıkın');
    t = t.replace(/Enter the roundabout/gi, 'Dönel kavşağa girin');
    t = t.replace(/At the roundabout/gi, 'Dönel kavşakta');
    t = t.replace(/Roundabout/gi, 'Dönel kavşak');
    t = t.replace(/Take the (\d+)(st|nd|rd|th) exit/gi, '$1. çıkıştan çıkın');
    // Birleşme/ayrılma
    t = t.replace(/Merge left/gi, 'Soldan birleşin');
    t = t.replace(/Merge right/gi, 'Sağdan birleşin');
    t = t.replace(/Merge/gi, 'Birleşin');
    t = t.replace(/Fork left/gi, 'Soldan ayrılın');
    t = t.replace(/Fork right/gi, 'Sağdan ayrılın');
    // Bağlaçlar ve konumlar
    t = t.replace(/\bonto\b/gi, 'yönünde');
    t = t.replace(/\bon the left\b/gi, 'solda');
    t = t.replace(/\bon the right\b/gi, 'sağda');
    t = t.replace(/\bon\b/gi, 'üzerinde');
    t = t.replace(/\bthen\b/gi, 'sonra');
    t = t.replace(/\band\b/gi, 've');
    t = t.replace(/\bfor\b/gi, 'boyunca');
    t = t.replace(/\bto\b/gi, 'yönüne');
    // Birimler
    t = t.replace(/(\d+)\s*m\b/gi, '$1 metre');
    t = t.replace(/(\d+)\s*km\b/gi, '$1 kilometre');
    t = t.replace(/(\d+)\s*mi\b/gi, '$1 mil');
    return t;
  }, []);

  // İki koordinat arası yön açısı (bearing) hesapla
  const calcBearing = useCallback((lat1: number, lng1: number, lat2: number, lng2: number) => {
    const toRad = (d: number) => d * Math.PI / 180;
    const toDeg = (r: number) => r * 180 / Math.PI;
    const dLng = toRad(lng2 - lng1);
    const y = Math.sin(dLng) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }, []);



  const updateCarIcon = useCallback((heading: number) => {
    if (!carMarkerRef.current) return;
    const isDark = theme === 'dark';
    const carColor = isDark ? '#2dd4bf' : '#3b82f6';

    const svgIcon = `
<svg width="60" height="60" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="shadowGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#000" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="beamGrad" x1="50%" y1="100%" x2="50%" y2="0%">
      <stop offset="0%" stop-color="#fef08a" stop-opacity="0.8"/>
      <stop offset="40%" stop-color="#fef08a" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#fef08a" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <g transform="rotate(${heading} 50 50)">
    <!-- 1. Car Shadow -->
    <ellipse cx="50" cy="58" rx="22" ry="32" fill="url(#shadowGrad)"/>

    <!-- 2. Headlight Beams (Farları Açık - Dark Mode) -->
    ${isDark ? `
    <polygon points="41,23 15,-15 45,-15" fill="url(#beamGrad)"/>
    <polygon points="59,23 55,-15 85,-15" fill="url(#beamGrad)"/>
    ` : ''}

    <!-- 3. Wheels -->
    <rect x="27" y="28" width="6" height="14" rx="2" fill="#0f172a" stroke="${carColor}" stroke-width="1"/>
    <rect x="67" y="28" width="6" height="14" rx="2" fill="#0f172a" stroke="${carColor}" stroke-width="1"/>
    <rect x="27" y="62" width="6" height="14" rx="2" fill="#0f172a" stroke="${carColor}" stroke-width="1"/>
    <rect x="67" y="62" width="6" height="14" rx="2" fill="#0f172a" stroke="${carColor}" stroke-width="1"/>

    <!-- 4. Futuristic EV Body -->
    <path d="M32,75 C32,82 68,82 68,75 L68,32 C68,22 62,18 50,18 C38,18 32,22 32,32 Z" fill="#1e293b" stroke="${carColor}" stroke-width="2.5"/>
    <path d="M34,70 C34,76 66,76 66,70 L64,34 C64,26 58,22 50,22 C42,22 36,26 36,34 Z" fill="${carColor}"/>
    
    <!-- 5. 3D Glass Cabin Roof -->
    <path d="M38,58 C38,62 62,62 62,58 L60,40 C60,32 56,28 50,28 C44,28 40,32 40,40 Z" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5"/>
    <path d="M42,50 C42,52 58,52 58,50 L57,41 C57,36 54,34 50,34 C46,34 43,36 43,41 Z" fill="#1e293b"/>
    <path d="M43,40 C43,38 57,38 57,40 L56,43 C56,43 44,43 44,43 Z" fill="#ffffff" fill-opacity="0.35"/>

    <!-- 6. Headlights dots -->
    <circle cx="41" cy="23" r="3.5" fill="#fef08a"/>
    <circle cx="59" cy="23" r="3.5" fill="#fef08a"/>
  </g>
</svg>
`;

    carMarkerRef.current.setIcon({
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgIcon.trim()),
      scaledSize: new google.maps.Size(60, 60),
      anchor: new google.maps.Point(30, 30),
    });
  }, [theme]);

  const stopNavigation = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (carMarkerRef.current) {
      carMarkerRef.current.setMap(null);
      carMarkerRef.current = null;
    }
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
      directionsRendererRef.current = null;
    }
    if (simulationTimerRef.current) {
      clearInterval(simulationTimerRef.current);
      simulationTimerRef.current = null;
    }
    routeCoordsRef.current = [];
    routeInstructionsRef.current = [];
    lastSpokenIndexRef.current = -1;
    prevSimCoordRef.current = null;
    window.speechSynthesis?.cancel();
    setNavActive(false);
    setNavSpeed(0);
    setNavHeading(0);
  }, []);

  const simulationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const simulateDrive = useCallback(() => {
    const coords = routeCoordsRef.current;
    if (coords.length === 0) return;

    let idx = 0;
    const step = Math.max(1, Math.floor(coords.length / 250));
    const intervalMs = 150;

    if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
    prevSimCoordRef.current = coords[0];

    speakTurkish('Simülasyon başlatılıyor. Rota üzerinde ilerleniyor.');

    simulationTimerRef.current = setInterval(() => {
      if (idx >= coords.length) {
        if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
        speakTurkish('Hedefinize ulaştınız! Navigasyon tamamlandı.');
        setNavSpeed(0);
        return;
      }
      const [lat, lng] = coords[idx];

      // Yön ve hız hesapla
      if (prevSimCoordRef.current) {
        const [pLat, pLng] = prevSimCoordRef.current;
        const bearing = calcBearing(pLat, pLng, lat, lng);
        setNavHeading(bearing);
        updateCarIcon(bearing);

        // Simülasyon hızı hesapla (mesafe/zaman)
        const distKm = kmBetween(pLat, pLng, lat, lng);
        const simSpeedKmh = Math.round((distKm / (intervalMs / 1000)) * 3600); // km/h
        const clampedSpeed = Math.min(simSpeedKmh, 130); // Max 130 km/h
        setNavSpeed(clampedSpeed > 2 ? clampedSpeed : 0);
      }
      prevSimCoordRef.current = [lat, lng];

      // Araba ikonunu taşı
      if (carMarkerRef.current) {
        carMarkerRef.current.setPosition({ lat, lng });
      }
      const map = mapRef.current;
      if (map) {
        map.setCenter({ lat, lng });
        if (map.getZoom() < 16) {
          map.setZoom(16);
        }
      }

      // Yaklaşılan yönlendirmeleri seslendir
      const instructions = routeInstructionsRef.current;
      for (let i = 0; i < instructions.length; i++) {
        if (i <= lastSpokenIndexRef.current) continue;
        const inst = instructions[i];
        if (!inst || !inst.text) continue;
        const coordIdx = inst.index;
        if (coordIdx !== undefined && coordIdx < coords.length) {
          const [iLat, iLng] = coords[coordIdx];
          const dist = kmBetween(lat, lng, iLat, iLng) * 1000;
          if (dist < 200) {
            const trText = translateInstruction(inst.text);
            speakTurkish(trText);
            lastSpokenIndexRef.current = i;
            break;
          }
        }
      }

      idx += step;
    }, intervalMs);
  }, [speakTurkish, translateInstruction, calcBearing, updateCarIcon]);

  useEffect(() => {
    (window as any).startNavigation = (stationId: string) => {
      const station = stations.find(s => s.id === stationId);
      if (!station) return;

      const doRouting = (loc: { lat: number, lng: number }) => {
        const map = mapRef.current;
        if (!map) return;

        // Önceki navigasyonu temizle
        stopNavigation();

        // Create Google Maps Directions Renderer and Service
        directionsRendererRef.current = new google.maps.DirectionsRenderer({
          map: map,
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: '#2dd4bf',
            strokeOpacity: 0.9,
            strokeWeight: 6
          }
        });

        // Navigation car marker
        const isDark = theme === 'dark';
        const carColor = isDark ? '#2dd4bf' : '#3b82f6';
        const initialCarSvg = `
<svg width="60" height="60" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="shadowGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#000" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="beamGrad" x1="50%" y1="100%" x2="50%" y2="0%">
      <stop offset="0%" stop-color="#fef08a" stop-opacity="0.8"/>
      <stop offset="40%" stop-color="#fef08a" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#fef08a" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <g transform="rotate(0 50 50)">
    <!-- 1. Car Shadow -->
    <ellipse cx="50" cy="58" rx="22" ry="32" fill="url(#shadowGrad)"/>

    <!-- 2. Headlight Beams (Farları Açık - Dark Mode) -->
    ${isDark ? `
    <polygon points="41,23 15,-15 45,-15" fill="url(#beamGrad)"/>
    <polygon points="59,23 55,-15 85,-15" fill="url(#beamGrad)"/>
    ` : ''}

    <!-- 3. Wheels -->
    <rect x="27" y="28" width="6" height="14" rx="2" fill="#0f172a" stroke="${carColor}" stroke-width="1"/>
    <rect x="67" y="28" width="6" height="14" rx="2" fill="#0f172a" stroke="${carColor}" stroke-width="1"/>
    <rect x="27" y="62" width="6" height="14" rx="2" fill="#0f172a" stroke="${carColor}" stroke-width="1"/>
    <rect x="67" y="62" width="6" height="14" rx="2" fill="#0f172a" stroke="${carColor}" stroke-width="1"/>

    <!-- 4. Futuristic EV Body -->
    <path d="M32,75 C32,82 68,82 68,75 L68,32 C68,22 62,18 50,18 C38,18 32,22 32,32 Z" fill="#1e293b" stroke="${carColor}" stroke-width="2.5"/>
    <path d="M34,70 C34,76 66,76 66,70 L64,34 C64,26 58,22 50,22 C42,22 36,26 36,34 Z" fill="${carColor}"/>
    
    <!-- 5. 3D Glass Cabin Roof -->
    <path d="M38,58 C38,62 62,62 62,58 L60,40 C60,32 56,28 50,28 C44,28 40,32 40,40 Z" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5"/>
    <path d="M42,50 C42,52 58,52 58,50 L57,41 C57,36 54,34 50,34 C46,34 43,36 43,41 Z" fill="#1e293b"/>
    <path d="M43,40 C43,38 57,38 57,40 L56,43 C56,43 44,43 44,43 Z" fill="#ffffff" fill-opacity="0.35"/>

    <!-- 6. Headlights dots -->
    <circle cx="41" cy="23" r="3.5" fill="#fef08a"/>
    <circle cx="59" cy="23" r="3.5" fill="#fef08a"/>
  </g>
</svg>
`;

        carMarkerRef.current = new google.maps.Marker({
          position: { lat: loc.lat, lng: loc.lng },
          map: map,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(initialCarSvg.trim()),
            scaledSize: new google.maps.Size(60, 60),
            anchor: new google.maps.Point(30, 30),
          },
          zIndex: 99999,
        });

        map.setCenter({ lat: loc.lat, lng: loc.lng });
        map.setZoom(16);

        const service = new google.maps.DirectionsService();
        service.route(
          {
            origin: { lat: loc.lat, lng: loc.lng },
            destination: { lat: station.lat, lng: station.lng },
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (result: any, status: any) => {
            if (status === google.maps.DirectionsStatus.OK && result) {
              directionsRendererRef.current.setDirections(result);

              const route = result.routes[0];
              const leg = route.legs[0];

              const pathCoords: [number, number][] = [];
              leg.steps.forEach((step: any) => {
                step.path.forEach((latLng: any) => {
                  pathCoords.push([latLng.lat(), latLng.lng()]);
                });
              });
              routeCoordsRef.current = pathCoords;

              routeInstructionsRef.current = leg.steps.map((step: any) => ({
                text: step.instructions.replace(/<[^>]*>/g, ''),
                index: pathCoords.findIndex(c => Math.abs(c[0] - step.start_location.lat()) < 0.001 && Math.abs(c[1] - step.start_location.lng()) < 0.001) || 0,
              }));

              setNavActive(true);

              const totalDist = leg.distance?.text || '';
              const totalTime = leg.duration?.text || '';
              speakTurkish(`Navigasyon başlatıldı. Toplam mesafe ${totalDist}, tahmini süre ${totalTime}.`);

              if (navigator.geolocation) {
                watchIdRef.current = navigator.geolocation.watchPosition(
                  (pos) => {
                    const newLat = pos.coords.latitude;
                    const newLng = pos.coords.longitude;

                    if (pos.coords.speed !== null && pos.coords.speed !== undefined) {
                      setNavSpeed(Math.round(pos.coords.speed * 3.6));
                    }
                    if (pos.coords.heading !== null && pos.coords.heading !== undefined) {
                      setNavHeading(pos.coords.heading);
                      updateCarIcon(pos.coords.heading);
                    }

                    if (carMarkerRef.current) {
                      carMarkerRef.current.setPosition({ lat: newLat, lng: newLng });
                    }
                    map.setCenter({ lat: newLat, lng: newLng });

                    const instructions = routeInstructionsRef.current;
                    for (let i = 0; i < instructions.length; i++) {
                      if (i <= lastSpokenIndexRef.current) continue;
                      const inst = instructions[i];
                      if (!inst || !inst.text) continue;

                      const coordIdx = inst.index;
                      const coords = routeCoordsRef.current;
                      if (coordIdx !== undefined && coordIdx < coords.length) {
                        const [iLat, iLng] = coords[coordIdx];
                        const dist = kmBetween(newLat, newLng, iLat, iLng) * 1000;
                        if (dist < 150) {
                          const trText = translateInstruction(inst.text);
                          speakTurkish(trText);
                          lastSpokenIndexRef.current = i;
                          break;
                        }
                      }
                    }
                  },
                  () => { },
                  { enableHighAccuracy: true, timeout: 5000, maximumAge: 1000 }
                );
              }
            }
          }
        );

        if (infoWindowRef.current) infoWindowRef.current.close();
      };

      if (!userLocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setUserLocation(loc);
            doRouting(loc);
          },
          async (err) => {
            console.warn("startNavigation: GPS failed, falling back to IP...", err);
            try {
              const res = await fetch('https://ipapi.co/json/');
              if (res.ok) {
                const data = await res.json();
                if (data.latitude && data.longitude) {
                  const loc = { lat: data.latitude, lng: data.longitude };
                  setUserLocation(loc);
                  doRouting(loc);
                  return;
                }
              }
            } catch (e) {
              console.warn(e);
            }
            // En son çare fallback: Rota simülasyonu çalışabilsin diye istasyonun 1.5km yakınında bir sahte başlangıç noktası seçelim
            const fallbackLoc = { lat: station.lat - 0.012, lng: station.lng - 0.012 };
            setUserLocation(fallbackLoc);
            doRouting(fallbackLoc);
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      } else {
        doRouting(userLocation);
      }
    };

    (window as any).stopNavigation = () => stopNavigation();
  }, [stations, userLocation, stopNavigation, speakTurkish, translateInstruction]);

  // Dynamic Map Theme Style Update
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setOptions({
        styles: theme === 'dark' ? GOOGLE_MAPS_DARK_STYLE : [],
      });
    }
  }, [theme]);

  // Dynamic Map Layer and Traffic updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.setMapTypeId(mapType);

    if (showTraffic) {
      if (!trafficLayerRef.current) {
        trafficLayerRef.current = new google.maps.TrafficLayer();
      }
      trafficLayerRef.current.setMap(map);
    } else {
      if (trafficLayerRef.current) {
        trafficLayerRef.current.setMap(null);
      }
    }
  }, [mapType, showTraffic]);

  useEffect(() => {
    if (!mapHostRef.current || mapRef.current) return;
    const initialCenter = userLocation
      ? { lat: userLocation.lat, lng: userLocation.lng }
      : { lat: TURKEY_CENTER[0], lng: TURKEY_CENTER[1] };
    const initialZoom = userLocation ? 11 : 6;

    const map = new google.maps.Map(mapHostRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: theme === 'dark' ? GOOGLE_MAPS_DARK_STYLE : [],
    });
    infoWindowRef.current = new google.maps.InfoWindow();
    mapRef.current = map;

    if (layerControlsRef.current) {
      map.controls[google.maps.ControlPosition.BOTTOM_RIGHT].push(layerControlsRef.current);
    }
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || loading) return;

    const renderMarkers = () => {
      const bounds = map.getBounds();
      if (!bounds) return;

      const zoom = map.getZoom() || 6;

      // 1. Determine stations that should be visible (cap to keep DOM light and responsive)
      const visibleStations: Station[] = [];
      const maxRenderLimit = zoom < 11 ? 500 : 250;

      for (const station of filtered) {
        const pt = new google.maps.LatLng(station.lat, station.lng);
        if (bounds.contains(pt)) {
          visibleStations.push(station);
          if (visibleStations.length >= maxRenderLimit) {
            break;
          }
        }
      }

      // Create a set of visible IDs for fast O(1) diffing
      const visibleIds = new Set(visibleStations.map(s => s.id));

      // 2. Remove markers that are no longer inside the viewport
      markerByIdRef.current.forEach((marker, id) => {
        if (!visibleIds.has(id)) {
          marker.setMap(null);
          markerByIdRef.current.delete(id);
        }
      });

      // 3. Add or reuse markers for visible stations
      visibleStations.forEach((station) => {
        // If already rendered, reuse it directly (no tear-down/re-create lag!)
        if (markerByIdRef.current.has(station.id)) {
          return;
        }

        const color = station.isGreen ? '#10b981' : station.maxPower >= 100 ? '#f59e0b' : '#3b82f6';
        let marker: any;

        if (zoom < 11) {
          marker = new google.maps.Marker({
            position: { lat: station.lat, lng: station.lng },
            map: map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 4,
              fillColor: color,
              fillOpacity: 0.9,
              strokeColor: '#ffffff',
              strokeWeight: 1,
            },
          });
        } else {
          // Sleek, compact and lightweight modern vector pin without CPU-heavy filters
          const svgIcon = `
<svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">
  <path d="M13 0C5.82 0 0 5.82 0 13c0 9.75 13 21 13 21s13-11.25 13-21C26 5.82 20.18 0 13 0z" fill="${color}"/>
  <circle cx="13" cy="12" r="7.5" fill="#ffffff"/>
  <path d="M12.5 7L9.5 12h3v4.5l4-5.5h-3.5L12.5 7z" fill="${color}"/>
</svg>
`;
          marker = new google.maps.Marker({
            position: { lat: station.lat, lng: station.lng },
            map: map,
            icon: {
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgIcon.trim()),
              scaledSize: new google.maps.Size(26, 34),
              anchor: new google.maps.Point(13, 34),
            },
          });
        }

        const priceHTML = (station.acPrice || station.dcPrice)
          ? `<div style="margin-top:6px;font-size:12px;display:flex;gap:8px">
              ${station.acPrice ? `<span style="padding:2px 6px;border-radius:4px;background:#e0f2fe;color:#0369a1">AC: ${station.acPrice} ₺/kWh</span>` : ''}
              ${station.dcPrice ? `<span style="padding:2px 6px;border-radius:4px;background:#fce7f3;color:#9d174d">DC: ${station.dcPrice} ₺/kWh</span>` : ''}
             </div>`
          : '';

        const popupHTML = `
          <div style="font-family:Inter,sans-serif;padding:4px 0;min-width:200px;color:#000;">
            <strong style="font-size:14px">${station.name}</strong><br/>
            <span style="color:#666;font-size:12px">${station.city} • ${station.brand}</span><br/>
            <span style="display:inline-block;margin-top:4px;padding:2px 8px;border-radius:99px;font-size:11px;background:${station.serviceType === 'Halka Açık' ? '#dcfce7;color:#166534' : '#fef3c7;color:#92400e'}">${station.serviceType}</span>
            ${station.isGreen ? '<span style="display:inline-block;margin-top:4px;margin-left:4px;padding:2px 8px;border-radius:99px;font-size:11px;background:#dcfce7;color:#166534">🌿 Yeşil</span>' : ''}
            ${priceHTML}
            <div style="margin-top:4px;font-size:11px;color:#888">${station.socketCount} soket • Max ${station.maxPower} kW</div>
            <button onclick="window.startNavigation('${station.id}')" style="margin-top:10px;width:100%;padding:8px;border:none;border-radius:6px;background:var(--accent-teal);color:#000;font-weight:600;cursor:pointer;font-size:12px;">Navigasyonu Başlat</button>
          </div>
        `;

        marker.addListener('click', () => {
          if (infoWindowRef.current) {
            infoWindowRef.current.setContent(popupHTML);
            infoWindowRef.current.open(map, marker);
          }
        });

        markerByIdRef.current.set(station.id, marker);
      });
    };

    const listener = map.addListener('idle', renderMarkers);

    // Render immediately on filter/search changes so markers update instantly
    renderMarkers();

    if (!navActive) {
      if (userLocation && !hasCenteredRef.current) {
        map.setCenter({ lat: userLocation.lat, lng: userLocation.lng });
        map.setZoom(11);
        hasCenteredRef.current = true;
      } else if (!userLocation && !hasCenteredRef.current) {
        const fitSample = filteredByGeoFilters.slice(0, 12_000);
        if (fitSample.length >= 2) {
          const boundsObj = new google.maps.LatLngBounds();
          fitSample.forEach((s) => boundsObj.extend({ lat: s.lat, lng: s.lng }));
          map.fitBounds(boundsObj);

          const maxZoomListener = map.addListener('bounds_changed', () => {
            if (map.getZoom() > 14) map.setZoom(14);
            google.maps.event.removeListener(maxZoomListener);
          });
        } else if (fitSample.length === 1) {
          map.setCenter({ lat: fitSample[0].lat, lng: fitSample[0].lng });
          map.setZoom(14);
        } else {
          map.setCenter({ lat: TURKEY_CENTER[0], lng: TURKEY_CENTER[1] });
          map.setZoom(6);
        }
      }
    }

    const targetId = searchParams.get('id');
    const startNav = searchParams.get('nav') === 'true';
    if (targetId) {
      const targetStation = filtered.find(s => String(s.id) === targetId) || stations.find(s => String(s.id) === targetId);
      if (targetStation) {
        focusStationOnMap(targetStation);
        if (startNav && (window as any).startNavigation) {
          setTimeout(() => {
            (window as any).startNavigation(targetId);
          }, 800);
        }
      }
    }

    return () => {
      google.maps.event.removeListener(listener);
      // Clean up all markers from the map when search/filters change to prevent ghost or mixed up markers
      markerByIdRef.current.forEach((marker) => {
        marker.setMap(null);
      });
      markerByIdRef.current.clear();
    };
  }, [
    filtered,
    filteredByGeoFilters,
    mapCenter,
    userLocation,
    loading,
    navActive,
  ]);

  return (
    <section className="map-page">
      {/* Navigasyon aktif kontrol barı */}
      {navActive && (
        <div className="nav-active-bar">
          <div className="nav-speed-gauge">
            <span className="nav-speed-value">{navSpeed}</span>
            <span className="nav-speed-unit">km/h</span>
          </div>
          <div className="nav-active-pulse" />
          <span>{t('map_nav_active', lang)}</span>
          <button onClick={simulateDrive} className="nav-sim-btn">{t('map_nav_sim_start', lang)}</button>
          <button onClick={stopNavigation} className="nav-stop-btn">{t('map_nav_stop', lang)}</button>
        </div>
      )}
      <button
        className="mobile-sheet-toggle"
        onClick={() => setMobileSheetOpen(!mobileSheetOpen)}
        type="button"
      >
        {mobileSheetOpen ? t('map_nav_close', lang) : `${t('map_filters', lang)} (${filtered.length.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US')})`}
      </button>

      {/* Sidebar / Bottom Sheet */}
      <aside className={`map-sidebar ${mobileSheetOpen ? 'sheet-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-title">{t('map_sidebar_title', lang)}</div>
          <div className="search-box">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('map_search_ph', lang)}
            />
          </div>
        </div>

        <div className="filter-section">
          <div className="filter-label">{t('map_filter_source', lang)}</div>
          <div className="chip-row">
            <button type="button" className={`chip ${greenFilter === 'all' ? 'active' : ''}`} onClick={() => setGreenFilter('all')}>
              {t('map_all', lang)}
            </button>
            <button type="button" className={`chip ${greenFilter === 'green' ? 'active' : ''}`} onClick={() => setGreenFilter('green')}>
              {t('map_green', lang)}
            </button>
            <button type="button" className={`chip ${greenFilter === 'normal' ? 'active' : ''}`} onClick={() => setGreenFilter('normal')}>
              {t('map_standard', lang)}
            </button>
          </div>
          <div className="filter-label" style={{ marginTop: 12 }}>{t('map_filter_service', lang)}</div>
          <div className="chip-row">
            <button type="button" className={`chip ${serviceFilter === 'all' ? 'active' : ''}`} onClick={() => setServiceFilter('all')}>
              {t('map_all_access', lang)}
            </button>
            <button type="button" className={`chip ${serviceFilter === 'Halka Açık' ? 'active' : ''}`} onClick={() => setServiceFilter('Halka Açık')}>
              {t('map_public', lang)}
            </button>
            <button type="button" className={`chip ${serviceFilter === 'Özel' ? 'active' : ''}`} onClick={() => setServiceFilter('Özel')}>
              {t('map_private', lang)}
            </button>
          </div>
          <div className="filter-label" style={{ marginTop: 12 }}>{t('map_filter_dist', lang)}</div>
          <div className="chip-row">
            {([30, 50, 100] as const).map((km) => (
              <button
                key={km}
                type="button"
                className={`chip ${radiusKm === km ? 'active' : ''}`}
                onClick={() => setRadiusKm(km)}
              >
                {km} km
              </button>
            ))}
            <button
              type="button"
              className={`chip ${radiusKm === 'all' ? 'active' : ''}`}
              onClick={() => setRadiusKm('all')}
            >
              {t('map_all', lang)}
            </button>
            <button type="button" className="chip location" onClick={() => requestLocation(true)}>
              {t('map_use_loc', lang)}
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="sidebar-kpis">
          <div className="kpi-item">
            <div className="kpi-value">{stations.length.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US')}</div>
            <div className="kpi-label">{t('map_kpi_total', lang)}</div>
          </div>
          <div className="kpi-item">
            <div className="kpi-value">{publicCountAll.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US')}</div>
            <div className="kpi-label">{t('map_public', lang)}</div>
          </div>
          <div className="kpi-item">
            <div className="kpi-value">{filtered.length.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US')}</div>
            <div className="kpi-label">{t('map_kpi_filtered', lang)}</div>
          </div>
        </div>

        {/* Results */}
        <div className="sidebar-results">
          {loading && <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '20px 0' }}>{t('stations_loading', lang)}</p>}
          {!loading && filtered.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '20px 0' }}>{t('stations_no_res', lang)}</p>
          )}
          {filtered.slice(0, 30).map((s) => (
            <div
              key={s.id}
              className="result-card"
              style={{ display: 'flex', flexDirection: 'column' }}
            >
              <div onClick={() => focusStationOnMap(s)} style={{ cursor: 'pointer' }}>
                <div className="result-name">{s.name}</div>
                <div className="result-meta">
                  {s.city} • {s.brand} • {s.serviceType}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  {s.isGreen && <span className="result-badge green">{t('map_green', lang)}</span>}
                  {s.acPrice && <span className="result-badge all">AC: {s.acPrice}₺</span>}
                  {s.dcPrice && <span className="result-badge smart">DC: {s.dcPrice}₺</span>}
                  <span className="result-badge all">{s.socketCount} soket • {s.maxPower}kW</span>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); (window as any).startNavigation?.(s.id); }}
                style={{ marginTop: 10, padding: '6px 10px', border: '1px solid var(--border-subtle)', borderRadius: 6, background: 'rgba(45,212,191,0.1)', color: 'var(--accent-teal)', cursor: 'pointer', fontSize: '0.8rem', alignSelf: 'flex-start', fontWeight: 600 }}
              >
                {t('map_nav_start', lang)}
              </button>
            </div>
          ))}
          {!loading && filtered.length > 30 && (
            <NavLink
              to="/stations"
              className="btn-primary"
              style={{ display: 'block', textAlign: 'center', width: '100%', marginTop: 12, padding: '10px', textDecoration: 'none' }}
            >
              {t('map_view_all', lang)} (+{(filtered.length - 30).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US')})
            </NavLink>
          )}
        </div>
      </aside>

      {/* Map */}
      <div className="map-container" style={{ position: 'relative' }}>
        {loading && (
          <div className="map-loading">
            <div className="map-loading-spinner" />
          </div>
        )}
        <div ref={mapHostRef} style={{ width: '100%', height: '100%' }} />

        {/* Fütüristik Harita Katmanı ve Trafik Paneli */}
        <div ref={layerControlsRef} className="map-layer-controls">
          <button
            type="button"
            className={`map-layer-btn ${mapType === 'hybrid' ? 'active' : ''}`}
            onClick={() => setMapType(mapType === 'roadmap' ? 'hybrid' : 'roadmap')}
            title={lang === 'tr' ? "Uydu Görünümünü Aç/Kapat" : "Toggle Satellite View"}
          >
            {mapType === 'hybrid' ? t('map_layer_road', lang) : t('map_layer_satellite', lang)}
          </button>
          <button
            type="button"
            className={`map-layer-btn ${showTraffic ? 'active' : ''}`}
            onClick={() => setShowTraffic(!showTraffic)}
            title={lang === 'tr' ? "Canlı Trafik Durumunu Göster/Gizle" : "Toggle Live Traffic"}
          >
            {showTraffic ? t('map_traffic_off', lang) : t('map_traffic_on', lang)}
          </button>
        </div>
      </div>
    </section>
  );
}

/* ━━━━━━━━ CONTACT PAGE ━━━━━━━━ */
function ContactPage() {
  const { lang } = useLang();
  return (
    <>
      <section className="section">
        <div className="contact-section">
          <div className="contact-info">
            <div className="section-label">{t('contact_label', lang)}</div>
            <h2>{t('contact_title', lang)}</h2>
            <p>{t('contact_desc', lang)}</p>
            <div className="contact-details">
              <div className="contact-item">
                <div className="contact-icon">📧</div>
                <div>
                  <div className="contact-item-label">{t('contact_email_lbl', lang)}</div>
                  <div className="contact-item-value">info@ecna.com.tr</div>
                </div>
              </div>
              <div className="contact-item">
                <div className="contact-icon">📞</div>
                <div>
                  <div className="contact-item-label">{t('contact_phone_lbl', lang)}</div>
                  <div className="contact-item-value">+90 212 000 00 00</div>
                </div>
              </div>
              <div className="contact-item">
                <div className="contact-icon">📍</div>
                <div>
                  <div className="contact-item-label">{t('contact_addr_lbl', lang)}</div>
                  <div className="contact-item-value">{t('contact_addr_val', lang)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="roadmap-card">
            <h3>{t('roadmap_title', lang)}</h3>
            <div className="roadmap-list">
              <div className="roadmap-item">
                <div className="roadmap-dot" />
                <div>
                  <div className="roadmap-q">Q1 2026</div>
                  <div className="roadmap-text">{t('roadmap_q1', lang)}</div>
                </div>
              </div>
              <div className="roadmap-item">
                <div className="roadmap-dot" />
                <div>
                  <div className="roadmap-q">Q2 2026</div>
                  <div className="roadmap-text">{t('roadmap_q2', lang)}</div>
                </div>
              </div>
              <div className="roadmap-item">
                <div className="roadmap-dot" />
                <div>
                  <div className="roadmap-q">Q3 2026</div>
                  <div className="roadmap-text">{t('roadmap_q3', lang)}</div>
                </div>
              </div>
              <div className="roadmap-item">
                <div className="roadmap-dot" />
                <div>
                  <div className="roadmap-q">Q4 2026</div>
                  <div className="roadmap-text">{t('roadmap_q4', lang)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}

/* ━━━━━━━━ ROUTE PLANNER PAGE ━━━━━━━━ */
function RoutePlannerPage({ theme }: { theme: 'light' | 'dark' }) {
  const { lang } = useLang();
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const directionsRendererRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [originCoords, setOriginCoords] = useState<[number, number] | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(false);
  const [stations, setStations] = useState<Station[]>([]);
  const [routeStations, setRouteStations] = useState<Station[]>([]);
  const [maxDistanceKm, setMaxDistanceKm] = useState(10); // Find stations within 10km of route
  const [triggerRoute, setTriggerRoute] = useState(false);

  const [mapType, setMapType] = useState<'roadmap' | 'hybrid'>('roadmap');
  const [showTraffic, setShowTraffic] = useState(false);
  const trafficLayerRef = useRef<any>(null);
  const layerControlsRef = useRef<HTMLDivElement | null>(null);

  // Dynamic Map Layer and Traffic updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.setMapTypeId(mapType);

    if (showTraffic) {
      if (!trafficLayerRef.current) {
        trafficLayerRef.current = new google.maps.TrafficLayer();
      }
      trafficLayerRef.current.setMap(map);
    } else {
      if (trafficLayerRef.current) {
        trafficLayerRef.current.setMap(null);
      }
    }
  }, [mapType, showTraffic]);

  useEffect(() => {
    getStations().then((data) => setStations(data));

    // Auto-request location on load
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setOriginCoords([pos.coords.latitude, pos.coords.longitude]);
        setOrigin(lang === 'tr' ? "Mevcut Konum" : "Current Location");
      }, () => {
        // Silently fail if blocked or not found automatically
      });
    }
  }, []);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setOptions({
        styles: theme === 'dark' ? GOOGLE_MAPS_DARK_STYLE : [],
      });
    }
  }, [theme]);

  useEffect(() => {
    if (!mapHostRef.current) return;
    const map = new google.maps.Map(mapHostRef.current, {
      center: { lat: TURKEY_CENTER[0], lng: TURKEY_CENTER[1] },
      zoom: 6,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: theme === 'dark' ? GOOGLE_MAPS_DARK_STYLE : [],
    });
    mapRef.current = map;

    if (layerControlsRef.current) {
      map.controls[google.maps.ControlPosition.BOTTOM_RIGHT].push(layerControlsRef.current);
    }

    map.addListener('click', (e: any) => {
      if (e.latLng) {
        setDestinationCoords([e.latLng.lat(), e.latLng.lng()]);
        setDestination("Haritadan Seçildi");
        setTriggerRoute(true);
      }
    });

    return () => {
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (triggerRoute) {
      setTriggerRoute(false);
      calculateRoute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerRoute]);

  const getUserLocation = () => {
    if (!navigator.geolocation) {
      alert("Tarayıcınız konum servisini desteklemiyor.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOriginCoords([pos.coords.latitude, pos.coords.longitude]);
        setOrigin("Mevcut Konum");
      },
      () => alert("Konum alınamadı.")
    );
  };

  const drawStations = (pts: Station[]) => {
    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    pts.forEach(s => {
      const color = s.isGreen ? '#22c55e' : s.maxPower >= 100 ? '#f59e0b' : '#9ca3af';
      const svgIcon = `
<svg width="40" height="52" viewBox="0 0 40 52" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow-route-${s.id}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
    </filter>
  </defs>
  <path d="M20 2C10.06 2 2 10.06 2 20c0 10.5 18 30 18 30s18-19.5 18-30C38 10.06 29.94 2 20 2z" fill="${color}" filter="url(#shadow-route-${s.id})"/>
  <circle cx="20" cy="20" r="10" fill="#fff"/>
  <g transform="translate(14, 14)">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="${color}">
      <path d="M16 4h-1V2h-2v2h-2V2H9v2H8C6.9 4 6 4.9 6 6v14c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-3.5 13H11v-3.5H9L12.5 7v3.5H15L11.5 17z"/>
    </svg>
  </g>
</svg>
`;
      const marker = new google.maps.Marker({
        position: { lat: s.lat, lng: s.lng },
        map: mapRef.current,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgIcon),
          scaledSize: new google.maps.Size(40, 52),
          anchor: new google.maps.Point(20, 50),
        }
      });

      const info = new google.maps.InfoWindow({
        content: `
          <div style="color:#000; min-width: 180px;">
            <h3 style="margin:0 0 5px 0; font-size:14px;">${s.name}</h3>
            <div style="font-size:12px; margin-bottom:4px;">${s.brand} • ${s.serviceType}</div>
            <div style="font-size:12px; opacity:0.8; margin-bottom:8px;">${s.city}</div>
            ${s.acPrice ? `<div style="font-size:12px;">AC: ${s.acPrice}₺</div>` : ''}
            ${s.dcPrice ? `<div style="font-size:12px;">DC: ${s.dcPrice}₺</div>` : ''}
          </div>
        `
      });

      marker.addListener('click', () => {
        info.open(mapRef.current, marker);
      });

      markersRef.current.push(marker);
    });
  };

  const geocode = async (query: string): Promise<[number, number] | null> => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      }
    } catch {
      // omit
    }
    return null;
  };

  const calculateRoute = async () => {
    if (!origin || !destination) return;
    if (!mapRef.current) return;
    setLoading(true);

    const startLoc = originCoords || await geocode(origin);
    const endLoc = destinationCoords || await geocode(destination);

    if (!startLoc || !endLoc) {
      alert(lang === 'tr' ? "Lokasyon bulunamadı. Lütfen daha açık bir adres girin." : "Location not found. Please enter a more specific address.");
      setLoading(false);
      return;
    }

    setOriginCoords(startLoc);
    setDestinationCoords(endLoc);

    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
    }

    directionsRendererRef.current = new google.maps.DirectionsRenderer({
      map: mapRef.current,
      polylineOptions: {
        strokeColor: '#38bdf8',
        strokeWeight: 4,
        strokeOpacity: 0.8
      }
    });

    const service = new google.maps.DirectionsService();
    service.route({
      origin: { lat: startLoc[0], lng: startLoc[1] },
      destination: { lat: endLoc[0], lng: endLoc[1] },
      travelMode: google.maps.TravelMode.DRIVING
    }, (result: any, status: any) => {
      setLoading(false);
      if (status === google.maps.DirectionsStatus.OK && result) {
        directionsRendererRef.current.setDirections(result);

        const route = result.routes[0];
        const leg = route.legs[0];

        const coords: { lat: number, lng: number }[] = [];
        leg.steps.forEach((step: any) => {
          step.path.forEach((latLng: any) => {
            coords.push({ lat: latLng.lat(), lng: latLng.lng() });
          });
        });

        // Bounding box filter for efficiency
        const lats = coords.map(c => c.lat);
        const lngs = coords.map(c => c.lng);
        const minLat = Math.min(...lats) - 0.2;
        const maxLat = Math.max(...lats) + 0.2;
        const minLng = Math.min(...lngs) - 0.2;
        const maxLng = Math.max(...lngs) + 0.2;

        const candidateStations = stations.filter(s =>
          s.lat >= minLat && s.lat <= maxLat && s.lng >= minLng && s.lng <= maxLng
        );

        // Find stations close to the route
        const nearbyStations: Station[] = [];
        for (const s of candidateStations) {
          let minDistance = Infinity;
          for (let i = 0; i < coords.length; i += Math.max(1, Math.floor(coords.length / 200))) {
            const d = kmBetween(s.lat, s.lng, coords[i].lat, coords[i].lng);
            if (d < minDistance) minDistance = d;
          }
          if (minDistance <= maxDistanceKm) {
            nearbyStations.push(s);
          }
        }

        // Sort stations by distance to startLoc (closest to furthest)
        if (startLoc) {
          nearbyStations.sort((a, b) => {
            const distA = kmBetween(a.lat, a.lng, startLoc[0], startLoc[1]);
            const distB = kmBetween(b.lat, b.lng, startLoc[0], startLoc[1]);
            return distA - distB;
          });
        }

        setRouteStations(nearbyStations);
        drawStations(nearbyStations);
      } else {
        alert(lang === 'tr' ? "Rota hesaplanırken bir hata oluştu." : "An error occurred while calculating the route.");
      }
    });
  };

  return (
    <div style={{ height: 'calc(100vh - 72px)', display: 'flex', flexDirection: 'column', background: 'var(--bg-deep)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', height: '100%' }}>
        {/* Sidebar */}
        <div style={{ width: '350px', background: 'var(--bg-surface)', borderRight: '1px solid var(--border-subtle)', boxShadow: '4px 0 24px var(--shadow-sidebar)', display: 'flex', flexDirection: 'column', zIndex: 10 }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border-subtle)' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', color: 'var(--text-primary)' }}>{t('route_title', lang)}</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{t('route_origin', lang)}</span>
                  <button type="button" onClick={getUserLocation} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}>{t('route_my_loc', lang)}</button>
                </label>
                <input
                  type="text"
                  value={origin}
                  onChange={e => { setOrigin(e.target.value); setOriginCoords(null); }}
                  placeholder={t('route_origin_ph', lang)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>{t('route_dest', lang)}</label>
                <input
                  type="text"
                  value={destination}
                  onChange={e => { setDestination(e.target.value); setDestinationCoords(null); }}
                  placeholder={t('route_dest_ph', lang)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>{t('route_max_dist', lang)}</label>
                <input
                  type="number"
                  value={maxDistanceKm}
                  onChange={e => setMaxDistanceKm(Number(e.target.value))}
                  min={1} max={50}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                />
              </div>

              <button
                onClick={calculateRoute}
                disabled={loading || stations.length === 0}
                className="btn-primary"
                style={{ width: '100%', marginTop: '8px', padding: '12px' }}
              >
                {loading ? t('route_calculating', lang) : t('route_calc', lang)}
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            {routeStations.length > 0 ? (
              <>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: 'var(--text-secondary)' }}>{t('route_stations_header', lang)} ({routeStations.length})</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {routeStations.map(s => (
                    <div key={s.id} style={{ background: 'var(--bg-deep)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '6px' }}>
                        <span>{s.name}</span>
                        {originCoords && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                            {kmBetween(originCoords[0], originCoords[1], s.lat, s.lng).toFixed(1)} km
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.brand} • {s.city}</div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                        {s.isGreen && <span className="custom-tag tag-green">{t('map_green', lang).replace('🌿 ', '')}</span>}
                        <span className="custom-tag tag-blue">{s.maxPower}kW</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', marginTop: '20px' }}>
                {t('route_empty', lang)}
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          <div ref={mapHostRef} style={{ width: '100%', height: '100%', background: 'var(--bg-deep)' }} />

          {/* Fütüristik Harita Katmanı ve Trafik Paneli */}
          <div ref={layerControlsRef} className="map-layer-controls">
            <button
              type="button"
              className={`map-layer-btn ${mapType === 'hybrid' ? 'active' : ''}`}
              onClick={() => setMapType(mapType === 'roadmap' ? 'hybrid' : 'roadmap')}
              title={lang === 'tr' ? "Uydu Görünümünü Aç/Kapat" : "Toggle Satellite View"}
            >
              {mapType === 'hybrid' ? t('map_layer_road', lang) : t('map_layer_satellite', lang)}
            </button>
            <button
              type="button"
              className={`map-layer-btn ${showTraffic ? 'active' : ''}`}
              onClick={() => setShowTraffic(!showTraffic)}
              title={lang === 'tr' ? "Canlı Trafik Durumunu Göster/Gizle" : "Toggle Live Traffic"}
            >
              {showTraffic ? t('map_traffic_off', lang) : t('map_traffic_on', lang)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

/* ━━━━━━━━ STATIONS PAGE ━━━━━━━━ */
function StationsPage() {
  const { lang } = useLang();
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const [greenFilter, setGreenFilter] = useState<'all' | 'green' | 'normal'>('all');
  const [serviceFilter, setServiceFilter] = useState<'all' | 'Halka Açık' | 'Özel'>('all');
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    getStations().then(data => {
      setStations(data);
      setLoading(false);
    });
  }, []);

  const requestLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setPage(0);
    });
  };

  const filtered = useMemo(() => {
    let result = stations;

    if (greenFilter !== 'all') {
      result = result.filter(s => greenFilter === 'green' ? s.isGreen : !s.isGreen);
    }
    if (serviceFilter !== 'all') {
      result = result.filter(s => s.serviceType === normalizeServiceLabel(serviceFilter));
    }

    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.brand.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q)
      );
    }

    if (userLoc) {
      result = [...result].sort((a, b) => {
        const distA = kmBetween(userLoc.lat, userLoc.lng, a.lat, a.lng);
        const distB = kmBetween(userLoc.lat, userLoc.lng, b.lat, b.lng);
        return distA - distB;
      });
    }

    return result;
  }, [stations, search, greenFilter, serviceFilter, userLoc]);

  const itemsPerPage = 100;
  const pageCount = Math.ceil(filtered.length / itemsPerPage);
  const currentItems = filtered.slice(page * itemsPerPage, (page + 1) * itemsPerPage);

  return (
    <div style={{ paddingTop: '80px', minHeight: '101vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-deep)' }}>

      <style>{`
        .custom-stations-container {
          max-width: 900px;
          margin: 0 auto;
          width: 100%;
          padding: 0 20px;
        }
        .custom-filter-box {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 24px;
          margin-bottom: 24px;
        }
        .custom-search {
          width: 100%;
          background: var(--bg-deep);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 14px 16px 14px 44px;
          color: var(--text-primary);
          font-size: 0.95rem;
          outline: none;
          transition: border-color 0.2s;
        }
        .custom-search:focus {
          border-color: var(--accent-cyan);
        }
        .custom-search-wrapper {
          position: relative;
          margin-bottom: 24px;
        }
        .custom-search-icon {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 1rem;
          color: var(--text-muted);
          pointer-events: none;
        }
        .custom-filter-label {
          font-size: 0.75rem;
          color: var(--text-muted);
          text-transform: uppercase;
          font-weight: 600;
          letter-spacing: 0.5px;
          margin-bottom: 12px;
        }
        .custom-chip {
          padding: 8px 16px;
          border-radius: 99px;
          border: 1px solid var(--border-default);
          background: transparent;
          color: var(--text-secondary);
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .custom-chip:hover {
          background: var(--bg-elevated);
          border-color: var(--border-highlight);
        }
        .custom-chip.active-cyan {
          background: var(--accent-teal);
          border-color: var(--accent-teal);
          color: #000;
          font-weight: 600;
        }
        .custom-chip.active-green {
          background: #34d399;
          border-color: #34d399;
          color: #000;
          font-weight: 600;
        }
        .custom-chip.location {
          border-color: rgba(34, 211, 238, 0.3);
          color: var(--accent-cyan);
        }
        .custom-chip.location.active {
          background: rgba(34, 211, 238, 0.1);
          border-color: var(--accent-cyan);
        }
        
        .custom-card {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 24px;
          margin-bottom: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 20px;
          transition: border-color 0.2s;
        }
        .custom-card:hover {
          border-color: var(--border-highlight);
        }
        .custom-tag {
          padding: 4px 10px;
          border-radius: 99px;
          font-size: 0.75rem;
          font-weight: 600;
        }
        .tag-green {
          background: rgba(16, 185, 129, 0.15);
          color: #34d399;
        }
        .tag-blue {
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
        }
        .tag-purple {
          background: rgba(168, 85, 247, 0.15);
          color: #c084fc;
        }
        
        .custom-btn-outline {
          background: transparent;
          border: 1px solid var(--border-subtle);
          color: var(--text-primary);
          padding: 10px 20px;
          border-radius: var(--radius-md);
          font-size: 0.9rem;
          font-weight: 500;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: background 0.2s;
        }
        .custom-btn-outline:hover {
          background: var(--bg-elevated);
          border-color: var(--border-highlight);
        }
        .custom-btn-cyan {
          background: var(--accent-teal);
          color: #000;
          border: none;
          padding: 10px 20px;
          border-radius: var(--radius-md);
          font-size: 0.9rem;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 0 20px rgba(45, 212, 191, 0.4);
          transition: all 0.2s;
        }
        .custom-btn-cyan:hover {
          box-shadow: 0 0 30px rgba(45, 212, 191, 0.6);
          transform: translateY(-1px);
        }
      `}</style>

      <div className="custom-stations-container" style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px' }}>
          <span style={{ width: '24px', height: '2px', background: 'var(--accent-cyan)' }}></span>
          {t('nav_stations', lang)}
        </div>
        <h2 style={{ fontSize: '2.5rem', fontWeight: 700, margin: '0 0 12px 0', fontFamily: 'var(--font-display)' }}>{t('stations_title', lang)}</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', margin: 0 }}>
          {t('stations_desc', lang).replace('{n}', stations.length.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US'))}
        </p>
      </div>

      <section className="custom-stations-container" style={{ flex: 1 }}>
        <div className="custom-filter-box">
          <div className="custom-search-wrapper">
            <span className="custom-search-icon">🔍</span>
            <input
              type="text"
              className="custom-search"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder={t('stations_search_ph', lang)}
            />
          </div>

          <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
            <div>
              <div className="custom-filter-label">{t('stations_energy_src', lang)}</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className={`custom-chip ${greenFilter === 'all' ? 'active-cyan' : ''}`} onClick={() => { setGreenFilter('all'); setPage(0); }}>{t('map_all', lang)}</button>
                <button type="button" className={`custom-chip ${greenFilter === 'green' ? 'active-green' : ''}`} onClick={() => { setGreenFilter('green'); setPage(0); }}>{t('map_green', lang)}</button>
                <button type="button" className={`custom-chip ${greenFilter === 'normal' ? 'active-cyan' : ''}`} onClick={() => { setGreenFilter('normal'); setPage(0); }}>{t('map_standard', lang)}</button>
              </div>
            </div>
            <div>
              <div className="custom-filter-label">{t('stations_access_type', lang)}</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className={`custom-chip ${serviceFilter === 'all' ? 'active-cyan' : ''}`} onClick={() => { setServiceFilter('all'); setPage(0); }}>{t('map_all', lang)}</button>
                <button type="button" className={`custom-chip ${serviceFilter === 'Halka Açık' ? 'active-cyan' : ''}`} onClick={() => { setServiceFilter('Halka Açık'); setPage(0); }}>{t('map_public', lang)}</button>
                <button type="button" className={`custom-chip ${serviceFilter === 'Özel' ? 'active-cyan' : ''}`} onClick={() => { setServiceFilter('Özel'); setPage(0); }}>{t('map_private', lang)}</button>
              </div>
            </div>
            <div>
              <div className="custom-filter-label">{t('stations_sort', lang)}</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={requestLocation}
                  className={`custom-chip location ${userLoc ? 'active' : ''}`}
                >
                  {userLoc ? t('stations_sort_loc_active', lang) : t('stations_sort_loc', lang)}
                </button>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>{t('stations_loading', lang)}</p>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {currentItems.map(s => (
                <div key={s.id} className="custom-card">
                  <div style={{ flex: '1 1 250px' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px', fontFamily: 'var(--font-display)' }}>
                      {s.name}
                      {userLoc && (
                        <span style={{ fontSize: '0.85rem', marginLeft: '8px', color: 'var(--accent-cyan)', fontWeight: 500, fontFamily: 'var(--font-body)' }}>
                          • {kmBetween(userLoc.lat, userLoc.lng, s.lat, s.lng).toFixed(1)} km
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px', fontWeight: 600 }}>
                      {s.city} • {s.brand} • {s.serviceType}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {s.isGreen && <span className="custom-tag tag-green">{t('map_green', lang)}</span>}
                      {s.acPrice && <span className="custom-tag tag-blue">AC: {s.acPrice}₺</span>}
                      {s.dcPrice && <span className="custom-tag tag-purple">DC: {s.dcPrice}₺</span>}
                      <span className="custom-tag tag-blue">{s.socketCount} soket • {s.maxPower}kW</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <NavLink to={`/map?id=${s.id}`} className="custom-btn-outline">
                      {t('stations_on_map', lang)}
                    </NavLink>
                    <NavLink to={`/map?id=${s.id}&nav=true`} className="custom-btn-cyan">
                      {t('stations_nav', lang)}
                    </NavLink>
                  </div>
                </div>
              ))}

              {currentItems.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px dashed var(--border-default)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '16px' }}>🔍</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>{t('stations_no_res', lang)}</div>
                  <div style={{ color: '#64748b' }}>{t('stations_empty', lang)}</div>
                </div>
              )}
            </div>

            {pageCount > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 40, padding: '24px 0', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="custom-chip"
                  style={{ opacity: page === 0 ? 0.3 : 1, cursor: page === 0 ? 'not-allowed' : 'pointer' }}
                >
                  {t('stations_prev', lang)}
                </button>
                <span style={{ fontWeight: 500, color: '#64748b', fontSize: '0.9rem' }}>
                  {t('stations_page', lang)} <span style={{ color: '#f8fafc' }}>{page + 1}</span> / {pageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                  disabled={page >= pageCount - 1}
                  className="custom-chip"
                  style={{ opacity: page >= pageCount - 1 ? 0.3 : 1, cursor: page >= pageCount - 1 ? 'not-allowed' : 'pointer' }}
                >
                  {t('stations_next', lang)}
                </button>
              </div>
            )}
          </>
        )}
      </section>
      <Footer />
    </div>
  );
}
