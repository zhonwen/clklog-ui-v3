import defaultSettings from '@/settings'

const title = defaultSettings.title || 'ClkLog'

export default function getPageTitle(pageTitle?: string) {
  if (pageTitle) {
    return `${title} - ${pageTitle}`
  }
  return `${title}`
}
