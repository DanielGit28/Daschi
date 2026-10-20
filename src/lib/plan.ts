// Motor del plan: decide qué toca hoy según edad, raza, enfoques elegidos y progreso.
// Funciones puras (sin base de datos ni React) para poder probarlas.
import type { ChecklistItem, Content, Goal, GoalId, Household, Lesson, PottySpot, Tip } from '../content';

export type PlanProfile = {
  weeks: number;
  breed: string;
  chosenGoals: GoalId[];
  /** 5, 10 o 15 minutos al día: 1, 2 o 3 lecciones. */
  dailyMinutes: number;
  /** Todavía no llegó a casa. */
  preArrival: boolean;
  pottySpot: PottySpot | null;
  household: Household | null;
};

export type Progress = {
  /** Lecciones logradas (o guías leídas). */
  achieved: Set<string>;
  /** Última práctica por lección, en ms. */
  lastPracticed: Map<string, number>;
};

export type GoalReason = 'edad' | 'raza' | 'elegido';
export type ActiveGoal = { goal: Goal; reason: GoalReason };

const DAY_MS = 24 * 60 * 60 * 1000;

/** 'AAAA-MM-DD' local: el plan cambia una vez por día. */
export function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Hash estable de texto a [0, 1): rotación diaria predecible, sin Math.random. */
function hash01(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

function matchesBreed(breed: string, breeds: string[] | undefined) {
  if (!breeds) return false;
  const b = breed.toLowerCase();
  return breeds.some((x) => b.includes(x));
}

/** Enfoque que la app incluye sola (por edad o raza), aunque no se haya elegido. */
export function automaticReason(goal: Goal, weeks: number, breed: string): GoalReason | null {
  if (goal.urgentUntilWeeks != null && weeks < goal.urgentUntilWeeks) return 'edad';
  if (matchesBreed(breed, goal.breeds)) return 'raza';
  return null;
}

export function activeGoals(profile: PlanProfile, goals: Goal[]): ActiveGoal[] {
  const out: ActiveGoal[] = [];
  for (const goal of goals) {
    const auto = automaticReason(goal, profile.weeks, profile.breed);
    if (auto) out.push({ goal, reason: auto });
    else if (profile.chosenGoals.includes(goal.id)) out.push({ goal, reason: 'elegido' });
  }
  return out;
}

export function isLessonAvailable(lesson: Lesson, weeks: number, achieved: Set<string>) {
  if (weeks < lesson.minWeeks) return false;
  if (lesson.maxWeeks != null && weeks >= lesson.maxWeeks) return false;
  if (lesson.after && !achieved.has(lesson.after)) return false;
  return true;
}

/** Lecciones de un enfoque en orden de ruta. */
export function routeLessons(goalId: GoalId, lessons: Lesson[]) {
  return lessons.filter((l) => l.goal === goalId).sort((a, b) => a.order - b.order);
}

/** Siguiente lección sin lograr de un enfoque, o null si no hay nada disponible. */
export function nextLesson(goalId: GoalId, weeks: number, progress: Progress, lessons: Lesson[]) {
  return routeLessons(goalId, lessons).find((l) => !progress.achieved.has(l.id) && isLessonAvailable(l, weeks, progress.achieved)) ?? null;
}

export function lessonSlots(dailyMinutes: number) {
  return Math.min(3, Math.max(1, Math.round(dailyMinutes / 5)));
}

/**
 * Lecciones de hoy: una por enfoque como máximo. Pesan los enfoques urgentes por edad y los
 * elegidos; se prefiere seguir lo que ya se empezó y se rota por día para no repetir siempre lo mismo.
 */
export function todayLessons(profile: PlanProfile, progress: Progress, content: Content, now: Date): Lesson[] {
  if (profile.preArrival) {
    return content.lessons
      .filter((l) => l.beforeArrival && !progress.achieved.has(l.id))
      .sort((a, b) => a.order - b.order)
      .slice(0, 3);
  }

  const today = dayKey(now);
  const weight: Record<GoalReason, number> = { edad: 2, elegido: 2, raza: 1 };
  const candidates: Array<{ lesson: Lesson; score: number }> = [];

  for (const { goal, reason } of activeGoals(profile, content.goals)) {
    const lesson = nextLesson(goal.id, profile.weeks, progress, content.lessons);
    if (!lesson) continue;
    const last = progress.lastPracticed.get(lesson.id);
    let score = weight[reason] + hash01(`${today}:${goal.id}`);
    if (last != null) {
      // Ya empezada: seguir es mejor que abrir algo nuevo, salvo que se haya hecho hace muy poco.
      score += now.getTime() - last < DAY_MS / 2 ? -1 : 1.5;
    }
    if (lesson.kind === 'guia') score -= 0.5;
    candidates.push({ lesson, score });
  }

  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, lessonSlots(profile.dailyMinutes))
    .map((c) => c.lesson);
}

export function tipMatches(tip: Tip, profile: PlanProfile, active: Set<GoalId>) {
  if (!!tip.preArrival !== profile.preArrival) return false;
  if (!active.has(tip.goal)) return false;
  if (tip.minWeeks != null && profile.weeks < tip.minWeeks) return false;
  if (tip.maxWeeks != null && profile.weeks >= tip.maxWeeks) return false;
  return tipFitsHome(tip, profile);
}

/** Consejos de un enfoque que aplican a este hogar (sin filtrar por edad ni llegada). */
export function goalTips(goalId: GoalId, profile: PlanProfile, tips: Tip[]) {
  return tips.filter((t) => t.goal === goalId && tipFitsHome(t, profile));
}

function tipFitsHome(tip: Tip, profile: PlanProfile) {
  if (tip.spot && tip.spot !== profile.pottySpot) return false;
  if (tip.household === 'ninos' && profile.household !== 'ninos') return false;
  if (tip.household === 'familia' && profile.household !== 'familia' && profile.household !== 'ninos') return false;
  if (tip.breeds && !matchesBreed(profile.breed, tip.breeds)) return false;
  return true;
}

/** Un tip por día, distinto cada día dentro de los que aplican. */
export function tipOfDay(profile: PlanProfile, content: Content, now: Date): Tip | null {
  // Antes de llegar, todos los enfoques cuentan para los tips de preparación.
  const active = new Set<GoalId>(
    profile.preArrival ? content.goals.map((g) => g.id) : activeGoals(profile, content.goals).map((a) => a.goal.id),
  );
  const eligible = content.tips.filter((t) => tipMatches(t, profile, active));
  if (eligible.length === 0) return null;
  return eligible[Math.floor(hash01(dayKey(now)) * eligible.length)];
}

/** Cosas de socialización todavía sin una experiencia buena, rotadas por día. */
export function socializationPicks(items: ChecklistItem[], covered: Set<string>, now: Date, count = 2): ChecklistItem[] {
  const today = dayKey(now);
  return items
    .filter((i) => !covered.has(i.id))
    .map((i) => ({ i, k: hash01(`${today}:${i.id}`) }))
    .sort((a, b) => a.k - b.k)
    .slice(0, count)
    .map((x) => x.i);
}

/** Sugerencia según los registros de baño de hoy, o null si va bien. */
export function pottyAdvice(insideToday: number, outsideToday: number, intervalMin: number | null) {
  if (insideToday >= 3 && intervalMin != null && intervalMin > 45) {
    return { text: `Hoy van ${insideToday} accidentes. Probá salidas más seguidas por unos días.`, suggestInterval: intervalMin > 60 ? 60 : 45 };
  }
  if (insideToday >= 2 && insideToday > outsideToday) {
    return { text: 'Más accidentes que salidas exitosas hoy: sumá salidas después de comer, jugar y dormir.', suggestInterval: null };
  }
  return null;
}
