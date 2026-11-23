export interface City {
  name: string;
  country: string;
  zone: string;
}

/** A curated set of cities across every major UTC offset. */
export const CITIES: City[] = [
  { name: 'Honolulu', country: 'United States', zone: 'Pacific/Honolulu' },
  { name: 'Anchorage', country: 'United States', zone: 'America/Anchorage' },
  { name: 'Los Angeles', country: 'United States', zone: 'America/Los_Angeles' },
  { name: 'Vancouver', country: 'Canada', zone: 'America/Vancouver' },
  { name: 'Denver', country: 'United States', zone: 'America/Denver' },
  { name: 'Phoenix', country: 'United States', zone: 'America/Phoenix' },
  { name: 'Chicago', country: 'United States', zone: 'America/Chicago' },
  { name: 'Mexico City', country: 'Mexico', zone: 'America/Mexico_City' },
  { name: 'New York', country: 'United States', zone: 'America/New_York' },
  { name: 'Toronto', country: 'Canada', zone: 'America/Toronto' },
  { name: 'Bogotá', country: 'Colombia', zone: 'America/Bogota' },
  { name: 'Lima', country: 'Peru', zone: 'America/Lima' },
  { name: 'Santiago', country: 'Chile', zone: 'America/Santiago' },
  { name: 'Buenos Aires', country: 'Argentina', zone: 'America/Argentina/Buenos_Aires' },
  { name: 'São Paulo', country: 'Brazil', zone: 'America/Sao_Paulo' },
  { name: 'Reykjavík', country: 'Iceland', zone: 'Atlantic/Reykjavik' },
  { name: 'London', country: 'United Kingdom', zone: 'Europe/London' },
  { name: 'Dublin', country: 'Ireland', zone: 'Europe/Dublin' },
  { name: 'Lisbon', country: 'Portugal', zone: 'Europe/Lisbon' },
  { name: 'Lagos', country: 'Nigeria', zone: 'Africa/Lagos' },
  { name: 'Accra', country: 'Ghana', zone: 'Africa/Accra' },
  { name: 'Casablanca', country: 'Morocco', zone: 'Africa/Casablanca' },
  { name: 'Paris', country: 'France', zone: 'Europe/Paris' },
  { name: 'Berlin', country: 'Germany', zone: 'Europe/Berlin' },
  { name: 'Madrid', country: 'Spain', zone: 'Europe/Madrid' },
  { name: 'Rome', country: 'Italy', zone: 'Europe/Rome' },
  { name: 'Amsterdam', country: 'Netherlands', zone: 'Europe/Amsterdam' },
  { name: 'Stockholm', country: 'Sweden', zone: 'Europe/Stockholm' },
  { name: 'Warsaw', country: 'Poland', zone: 'Europe/Warsaw' },
  { name: 'Athens', country: 'Greece', zone: 'Europe/Athens' },
  { name: 'Cairo', country: 'Egypt', zone: 'Africa/Cairo' },
  { name: 'Johannesburg', country: 'South Africa', zone: 'Africa/Johannesburg' },
  { name: 'Kyiv', country: 'Ukraine', zone: 'Europe/Kyiv' },
  { name: 'Istanbul', country: 'Türkiye', zone: 'Europe/Istanbul' },
  { name: 'Nairobi', country: 'Kenya', zone: 'Africa/Nairobi' },
  { name: 'Moscow', country: 'Russia', zone: 'Europe/Moscow' },
  { name: 'Riyadh', country: 'Saudi Arabia', zone: 'Asia/Riyadh' },
  { name: 'Tehran', country: 'Iran', zone: 'Asia/Tehran' },
  { name: 'Dubai', country: 'United Arab Emirates', zone: 'Asia/Dubai' },
  { name: 'Karachi', country: 'Pakistan', zone: 'Asia/Karachi' },
  { name: 'Mumbai', country: 'India', zone: 'Asia/Kolkata' },
  { name: 'Delhi', country: 'India', zone: 'Asia/Kolkata' },
  { name: 'Kathmandu', country: 'Nepal', zone: 'Asia/Kathmandu' },
  { name: 'Dhaka', country: 'Bangladesh', zone: 'Asia/Dhaka' },
  { name: 'Bangkok', country: 'Thailand', zone: 'Asia/Bangkok' },
  { name: 'Jakarta', country: 'Indonesia', zone: 'Asia/Jakarta' },
  { name: 'Singapore', country: 'Singapore', zone: 'Asia/Singapore' },
  { name: 'Hong Kong', country: 'China', zone: 'Asia/Hong_Kong' },
  { name: 'Shanghai', country: 'China', zone: 'Asia/Shanghai' },
  { name: 'Taipei', country: 'Taiwan', zone: 'Asia/Taipei' },
  { name: 'Manila', country: 'Philippines', zone: 'Asia/Manila' },
  { name: 'Perth', country: 'Australia', zone: 'Australia/Perth' },
  { name: 'Seoul', country: 'South Korea', zone: 'Asia/Seoul' },
  { name: 'Tokyo', country: 'Japan', zone: 'Asia/Tokyo' },
  { name: 'Adelaide', country: 'Australia', zone: 'Australia/Adelaide' },
  { name: 'Brisbane', country: 'Australia', zone: 'Australia/Brisbane' },
  { name: 'Sydney', country: 'Australia', zone: 'Australia/Sydney' },
  { name: 'Melbourne', country: 'Australia', zone: 'Australia/Melbourne' },
  { name: 'Auckland', country: 'New Zealand', zone: 'Pacific/Auckland' },
  { name: 'Fiji', country: 'Fiji', zone: 'Pacific/Fiji' },
];

/** Saved entries are "<zone>|<city name>" so two cities in one zone (Mumbai, Delhi) stay distinct. */
export const cityKey = (c: City) => `${c.zone}|${c.name}`;
export function cityFromKey(key: string): City {
  const [zone, name] = key.split('|');
  return CITIES.find((c) => c.zone === zone && c.name === name) ?? { zone, name: name || zone.split('/').pop()!.replace(/_/g, ' '), country: '' };
}

/** Wall-clock parts of `now` in `zone`. */
export function zonedParts(zone: string, now: number) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') % 24, minute: get('minute') };
}

/** Offset of `zone` from UTC in minutes at `now`. */
export function zoneOffsetMinutes(zone: string, now: number): number {
  const p = zonedParts(zone, now);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((asUtc - Math.floor(now / 60_000) * 60_000) / 60_000);
}

/** "+5h 30m", "−3h", "Same time" relative to the device. */
export function describeOffset(zone: string, now: number): { diff: string; day: 'Today' | 'Tomorrow' | 'Yesterday' } {
  const local = -new Date(now).getTimezoneOffset();
  const diffMin = zoneOffsetMinutes(zone, now) - local;
  const p = zonedParts(zone, now);
  const d = new Date(now);
  const zonedDay = Date.UTC(p.year, p.month - 1, p.day);
  const localDay = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const day = zonedDay > localDay ? 'Tomorrow' : zonedDay < localDay ? 'Yesterday' : 'Today';
  if (diffMin === 0) return { diff: 'Same time', day };
  const sign = diffMin > 0 ? '+' : '−';
  const abs = Math.abs(diffMin);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return { diff: `${sign}${h}h${m ? ` ${m}m` : ''}`, day };
}
