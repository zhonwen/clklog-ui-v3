export function formatDate(date: Date) {
  return (
    date.getFullYear() +
    '-' +
    (date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1) +
    '-' +
    (date.getDate() < 10 ? '0' + date.getDate() : date.getDate())
  )
}

export function formatTime(seconds: number) {
  if (!seconds) return '--'
  let hours = Math.floor(seconds / 3600)
  let minutes = Math.floor((seconds - hours * 3600) / 60)
  let rest = seconds - hours * 3600 - minutes * 60
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
  return `${pad(hours)}:${pad(minutes)}:${pad(rest)}`
}
