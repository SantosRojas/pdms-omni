export function toLocalDatetime(utcStr: string): string {
  const d = new Date(utcStr + "Z")
  if (isNaN(d.getTime())) return utcStr
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  const hours = String(d.getHours()).padStart(2, "0")
  const mins = String(d.getMinutes()).padStart(2, "0")
  const secs = String(d.getSeconds()).padStart(2, "0")
  return `${year}-${month}-${day} ${hours}:${mins}:${secs}`
}

export function toLocalTimeOnly(utcStr: string): string {
  const d = new Date(utcStr + "Z")
  if (isNaN(d.getTime())) return utcStr
  const hours = String(d.getHours()).padStart(2, "0")
  const mins = String(d.getMinutes()).padStart(2, "0")
  return `${hours}:${mins}`
}

export function relativeTime(utcStr: string): string {
  const date = new Date(utcStr + "Z")
  if (isNaN(date.getTime())) return utcStr
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "ahora"
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `hace ${days} día${days > 1 ? "s" : ""}`
  return date.toLocaleDateString("es-ES")
}

export function formatDuration(start: string, end: string | null): string {
  if (!end) return "En curso"
  const s = new Date(start + "Z")
  const e = new Date(end + "Z")
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return "En curso"
  const diff = e.getTime() - s.getTime()
  const hours = Math.floor(diff / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins} min`
}
