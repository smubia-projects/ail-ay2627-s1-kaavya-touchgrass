<script setup>
import { ref } from 'vue'
import BrandMark from './components/BrandMark.vue'
import AppNavigation from './components/AppNavigation.vue'
import HowItWorks from './components/HowItWorks.vue'
import ExploreDemo from './components/ExploreDemo.vue'
import ScreenshotCheckIn from './components/ScreenshotCheckIn.vue'
import ActivitySuggestions from './components/ActivitySuggestions.vue'
import UserDiary from './components/UserDiary.vue'
import RateLimitCTA from './components/RateLimitCTA.vue'
import { limits, dismissCta, dismissPaused } from './api'

// Public, no-login showcase: demo leaderboard (bundled fixture), analyse-only screenshot
// check, AI activity ideas and a browser-local diary. No accounts, groups or server storage.
const view = ref('leaderboard')
function navigate(next) {
  view.value = next
  document.getElementById('main-content')?.focus({ preventScroll: true })
  window.scrollTo?.(0, 0)
}
</script>

<template>
  <a class="skip-link" href="#main-content">Skip to content</a>
  <div class="app-shell">
    <aside class="sidebar">
      <BrandMark />
      <AppNavigation :active="view" @navigate="navigate" />
      <div class="sidebar-group">
        <p class="eyebrow">AI LODGE SHOWCASE</p>
        <p class="sidebar-note">A public demo of TouchGrass: no login, no groups. The leaderboard uses fictional sample data.</p>
        <p class="privacy-note">Screenshots are sent to an AI provider for analysis and are not stored.</p>
      </div>
    </aside>
    <div class="workspace">
      <header class="mobile-topbar"><BrandMark /></header>
      <main id="main-content" class="main-content" tabindex="-1">
        <div v-if="limits.paused" class="alert alert-warning paused-notice" role="status" aria-live="polite" data-testid="demo-paused">
          <span><strong>Demo paused.</strong> {{ limits.paused }} The demo leaderboard and your diary still work.</span>
          <button type="button" class="btn-close" aria-label="Dismiss notice" @click="dismissPaused"></button>
        </div>
        <HowItWorks />
        <ExploreDemo v-show="view === 'leaderboard'" />
        <section v-show="view === 'checkins'" class="dedicated-view">
          <header class="page-heading"><p class="eyebrow">SMALL STEPS, HONEST NUMBERS</p><h1>Check a screenshot</h1><p>See how TouchGrass turns a screen-time screenshot into minutes.</p></header>
          <ScreenshotCheckIn />
        </section>
        <section v-show="view === 'activities'" class="dedicated-view">
          <header class="page-heading"><p class="eyebrow">LESS SCROLLING, MORE LIVING</p><h1>A little inspiration.</h1><p>Make room for something offline.</p></header>
          <ActivitySuggestions />
        </section>
        <section v-show="view === 'diary'" class="dedicated-view">
          <header class="page-heading"><p class="eyebrow">A LITTLE REFLECTION</p><h1>Your personal diary</h1><p>A space to notice your habits. Just for you, saved in this browser.</p></header>
          <UserDiary />
        </section>
      </main>
      <div class="mobile-navigation"><AppNavigation :active="view" @navigate="navigate" /></div>
    </div>
  </div>
  <RateLimitCTA v-if="limits.cta.open" :queries-made="limits.cta.count" @dismiss="dismissCta" />
</template>
