/**
 * "hace X minutos / horas / días" in Spanish. Returns "nunca" for
 * null/undefined and "ahora mismo" if the timestamp is in the future
 * (clock skew between server and DB).
 */
export function relativeFromNow(iso: string | null | undefined): string {
  if (!iso) return "nunca";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "ahora mismo";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "hace unos segundos";
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} minuto${min === 1 ? "" : "s"}`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr} hora${hr === 1 ? "" : "s"}`;
  const days = Math.floor(hr / 24);
  return `hace ${days} día${days === 1 ? "" : "s"}`;
}
