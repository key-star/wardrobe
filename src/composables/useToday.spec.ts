import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useToday } from './useToday'

const Host = defineComponent({
  setup() {
    return useToday()
  },
  template: '<div><span data-today>{{ today }}</span><span data-heading>{{ heading }}</span></div>',
})

describe('useToday', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('refreshes the date and heading after midnight', async () => {
    vi.setSystemTime(new Date(2026, 9, 22, 23, 59, 59, 500))
    const wrapper = mount(Host)
    expect(wrapper.get('[data-today]').text()).toBe('2026-10-22')
    expect(wrapper.get('[data-heading]').text()).toContain('10月22日')

    await vi.advanceTimersByTimeAsync(2000)
    await nextTick()

    expect(wrapper.get('[data-today]').text()).toBe('2026-10-23')
    expect(wrapper.get('[data-heading]').text()).toContain('10月23日')
    wrapper.unmount()
  })

  it('refreshes when the window regains focus', async () => {
    vi.setSystemTime(new Date(2026, 9, 22, 23, 59, 0))
    const wrapper = mount(Host)

    vi.setSystemTime(new Date(2026, 9, 23, 9, 0, 0))
    window.dispatchEvent(new Event('focus'))
    await nextTick()

    expect(wrapper.get('[data-today]').text()).toBe('2026-10-23')
    expect(wrapper.get('[data-heading]').text()).toContain('10月23日')
    wrapper.unmount()
  })
})
