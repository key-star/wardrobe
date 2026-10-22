<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import Icon from '@/components/Icon.vue'
import RecommendCard from '@/components/RecommendCard.vue'
import TodayPick from '@/components/TodayPick.vue'
import { useToast } from '@/composables/useToast'
import { SEASONS, STYLES, categoryLabel } from '@/db/constants'
import { getSetting, listWearLogs, newId, recordOutfitWear, setSetting } from '@/db/repo'
import type { WearLog } from '@/db/types'
import { renderOutfitCover, type CollagePiece } from '@/services/collage'
import {
  RECOMMEND_SLOTS,
  buildWearHistory,
  compareScored,
  recommendCombinations,
  scoreOutfit,
  type Recommendation,
} from '@/services/recommend'
import {
  dayLabel,
  isOutfitEligible,
  localDateKey,
  seasonsForTemperature,
  todayHeading,
  warmthHint,
  warmthRange,
} from '@/services/today'
import {
  currentPosition,
  fetchWeather,
  searchPlaces,
  type WeatherLocation,
  type WeatherPlace,
  type WeatherSnapshot,
} from '@/services/weather'
import { createEmptyOutfit, layerFor, useOutfitsStore } from '@/stores/outfits'
import { useWardrobeStore } from '@/stores/wardrobe'

const OCCASIONS = STYLES.filter((style) => style.id !== 'home')
const TODAY = localDateKey()
const heading = todayHeading()

const wardrobe = useWardrobeStore()
const outfitsStore = useOutfitsStore()
const { show } = useToast()
const { items } = storeToRefs(wardrobe)
const { outfits, pieces } = storeToRefs(outfitsStore)

const occasion = ref('')
const logs = ref<WearLog[]>([])
const pickedId = ref<string | null>(null)
const recordingId = ref<string | null>(null)
const lastRecordedId = ref<string | null>(null)
const showAllLogs = ref(false)
const savingRecommendation = ref<string | null>(null)
const savedRecommendations = ref<string[]>([])

const location = ref<WeatherLocation | null>(null)
const weather = ref<WeatherSnapshot | null>(null)
const weatherStale = ref(false)
const weatherLoading = ref(false)
const weatherError = ref('')
const setupOpen = ref(false)
const placeQuery = ref('')
const places = ref<WeatherPlace[]>([])
const placeSearching = ref(false)
const placeError = ref('')
const locating = ref(false)
const manualOpen = ref(false)
const manualName = ref('')
const manualLat = ref('')
const manualLon = ref('')

let weatherController: AbortController | null = null
let searchController: AbortController | null = null

const itemMap = computed(() => new Map(items.value.map((item) => [item.id, item])))
const weatherSeasons = computed(() => seasonsForTemperature(weather.value?.temperature))
const wearHistory = computed(() => buildWearHistory(logs.value))
const targetWarmth = computed(() => {
  if (!weather.value) return 3
  const [min, max] = warmthRange(weather.value.temperature)
  return (min + max) / 2
})

function outfitPieces(outfitId: string) {
  return pieces.value
    .filter((piece) => piece.outfitId === outfitId)
    .sort((a, b) => a.layer - b.layer || a.id.localeCompare(b.id))
}
const seasonText = computed(() =>
  weatherSeasons.value
    .map((id) => SEASONS.find((season) => season.id === id)?.label)
    .filter(Boolean)
    .join(' / '),
)
const warmthText = computed(() => {
  if (!weather.value) return ''
  const [min, max] = warmthRange(weather.value.temperature)
  return `建议保暖 ${min}–${max} 级 · ${warmthHint(weather.value.temperature)}`
})
const locationText = computed(() =>
  location.value
    ? [location.value.name, location.value.detail].filter(Boolean).join(' · ')
    : '',
)
const weatherUpdated = computed(() => {
  if (!weather.value) return ''
  const date = new Date(weather.value.fetchedAt)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(date.getHours())}:${p(date.getMinutes())}`
})
const occasionLabel = computed(
  () => OCCASIONS.find((style) => style.id === occasion.value)?.label,
)

const eligible = computed(() =>
  outfits.value.filter((outfit) =>
    isOutfitEligible(
      outfit,
      outfitPieces(outfit.id),
      itemMap.value,
      weatherSeasons.value,
      occasion.value || undefined,
    ),
  ),
)
const scoredEligible = computed(() =>
  eligible.value
    .map((outfit) =>
      scoreOutfit(outfit, outfitPieces(outfit.id), itemMap.value, {
        today: TODAY,
        targetWarmth: targetWarmth.value,
        history: wearHistory.value,
      }),
    )
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort(
      (a, b) =>
        compareScored(a, b) ||
        Number(b.outfit.favorite) - Number(a.outfit.favorite) ||
        (b.outfit.rating ?? 0) - (a.outfit.rating ?? 0) ||
        b.outfit.updatedAt.localeCompare(a.outfit.updatedAt),
    ),
)
const candidates = computed(() => scoredEligible.value.slice(0, 3))
const recommendations = computed(() =>
  recommendCombinations(items.value, logs.value, {
    today: TODAY,
    seasons: weatherSeasons.value,
    occasion: occasion.value || undefined,
    targetWarmth: targetWarmth.value,
    sampleSize: 200,
    limit: 3,
  }),
)
const missingRecommendationSlots = computed(() =>
  RECOMMEND_SLOTS.filter(
    (slot) => !items.value.some((item) => item.category === slot),
  ).map((slot) => categoryLabel(slot)),
)
const recommendationHint = computed(() => {
  if (recommendations.value.length) return ''
  if (missingRecommendationSlots.value.length) {
    return `衣橱里还需要${missingRecommendationSlots.value.join('、')}，才能自动组合推荐。`
  }
  return '没有同时满足「干净 · 在役 · 当季」的上装、下装和鞋，先整理一下衣橱吧。'
})
const wornTodayIds = computed(
  () =>
    new Set(
      logs.value
        .filter((log) => log.date === TODAY && log.outfitId)
        .map((log) => log.outfitId as string),
    ),
)
const todayLogs = computed(() => logs.value.filter((log) => log.date === TODAY))
const pastLogs = computed(() => logs.value.filter((log) => log.date !== TODAY))
const visibleLogs = computed(() =>
  showAllLogs.value ? pastLogs.value : pastLogs.value.slice(0, 6),
)

function titleOf(outfitId: string): string {
  const found = outfitsStore.byId(outfitId)
  return found?.name?.trim() || '未命名搭配'
}

function previewPieces(outfitId: string): CollagePiece[] {
  return outfitPieces(outfitId)
    .map((piece) => {
      const item = itemMap.value.get(piece.itemId)
      return item ? { item, slot: piece.slot, layer: piece.layer } : null
    })
    .filter((piece): piece is CollagePiece => piece !== null)
}

function logTitle(log: WearLog): string {
  if (!log.outfitId) return `${log.itemIds.length} 件单品`
  const found = outfitsStore.byId(log.outfitId)
  return found ? found.name?.trim() || '未命名搭配' : '已删除搭配'
}

function logMeta(log: WearLog): string {
  const parts = [`${log.itemIds.length} 件`]
  const style = STYLES.find((entry) => entry.id === log.occasion)
  if (style) parts.push(style.label)
  if (log.weather) parts.push(log.weather)
  return parts.join(' · ')
}

function logLink(log: WearLog): string | null {
  if (!log.outfitId || !outfitsStore.byId(log.outfitId)) return null
  return `/outfits/${log.outfitId}`
}

function setOccasion(id: string) {
  occasion.value = id
  pickedId.value = null
}

function pickRandom() {
  if (!candidates.value.length) return
  const pick = candidates.value[Math.floor(Math.random() * candidates.value.length)]
  pickedId.value = pick.outfit.id
  show(`试试「${titleOf(pick.outfit.id)}」`)
}

async function wearOutfit(outfitId: string) {
  if (recordingId.value) return
  const outfitPiecesForRecord = outfitPieces(outfitId)
  if (!outfitPiecesForRecord.length) {
    show('这套搭配还没有单品')
    return
  }
  recordingId.value = outfitId
  try {
    const result = await recordOutfitWear({
      date: TODAY,
      outfitId,
      itemIds: outfitPiecesForRecord.map((piece) => piece.itemId),
      occasion: occasion.value || outfitsStore.byId(outfitId)?.occasions[0],
      weather: weather.value
        ? `${weather.value.temperature}° ${weather.value.label}`
        : undefined,
    })
    logs.value = await listWearLogs()
    await wardrobe.load(true)
    lastRecordedId.value = result.log.id
    pickedId.value = null
    show(result.created ? `已记录今天穿了「${titleOf(outfitId)}」` : '今天已经记录过这套')
  } catch {
    show('记录失败，请重试')
  } finally {
    recordingId.value = null
  }
}

function recommendationKey(recommendation: Recommendation): string {
  return recommendation.items.map((item) => item.id).join('|')
}

function recommendationPieces(recommendation: Recommendation): CollagePiece[] {
  return recommendation.items.map((item) => ({
    item,
    slot: item.category,
    layer: layerFor(item.category),
  }))
}

async function saveRecommendation(recommendation: Recommendation) {
  const key = recommendationKey(recommendation)
  if (savingRecommendation.value || savedRecommendations.value.includes(key)) return
  savingRecommendation.value = key
  try {
    const outfit = createEmptyOutfit()
    outfit.name = `推荐 · ${heading}`
    outfit.seasons = [...weatherSeasons.value]
    outfit.occasions = occasion.value ? [occasion.value] : []
    outfit.notes = `规则评分 ${Math.round(recommendation.score)}`
    const pieces = recommendation.items.map((item) => ({
      id: newId(),
      outfitId: outfit.id,
      itemId: item.id,
      slot: item.category,
      layer: layerFor(item.category),
    }))
    await outfitsStore.saveOutfit({ outfit, items: pieces })
    const cover = await renderOutfitCover(recommendationPieces(recommendation)).catch(
      () => null,
    )
    if (cover) await outfitsStore.setCover(outfit.id, cover)
    savedRecommendations.value = [...savedRecommendations.value, key]
    show('已保存为搭配')
  } catch {
    show('保存失败，请重试')
  } finally {
    savingRecommendation.value = null
  }
}

function sameLocation(a: WeatherLocation, b: WeatherSnapshot): boolean {
  return a.latitude === b.latitude && a.longitude === b.longitude
}

async function refreshWeather() {
  const current = location.value
  if (!current) return
  weatherController?.abort()
  const controller = new AbortController()
  weatherController = controller
  weatherLoading.value = true
  weatherError.value = ''
  try {
    const snapshot = await fetchWeather(current, controller.signal)
    if (controller.signal.aborted) return
    weather.value = snapshot
    weatherStale.value = false
    await setSetting('weatherCache', snapshot)
  } catch {
    if (controller.signal.aborted) return
    weatherStale.value = Boolean(weather.value)
    weatherError.value = weather.value
      ? '天气更新失败，显示上次数据'
      : '天气获取失败，请稍后重试'
  } finally {
    if (weatherController === controller) weatherLoading.value = false
  }
}

async function applyLocation(next: WeatherLocation) {
  location.value = next
  weather.value = null
  weatherStale.value = false
  weatherError.value = ''
  pickedId.value = null
  await setSetting('weatherLocation', next)
  setupOpen.value = false
  await refreshWeather()
}

function openSetup() {
  setupOpen.value = true
  places.value = []
  placeError.value = ''
  manualOpen.value = false
}

async function searchCity() {
  const keyword = placeQuery.value.trim()
  if (!keyword) return
  searchController?.abort()
  const controller = new AbortController()
  searchController = controller
  placeSearching.value = true
  placeError.value = ''
  try {
    const results = await searchPlaces(keyword, controller.signal)
    if (controller.signal.aborted) return
    places.value = results
    if (!results.length) placeError.value = '没有找到这个城市，试试更完整的名称'
  } catch {
    if (!controller.signal.aborted) placeError.value = '搜索失败，请检查网络'
  } finally {
    if (searchController === controller) placeSearching.value = false
  }
}

async function choosePlace(place: WeatherPlace) {
  await applyLocation({
    name: place.name,
    detail: place.detail,
    latitude: place.latitude,
    longitude: place.longitude,
  })
}

async function useCurrentLocation() {
  locating.value = true
  try {
    const coords = await currentPosition()
    await applyLocation({ name: '当前位置', ...coords })
  } catch (error) {
    show(error instanceof Error ? error.message : '定位失败')
  } finally {
    locating.value = false
  }
}

async function submitManual() {
  const latitude = Number(manualLat.value)
  const longitude = Number(manualLon.value)
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    show('请输入有效的纬度（-90~90）和经度（-180~180）')
    return
  }
  await applyLocation({
    name: manualName.value.trim() || '自定义位置',
    latitude,
    longitude,
  })
}

onMounted(async () => {
  await Promise.all([wardrobe.load(true), outfitsStore.load(true)])
  logs.value = await listWearLogs()
  location.value = (await getSetting<WeatherLocation>('weatherLocation')) ?? null
  const cached = await getSetting<WeatherSnapshot>('weatherCache')
  if (location.value && cached && sameLocation(location.value, cached)) {
    weather.value = cached
    weatherStale.value = true
  }
  if (location.value) await refreshWeather()
})

onBeforeUnmount(() => {
  weatherController?.abort()
  searchController?.abort()
})
</script>

<template>
  <div class="page page--padded">
    <header class="topbar">
      <div class="topbar__title">
        今天
        <div class="topbar__sub">{{ heading }}</div>
      </div>
      <button class="icon-btn" aria-label="设置天气位置" @click="openSetup">
        <Icon name="pin" :size="19" />
      </button>
    </header>

    <div class="section" style="margin-top: 16px">
      <div v-if="location" class="card weather">
        <div class="weather__top">
          <span class="weather__emoji">{{ weather?.emoji ?? '🌡️' }}</span>
          <div class="weather__now">
            <span class="weather__temp">{{ weather ? `${weather.temperature}°` : '--' }}</span>
            <span class="weather__label">
              {{ weatherLoading && !weather ? '天气获取中' : weather?.label ?? '暂无天气' }}
            </span>
          </div>
          <button
            class="icon-btn icon-btn--plain"
            aria-label="刷新天气"
            :disabled="weatherLoading"
            @click="refreshWeather"
          >
            <Icon name="refresh" :size="19" :class="{ spin: weatherLoading }" />
          </button>
        </div>

        <div class="weather__meta">
          <button class="weather__place" @click="openSetup">
            <Icon name="pin" :size="14" />{{ locationText }}
          </button>
          <span v-if="weather" class="weather__time">{{ weatherUpdated }} 更新</span>
        </div>

        <div class="weather__tips">
          <span>{{ seasonText }}</span>
          <span>{{ warmthText }}</span>
        </div>

        <p v-if="weatherStale || weatherError" class="weather__note">
          {{ weatherError || '天气为上次数据，联网后自动更新' }}
        </p>
      </div>

      <div v-else class="card weather weather--empty">
        <span class="weather__emoji">🌤️</span>
        <div class="weather__prompt">
          <p class="weather__prompt-title">按天气挑今天穿什么</p>
          <p class="weather__prompt-desc">设置城市后可按温度和季节筛选干净、在役的搭配。</p>
        </div>
        <button class="btn btn--primary" @click="openSetup">设置城市</button>
      </div>
    </div>

    <div v-if="todayLogs.length" class="section">
      <div class="section__head">
        <div class="section__title">今日记录</div>
      </div>
      <div class="records">
        <div
          v-for="log in todayLogs"
          :key="log.id"
          class="record"
          :class="{ 'record--fresh': log.id === lastRecordedId }"
        >
          <div class="record__body">
            <span class="record__title">{{ logTitle(log) }}</span>
            <span class="record__meta">{{ logMeta(log) }}</span>
          </div>
          <router-link v-if="logLink(log)" :to="logLink(log)!" class="record__link">
            查看
          </router-link>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section__head">
        <div class="section__title">今天什么场合</div>
        <button v-if="occasion" class="section__action" @click="setOccasion('')">清除</button>
      </div>
      <div class="chips chips--scroll">
        <button class="chip" :class="{ 'chip--on': !occasion }" @click="setOccasion('')">
          不限
        </button>
        <button
          v-for="style in OCCASIONS"
          :key="style.id"
          class="chip"
          :class="{ 'chip--on': occasion === style.id }"
          @click="setOccasion(style.id)"
        >
          {{ style.label }}
        </button>
      </div>
    </div>

    <div class="section">
      <div class="section__head">
        <div class="section__title">今天穿什么</div>
        <span v-if="eligible.length" class="section__hint">{{ eligible.length }} 套可选</span>
      </div>

      <div v-if="candidates.length" class="candidates">
        <TodayPick
          v-for="row in candidates"
          :key="row.outfit.id"
          :outfit="row.outfit"
          :pieces="previewPieces(row.outfit.id)"
          :count="outfitsStore.countFor(row.outfit.id)"
          :worn="wornTodayIds.has(row.outfit.id)"
          :picked="pickedId === row.outfit.id"
          :score="row.score"
          @wear="wearOutfit(row.outfit.id)"
        />

        <button v-if="candidates.length > 1" class="btn btn--block random" @click="pickRandom">
          <Icon name="sparkle" :size="17" />随便穿一套
        </button>
      </div>

      <div v-else-if="!outfits.length" class="card hint-card">
        <span class="hint-card__emoji">🎨</span>
        <p class="hint-card__title">还没有搭配</p>
        <p class="hint-card__desc">先把常穿的单品拼成套装，今天页就能直接挑。</p>
        <router-link to="/outfits/new" class="btn btn--primary">
          <Icon name="plus" :size="18" />新建搭配
        </router-link>
      </div>

      <div v-else class="card hint-card">
        <span class="hint-card__emoji">🧺</span>
        <p class="hint-card__title">没有符合条件的套装</p>
        <p class="hint-card__desc">
          当前按「{{ seasonText }}<template v-if="occasionLabel"> · {{ occasionLabel }}</template>」筛选，
          需要套装内单品都干净、在役，季节也要匹配。
        </p>
        <button v-if="occasion" class="btn" @click="setOccasion('')">看看其他场合</button>
        <router-link v-else to="/outfits" class="btn">去整理搭配</router-link>
      </div>
    </div>

    <div class="section">
      <div class="section__head">
        <div class="section__title">规则推荐</div>
        <span class="section__hint">色彩 · 正式度 · 温度 · 新鲜度</span>
      </div>

      <div v-if="recommendations.length" class="candidates">
        <RecommendCard
          v-for="recommendation in recommendations"
          :key="recommendationKey(recommendation)"
          :recommendation="recommendation"
          :saving="savingRecommendation === recommendationKey(recommendation)"
          :saved="savedRecommendations.includes(recommendationKey(recommendation))"
          @save="saveRecommendation(recommendation)"
        />
      </div>
      <p v-else class="card hint-text">{{ recommendationHint }}</p>
    </div>

    <div v-if="pastLogs.length" class="section">
      <div class="section__head">
        <div class="section__title">最近穿过</div>
        <button
          v-if="pastLogs.length > 6"
          class="section__action"
          @click="showAllLogs = !showAllLogs"
        >
          {{ showAllLogs ? '收起' : '查看全部' }}
        </button>
      </div>
      <div class="records">
        <div v-for="log in visibleLogs" :key="log.id" class="record">
          <div class="record__day">{{ dayLabel(log.date, TODAY) }}</div>
          <div class="record__body">
            <span class="record__title">{{ logTitle(log) }}</span>
            <span class="record__meta">{{ logMeta(log) }}</span>
          </div>
          <router-link v-if="logLink(log)" :to="logLink(log)!" class="record__link">
            查看
          </router-link>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="sheet">
        <div v-if="setupOpen" class="sheet" @click.self="setupOpen = false">
          <div class="sheet__panel">
            <header class="sheet__head">
              <div class="sheet__title">设置天气位置</div>
              <button class="icon-btn icon-btn--plain" aria-label="关闭" @click="setupOpen = false">
                <Icon name="close" :size="20" />
              </button>
            </header>

            <div class="sheet__body">
              <p class="sheet__hint">
                位置只保存在本机，用于按当地天气筛选套装。天气数据来自 Open-Meteo，无需注册。
              </p>

              <div class="search-row">
                <input
                  v-model="placeQuery"
                  class="input"
                  placeholder="搜索城市，如 杭州"
                  @keyup.enter="searchCity"
                />
                <button class="btn" :disabled="placeSearching" @click="searchCity">
                  {{ placeSearching ? '搜索中' : '搜索' }}
                </button>
              </div>

              <div v-if="places.length" class="places">
                <button
                  v-for="place in places"
                  :key="place.id ?? `${place.name}-${place.latitude}`"
                  class="place"
                  @click="choosePlace(place)"
                >
                  <span class="place__name">{{ place.name }}</span>
                  <span class="place__detail">{{ place.detail }}</span>
                </button>
              </div>
              <p v-if="placeError" class="search-error">{{ placeError }}</p>

              <button class="btn btn--block" :disabled="locating" @click="useCurrentLocation">
                <Icon name="pin" :size="18" />{{ locating ? '定位中' : '使用当前位置' }}
              </button>

              <button class="link-btn" @click="manualOpen = !manualOpen">
                {{ manualOpen ? '收起手动输入' : '手动输入经纬度' }}
              </button>

              <div v-if="manualOpen" class="manual">
                <input v-model="manualName" class="input" placeholder="位置名称（可选）" />
                <div class="row">
                  <input v-model="manualLat" class="input" inputmode="decimal" placeholder="纬度" />
                  <input v-model="manualLon" class="input" inputmode="decimal" placeholder="经度" />
                </div>
                <button class="btn" @click="submitManual">使用这组坐标</button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
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

.section__action {
  color: var(--accent);
  font-size: 13px;
}

.weather {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background:
    radial-gradient(circle at 12% 0%, rgba(124, 143, 255, 0.18), transparent 58%),
    var(--bg-elev);
}

.weather__top {
  display: flex;
  align-items: center;
  gap: 12px;
}

.weather__emoji {
  font-size: 38px;
  line-height: 1;
}

.weather__now {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.weather__temp {
  font-size: 30px;
  font-weight: 700;
  line-height: 1.1;
}

.weather__label {
  font-size: 13px;
  color: var(--text-dim);
}

.weather__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  color: var(--text-faint);
}

.weather__place {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  color: var(--text-dim);
  font-size: 12.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weather__time {
  flex: none;
}

.weather__tips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.weather__tips span {
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--bg-elev-2);
  border: 1px solid var(--border);
  color: var(--text-dim);
  font-size: 12px;
}

.weather__note {
  font-size: 12px;
  color: var(--warn);
}

.weather--empty {
  flex-direction: row;
  align-items: center;
  gap: 12px;
  background: var(--bg-elev);
}

.weather__prompt {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.weather__prompt-title {
  font-size: 14.5px;
  font-weight: 600;
}

.weather__prompt-desc {
  font-size: 12px;
  color: var(--text-faint);
  line-height: 1.5;
}

.records {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.record {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  border-bottom: 1px solid var(--border);
}

.record:last-child {
  border-bottom: none;
}

.record--fresh {
  box-shadow: inset 3px 0 0 var(--accent-strong);
  background: color-mix(in srgb, var(--accent-soft) 40%, var(--bg-elev));
}

.record__day {
  flex: none;
  width: 52px;
  font-size: 12px;
  color: var(--text-faint);
}

.record__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.record__title {
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record__meta {
  font-size: 12px;
  color: var(--text-faint);
}

.record__link {
  flex: none;
  font-size: 12px;
  color: var(--accent);
}

.candidates {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.random {
  min-height: 42px;
  font-size: 14px;
}

.hint-text {
  padding: 16px;
  color: var(--text-faint);
  font-size: 13px;
  line-height: 1.6;
}

.hint-card {
  padding: 24px 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.hint-card__emoji {
  font-size: 34px;
}

.hint-card__title {
  font-size: 15px;
  font-weight: 600;
}

.hint-card__desc {
  font-size: 12.5px;
  color: var(--text-faint);
  line-height: 1.6;
}

.hint-card .btn {
  margin-top: 4px;
}

.sheet {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(6, 7, 10, 0.6);
  display: flex;
  align-items: flex-end;
}

.sheet__panel {
  width: 100%;
  max-height: 84svh;
  display: flex;
  flex-direction: column;
  background: var(--bg-elev);
  border-top-left-radius: 22px;
  border-top-right-radius: 22px;
  border-top: 1px solid var(--border);
  padding-bottom: calc(var(--safe-bottom) + 8px);
  animation: sheet-in 0.2s ease;
}

@keyframes sheet-in {
  from {
    transform: translateY(18px);
    opacity: 0;
  }
}

.sheet__head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px 8px;
}

.sheet__title {
  flex: 1;
  font-size: 17px;
  font-weight: 650;
}

.sheet__body {
  padding: 0 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}

.sheet__hint {
  font-size: 12.5px;
  color: var(--text-faint);
  line-height: 1.6;
}

.search-row {
  display: flex;
  gap: 8px;
}

.search-row .input {
  flex: 1;
}

.search-row .btn {
  flex: none;
  min-height: 46px;
}

.places {
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.place {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 11px 13px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

.place:last-child {
  border-bottom: none;
}

.place:active {
  background: var(--bg-elev-2);
}

.place__name {
  font-size: 14px;
}

.place__detail {
  font-size: 12px;
  color: var(--text-faint);
}

.search-error {
  font-size: 12.5px;
  color: var(--danger);
}

.link-btn {
  align-self: center;
  color: var(--accent);
  font-size: 13px;
}

.manual {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.16s ease;
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
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
