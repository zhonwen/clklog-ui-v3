export interface MenuItem {
  name: string
  path: string
  component?: string
  componentUri?: string
  icon?: string
  hidden?: boolean
  hideSidebar?: boolean
  alwaysShow?: boolean
  externalLink?: boolean
  children?: MenuItem[]
}

export interface ProjectItem {
  projectName: string
  projectDisplayName: string
}

export interface ChannelItem {
  displayName: string
  id: string
}
