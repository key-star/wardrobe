import { describe, expect, it } from 'vitest'
import { askConfirm, settleConfirm, useConfirm } from './useConfirm'

describe('useConfirm', () => {
  it('opens a confirm request and resolves the chosen value', async () => {
    const { current } = useConfirm()
    const result = askConfirm({ title: '删除单品', message: '确认删除？', danger: true })
    expect(current.value?.title).toBe('删除单品')
    expect(current.value?.confirmText).toBe('确定')

    settleConfirm(true)
    await expect(result).resolves.toBe(true)
    expect(current.value).toBeNull()
  })

  it('resolves a pending request as cancelled when replaced', async () => {
    const first = askConfirm({ title: '第一个' })
    const second = askConfirm({ title: '第二个', confirmText: '继续' })

    await expect(first).resolves.toBe(false)
    expect(useConfirm().current.value?.title).toBe('第二个')
    settleConfirm(false)
    await expect(second).resolves.toBe(false)
  })
})
