import { useState, useEffect } from 'react'
import {
  Cloud, CloudDrizzle, CloudRain, CloudSnow, CloudSun, Sun, CloudLightning,
  CloudFog, Wind, Droplets, Thermometer, Eye
} from 'lucide-react'

interface WeatherData {
  current: {
    temperature: number
    apparentTemperature: number
    weatherCode: number
    windSpeed: number
    humidity: number
    isDay: boolean
  }
  hourly: {
    time: string
    temperature: number
    weatherCode: number
    precipitationProbability: number
  }[]
  daily: {
    tempMax: number
    tempMin: number
    weatherCode: number
    precipitationProbabilityMax: number
  }
}

const WMO_CODES: Record<number, { label: string; icon: typeof Sun }> = {
  0: { label: 'Clear sky', icon: Sun },
  1: { label: 'Mainly clear', icon: CloudSun },
  2: { label: 'Partly cloudy', icon: CloudSun },
  3: { label: 'Overcast', icon: Cloud },
  45: { label: 'Foggy', icon: CloudFog },
  48: { label: 'Rime fog', icon: CloudFog },
  51: { label: 'Light drizzle', icon: CloudDrizzle },
  53: { label: 'Drizzle', icon: CloudDrizzle },
  55: { label: 'Heavy drizzle', icon: CloudDrizzle },
  56: { label: 'Freezing drizzle', icon: CloudDrizzle },
  57: { label: 'Heavy freezing drizzle', icon: CloudDrizzle },
  61: { label: 'Light rain', icon: CloudRain },
  63: { label: 'Rain', icon: CloudRain },
  65: { label: 'Heavy rain', icon: CloudRain },
  66: { label: 'Freezing rain', icon: CloudRain },
  67: { label: 'Heavy freezing rain', icon: CloudRain },
  71: { label: 'Light snow', icon: CloudSnow },
  73: { label: 'Snow', icon: CloudSnow },
  75: { label: 'Heavy snow', icon: CloudSnow },
  77: { label: 'Snow grains', icon: CloudSnow },
  80: { label: 'Light showers', icon: CloudRain },
  81: { label: 'Showers', icon: CloudRain },
  82: { label: 'Heavy showers', icon: CloudRain },
  85: { label: 'Snow showers', icon: CloudSnow },
  86: { label: 'Heavy snow showers', icon: CloudSnow },
  95: { label: 'Thunderstorm', icon: CloudLightning },
  96: { label: 'Thunderstorm with hail', icon: CloudLightning },
  99: { label: 'Thunderstorm with heavy hail', icon: CloudLightning },
}

function getWeatherInfo(code: number) {
  return WMO_CODES[code] || { label: 'Unknown', icon: Cloud }
}

const LONDON_LAT = 51.5074
const LONDON_LON = -0.1278

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LONDON_LAT}&longitude=${LONDON_LON}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,is_day&hourly=temperature_2m,weather_code,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&timezone=Europe/London&forecast_days=1`

    fetch(url)
      .then(r => r.json())
      .then(data => {
        const now = new Date()
        const currentHour = now.getHours()

        const hourlyData = (data.hourly?.time || [])
          .map((t: string, i: number) => ({
            time: t,
            temperature: data.hourly.temperature_2m[i],
            weatherCode: data.hourly.weather_code[i],
            precipitationProbability: data.hourly.precipitation_probability[i]
          }))
          .filter((_: unknown, i: number) => i >= currentHour && i <= currentHour + 8)

        setWeather({
          current: {
            temperature: Math.round(data.current.temperature_2m),
            apparentTemperature: Math.round(data.current.apparent_temperature),
            weatherCode: data.current.weather_code,
            windSpeed: Math.round(data.current.wind_speed_10m),
            humidity: data.current.relative_humidity_2m,
            isDay: data.current.is_day === 1
          },
          hourly: hourlyData,
          daily: {
            tempMax: Math.round(data.daily.temperature_2m_max[0]),
            tempMin: Math.round(data.daily.temperature_2m_min[0]),
            weatherCode: data.daily.weather_code[0],
            precipitationProbabilityMax: data.daily.precipitation_probability_max[0]
          }
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="bg-surface-1 rounded-2xl border border-border p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-surface-2 rounded-xl animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-5 w-12 bg-surface-2 rounded animate-pulse" />
            <div className="h-3 w-20 bg-surface-2 rounded animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  if (!weather) return null

  const { current, hourly, daily } = weather
  const info = getWeatherInfo(current.weatherCode)
  const WeatherIcon = info.icon

  return (
    <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
      {/* Current conditions */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <WeatherIcon className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold text-text-primary tabular-nums">{current.temperature}°</span>
                <span className="text-xs text-text-tertiary">London</span>
              </div>
              <p className="text-xs text-text-secondary">{info.label}</p>
            </div>
          </div>

          <div className="text-right space-y-1">
            <div className="flex items-center gap-1 text-[11px] text-text-tertiary justify-end">
              <Thermometer className="w-3 h-3" />
              Feels {current.apparentTemperature}°
            </div>
            <div className="flex items-center gap-1 text-[11px] text-text-tertiary justify-end">
              <Wind className="w-3 h-3" />
              {current.windSpeed} km/h
            </div>
            <div className="flex items-center gap-1 text-[11px] text-text-tertiary justify-end">
              <Droplets className="w-3 h-3" />
              {current.humidity}%
            </div>
          </div>
        </div>

        {/* Day summary */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border">
          <span className="text-xs text-text-tertiary">
            H: {daily.tempMax}° · L: {daily.tempMin}°
          </span>
          {daily.precipitationProbabilityMax > 20 && (
            <span className="flex items-center gap-1 text-xs text-blue-400">
              <Droplets className="w-3 h-3" />
              {daily.precipitationProbabilityMax}% rain
            </span>
          )}
        </div>
      </div>

      {/* Hourly forecast */}
      {hourly.length > 0 && (
        <div className="px-3 pb-3">
          <div className="flex gap-1 overflow-x-auto scrollbar-none">
            {hourly.slice(0, 6).map((h, i) => {
              const hour = new Date(h.time).getHours()
              const hourStr = hour === 0 ? '12am' : hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`
              const HourIcon = getWeatherInfo(h.weatherCode).icon
              return (
                <div key={i} className="flex flex-col items-center gap-1 px-2.5 py-2 rounded-lg min-w-[52px]">
                  <span className="text-[10px] text-text-tertiary">{hourStr}</span>
                  <HourIcon className="w-3.5 h-3.5 text-text-secondary" />
                  <span className="text-xs font-medium text-text-primary tabular-nums">{Math.round(h.temperature)}°</span>
                  {h.precipitationProbability > 20 && (
                    <span className="text-[9px] text-blue-400 tabular-nums">{h.precipitationProbability}%</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
