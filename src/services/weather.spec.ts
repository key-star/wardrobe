import { describe, expect, it } from 'vitest'
import { describeWeather } from '@/services/weather'

describe('weather', () => {
  it('maps WMO codes to labels and emoji', () => {
    expect(describeWeather(0)).toMatchObject({ label: '晴', emoji: '☀️' })
    expect(describeWeather(2).label).toBe('多云')
    expect(describeWeather(3).emoji).toBe('☁️')
    expect(describeWeather(45).label).toBe('雾')
    expect(describeWeather(61).label).toBe('小雨')
    expect(describeWeather(75).label).toBe('大雪')
    expect(describeWeather(95).label).toBe('雷阵雨')
  })

  it('falls back for unknown codes', () => {
    expect(describeWeather(123).label).toBe('天气未知')
  })
})
