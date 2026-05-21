#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_INPUT = 'public/data/stations.json';
const DEFAULT_OUTPUT = 'public/data/stations.geocoded.json';
const DEFAULT_CACHE = 'public/data/geocode-cache.json';
const CHECKPOINT_EVERY = 100;

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    cache: DEFAULT_CACHE,
    limit: 300,
    sleepMs: 2600,
    overwrite: false,
    photonOnly: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--photon-only') {
      args.photonOnly = true;
      continue;
    }
    if (!token.startsWith('--')) continue;

    const key = token.slice(2);
    const next = argv[i + 1];

    if (key === 'overwrite') {
      args.overwrite = true;
      continue;
    }

    if (next == null || next.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }

    if (key === 'limit') {
      args.limit = Number(next);
    } else if (key === 'sleepMs') {
      args.sleepMs = Number(next);
    } else if (key in args) {
      args[key] = next;
    }

    i += 1;
  }

  if (!Number.isFinite(args.limit) || args.limit < 0) {
    throw new Error('--limit must be a non-negative number');
  }

  if (!Number.isFinite(args.sleepMs) || args.sleepMs < 0) {
    throw new Error('--sleepMs must be a non-negative number');
  }

  return args;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const norm = (value) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');

const coordOkLng = (v) => v !== null && v !== undefined && v !== 0 && v !== '0' && v !== '' && Number.isFinite(Number(v)) && Math.abs(Number(v)) <= 180;

function latOk(lat) {
  return lat !== null && lat !== undefined && lat !== 0 && lat !== '0' && lat !== '' && Number.isFinite(Number(lat)) && Math.abs(Number(lat)) <= 90;
}

function isValidResolvedCoord(obj) {
  return (
    obj != null
    && typeof obj === 'object'
    && latOk(Number(obj.lat))
    && coordOkLng(Number(obj.lng))
  );
}

const TURKISH_CITIES = new Set([
  'adana', 'adiyaman', 'afyonkarahisar', 'agri', 'aksaray', 'amasya', 'ankara', 'antalya', 'ardahan', 'artvin',
  'aydin', 'balikesir', 'bartin', 'batman', 'bayburt', 'bilecik', 'bingol', 'bitlis', 'bolu', 'burdur', 'bursa',
  'canakkale', 'cankiri', 'corum', 'denizli', 'diyarbakir', 'duzce', 'edirne', 'elazig', 'erzincan', 'erzurum',
  'eskisehir', 'gaziantep', 'giresun', 'gumushane', 'hakkari', 'hatay', 'igdir', 'isparta', 'istanbul', 'izmir',
  'kahramanmaras', 'karabuk', 'karaman', 'kars', 'kastamonu', 'kayseri', 'kilis', 'kirikkale', 'kirklareli',
  'kirsehir', 'kocaeli', 'konya', 'kutahya', 'malatya', 'manisa', 'mardin', 'mersin', 'mugla', 'mus', 'nevsehir',
  'nigde', 'ordu', 'osmaniye', 'rize', 'sakarya', 'samsun', 'sanliurfa', 'siirt', 'sinop', 'sivas', 'sirnak',
  'tekirdag', 'tokat', 'trabzon', 'tunceli', 'usak', 'van', 'yalova', 'yozgat', 'zonguldak'
]);

function isGenericCentroid(displayName, query) {
  if (!displayName) return false;
  const nameLower = String(displayName).toLowerCase().trim()
    .replace(/[ıİ]/g, 'i')
    .replace(/[şŞ]/g, 's')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c');
  
  if (nameLower === 'turkiye' || nameLower === 'turkey') return true;
  if (TURKISH_CITIES.has(nameLower)) {
    const qLower = String(query).toLowerCase();
    if (qLower.includes('mah') || qLower.includes('cad') || qLower.includes('sok') || qLower.includes('no:')) {
      return true;
    }
  }
  return false;
}

function pruneBadCache(cache) {
  let removed = 0;
  for (const k of Object.keys(cache)) {
    const v = cache[k];
    if (!isValidResolvedCoord(v) || isGenericCentroid(v.displayName, k)) {
      delete cache[k];
      removed += 1;
    }
  }
  return removed;
}

function cleanQueryParts(parts) {
  const seen = new Set();
  return parts
    .map(p => String(p ?? '').trim())
    .filter(p => {
      if (!p) return false;
      const lower = p.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    });
}

function extractDistrictAndCity(address, fallbackCity) {
  const cleanAddr = String(address ?? '').replace(/\([^)]*\)/g, '').trim();
  const slashParts = cleanAddr.split('/');
  
  let city = fallbackCity ? String(fallbackCity).trim() : '';
  if (city.toLowerCase() === 'bilinmiyor') city = '';
  
  let district = '';

  if (slashParts.length >= 2) {
    const lastPart = slashParts[slashParts.length - 1].trim();
    const prevPart = slashParts[slashParts.length - 2].trim();
    
    if (lastPart.length > 2 && !/\d/.test(lastPart)) {
      city = lastPart;
    }
    
    const words = prevPart.split(/\s+/);
    if (words.length > 0) {
      district = words[words.length - 1].trim();
      if (/\d/.test(district) || district.length <= 2) {
        district = '';
      }
    }
  }

  return { district, city };
}

const SPECIFIC_KEYWORDS = [
  'avm', 'merkez', 'otel', 'hotel', 'petrol', 'tesis', 'sanayi', 'park', 'kolej',
  'lise', 'hastane', 'universite', 'cami', 'plaza', 'restoran', 'restaurant',
  'cafe', 'gross', 'outlet', 'koçtaş', 'migros', 'şok', 'a101', 'carrefour',
  'shell', 'opet', 'bp', 'aytemiz', 'po', 'petrol ofisi', 'total', 'sunpet',
  'lukoil', 'mola', 'dinlenme', 'terminal', 'otogar', 'burulaş', 'havalimanı',
  'havaalanı', 'istasyonu'
];

function isSpecificName(name) {
  const normName = String(name ?? '').toLowerCase();
  const stripped = normName
    .replace(/\b(?:otojet|trugo|zes|eşarj|şarjon|astorşarj|beefull|toger|estasyon|i-şarj|mycharge|aksa şarj|b-charge|epsis|şarjgo|şarjist|en yakıt|voltrun)\b\s*[-–]?\s*/gi, '')
    .trim();
  if (stripped.length <= 4) return false;
  return SPECIFIC_KEYWORDS.some(kw => stripped.includes(kw));
}

function cleanStationName(name) {
  return String(name ?? '')
    .replace(/^(?:otojet|trugo|zes|eşarj|şarjon|astorşarj|beefull|toger|estasyon|i-şarj|mycharge|aksa şarj|b-charge|epsis|şarjgo|şarjist|en yakıt|voltrun)\b\s*[-–]?\s*/gi, '')
    .trim();
}

function makeQuery(station) {
  const rawAddress = norm(station.adres);
  let city = norm(station.sehir);
  const name = norm(station.ad);

  if (city.toLowerCase() === 'bilinmiyor') {
    city = '';
  }

  // Remove parentheses
  let cleanedAddr = rawAddress.replace(/\([^)]*\)/g, '').trim();

  // Extract district and city
  const extracted = extractDistrictAndCity(rawAddress, city);
  const resolvedCity = extracted.city || city;
  const resolvedDistrict = extracted.district;

  // Clean Turkish duplicate suffixes
  cleanedAddr = cleanedAddr
    .replace(/\bmah\s+mahallesi\b/gi, 'Mahallesi')
    .replace(/\bcad\s+caddesi\b/gi, 'Caddesi')
    .replace(/\b(?:sokak|sok|sk)\s+sokağı\b/gi, 'Sokak')
    .replace(/\b(?:bulvar|bul|blv)\s+bulvarı\b/gi, 'Bulvarı')
    .replace(/\bapt\s+apartmanı\b/gi, 'Apartmanı');

  // Expand abbreviations
  cleanedAddr = cleanedAddr
    .replace(/\bmah\./gi, 'Mahallesi')
    .replace(/\bmah\b/gi, 'Mahallesi')
    .replace(/\bcad\./gi, 'Caddesi')
    .replace(/\bcad\b/gi, 'Caddesi')
    .replace(/\b(?:sok|sk)\./gi, 'Sokak')
    .replace(/\b(?:sok|sk)\b/gi, 'Sokak')
    .replace(/\b(?:bul|blv)\./gi, 'Bulvarı')
    .replace(/\b(?:bul|blv)\b/gi, 'Bulvarı')
    .replace(/\bapt\./gi, 'Apartmanı')
    .replace(/\bapt\b/gi, 'Apartmanı');

  // Replace slash with comma
  cleanedAddr = cleanedAddr.replace(/\s*\/\s*/g, ', ').trim();

  // Remove multiple spaces
  cleanedAddr = cleanedAddr.replace(/\s+/g, ' ');

  // Candidate A: Cleaned Address, City, Türkiye
  const queryA = cleanQueryParts([cleanedAddr, resolvedCity, 'Türkiye']).join(', ');

  // Candidate B: Without specific door number info
  let addrWithoutNo = cleanedAddr.replace(/\bno\s*:\s*\S*/gi, '').trim();
  const queryB = cleanQueryParts([addrWithoutNo, resolvedCity, 'Türkiye']).join(', ');

  // Candidate C: Core address before first slash, City, Türkiye
  const beforeSlash = rawAddress.split('/')[0]?.replace(/\([^)]*\)/g, '').trim() ?? '';
  const queryC = cleanQueryParts([beforeSlash, resolvedCity, 'Türkiye']).join(', ');

  // Candidate D: District, City, Türkiye
  let queryD = '';
  if (resolvedDistrict && resolvedCity) {
    queryD = cleanQueryParts([resolvedDistrict, resolvedCity, 'Türkiye']).join(', ');
  }

  // Candidate E: Cleaned Station Name, City, Türkiye
  const cleanedName = cleanStationName(station.ad);
  const queryE = cleanedName ? cleanQueryParts([cleanedName, resolvedCity, 'Türkiye']).join(', ') : '';

  // Candidate F: City, Türkiye (absolute fallback, but only if city is valid)
  const queryF = resolvedCity ? cleanQueryParts([resolvedCity, 'Türkiye']).join(', ') : '';

  const nameIsSpecific = isSpecificName(station.ad);

  const candidates = nameIsSpecific ? [
    queryE,
    queryA,
    queryB,
    queryC,
    queryD,
    queryF,
  ] : [
    queryA,
    queryB,
    queryC,
    queryD,
    queryE,
    queryF,
  ];

  const filtered = candidates.filter(Boolean);
  return [...new Set(filtered)];
}

async function loadJson(filePath, fallbackValue) {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    return JSON.parse(text);
  } catch (error) {
    if (error && error.code === 'ENOENT') return fallbackValue;
    throw error;
  }
}

async function geocodeGoogle(query) {
  try {
    const apiKey = 'AIzaSyArYzf8rbtGz5GMWhgwGY43tttFRjrp874';
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', query);
    url.searchParams.set('key', apiKey);

    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Google API Error: HTTP ${res.status}`);
      return null;
    }

    const json = await res.json();
    if (json.status === 'OK' && json.results && json.results.length > 0) {
      const result = json.results[0];
      const lat = result.geometry.location.lat;
      const lng = result.geometry.location.lng;
      if (latOk(lat) && coordOkLng(lng)) {
        return {
          lat,
          lng,
          source: 'google',
          displayName: result.formatted_address || null,
        };
      }
    } else if (json.status === 'ZERO_RESULTS') {
      // Not found, continue
    } else {
      console.warn(`Google API status: ${json.status} for query: ${query}`);
    }
    return null;
  } catch (error) {
    console.error('Google API exception:', error);
    return null;
  }
}

async function geocodePhoton(query) {
  try {
    const url = new URL('https://photon.komoot.io/api');
    url.searchParams.set('q', query);
    url.searchParams.set('limit', '1');

    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ev-charge-atlas-geocoder/1.0 (contact: info@ecna.com.tr)',
      },
    });

    if (!res.ok) return null;

    const json = await res.json();
    const f = json?.features?.[0];
    const c = f?.geometry?.coordinates;

    if (!Array.isArray(c) || c.length < 2) return null;

    const lng = Number(c[0]);
    const lat = Number(c[1]);

    if (!latOk(lat) || !coordOkLng(lng)) return null;

    return {
      lat,
      lng,
      source: 'photon',
      displayName: f?.properties?.name ?? null,
    };
  } catch {
    return null;
  }
}

async function geocodeNominatim(query) {
  const maxAttempts = 8;
  let attempt = 0;

  while (attempt < maxAttempts) {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('countrycodes', 'tr');
    url.searchParams.set('addressdetails', '0');

    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ev-charge-atlas-geocoder/1.0 (contact: info@ecna.com.tr)',
      },
    });

    if (res.status === 429) {
      let waitMs = 15_000 + attempt * 8000;
      const ra = res.headers.get('retry-after');
      if (ra != null && /^\d+(\.\d+)?$/.test(ra.trim())) {
        waitMs = Math.max(waitMs, Math.ceil(Number(ra) * 1000));
      }
      console.warn(
        `Nominatim 429 → ${Math.round(waitMs / 1000)} sn bekleniyor (deneme ${attempt + 1}/${maxAttempts})`,
      );
      await sleep(waitMs);
      attempt += 1;
      continue;
    }

    if (!res.ok) {
      throw new Error(`Nominatim error ${res.status}`);
    }

    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const first = rows[0];
    const lat = Number(first.lat);
    const lng = Number(first.lon);

    if (!latOk(lat) || !coordOkLng(lng)) return null;

    return {
      lat,
      lng,
      source: 'nominatim',
      displayName: first.display_name ?? null,
    };
  }

  console.warn('Nominatim: yeniden deneme tükendi →', query.slice(0, 80));
  return null;
}

/**
 * Google Geocoding (yeni/hızlı/kesin) → Photon → Nominatim.
 */
async function resolveCoords(candidates, sleepMsNom, idxLabel, photonOnly) {
  // 1. Konya M1 AVM ve Doç. Dr. Halil Ürün Caddesi bypass'ı
  for (const q of candidates) {
    const qLower = q.toLowerCase();
    if (qLower.includes('doç.dr.halil') || qLower.includes('halil urun') || qLower.includes('m1 konya') || qLower.includes('yazir mah')) {
      if (qLower.includes('konya') || qLower.includes('selcuklu')) {
        console.log(`${idxLabel} [Bypass] Konya M1 AVM / Doç. Dr. Halil Ürün Caddesi için kesin koordinatlar manuel atandı: 37.9510893, 32.4962343`);
        return {
          lat: 37.9510893,
          lng: 32.4962343,
          source: 'manual_override',
          displayName: 'Yazır Mahallesi Doç.dr.halil Ürün Caddesi No:22/79 Selçuklu / KONYA'
        };
      }
    }
  }

  // 2. Google Geocoding API ile sorgulama (Hızlı ve Kesin)
  for (const q of candidates) {
    const coords = await geocodeGoogle(q);
    await sleep(35); // QPS 50 limite uygun, hızlı ve polite 35ms bekleme
    if (isValidResolvedCoord(coords)) {
      if (isGenericCentroid(coords.displayName, q)) {
        continue;
      }
      return coords;
    }
  }

  // Google API bulamadıysa Photon/Nominatim gibi yanıltıcı açık kaynaklı servislere ASLA düşme!
  return null;
}

const CITY_COORDS_CENTROIDS = {
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
  'KIRIKKALE': [39.8468, 33.5153],
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

function normalizeCityName(val) {
  return String(val ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z]/g, '');
}

function kmBetween(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earth = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earth * Math.asin(Math.sqrt(a));
}

function isStationAtCityCentroid(station) {
  if (!station.lat || !station.lng) return false;
  const cityKey = normalizeCityName(station.sehir);
  const base = CITY_COORDS_CENTROIDS[cityKey];
  if (!base) return false;
  const dist = kmBetween(Number(station.lat), Number(station.lng), base[0], base[1]);
  return dist < 3.0; // Less than 3 km to catch offset centroids
}

async function main() {
  const args = parseArgs(process.argv);
  const cwd = process.cwd();

  const inputPath = path.resolve(cwd, args.input);
  const outputPath = path.resolve(cwd, args.output);
  const cachePath = path.resolve(cwd, args.cache);

  const stations = await loadJson(inputPath, null);
  if (!Array.isArray(stations)) {
    throw new Error(`Input must be a JSON array: ${inputPath}`);
  }

  const cache = await loadJson(cachePath, {});
  if (cache == null || typeof cache !== 'object' || Array.isArray(cache)) {
    throw new Error(`Cache must be a JSON object: ${cachePath}`);
  }

  const purged = pruneBadCache(cache);
  if (purged > 0) {
    console.log(`Önbellekten ${purged} geçersiz kayıt silindi (başarısız/null girdiler).`);
  }

  // Purge specific bad coordinates and keys from cache to force correct re-geocoding
  let cacheKeyPurges = 0;
  for (const key of Object.keys(cache)) {
    if (key.toLowerCase().includes('doç.dr.halil') || key.toLowerCase().includes('m1 konya')) {
      delete cache[key];
      cacheKeyPurges++;
    }
  }
  if (cacheKeyPurges > 0) {
    console.log(`Önbellekten ${cacheKeyPurges} hatalı Konya M1 AVM/Doç. Dr. Halil Ürün caddesi kaydı temizlendi.`);
  }

  const out = /** @type {object[]} */ (structuredClone(stations));

  // Force reset coordinates for Yazır / M1 Konya AVM station to trigger geocoding
  let targetResets = 0;
  for (const s of out) {
    if (s.id === 'ŞRJ/20481' || s.ad.includes('M1 Konya')) {
      s.lat = null;
      s.lng = null;
      targetResets++;
    }
  }
  if (targetResets > 0) {
    console.log(`Yazır Mahallesi M1 Konya AVM istasyonunun (${targetResets} adet) koordinatı yeniden geocode edilmek üzere sıfırlandı.`);
  }

  let processed = 0;
  let geocoded = 0;
  let cacheHits = 0;
  let failures = 0;

  const persistCheckpoint = async () => {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(out), 'utf8');
    await fs.writeFile(cachePath, JSON.stringify(cache, null, 2), 'utf8');
  };

  let stopRequested = false;
  process.on('SIGINT', async () => {
    if (stopRequested) return;
    stopRequested = true;
    console.error('\nSinyal: ara kayıt yazılıyor…');
    try {
      await persistCheckpoint();
      console.error('Checkpoint kaydedildi.');
    } catch (e) {
      console.error(e);
    }
    process.exitCode = 130;
    process.exit();
  });

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const needsCoordinate = (s) => {
    const hasCoord =
      latOk(Number(s.lat)) && coordOkLng(Number(s.lng));
    if (args.overwrite) return true;
    if (!hasCoord) return true;
    if (isStationAtCityCentroid(s)) return true;
    return false;
  };
  const totalNeeding = out.filter(needsCoordinate).length;
  if (args.photonOnly) {
    console.log('Mod: Photon-only (--photon-only) — Nominatim kullanılmıyor.');
  }

  console.log(
    `Girdi: ${out.length} istasyon | koordinatsız veya merkez centroid: ~${totalNeeding} | bu çalışmada en fazla ${Math.min(totalNeeding, args.limit)} adres sorgusu`,
  );

  for (let i = 0; i < out.length; i += 1) {
    const station = out[i];
    const hasCoord =
      latOk(Number(station.lat)) && coordOkLng(Number(station.lng));

    if (hasCoord && !args.overwrite && !isStationAtCityCentroid(station)) {
      continue;
    }

    const isTargetReset = station.id === 'ŞRJ/20481' || station.ad.includes('M1 Konya');
    if (processed >= args.limit && !isTargetReset) {
      continue;
    }

    processed += 1;

    const candidates = makeQuery(station);
    const key = candidates[0];

    if (!key) {
      failures += 1;
      continue;
    }

    let coords = null;

    for (const q of candidates) {
      if (isValidResolvedCoord(cache[q])) {
        coords = cache[q];
        cacheHits += 1;
        break;
      }
    }

    if (!coords) {
      coords = await resolveCoords(candidates, args.sleepMs, `[${i + 1}]`, args.photonOnly);
      if (coords) cache[key] = coords;
    }

    if (coords && latOk(Number(coords.lat)) && coordOkLng(Number(coords.lng))) {
      geocoded += 1;
      station.lat = Number(coords.lat);
      station.lng = Number(coords.lng);
    } else {
      failures += 1;
    }

    if (processed % 25 === 0) {
      console.log(
        `İlerleme: ${processed} (yeni koordinat: ${geocoded}, önbellek: ${cacheHits}, başarısız: ${failures})`,
      );
    }
    if (processed % CHECKPOINT_EVERY === 0) {
      await persistCheckpoint();
      console.log(`→ Checkpoint (${processed})`);
    }
  }

  await persistCheckpoint();

  console.log('Bitti.');
  console.log(`Input: ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Cache: ${cachePath}`);
  console.log(`İşlenen adres: ${processed}`);
  console.log(`Yeni koordinat: ${geocoded}`);
  console.log(`Önbellek isabeti: ${cacheHits}`);
  console.log(`Başarısız (koordinatsız): ${failures}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
