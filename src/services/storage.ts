export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage && typeof navigator.storage.persist === 'function') {
      if (await navigator.storage.persisted()) return true
      return await navigator.storage.persist()
    }
  } catch {
    /* ignore */
  }
  return false
}

export async function isStoragePersistent(): Promise<boolean> {
  try {
    if (navigator.storage && typeof navigator.storage.persisted === 'function') {
      return await navigator.storage.persisted()
    }
  } catch {
    /* ignore */
  }
  return false
}

export interface StorageUsage {
  usage: number
  quota: number
}

export async function storageEstimate(): Promise<StorageUsage | undefined> {
  try {
    if (navigator.storage && typeof navigator.storage.estimate === 'function') {
      const est = await navigator.storage.estimate()
      if (typeof est.usage === 'number' && typeof est.quota === 'number') {
        return { usage: est.usage, quota: est.quota }
      }
    }
  } catch {
    /* ignore */
  }
  return undefined
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** i
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}
