import type { WeatherCondition } from '@/lib/types';

const COLOMBO = { lat: 6.9271, lon: 79.8612 };

export async function fetchWeather(location = 'Colombo'): Promise<WeatherCondition> {
  const key = process.env.WEATHER_API_KEY || process.env.OPENWEATHER_API_KEY;
  if (!key) return fallbackWeather(location);

  try {
    const coords = location.toLowerCase().includes('colombo') ? COLOMBO : COLOMBO;
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${coords.lat}&lon=${coords.lon}&appid=${key}&units=metric`;
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return fallbackWeather(location);

    const data = await res.json();
    const rainMm = data.rain?.['1h'] ?? data.rain?.['3h'] ?? 0;
    const temp = data.main?.temp ?? 28;
    const humidity = data.main?.humidity ?? undefined;
    const main = (data.weather?.[0]?.main || '').toLowerCase();
    const desc = (data.weather?.[0]?.description || '').toLowerCase();

    let condition: WeatherCondition['condition'] = 'sunny';
    if (main.includes('rain') || desc.includes('monsoon') || rainMm > 10) condition = 'monsoon';
    else if (main.includes('drizzle') || rainMm > 0) condition = 'rainy';
    else if (data.main?.humidity > 75) condition = 'humid';

    const spoilageModifier =
      condition === 'monsoon'
        ? 0.5
        : condition === 'rainy'
          ? 0.7
          : condition === 'humid' || (humidity != null && humidity > 80)
            ? 0.85
            : 1.0;

    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${coords.lat}&lon=${coords.lon}&appid=${key}&units=metric&cnt=9`;
    const forecastRes = await fetch(forecastUrl, { next: { revalidate: 1800 } });
    let forecast: WeatherCondition['forecast'] = [];
    if (forecastRes.ok) {
      const forecastData = await forecastRes.json();
      forecast = (forecastData.list || []).slice(0, 3).map((f: { dt_txt: string; weather: { main: string }[]; rain?: { '3h': number } }) => ({
        date: f.dt_txt.split(' ')[0],
        condition: f.weather?.[0]?.main?.toLowerCase() || 'cloudy',
        rainMm: f.rain?.['3h'] ?? 0,
      }));
    }

    return {
      condition,
      temperature: Math.round(temp),
      rainMm: Math.round(rainMm),
      humidity: humidity != null ? Math.round(humidity) : undefined,
      spoilageModifier,
      forecast,
      location,
      source: 'openweather',
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return fallbackWeather(location);
  }
}

function fallbackWeather(location: string): WeatherCondition {
  return {
    condition: 'humid',
    temperature: 28,
    rainMm: 0,
    spoilageModifier: 0.85,
    location,
    source: 'fallback',
    fetchedAt: new Date().toISOString(),
  };
}
