<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import Icon from '@/components/Icon.vue'
import { useToast } from '@/composables/useToast'
import { getSetting, setSetting } from '@/db/repo'
import {
  backupFileName,
  buildBackup,
  downloadBlob,
  importBackup,
  type ImportMode,
} from '@/services/backup'
import {
  formatBytes,
  isStoragePersistent,
  requestPersistentStorage,
  storageEstimate,
} from '@/services/storage'
import { useCutoutStore } from '@/stores/cutout'
import { useWardrobeStore } from '@/stores/wardrobe'

const store = useWardrobeStore()
const { total, categoryStats, totalValue, wearCountTotal, items } = storeToRefs(store)
const cutout = useCutoutStore()
const { running: cutoutRunning, total: cutoutTotal, done: cutoutDone, failed: cutoutFailed, percent: cutoutPercent } =
  storeToRefs(cutout)
const { show } = useToast()

const photoCount = computed(() => items.value.filter((item) => item.hasOriginal).length)
const cutoutCount = computed(() => items.value.filter((item) => item.hasCutout).length)

const fileInput = ref<HTMLInputElement | null>(null)
const busy = ref(false)
const lastBackupAt = ref<string | null>(null)
const persistent = ref(false)
const usage = ref<{ usage: number; quota: number } | null>(null)
const importMode = ref<ImportMode>('merge')

const backupAgeDays = computed(() => {
  if (!lastBackupAt.value) return null
  const diff = Date.now() - new Date(lastBackupAt.value).getTime()
  return Math.floor(diff / 86_400_000)
})

const backupHint = computed(() => {
  if (!lastBackupAt.value) return '还没有备份过，建议先导出一次'
  const days = backupAgeDays.value ?? 0
  if (days <= 0) return '今天已备份'
  if (days >= 7) return `已 ${days} 天没有备份，建议尽快导出`
  return `${days} 天前备份`
})

const usagePercent = computed(() => {
  if (!usage.value || !usage.value.quota) return 0
  return Math.min(100, (usage.value.usage / usage.value.quota) * 100)
})

async function refresh() {
  persistent.value = await isStoragePersistent()
  usage.value = (await storageEstimate()) ?? null
  lastBackupAt.value = (await getSetting<string>('lastBackupAt')) ?? null
}

onMounted(async () => {
  await store.load()
  await refresh()
})

async function enablePersistent() {
  const ok = await requestPersistentStorage()
  persistent.value = ok
  show(ok ? '已开启持久化存储' : '浏览器未授予，建议定期导出备份')
}

async function doExport() {
  busy.value = true
  try {
    const blob = await buildBackup()
    downloadBlob(blob, backupFileName())
    const now = new Date().toISOString()
    await setSetting('lastBackupAt', now)
    lastBackupAt.value = now
    show(`已导出 ${formatBytes(blob.size)}`)
    await refresh()
  } catch {
    show('导出失败，请重试')
  } finally {
    busy.value = false
  }
}

function regenerateCutouts() {
  const ids = items.value.filter((item) => item.hasOriginal).map((item) => item.id)
  if (!ids.length) {
    show('还没有可处理的照片')
    return
  }
  if (!window.confirm(`将重新抠图 ${ids.length} 件，期间可继续使用，继续？`)) return
  cutout.enqueue(ids, true)
  show('已加入抠图队列')
}

function pickFile() {
  fileInput.value?.click()
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  const modeText = importMode.value === 'replace' ? '覆盖现有数据' : '与现有数据合并'
  if (!window.confirm(`将「${file.name}」导入（${modeText}），继续？`)) return

  busy.value = true
  try {
    const result = await importBackup(file, importMode.value)
    await store.load(true)
    await refresh()
    show(
      `导入完成：${result.items} 件单品${result.outfits ? `、${result.outfits} 套搭配` : ''}`,
    )
  } catch (error) {
    show(error instanceof Error ? error.message : '导入失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="page page--padded">
    <header class="topbar">
      <div class="topbar__title">设置</div>
    </header>

    <div class="section" style="margin-top: 16px">
      <div class="section__title">衣橱概览</div>
      <div class="stats">
        <div class="stat">
          <span class="stat__value">{{ total }}</span>
          <span class="stat__label">件单品</span>
        </div>
        <div class="stat">
          <span class="stat__value">{{ wearCountTotal }}</span>
          <span class="stat__label">累计穿着次数</span>
        </div>
        <div class="stat">
          <span class="stat__value">¥{{ totalValue }}</span>
          <span class="stat__label">衣橱总价值</span>
        </div>
      </div>

      <div class="breakdown">
        <div v-for="row in categoryStats" :key="row.id" class="breakdown__row">
          <span>{{ row.emoji }} {{ row.label }}</span>
          <span class="breakdown__count">{{ row.count }}</span>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section__title">备份与迁移</div>
      <div class="card block">
        <p class="block__hint">{{ backupHint }}</p>
        <p class="block__desc">
          数据只存在这台设备。换手机、双机共用或防止误删，都靠这个备份文件。
        </p>
        <button class="btn btn--primary btn--block" :disabled="busy" @click="doExport">
          <Icon name="download" :size="19" />导出备份
        </button>

        <div class="divider" />

        <div class="field" style="margin-bottom: 10px">
          <span class="field__label">导入方式</span>
          <div class="chips">
            <button
              class="chip"
              :class="{ 'chip--on': importMode === 'merge' }"
              @click="importMode = 'merge'"
            >
              合并（保留现有）
            </button>
            <button
              class="chip"
              :class="{ 'chip--on': importMode === 'replace' }"
              @click="importMode = 'replace'"
            >
              覆盖（清空后导入）
            </button>
          </div>
        </div>
        <button class="btn btn--block" :disabled="busy" @click="pickFile">
          <Icon name="upload" :size="19" />选择备份文件导入
        </button>
        <input
          ref="fileInput"
          class="hidden-input"
          type="file"
          accept=".wardrobe,.zip,application/zip"
          @change="onFile"
        />
      </div>
    </div>

    <div class="section">
      <div class="section__title">本地存储</div>
      <div class="card block">
        <div v-if="usage" class="usage">
          <div class="usage__head">
            <span>已用 {{ formatBytes(usage.usage) }}</span>
            <span class="usage__quota">可用配额 {{ formatBytes(usage.quota) }}</span>
          </div>
          <div class="usage__bar">
            <div class="usage__fill" :style="{ width: `${usagePercent}%` }" />
          </div>
        </div>

        <div class="storage-state">
          <Icon :name="persistent ? 'check' : 'alert'" :size="18" />
          <span>{{ persistent ? '已开启持久化存储' : '未开启持久化，系统可能清理数据' }}</span>
        </div>

        <button v-if="!persistent" class="btn btn--block" @click="enablePersistent">
          申请持久化存储
        </button>
      </div>
    </div>

    <div class="section">
      <div class="section__title">照片与抠图</div>
      <div class="card block">
        <p class="block__desc">
          已抠图 {{ cutoutCount }} / {{ photoCount }} 件。抠图在本机完成，首次使用需下载模型（约 80MB），
          之后可离线使用。抠图失败不影响单品正常使用。
        </p>

        <div v-if="cutoutRunning || cutoutTotal > 0" class="cutout-progress">
          <div class="cutout-progress__head">
            <span>{{ cutoutRunning ? `正在处理 ${cutoutDone}/${cutoutTotal}` : `上次完成 ${cutoutDone} 张` }}</span>
            <span v-if="cutoutFailed" class="cutout-progress__fail">失败 {{ cutoutFailed }}</span>
          </div>
          <div class="usage__bar">
            <div class="usage__fill" :style="{ width: `${cutoutPercent}%` }" />
          </div>
        </div>

        <button class="btn btn--block" :disabled="cutoutRunning || !photoCount" @click="regenerateCutouts">
          <Icon name="sparkle" :size="19" />
          {{ cutoutRunning ? '抠图中…' : '重新抠图全部' }}
        </button>
      </div>
    </div>

    <div class="section">
      <div class="section__title">安装到手机主屏幕</div>
      <div class="card block">
        <p class="block__desc">
          iPhone：Safari → 分享 → 添加到主屏幕。<br />
          Android：Chrome → 菜单 → 安装应用。<br />
          从主屏图标打开可获得独立窗口和更稳定的本地存储。
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 12px;
}

.stat {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: center;
  text-align: center;
}

.stat__value {
  font-size: 19px;
  font-weight: 650;
  color: var(--text);
}

.stat__label {
  font-size: 11px;
  color: var(--text-faint);
}

.breakdown {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.breakdown__row {
  display: flex;
  justify-content: space-between;
  padding: 11px 14px;
  font-size: 14px;
  color: var(--text-dim);
  border-bottom: 1px solid var(--border);
}

.breakdown__row:last-child {
  border-bottom: none;
}

.breakdown__count {
  color: var(--text);
  font-weight: 600;
}

.block {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.block__hint {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.block__desc {
  font-size: 13px;
  color: var(--text-faint);
  line-height: 1.55;
}

.divider {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}

.hidden-input {
  display: none;
}

.usage__head {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-dim);
  margin-bottom: 8px;
}

.usage__quota {
  color: var(--text-faint);
}

.usage__bar {
  height: 7px;
  border-radius: 4px;
  background: var(--bg-input);
  overflow: hidden;
}

.usage__fill {
  height: 100%;
  border-radius: 4px;
  background: var(--accent-strong);
}

.cutout-progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cutout-progress__head {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-dim);
}

.cutout-progress__fail {
  color: var(--warn, #e6b566);
}

.storage-state {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-dim);
}
</style>
