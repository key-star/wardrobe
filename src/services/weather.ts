export interface WeatherLocation {
  name: string
  detail?: string
  latitude: number
  longitude: number
}

export interface WeatherSnapshot {
  temperature: number
  code: number
  label: string
  emoji: string
  fetchedAt: string
  locationName: string
  latitude: number
  longitude: number
}

export interface WeatherPlace {
  id?: number
  name: string
  detail?: string
  latitude: number
  longitude: number
}

interface WeatherResponse {
  current?: {
    temperature_2m?: unknown
    weather_code?: unknown
  }
}

interface GeocodingResponse {
  results?: {
    id?: unknown
    name?: unknown
    admin1?: unknown
    country?: unknown
    latitude?: unknown
    longitude?: unknown
  }[]
}

const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast'
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const REQUEST_TIMEOUT = 8000

function weatherText(code: number): { label: string; emoji: string } {
  if (code === 0) return { label: '晴', emoji: '☀️' }
  if (code === 1) return { label: '晴间多云', emoji: '🌤️' }
  if (code === 2) return { label: '多云', emoji: '⛅' }
  if (code === 3) return { label: '阴', emoji: '☁️' }
  if (code === 45 || code === 48) return { label: '雾', emoji: '🌫️' }
  if (code >= 51 && code <= 57) return { label: '毛毛雨', emoji: '🌦️' }
  if (code === 61) return { label: '小雨', emoji: '🌧️' }
  if (code === 63) return { label: '中雨', emoji: '🌧️' }
  if (code === 65) return { label: '大雨', emoji: '🌧️' }
  if (code === 66 || code === 67) return { label: '冻雨', emoji: '🌧️' }
  if (code === 71) return { label: '小雪', emoji: '🌨️' }
  if (code === 73) return { label: '中雪', emoji: '🌨️' }
  if (code === 75) return { label: '大雪', emoji: '❄️' }
  if (code === 77) return { label: '米雪', emoji: '🌨️' }
  if (code >= 80 && code <= 82) return { label: '阵雨', emoji: '🌦️' }
  if (code === 85 || code === 86) return { label: '阵雪', emoji: '🌨️' }
  if (code >= 95 && code <= 99) return { label: '雷阵雨', emoji: '⛈️' }
  return { label: '天气未知', emoji: '🌡️' }
}

export function describeWeather(code: number): { label: string; emoji: string } {
  return weatherText(code)
}

async function request(url: URL, signal?: AbortSignal): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`请求失败（${response.status}）`)
    return response
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

export async function fetchWeather(
  location: WeatherLocation,
  signal?: AbortSignal,
): Promise<WeatherSnapshot> {
  const url = new URL(WEATHER_URL)
  url.searchParams.set('latitude', String(location.latitude))
  url.searchParams.set('longitude', String(location.longitude))
  url.searchParams.set('current', 'temperature_2m,weather_code')
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('forecast_days', '1')

  const response = await request(url, signal)
  const data = (await response.json()) as WeatherResponse
  const temperature = data.current?.temperature_2m
  const code = data.current?.weather_code
  if (typeof temperature !== 'number' || typeof code !== 'number') {
    throw new Error('天气数据格式异常')
  }
  const text = weatherText(code)
  return {
    temperature: Math.round(temperature),
    code,
    label: text.label,
    emoji: text.emoji,
    fetchedAt: new Date().toISOString(),
    locationName: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
  }
}

export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<WeatherPlace[]> {
  const keyword = query.trim()
  if (!keyword) return []
  const url = new URL(GEOCODING_URL)
  url.searchParams.set('name', keyword)
  url.searchParams.set('count', '6')
  url.searchParams.set('language', 'zh')
  url.searchParams.set('format', 'json')

  const response = await request(url, signal)
  const data = (await response.json()) as GeocodingResponse
  return (data.results ?? [])
    .filter(
      (row) =>
        typeof row.name === 'string' &&
        typeof row.latitude === 'number' &&
        typeof row.longitude === 'number',
    )
    .map((row) => ({
      id: typeof row.id === 'number' ? row.id : undefined,
      name: row.name as string,
      detail: [row.admin1, row.country]
        .filter((part): part is string => typeof part === 'string' && Boolean(part))
        .join(' · '),
      latitude: row.latitude as number,
      longitude: row.longitude as number,
    }))
}

export function currentPosition(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('当前浏览器不支持定位'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      () => reject(new Error('定位失败，请手动选择城市')),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 },
    )
  })
}
