<script setup lang="ts">
import { computed } from 'vue'
import { Divider, Flex, Input, InputNumber, Slider, Switch, Tag } from 'ant-design-vue'

import ProListItem from '@/components/pro-list-item/index.vue'
import ProList from '@/components/pro-list/index.vue'
import { useCatStore } from '@/stores/cat'
import { useSyncStore } from '@/stores/sync'
import { isWindows } from '@/utils/platform'

const catStore = useCatStore()
const syncStore = useSyncStore()

const syncStatusColor = computed(() => {
  const colorMap = {
    disconnected: 'default',
    connecting: 'processing',
    waiting: 'warning',
    connected: 'success',
    error: 'error',
  } as const

  return colorMap[syncStore.status]
})

const syncStatusText = computed(() => {
  const textMap = {
    disconnected: '未连接',
    connecting: '连接中',
    waiting: '等待对端',
    connected: '已连接',
    error: '连接异常',
  } as const

  return textMap[syncStore.status]
})
</script>

<template>
  <ProList :title="$t('pages.preference.cat.labels.modelSettings')">
    <ProListItem
      :description="$t('pages.preference.cat.hints.mirrorMode')"
      :title="$t('pages.preference.cat.labels.mirrorMode')"
    >
      <Switch v-model:checked="catStore.model.mirror" />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.cat.hints.mouseMirror')"
      :title="$t('pages.preference.cat.labels.mouseMirror')"
    >
      <Switch v-model:checked="catStore.model.mouseMirror" />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.cat.hints.ignoreMouse')"
      :title="$t('pages.preference.cat.labels.ignoreMouse')"
    >
      <Switch v-model:checked="catStore.model.ignoreMouse" />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.cat.hints.motionSound')"
      :title="$t('pages.preference.cat.labels.motionSound')"
    >
      <Switch v-model:checked="catStore.model.motionSound" />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.cat.hints.behavior')"
      :title="$t('pages.preference.cat.labels.behavior')"
    >
      <Switch v-model:checked="catStore.model.behavior" />
    </ProListItem>

    <ProListItem
      v-if="isWindows"
      :description="$t('pages.preference.cat.hints.autoReleaseDelay')"
      :title="$t('pages.preference.cat.labels.autoReleaseDelay')"
    >
      <InputNumber
        v-model:value="catStore.model.autoReleaseDelay"
        addon-after="s"
        class="w-28"
      />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.cat.hints.maxFPS')"
      :title="$t('pages.preference.cat.labels.maxFPS')"
    >
      <InputNumber
        v-model:value="catStore.model.maxFPS"
        class="w-20"
        :min="0"
      />
    </ProListItem>
  </ProList>

  <ProList title="双端同步">
    <ProListItem
      description="启用后，会把当前猫猫的键盘/鼠标动作通过 WebSocket 中继同步给同一房间的另一端。只同步动作，不同步真实文本内容。"
      title="启用同步"
    >
      <Switch v-model:checked="syncStore.enabled" />
    </ProListItem>

    <ProListItem
      description="填写中继服务器地址。局域网测试时可用 ws://你的IP:4399。"
      title="服务器地址"
    >
      <Input
        v-model:value="syncStore.serverUrl"
        class="w-80"
        placeholder="ws://127.0.0.1:4399"
      />
    </ProListItem>

    <ProListItem
      description="双方填写同一个房间号即可配对。"
      title="房间号"
    >
      <Input
        v-model:value="syncStore.roomId"
        class="w-60"
        placeholder="room-001"
      />
    </ProListItem>

    <ProListItem title="本机标识">
      <Input
        v-model:value="syncStore.peerId"
        class="w-60"
      />
    </ProListItem>

    <ProListItem title="连接状态">
      <Tag :color="syncStatusColor">
        {{ syncStatusText }}
      </Tag>
    </ProListItem>

    <ProListItem
      v-if="syncStore.lastError"
      title="最近错误"
      vertical
    >
      <div class="max-w-120 break-all text-xs text-red-500">
        {{ syncStore.lastError }}
      </div>
    </ProListItem>
  </ProList>

  <ProList :title="$t('pages.preference.cat.labels.windowSettings')">
    <ProListItem
      :description="$t('pages.preference.cat.hints.passThrough')"
      :title="$t('pages.preference.cat.labels.passThrough')"
    >
      <Switch v-model:checked="catStore.window.passThrough" />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.cat.hints.alwaysOnTop')"
      :title="$t('pages.preference.cat.labels.alwaysOnTop')"
    >
      <Switch v-model:checked="catStore.window.alwaysOnTop" />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.cat.hints.hideOnHover')"
      :title="$t('pages.preference.cat.labels.hideOnHover')"
    >
      <Flex align="center">
        <Switch v-model:checked="catStore.window.hideOnHover" />

        <Flex
          align="center"
          class="overflow-hidden transition-all"
          :class="[catStore.window.hideOnHover ? 'w-28 opacity-100' : 'w-0 opacity-0']"
        >
          <Divider type="vertical" />

          <InputNumber
            v-model:value="catStore.window.hideOnHoverDelay"
            addon-after="s"
            class="w-24"
            :min="0"
          />
        </Flex>
      </Flex>
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.cat.hints.keepInScreen')"
      :title="$t('pages.preference.cat.labels.keepInScreen')"
    >
      <Switch v-model:checked="catStore.window.keepInScreen" />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.cat.hints.windowSize')"
      :title="$t('pages.preference.cat.labels.windowSize')"
    >
      <InputNumber
        v-model:value="catStore.window.scale"
        addon-after="%"
        class="w-28"
        :max="500"
        :min="1"
      />
    </ProListItem>

    <ProListItem :title="$t('pages.preference.cat.labels.windowRadius')">
      <InputNumber
        v-model:value="catStore.window.radius"
        addon-after="%"
        class="w-28"
        :min="0"
      />
    </ProListItem>

    <ProListItem
      :title="$t('pages.preference.cat.labels.opacity')"
      vertical
    >
      <Slider
        v-model:value="catStore.window.opacity"
        class="m-[0]!"
        :max="100"
        :min="10"
        :tip-formatter="(value) => `${value}%`"
      />
    </ProListItem>
  </ProList>
</template>
