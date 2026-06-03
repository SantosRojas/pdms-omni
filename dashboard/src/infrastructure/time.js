export function toLocalDatetime(utcStr) {
  if (!utcStr) return utcStr;
  const d = new Date(utcStr + 'Z');
  if (isNaN(d.getTime())) return utcStr;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  const secs = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${mins}:${secs}`;
}

export function toLocalTimeOnly(utcStr) {
  if (!utcStr) return utcStr;
  const d = new Date(utcStr + 'Z');
  if (isNaN(d.getTime())) return utcStr;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function toLocalDate(utcStr) {
  if (!utcStr) return utcStr;
  const d = new Date(utcStr + 'Z');
  if (isNaN(d.getTime())) return utcStr;
  return d.toLocaleDateString();
}
