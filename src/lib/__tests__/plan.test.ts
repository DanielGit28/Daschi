import { CONTENT, type GoalId } from '../../content';
import {
  activeGoals,
  lessonSlots,
  nextLesson,
  pottyAdvice,
  socializationPicks,
  tipOfDay,
  todayLessons,
  type PlanProfile,
  type Progress,
} from '../plan';

const NOW = new Date(2026, 9, 26, 9, 0);

function profile(over: Partial<PlanProfile> = {}): PlanProfile {
  return {
    weeks: 8,
    breed: 'Dachshund (salchicha)',
    chosenGoals: [],
    dailyMinutes: 10,
    preArrival: false,
    pottySpot: 'patio',
    household: 'solo',
    ...over,
  };
}

const empty = (): Progress => ({ achieved: new Set(), lastPracticed: new Map() });

describe('contenido', () => {
  const goalIds = new Set(CONTENT.goals.map((g) => g.id));
  const lessonIds = CONTENT.lessons.map((l) => l.id);

  it('ids únicos', () => {
    for (const ids of [lessonIds, CONTENT.tips.map((t) => t.id), [...CONTENT.prep, ...CONTENT.socialization].map((i) => i.id)]) {
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('cada lección y tip apunta a un enfoque existente', () => {
    for (const l of CONTENT.lessons) expect(goalIds).toContain(l.goal);
    for (const t of CONTENT.tips) expect(goalIds).toContain(t.goal);
  });

  it('"after" apunta a una lección del mismo enfoque y con edad mínima compatible', () => {
    for (const l of CONTENT.lessons.filter((x) => x.after)) {
      const prev = CONTENT.lessons.find((x) => x.id === l.after);
      expect(prev).toBeDefined();
      expect(prev!.goal).toBe(l.goal); // si no, un enfoque elegido solo podría quedar trabado
      expect(prev!.minWeeks).toBeLessThanOrEqual(l.minWeeks);
    }
  });

  it('cada lección tiene de 3 a 6 pasos y criterio de logrado', () => {
    for (const l of CONTENT.lessons) {
      expect(l.steps.length).toBeGreaterThanOrEqual(3);
      expect(l.steps.length).toBeLessThanOrEqual(6);
      expect(l.doneWhen.length).toBeGreaterThan(0);
    }
  });

  it('cada enfoque tiene al menos una lección disponible a las 8 o 16 semanas', () => {
    for (const g of CONTENT.goals) {
      const at8 = nextLesson(g.id, 8, empty(), CONTENT.lessons);
      const at16 = nextLesson(g.id, 16, empty(), CONTENT.lessons);
      expect(at8 ?? at16).not.toBeNull();
    }
  });
});

describe('enfoques activos', () => {
  it('a las 8 semanas incluye baño, socialización, mordiscos y dormir por edad, y espalda por raza', () => {
    const active = activeGoals(profile(), CONTENT.goals);
    const byReason = (r: string) => active.filter((a) => a.reason === r).map((a) => a.goal.id);
    expect(byReason('edad')).toEqual(['bano', 'socializacion', 'mordiscos', 'dormir']);
    expect(byReason('raza')).toEqual(['espalda']);
  });

  it('espalda no se incluye sola para otras razas', () => {
    const ids = activeGoals(profile({ breed: 'Labrador' }), CONTENT.goals).map((a) => a.goal.id);
    expect(ids).not.toContain('espalda');
  });

  it('a los 6 meses solo quedan los elegidos (y la raza)', () => {
    const ids = activeGoals(profile({ weeks: 30, chosenGoals: ['trucos'] }), CONTENT.goals).map((a) => a.goal.id);
    expect(ids).toEqual(['trucos', 'espalda']);
  });
});

describe('lecciones de hoy', () => {
  it('la cantidad depende de los minutos por día', () => {
    expect(lessonSlots(5)).toBe(1);
    expect(lessonSlots(10)).toBe(2);
    expect(lessonSlots(15)).toBe(3);
    expect(todayLessons(profile({ dailyMinutes: 15 }), empty(), CONTENT, NOW)).toHaveLength(3);
  });

  it('nunca repite enfoque en el mismo día', () => {
    const lessons = todayLessons(profile({ dailyMinutes: 15, chosenGoals: ['caso', 'trucos', 'olfato'] }), empty(), CONTENT, NOW);
    expect(new Set(lessons.map((l) => l.goal)).size).toBe(lessons.length);
  });

  it('antes de llegar muestra solo guías de preparación', () => {
    const lessons = todayLessons(profile({ preArrival: true }), empty(), CONTENT, NOW);
    expect(lessons.length).toBeGreaterThan(0);
    expect(lessons.every((l) => l.beforeArrival)).toBe(true);
  });

  it('respeta la edad mínima y las lecciones previas', () => {
    expect(nextLesson('caso', 8, empty(), CONTENT.lessons)?.id).toBe('caso-nombre');
    const done: Progress = { achieved: new Set(['caso-nombre']), lastPracticed: new Map() };
    expect(nextLesson('caso', 8, done, CONTENT.lessons)).toBeNull(); // mirarme es desde 9 semanas
    expect(nextLesson('caso', 9, done, CONTENT.lessons)?.id).toBe('caso-mirarme');
  });

  it('a lo largo de una semana aparecen los enfoques elegidos', () => {
    const chosen: GoalId[] = ['caso', 'olfato'];
    const seen = new Set<string>();
    for (let d = 0; d < 7; d++) {
      const day = new Date(2026, 9, 26 + d, 9);
      for (const l of todayLessons(profile({ chosenGoals: chosen, dailyMinutes: 15 }), empty(), CONTENT, day)) seen.add(l.goal);
    }
    for (const g of chosen) expect(seen).toContain(g);
  });

  it('el plan es estable durante el día', () => {
    const a = todayLessons(profile(), empty(), CONTENT, new Date(2026, 9, 26, 8));
    const b = todayLessons(profile(), empty(), CONTENT, new Date(2026, 9, 26, 20));
    expect(a.map((l) => l.id)).toEqual(b.map((l) => l.id));
  });
});

describe('tips y socialización', () => {
  it('el tip del día respeta el lugar del baño', () => {
    for (let d = 0; d < 30; d++) {
      const tip = tipOfDay(profile({ pottySpot: 'patio' }), CONTENT, new Date(2026, 9, d + 1));
      expect(tip?.spot === undefined || tip?.spot === 'patio').toBe(true);
    }
  });

  it('antes de llegar solo da tips de preparación', () => {
    expect(tipOfDay(profile({ preArrival: true }), CONTENT, NOW)?.preArrival).toBe(true);
  });

  it('socialización sugiere cosas no cubiertas', () => {
    const covered = new Set(CONTENT.socialization.slice(0, 5).map((i) => i.id));
    const picks = socializationPicks(CONTENT.socialization, covered, NOW, 2);
    expect(picks).toHaveLength(2);
    for (const p of picks) expect(covered.has(p.id)).toBe(false);
  });

  it('sugiere acortar el intervalo con muchos accidentes', () => {
    expect(pottyAdvice(3, 4, 60)?.suggestInterval).toBe(45);
    expect(pottyAdvice(0, 5, 60)).toBeNull();
  });
});
