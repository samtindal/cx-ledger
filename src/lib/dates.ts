const pad = (n: number) => String(n).padStart(2, '0');

export function toLocalISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(now: Date = new Date()): string {
  return toLocalISO(now);
}

export function daysAgo(n: number, now: Date = new Date()): string {
  return toLocalISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n));
}

function parseLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((parseLocal(toISO).getTime() - parseLocal(fromISO).getTime()) / 86_400_000);
}
