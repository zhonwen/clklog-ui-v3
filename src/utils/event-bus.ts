import mitt from 'mitt'

type AppEvents = {
  $updateMenu: unknown
  $CHECKPROJECT: string
  $loginOut: unknown
  $modifyPsw: unknown
  $downPage: unknown
}

export const bus = mitt<AppEvents>()
