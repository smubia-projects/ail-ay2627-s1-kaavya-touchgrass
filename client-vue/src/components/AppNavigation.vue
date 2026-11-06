<script setup>
import { Trophy, ScanLine, Sprout, BookOpen } from 'lucide-vue-next'
defineProps({ active: String })
defineEmits(['navigate'])
const items = [{ id: 'leaderboard', label: 'Demo leaderboard', short: 'Demo', icon: Trophy }, { id: 'checkins', label: 'Check a screenshot', short: 'Screenshot', icon: ScanLine }, { id: 'activities', label: 'Activities', short: 'Activities', icon: Sprout }, { id: 'diary', label: 'Diary', short: 'Diary', icon: BookOpen }]
</script>
<template>
  <nav aria-label="Main navigation" class="app-navigation">
    <button v-for="item in items" :key="item.id" type="button" :class="{ active: active === item.id }" :aria-current="active === item.id ? 'page' : undefined" :aria-label="item.label" @click="$emit('navigate', item.id)"><component :is="item.icon" class="icon-control nav-icon" aria-hidden="true" /><span class="nav-label-long">{{ item.label }}</span><span class="nav-label-short" aria-hidden="true">{{ item.short }}</span></button>
  </nav>
</template>
