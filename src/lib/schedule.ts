// Cálculo de horarios de los recordatorios de baño. Sin dependencias de Expo para poder probarlo solo.

const MS_PER_MIN = 60 * 1000;

/** 'HH:MM' → minutos desde medianoche, o null si no es una hora válida. */
export function parseTime(text: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((text ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function formatTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function minutesOfDay(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

/** ¿Cae la hora dentro del silencio de noche? Soporta ventanas que cruzan la medianoche (22:00 → 06:00). */
export function isQuiet(d: Date, quietStart: number | null, quietEnd: number | null): boolean {
  if (quietStart == null || quietEnd == null || quietStart === quietEnd) return false;
  const m = minutesOfDay(d);
  return quietStart < quietEnd ? m >= quietStart && m < quietEnd : m >= quietStart || m < quietEnd;
}

/** Próxima vez (estrictamente después de `after`) en que el reloj marca `minutes`. */
export function nextAtTime(after: Date, minutes: number): Date {
  const d = new Date(after.getFullYear(), after.getMonth(), after.getDate(), Math.floor(minutes / 60), minutes % 60);
  if (d.getTime() <= after.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

export type PottySlot = {
  at: Date;
  /** 'interval': toca salir según el intervalo; 'morning': primera salida al terminar el silencio de noche. */
  kind: 'interval' | 'morning';
  /** Minutos desde el último registro de baño (null si no hay registros). */
  sinceMin: number | null;
};

type SlotOptions = {
  /** Último registro de baño; sin registros se cuenta desde `now`. */
  lastLog: Date | null;
  now: Date;
  intervalMin: number;
  quietStart: number | null;
  quietEnd: number | null;
  horizonMin?: number;
  max?: number;
};

/**
 * Próximas salidas al baño: cada `intervalMin` desde el último registro, saltando el silencio
 * de noche (en su lugar, un aviso al terminar). Si ya se pasó la hora, devuelve las siguientes.
 */
export function pottySlots({ lastLog, now, intervalMin, quietStart, quietEnd, horizonMin = 36 * 60, max = 40 }: SlotOptions): PottySlot[] {
  if (!(intervalMin > 0)) return [];
  const anchor = lastLog ?? now;
  const step = intervalMin * MS_PER_MIN;
  const end = now.getTime() + horizonMin * MS_PER_MIN;
  const since = (t: number) => (lastLog ? Math.round((t - lastLog.getTime()) / MS_PER_MIN) : null);

  let t = anchor.getTime() + step;
  if (t <= now.getTime()) t += Math.ceil((now.getTime() - t + 1) / step) * step;

  const slots: PottySlot[] = [];
  while (t <= end && slots.length < max) {
    const at = new Date(t);
    if (isQuiet(at, quietStart, quietEnd)) {
      const wake = nextAtTime(at, quietEnd!);
      if (wake.getTime() > end) break;
      slots.push({ at: wake, kind: 'morning', sinceMin: since(wake.getTime()) });
      t = wake.getTime() + step;
    } else {
      slots.push({ at, kind: 'interval', sinceMin: since(t) });
      t += step;
    }
  }
  return slots;
}

/** Minutos después de comer en que conviene salir al baño. */
export const AFTER_MEAL_MIN = 15;
const JUST_WOKE_MIN = 15;

export type RoutineHint =
  | { kind: 'sleeping'; since: Date }
  | { kind: 'woke'; at: Date }
  | { kind: 'meal'; outingAt: Date; due: boolean };

/**
 * Pista según la última comida o siesta, si todavía no hubo baño después:
 * durmiendo, recién despierto (afuera ya) o comió (afuera ~15 min después).
 */
export function routineHint(
  lastActivity: { kind: string; logged_at: string } | null,
  lastPotty: { logged_at: string } | null,
  now: Date,
): RoutineHint | null {
  if (!lastActivity) return null;
  const at = new Date(lastActivity.logged_at);
  if (lastPotty && new Date(lastPotty.logged_at) >= at) return null;
  const minutesAgo = (now.getTime() - at.getTime()) / MS_PER_MIN;
  if (lastActivity.kind === 'dormir') return minutesAgo < 4 * 60 ? { kind: 'sleeping', since: at } : null;
  if (lastActivity.kind === 'despertar') return minutesAgo < JUST_WOKE_MIN ? { kind: 'woke', at } : null;
  if (lastActivity.kind === 'comida' && minutesAgo < 60) {
    return { kind: 'meal', outingAt: new Date(at.getTime() + AFTER_MEAL_MIN * MS_PER_MIN), due: minutesAgo >= AFTER_MEAL_MIN };
  }
  return null;
}

/** Estado para mostrar en "Hoy". */
export function pottyStatus(opts: SlotOptions): { overdue: boolean; quiet: boolean; next: Date | null } {
  const quiet = isQuiet(opts.now, opts.quietStart, opts.quietEnd);
  const dueAt = opts.lastLog ? opts.lastLog.getTime() + opts.intervalMin * MS_PER_MIN : null;
  const overdue = !quiet && dueAt != null && dueAt <= opts.now.getTime();
  const next = pottySlots({ ...opts, max: 1 })[0]?.at ?? null;
  return { overdue, quiet, next };
}
