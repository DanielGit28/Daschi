// Edad del cachorro y etapa del plan de entrenamiento.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Convierte 'AAAA-MM-DD' en una fecha local (sin desfase por zona horaria). */
export function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

/** Acepta 'DD/MM/AAAA' (como lo escribe una persona) y devuelve 'AAAA-MM-DD'. */
export function parseHumanDate(text: string): string | null {
  const m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(text.trim());
  if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return parseISODate(iso) ? iso : null;
}

export function formatHumanDate(iso: string): string {
  const d = parseISODate(iso);
  if (!d) return iso;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function ageInDays(birthISO: string, today: Date = new Date()): number {
  const birth = parseISODate(birthISO);
  if (!birth) return 0;
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((startOfToday.getTime() - birth.getTime()) / MS_PER_DAY));
}

export function ageInWeeks(birthISO: string, today: Date = new Date()): number {
  return Math.floor(ageInDays(birthISO, today) / 7);
}

export function ageLabel(birthISO: string, today: Date = new Date()): string {
  const days = ageInDays(birthISO, today);
  const weeks = Math.floor(days / 7);
  const rest = days % 7;
  if (weeks === 0) return `${days} ${days === 1 ? 'día' : 'días'}`;
  const w = `${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`;
  return rest === 0 ? w : `${w} y ${rest} ${rest === 1 ? 'día' : 'días'}`;
}

export type Stage = {
  number: 1 | 2 | 3 | 4 | 5;
  name: string;
  range: string;
  focus: string;
};

export const STAGES: Stage[] = [
  { number: 1, name: 'Llegada', range: '8-10 semanas', focus: 'Rutina, confianza, baño y dormir en su espacio' },
  { number: 2, name: 'Socialización intensa', range: '10-14 semanas', focus: 'Personas, sonidos, superficies y lugares nuevos, con calma' },
  { number: 3, name: 'Bases', range: '14-18 semanas', focus: 'Echado, quieto, ven y caminar sin jalar' },
  { number: 4, name: 'Adolescencia temprana', range: '4-6 meses', focus: 'Constancia: repasar todo con distracciones' },
  { number: 5, name: 'Adolescencia', range: '6-12 meses', focus: 'Reforzar sin retroceder, manejar ladrido y caza' },
];

/** Etapa según edad en semanas. Antes de las 8 semanas se usa la etapa 1. */
export function stageForWeeks(weeks: number): Stage {
  if (weeks < 10) return STAGES[0];
  if (weeks < 14) return STAGES[1];
  if (weeks < 18) return STAGES[2];
  if (weeks < 26) return STAGES[3];
  return STAGES[4];
}
