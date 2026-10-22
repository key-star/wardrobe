<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import Icon from '@/components/Icon.vue'
import { useToast } from '@/composables/useToast'
import { useToday } from '@/composables/useToday'
import { categoryLabel } from '@/db/constants'
import { downloadBlob } from '@/services/backup'
import {
  buildStatsCsv,
  costPerWearRows,
  idleReminderRows,
  itemDisplayName,
  longUnwornRows,
  statsSummary,
  type UnwornRow,
} from '@/services/stats'
import { useWardrobeStore } from '@/stores/wardrobe'

const { today, heading } = useToday()

const router = useRouter()
const wardrobe = useWardrobeStore()
const { items } = storeToRefs(wardrobe)
const { show } = useToast()

const showAllCost = ref(false)
const showAllUnworn = ref(false)

const summary = computed(() => statsSummary(items.value, today.value))
const costRows = computed(() => costPerWearRows(items.value))
const unwornRows = computed(() => longUnwornRows(items.value, today.value))
const reminders = computed(() => idleReminderRows(items.value, today.value))

const visibleCostRows = computed(() =>
  showAllCost.value ? costRows.value : costRows.value.slice(0, 8),
)
const visibleUnwornRows = computed(() =>
  showAllUnworn.value ? unwornRows.value : unwornRows.value.slice(0, 8),
)

function money(value: number | null | undefined): string {
  if (value == null) return '—'
  return `¥${value % 1 === 0 ? value : value.toFixed(1)}`
}

function unwornLabel(row: UnwornRow): string {
  if (row.neverWorn) {
    return row.days === 0 ? '刚入库，还没穿过' : `入库 ${row.days} 天，还没穿过`
  }
  return row.days === 0 ? '今天穿过' : `${row.days} 天没穿`
}

function reminderReason(row: UnwornRow): string {
  if (row.item.status === 'idle') return '已标记闲置'
  return row.neverWorn ? `入库 ${row.days} 天未穿` : `${row.days} 天未穿`
}

function exportCsv() {
  const csv = `\uFEFF${buildStatsCsv(items.value, today.value)}`
  downloadBlob(
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    `wardrobe-stats-${today.value}.csv`,
  )
  show('已导出统计 CSV')
}

onMounted(async () => {
  await wardrobe.load(true)
})
</script>

<template>
  <div class="page page--padded">
    <header class="topbar">
      <button class="icon-btn icon-btn--plain" aria-label="返回" @click="router.back()">
        <Icon name="back" :size="20" />
      </button>
      <div class="topbar__title">
        穿着统计
        <div class="topbar__sub">{{ heading }}</div>
      </div>
      <button
        v-if="items.length"
        class="icon-btn"
        aria-label="导出统计 CSV"
        @click="exportCsv"
      >
        <Icon name="download" :size="19" />
      </button>
    </header>

    <div v-if="!items.length" class="empty">
      <span class="empty__emoji">📊</span>
      <p>衣橱里还没有单品</p>
      <router-link to="/item/new" class="btn btn--primary">添加第一件</router-link>
    </div>

    <template v-else>
      <div class="section" style="margin-top: 16px">
        <div class="stats">
          <div class="stat">
            <span class="stat__value">{{ Math.round(summary.coverage.percent) }}%</span>
            <span class="stat__label">穿过 {{ summary.worn }}/{{ summary.total }} 件</span>
          </div>
          <div class="stat">
            <span class="stat__value">{{ money(summary.averageCostPerWear) }}</span>
            <span class="stat__label">平均每次成本</span>
          </div>
          <div class="stat">
            <span class="stat__value">{{ summary.reminderCount }}</span>
            <span class="stat__label">件需要关注</span>
          </div>
        </div>
        <p class="section__desc">
          成本按「价格 ÷ 穿着次数」计算，从未穿过按 1 次计。覆盖率统计至少有 1 次穿着记录的单品。
        </p>
      </div>

      <div v-if="reminders.length" class="section">
        <div class="section__head">
          <div class="section__title">闲置提醒</div>
          <span class="section__hint">{{ reminders.length }} 件</span>
        </div>
        <div class="card reminder">
          <router-link
            v-for="row in reminders"
            :key="row.item.id"
            :to="`/item/${row.item.id}`"
            class="reminder__row"
          >
            <span class="reminder__name">{{ itemDisplayName(row.item) }}</span>
            <span class="reminder__reason">{{ reminderReason(row) }}</span>
          </router-link>
        </div>
      </div>

      <div class="section">
        <div class="section__head">
          <div class="section__title">成本穿着比</div>
          <span class="section__hint">越靠前越不划算</span>
        </div>

        <div v-if="costRows.length" class="card list">
          <router-link
            v-for="row in visibleCostRows"
            :key="row.item.id"
            :to="`/item/${row.item.id}`"
            class="list__row"
          >
            <div class="list__body">
              <span class="list__title">{{ itemDisplayName(row.item) }}</span>
              <span class="list__meta">
                {{ categoryLabel(row.item.category) }} · ¥{{ row.item.price }} · 穿过
                {{ row.item.wearCount }} 次
              </span>
            </div>
            <span class="list__value">
              {{ money(row.cost) }}<small>/次</small>
            </span>
          </router-link>
        </div>
        <p v-else class="card hint-text">还没有填写价格的单品，补上价格后就能看到成本。</p>

        <button
          v-if="costRows.length > 8"
          class="section__more"
          @click="showAllCost = !showAllCost"
        >
          {{ showAllCost ? '收起' : `查看全部 ${costRows.length} 件` }}
        </button>
      </div>

      <div class="section">
        <div class="section__head">
          <div class="section__title">久未穿</div>
          <span class="section__hint">按时间从久到近</span>
        </div>

        <div class="card list">
          <router-link
            v-for="row in visibleUnwornRows"
            :key="row.item.id"
            :to="`/item/${row.item.id}`"
            class="list__row"
          >
            <div class="list__body">
              <span class="list__title">{{ itemDisplayName(row.item) }}</span>
              <span class="list__meta">
                {{ categoryLabel(row.item.category) }} · {{ unwornLabel(row) }}
              </span>
            </div>
            <span v-if="row.item.status === 'idle'" class="list__badge">闲置</span>
            <span v-else-if="row.days >= 90" class="list__badge list__badge--warn">
              90+ 天
            </span>
          </router-link>
        </div>

        <button
          v-if="unwornRows.length > 8"
          class="section__more"
          @click="showAllUnworn = !showAllUnworn"
        >
          {{ showAllUnworn ? '收起' : `查看全部 ${unwornRows.length} 件` }}
        </button>
      </div>

      <div class="section">
        <button class="btn btn--block" @click="exportCsv">
          <Icon name="download" :size="18" />导出统计 CSV
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.section__head .section__title {
  margin: 0;
}

.section__hint {
  font-size: 12px;
  color: var(--text-faint);
}

.section__desc {
  padding: 0 2px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-faint);
}

.section__more {
  width: 100%;
  padding: 10px 0 0;
  color: var(--accent);
  font-size: 13px;
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 10px;
}

.stat {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: center;
  text-align: center;
}

.stat__value {
  font-size: 18px;
  font-weight: 650;
  color: var(--text);
}

.stat__label {
  font-size: 11px;
  color: var(--text-faint);
}

.reminder,
.list {
  overflow: hidden;
}

.reminder__row,
.list__row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  color: inherit;
  border-bottom: 1px solid var(--border);
}

.reminder__row:last-child,
.list__row:last-child {
  border-bottom: none;
}

.reminder__row:active,
.list__row:active {
  background: var(--bg-elev-2);
}

.reminder__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}

.reminder__reason {
  flex: none;
  color: var(--warn);
  font-size: 12px;
}

.list__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.list__title {
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list__meta {
  font-size: 12px;
  color: var(--text-faint);
}

.list__value {
  flex: none;
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
}

.list__value small {
  color: var(--text-faint);
  font-size: 11px;
  font-weight: 400;
}

.list__badge {
  flex: none;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--bg-elev-2);
  border: 1px solid var(--border);
  color: var(--text-faint);
  font-size: 11px;
}

.list__badge--warn {
  color: var(--warn);
  border-color: color-mix(in srgb, var(--warn) 40%, transparent);
}

.hint-text {
  padding: 16px;
  color: var(--text-faint);
  font-size: 13px;
  line-height: 1.6;
}

@media (min-width: 640px) {
  .section {
    max-width: 560px;
    width: 100%;
    margin-left: auto;
    margin-right: auto;
  }
}
</style>
