#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_INPUT = 'public/data/stations.json';
const DEFAULT_OUTPUT = 'public/data/stations.geocoded.json';
const DEFAULT_CACHE = 'public/data/geocode-cache.json';

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    cache: DEFAULT_CACHE,
    limit: 300,
    sleepMs: 1100,
    overwrite: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
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

const coordOk = (v) => Number.isFinite(v) && Math.abs(v) <= 180;

function makeQuery(station) {
  const address = norm(station.adres);
  const city = norm(station.sehir);
  const name = norm(station.ad);

  const full = [address, city, 'Turkiye'].filter(Boolean).join(', ');
  const fallback = [name, city, 'Turkiye'].filter(Boolean).join(', ');

  return { full, fallback };
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

async function geocodeNominatim(query) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'tr');
  url.searchParams.set('addressdetails', '0');

  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'ev-charge-atlas-geocoder/1.0 (contact: demo@lumacharge.io)',
    },
  });

  if (!res.ok) {
    throw new Error(`Nominatim error ${res.status}`);
  }

  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const first = rows[0];
  const lat = Number(first.lat);
  const lng = Number(first.lon);

  if (!coordOk(lat) || !coordOk(lng)) return null;

  return {
    lat,
    lng,
    source: 'nominatim',
    displayName: first.display_name ?? null,
  };
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

  let processed = 0;
  let geocoded = 0;
  let cacheHits = 0;
  let failures = 0;

  const result = [];

  for (let i = 0; i < stations.length; i += 1) {
    const station = stations[i];
    const hasCoord = coordOk(Number(station.lat)) && coordOk(Number(station.lng));

    if (hasCoord && !args.overwrite) {
      result.push(station);
      continue;
    }

    if (processed >= args.limit) {
      result.push(station);
      continue;
    }

    processed += 1;

    const { full, fallback } = makeQuery(station);
    const key = full || fallback;

    if (!key) {
      failures += 1;
      result.push(station);
      continue;
    }

    let coords = cache[key] ?? null;

    if (coords) {
      cacheHits += 1;
    } else {
      try {
        coords = await geocodeNominatim(key);
        if (!coords && fallback && fallback !== key) {
          coords = await geocodeNominatim(fallback);
        }
      } catch (error) {
        console.error(`[${i + 1}] geocode error:`, error.message);
        coords = null;
      }

      cache[key] = coords;
      await sleep(args.sleepMs);
    }

    if (coords && coordOk(Number(coords.lat)) && coordOk(Number(coords.lng))) {
      geocoded += 1;
      result.push({
        ...station,
        lat: Number(coords.lat),
        lng: Number(coords.lng),
      });
    } else {
      failures += 1;
      result.push(station);
    }

    if ((processed % 25) === 0) {
      console.log(`Progress: ${processed}/${Math.min(args.limit, stations.length)} processed`);
    }
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(result), 'utf8');
  await fs.writeFile(cachePath, JSON.stringify(cache, null, 2), 'utf8');

  console.log('Done');
  console.log(`Input: ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Cache: ${cachePath}`);
  console.log(`Processed: ${processed}`);
  console.log(`Geocoded: ${geocoded}`);
  console.log(`Cache hits: ${cacheHits}`);
  console.log(`Failures: ${failures}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
