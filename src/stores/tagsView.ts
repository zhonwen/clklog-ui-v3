import { defineStore } from 'pinia'
import type { RouteLocationNormalizedLoaded } from 'vue-router'

interface TagView {
  path: string
  name?: string | symbol | null
  title: string
  meta: RouteLocationNormalizedLoaded['meta'] & { affix?: boolean; noCache?: boolean; title?: string }
}

export const useTagsViewStore = defineStore('tagsView', {
  state: () => ({
    visitedViews: [] as TagView[],
    cachedViews: [] as string[],
  }),
  actions: {
    addView(view: RouteLocationNormalizedLoaded) {
      this.addVisitedView(view)
      this.addCachedView(view)
    },
    addVisitedView(view: RouteLocationNormalizedLoaded) {
      if (this.visitedViews.some((v) => v.path === view.path)) return
      this.visitedViews.push({
        path: view.path,
        name: view.name,
        meta: view.meta,
        title: (view.meta.title as string) || 'no-name',
      })
    },
    addCachedView(view: RouteLocationNormalizedLoaded) {
      const name = typeof view.name === 'string' ? view.name : ''
      if (!name || this.cachedViews.includes(name)) return
      if (!view.meta.noCache) {
        this.cachedViews.push(name)
      }
    },
    delAllViews() {
      this.visitedViews = this.visitedViews.filter((tag) => tag.meta.affix)
      this.cachedViews = []
    },
  },
})
