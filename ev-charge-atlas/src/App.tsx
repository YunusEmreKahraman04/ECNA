import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { NavLink, Route, Routes } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';

/* ─── types ─── */
type RadiusKm = 30 | 50 | 100;

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

const toStation = (raw: RawStation): Station => {
  const cityKey = raw.sehir;
  const base = CITY_COORDS[cityKey] ?? CITY_COORDS[normalizeCity(cityKey)] ?? TURKEY_CENTER;
  const hash = raw.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const fallbackLat = base[0] + ((hash % 31) - 15) * 0.006;
  const fallbackLng = base[1] + ((hash % 37) - 18) * 0.006;
  const lat = typeof raw.lat === 'number' && Number.isFinite(raw.lat) ? raw.lat : fallbackLat;
  const lng = typeof raw.lng === 'number' && Number.isFinite(raw.lng) ? raw.lng : fallbackLng;

  return {
    id: raw.id,
    name: raw.ad || 'Adsız İstasyon',
    brand: raw.marka || 'Bilinmiyor',
    serviceType: raw.hizmet,
    address: raw.adres,
    city: raw.sehir,
    isGreen: raw.yesil,
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

/* ─── Navbar ─── */
function Navbar() {
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
            <span className="logo-icon">⚡</span>
            LumaCharge
          </NavLink>
          <div className="navbar-menu">
            <NavLink to="/" end>Ana Sayfa</NavLink>
            <NavLink to="/platform">Platform</NavLink>
            <NavLink to="/map">Harita</NavLink>
            <NavLink to="/contact">İletişim</NavLink>
          </div>
          <div className="navbar-right">
            {canInstall && (
              <button className="navbar-install" onClick={install} type="button">
                📲 Yükle
              </button>
            )}
            <NavLink to="/map" className="navbar-cta desktop-only">
              Haritayı Aç →
            </NavLink>
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
          <NavLink to="/" end onClick={() => setMobileOpen(false)}>🏠 Ana Sayfa</NavLink>
          <NavLink to="/platform" onClick={() => setMobileOpen(false)}>⚙️ Platform</NavLink>
          <NavLink to="/map" onClick={() => setMobileOpen(false)}>🗺️ Harita</NavLink>
          <NavLink to="/contact" onClick={() => setMobileOpen(false)}>📬 İletişim</NavLink>
          <div className="mobile-drawer-divider" />
          <NavLink to="/map" className="mobile-drawer-cta" onClick={() => setMobileOpen(false)}>
            ⚡ Şarj Noktalarını Keşfet
          </NavLink>
          {canInstall && (
            <button className="mobile-drawer-install" onClick={() => { install(); setMobileOpen(false); }} type="button">
              📲 Uygulamayı Yükle
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Footer ─── */
function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="logo-icon" style={{ width: 28, height: 28, fontSize: '0.85rem', borderRadius: 6 }}>⚡</span>
          LumaCharge
        </div>
        <div className="footer-links">
          <NavLink to="/">Ana Sayfa</NavLink>
          <NavLink to="/platform">Platform</NavLink>
          <NavLink to="/map">Harita</NavLink>
          <NavLink to="/contact">İletişim</NavLink>
        </div>
        <span className="footer-copy">© 2026 LumaCharge. Tüm hakları saklıdır.</span>
      </div>
    </footer>
  );
}

/* ━━━━━━━━ APP ━━━━━━━━ */
function App() {
  return (
    <div className="app">
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/platform" element={<PlatformPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/contact" element={<ContactPage />} />
      </Routes>
    </div>
  );
}

/* ━━━━━━━━ HOME PAGE ━━━━━━━━ */
function HomePage() {
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
              Türkiye'nin #1 EV Şarj Platformu
            </div>
            <h1 className="hero-title">
              Şarj noktanı bul,<br />
              <span className="gradient-text">yolculuğuna güvenle devam et.</span>
            </h1>
            <p className="hero-description">
              LumaCharge, Türkiye genelindeki 14.500+ elektrikli araç şarj istasyonunu tek bir haritada toplar.
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
                  <div className="stat-value"><AnimatedNumber value={14556} /></div>
                  <div className="stat-label">Aktif İstasyon</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value"><AnimatedNumber value={82} /></div>
                  <div className="stat-label">Şehir Kapsamı</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value"><AnimatedNumber value={11485} /></div>
                  <div className="stat-label">Halka Açık Nokta</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value"><AnimatedNumber value={180} /></div>
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
            <div className="trust-value"><AnimatedNumber value={14556} /></div>
            <div className="trust-label">Aktif İstasyon Kaydı</div>
          </div>
          <div className="trust-item">
            <div className="trust-value"><AnimatedNumber value={11485} /></div>
            <div className="trust-label">Halka Açık Nokta</div>
          </div>
          <div className="trust-item">
            <div className="trust-value"><AnimatedNumber value={82} /></div>
            <div className="trust-label">Şehir Kapsamı</div>
          </div>
          <div className="trust-item">
            <div className="trust-value"><AnimatedNumber value={180} /></div>
            <div className="trust-label">Marka</div>
          </div>
        </div>
      </div>

      {/* Features */}
      <section className="section">
        <div className="section-label">Özellikler</div>
        <h2 className="section-title">EV sürücüleri için tasarlandı</h2>
        <p className="section-desc">
          Harita-merkezli deneyim, akıllı filtreler ve gerçek zamanlı veri ile şarj kararını hızlandır.
        </p>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🗺️</div>
            <h3>Harita-Öncelikli Deneyim</h3>
            <p>
              Harita her zaman merkezde. Arama ve filtreler haritayı destekler,
              istasyonları anında görselleştir.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📍</div>
            <h3>Konum Tabanlı Arama</h3>
            <p>
              Konumunu paylaş, 30/50/100 km yarıçap seçimiyle en yakın ve en anlamlı istasyonları keşfet.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔋</div>
            <h3>Çoklu Veri Kaynağı</h3>
            <p>
              Tüm istasyonlar, yeşil enerji ve akıllı istasyonlar — 3 bağımsız veri
              kaynağından derlenen kapsamlı veritabanı.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3>Anlık Filtreler</h3>
            <p>
              Marka, hizmet tipi, mesafe ve kaynak bazlı filtrelerle
              binlerce istasyon arasından ihtiyacına uygun olanı bul.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🛡️</div>
            <h3>Güvenilir Operasyon</h3>
            <p>
              Super User / User rol modeli ile verinin doğruluğu ve güvenliği
              sürekli olarak korunur.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Yüksek Performans</h3>
            <p>
              Canvas tabanlı harita render, optimize edilmiş veri yükleme ve
              akıcı kullanıcı deneyimi.
            </p>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* Plans */}
      <section className="section">
        <div className="section-label">Planlar</div>
        <h2 className="section-title">Her sürüş profiline uygun kullanım modeli</h2>
        <p className="section-desc">
          Bireysel sürücülerden kurumsal filolara kadar her ihtiyaca uygun çözüm.
        </p>
        <div className="plans-grid">
          <div className="plan-card">
            <div className="plan-name">Go</div>
            <div className="plan-desc">Hızlı başlangıç, anlık keşif ve temel filtreler ile şarj noktalarını keşfet.</div>
            <div className="plan-price">Ücretsiz</div>
            <ul className="plan-features">
              <li>Temel harita erişimi</li>
              <li>Kaynak ve hizmet filtresi</li>
              <li>Konum bazlı arama</li>
              <li>İstasyon detay bilgisi</li>
            </ul>
          </div>
          <div className="plan-card featured">
            <div className="plan-name">Motion</div>
            <div className="plan-desc">Haftalık sürüş yapanlar için rota odaklı optimizasyon deneyimi.</div>
            <div className="plan-price">Premium</div>
            <ul className="plan-features">
              <li>Go planının tüm özellikleri</li>
              <li>Rota optimizasyonu</li>
              <li>Favori istasyonlar</li>
              <li>Gelişmiş analitik</li>
              <li>Öncelikli destek</li>
            </ul>
          </div>
          <div className="plan-card">
            <div className="plan-name">Power</div>
            <div className="plan-desc">Yüksek kilometre, operasyonel raporlar ve filo yönetimi desteği.</div>
            <div className="plan-price">Enterprise</div>
            <ul className="plan-features">
              <li>Motion planının tüm özellikleri</li>
              <li>Filo yönetim paneli</li>
              <li>API erişimi</li>
              <li>Özel entegrasyonlar</li>
              <li>Dedicated account manager</li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="cta-card">
          <h2>Yolculuk başlamadan önce en doğru şarj kararını ver.</h2>
          <p>Haritayı aç, filtreyi seç, yakınındaki istasyonları saniyeler içinde gör.</p>
          <NavLink to="/map" className="btn-primary">
            🗺️ Haritaya Git
          </NavLink>
        </div>
      </section>

      <Footer />
    </>
  );
}

/* ━━━━━━━━ PLATFORM PAGE ━━━━━━━━ */
function PlatformPage() {
  return (
    <>
      <section className="section">
        <div className="section-label">Platform</div>
        <h2 className="section-title">Nasıl değer üretiyoruz?</h2>
        <p className="section-desc">
          EV sürücüsünün en kritik 3 kararını hızlandırıyoruz: nerede şarj edeceğim,
          hangisi daha güvenilir, hangisi rota maliyetimi optimize eder.
        </p>

        <div className="features-grid" style={{ marginTop: 48 }}>
          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3>Karar Hızı</h3>
            <p>Saniyeler içinde en yakın, en uygun istasyonu bulmanı sağlar. Kararsızlığı ortadan kaldırır.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔋</div>
            <h3>Menzil Güveni</h3>
            <p>Rotanın üzerindeki istasyonları görselleştirir, menzil endişesini ortadan kaldırır.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🧠</div>
            <h3>Rota Zekası</h3>
            <p>Çoklu veri kaynağından derlenen veriler ile en akıllı şarj rotasını önerir.</p>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      <section className="section">
        <div className="section-label">Teknik Altyapı</div>
        <h2 className="section-title">Sağlam temeller üzerine inşa edildi</h2>
        <div className="tech-grid">
          <div className="tech-card">
            <h3>🎨 Ürün Bileşenleri</h3>
            <ul>
              <li>Marka odaklı premium onboarding ve sayfa akışı</li>
              <li>Leaflet tabanlı yüksek performanslı interaktif harita</li>
              <li>30 / 50 / 100 km yakınlık filtreleri</li>
              <li>Super User ve standart User rollerine hazır API modeli</li>
            </ul>
          </div>
          <div className="tech-card">
            <h3>⚙️ Teknik Omurga</h3>
            <ul>
              <li>Frontend: React + TypeScript + Vite + Router</li>
              <li>Data: CSV ingestion ve normalize katmanı</li>
              <li>Map: Canvas tabanlı hızlı marker çizimi</li>
              <li>Backend adayı: FastAPI + PostgreSQL + RBAC</li>
            </ul>
          </div>
          <div className="tech-card">
            <h3>👥 Roller</h3>
            <ul>
              <li>User: keşif, filtre, yakın istasyon, favoriler</li>
              <li>Super User: veri doğrulama, düzenleme, operasyon paneli</li>
              <li>Audit: kritik admin aksiyonları kayıt altında</li>
              <li>Rate-limit ve token politikasıyla güvenli API</li>
            </ul>
          </div>
          <div className="tech-card">
            <h3>📈 Gelecek Vizyonu</h3>
            <ul>
              <li>Gerçek zamanlı doluluk bilgisi entegrasyonu</li>
              <li>Mobil uygulama ve push bildirimler</li>
              <li>Ödeme sistemi entegrasyonu</li>
              <li>Makine öğrenmesi ile talep tahmini</li>
            </ul>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}

/* ━━━━━━━━ MAP PAGE ━━━━━━━━ */
function MapPage() {
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [greenFilter, setGreenFilter] = useState<'all' | 'green' | 'normal'>('all');
  const [serviceFilter, setServiceFilter] = useState<'all' | 'Halka Açık' | 'Özel'>('all');
  const [radiusKm, setRadiusKm] = useState<RadiusKm>(50);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      let res = await fetch('/data/stations.geocoded.json');
      if (!res.ok) {
        res = await fetch('/data/stations.json');
      }
      const raw: RawStation[] = await res.json();
      const parsed = raw.map(toStation);
      setStations(parsed);
      setLoading(false);
    };
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return stations
      .filter((s) => {
        if (greenFilter === 'all') return true;
        if (greenFilter === 'green') return s.isGreen;
        return !s.isGreen;
      })
      .filter((s) => (serviceFilter === 'all' ? true : s.serviceType === serviceFilter))
      .filter((s) => {
        if (!q) return true;
        return (
          s.name.toLowerCase().includes(q) ||
          s.city.toLowerCase().includes(q) ||
          s.brand.toLowerCase().includes(q) ||
          s.address.toLowerCase().includes(q)
        );
      })
      .filter((s) => {
        if (!userLocation) return true;
        return kmBetween(userLocation.lat, userLocation.lng, s.lat, s.lng) <= radiusKm;
      });
  }, [stations, search, greenFilter, serviceFilter, userLocation, radiusKm]);

  const mapCenter: [number, number] = userLocation ? [userLocation.lat, userLocation.lng] : TURKEY_CENTER;
  const openCount = filtered.filter((item) => item.serviceType === 'Halka Açık').length;

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setUserLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
    });
  }, []);

  useEffect(() => {
    if (!mapHostRef.current || mapRef.current) return;
    const map = L.map(mapHostRef.current, {
      center: TURKEY_CENTER,
      zoom: 6,
      preferCanvas: true,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;
    if (!map || !markerLayer) return;
    markerLayer.clearLayers();

    const limited = filtered.slice(0, 5000);
    limited.forEach((station) => {
      const color = station.isGreen ? '#2dd4bf' : station.maxPower >= 100 ? '#a78bfa' : '#3b82f6';
      const marker = L.circleMarker([station.lat, station.lng], {
        radius: 5,
        color: 'transparent',
        weight: 0,
        fillColor: color,
        fillOpacity: 0.85,
      });
      const priceHTML = (station.acPrice || station.dcPrice)
        ? `<div style="margin-top:6px;font-size:12px;display:flex;gap:8px">
            ${station.acPrice ? `<span style="padding:2px 6px;border-radius:4px;background:#e0f2fe;color:#0369a1">AC: ${station.acPrice} ₺/kWh</span>` : ''}
            ${station.dcPrice ? `<span style="padding:2px 6px;border-radius:4px;background:#fce7f3;color:#9d174d">DC: ${station.dcPrice} ₺/kWh</span>` : ''}
           </div>`
        : '';
      marker.bindPopup(
        `<div style="font-family:Inter,sans-serif;padding:4px 0;min-width:200px">
          <strong style="font-size:14px">${station.name}</strong><br/>
          <span style="color:#666;font-size:12px">${station.city} • ${station.brand}</span><br/>
          <span style="display:inline-block;margin-top:4px;padding:2px 8px;border-radius:99px;font-size:11px;background:${station.serviceType === 'Halka Açık' ? '#dcfce7;color:#166534' : '#fef3c7;color:#92400e'}">${station.serviceType}</span>
          ${station.isGreen ? '<span style="display:inline-block;margin-top:4px;margin-left:4px;padding:2px 8px;border-radius:99px;font-size:11px;background:#dcfce7;color:#166534">🌿 Yeşil</span>' : ''}
          ${priceHTML}
          <div style="margin-top:4px;font-size:11px;color:#888">${station.socketCount} soket • Max ${station.maxPower} kW</div>
        </div>`,
      );
      marker.addTo(markerLayer);
    });

    map.setView(mapCenter, userLocation ? 10 : 6);
  }, [filtered, mapCenter, userLocation]);

  return (
    <section className="map-page">
      {/* Mobile bottom sheet toggle */}
      <button
        className="mobile-sheet-toggle"
        onClick={() => setMobileSheetOpen(!mobileSheetOpen)}
        type="button"
      >
        {mobileSheetOpen ? '✕ Kapat' : `⚡ Filtreler (${filtered.length.toLocaleString('tr-TR')})`}
      </button>

      {/* Sidebar / Bottom Sheet */}
      <aside className={`map-sidebar ${mobileSheetOpen ? 'sheet-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-title">🔌 Şarj İstasyonları</div>
          <div className="search-box">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="İstasyon, marka veya şehir ara..."
            />
          </div>
        </div>

        <div className="filter-section">
          <div className="filter-label">Enerji Kaynağı</div>
          <div className="chip-row">
            <button type="button" className={`chip ${greenFilter === 'all' ? 'active' : ''}`} onClick={() => setGreenFilter('all')}>
              Tümü
            </button>
            <button type="button" className={`chip ${greenFilter === 'green' ? 'active' : ''}`} onClick={() => setGreenFilter('green')}>
              🌿 Yeşil Enerji
            </button>
            <button type="button" className={`chip ${greenFilter === 'normal' ? 'active' : ''}`} onClick={() => setGreenFilter('normal')}>
              ⚡ Standart
            </button>
          </div>
          <div className="filter-label" style={{ marginTop: 12 }}>Erişim</div>
          <div className="chip-row">
            <button type="button" className={`chip ${serviceFilter === 'all' ? 'active' : ''}`} onClick={() => setServiceFilter('all')}>
              Tüm Erişim
            </button>
            <button type="button" className={`chip ${serviceFilter === 'Halka Açık' ? 'active' : ''}`} onClick={() => setServiceFilter('Halka Açık')}>
              Halka Açık
            </button>
            <button type="button" className={`chip ${serviceFilter === 'Özel' ? 'active' : ''}`} onClick={() => setServiceFilter('Özel')}>
              Özel
            </button>
          </div>
          <div className="filter-label" style={{ marginTop: 12 }}>Mesafe</div>
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
            <button type="button" className="chip location" onClick={requestLocation}>
              📍 Konumumu Kullan
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="sidebar-kpis">
          <div className="kpi-item">
            <div className="kpi-value">{stations.length.toLocaleString('tr-TR')}</div>
            <div className="kpi-label">Toplam</div>
          </div>
          <div className="kpi-item">
            <div className="kpi-value">{openCount.toLocaleString('tr-TR')}</div>
            <div className="kpi-label">Halka Açık</div>
          </div>
          <div className="kpi-item">
            <div className="kpi-value">{filtered.length.toLocaleString('tr-TR')}</div>
            <div className="kpi-label">Filtreli</div>
          </div>
        </div>

        {/* Results */}
        <div className="sidebar-results">
          {loading && <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '20px 0' }}>Veriler yükleniyor...</p>}
          {!loading && filtered.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '20px 0' }}>Sonuç bulunamadı.</p>
          )}
          {filtered.slice(0, 30).map((s) => (
            <div key={s.id} className="result-card">
              <div className="result-name">{s.name}</div>
              <div className="result-meta">
                {s.city} • {s.brand} • {s.serviceType}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                {s.isGreen && <span className="result-badge green">🌿 Yeşil</span>}
                {s.acPrice && <span className="result-badge all">AC: {s.acPrice}₺</span>}
                {s.dcPrice && <span className="result-badge smart">DC: {s.dcPrice}₺</span>}
                <span className="result-badge all">{s.socketCount} soket • {s.maxPower}kW</span>
              </div>
            </div>
          ))}
          {!loading && filtered.length > 30 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', padding: '12px 0', textAlign: 'center' }}>
              +{(filtered.length - 30).toLocaleString('tr-TR')} istasyon daha...
            </p>
          )}
        </div>
      </aside>

      {/* Map */}
      <div className="map-container">
        {loading && (
          <div className="map-loading">
            <div className="map-loading-spinner" />
          </div>
        )}
        <div ref={mapHostRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </section>
  );
}

/* ━━━━━━━━ CONTACT PAGE ━━━━━━━━ */
function ContactPage() {
  return (
    <>
      <section className="section">
        <div className="contact-section">
          <div className="contact-info">
            <div className="section-label">İletişim</div>
            <h2>Bize ulaşın</h2>
            <p>
              Demo, partnerlik ve enterprise entegrasyonları için ekibimizle iletişime geçebilirsiniz.
              İhtiyacınıza en uygun çözümü birlikte belirleyelim.
            </p>
            <div className="contact-details">
              <div className="contact-item">
                <div className="contact-icon">📧</div>
                <div>
                  <div className="contact-item-label">E-posta</div>
                  <div className="contact-item-value">demo@lumacharge.io</div>
                </div>
              </div>
              <div className="contact-item">
                <div className="contact-icon">📞</div>
                <div>
                  <div className="contact-item-label">Telefon</div>
                  <div className="contact-item-value">+90 212 000 00 00</div>
                </div>
              </div>
              <div className="contact-item">
                <div className="contact-icon">📍</div>
                <div>
                  <div className="contact-item-label">Konum</div>
                  <div className="contact-item-value">İstanbul, Türkiye</div>
                </div>
              </div>
            </div>
          </div>

          <div className="roadmap-card">
            <h3>🗓️ Yol Haritası</h3>
            <div className="roadmap-list">
              <div className="roadmap-item">
                <div className="roadmap-dot" />
                <div>
                  <div className="roadmap-q">Q1 2026</div>
                  <div className="roadmap-text">Web lansmanı ve alfa harita — temel keşif deneyimi</div>
                </div>
              </div>
              <div className="roadmap-item">
                <div className="roadmap-dot" />
                <div>
                  <div className="roadmap-q">Q2 2026</div>
                  <div className="roadmap-text">Rol tabanlı backend, admin paneli ve kullanıcı yönetimi</div>
                </div>
              </div>
              <div className="roadmap-item">
                <div className="roadmap-dot" />
                <div>
                  <div className="roadmap-q">Q3 2026</div>
                  <div className="roadmap-text">Mobil uygulama ve rota optimizasyonu</div>
                </div>
              </div>
              <div className="roadmap-item">
                <div className="roadmap-dot" />
                <div>
                  <div className="roadmap-q">Q4 2026</div>
                  <div className="roadmap-text">Enterprise entegrasyonları ve ödeme sistemi</div>
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

export default App;
