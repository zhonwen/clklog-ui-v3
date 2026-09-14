import mitt from 'mitt'

export const bus = mitt<Record<string, unknown>>()
