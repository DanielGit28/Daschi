// Niveles de progreso y racha diaria. Funciones puras, como el motor del plan.
import { dayKey } from './plan';

export type LevelId = 'semilla' | 'brote' | 'explorador' | 'graduado';

type LevelInput = { achieved: Set<string>; socialCovered: number };

type Requirement = { label: string; done: (p: LevelInput) => boolean };

export type Level = { id: LevelId; name: string; emoji: string; summary: string; requirements: Requirement[] };

const lesson = (id: string, label: string): Requirement => ({ label, done: (p) => p.achieved.has(id) });

/** Cosas de socialización con experiencia buena que pide el nivel Explorador ("mayormente cubierto"). */
export const SOCIAL_GOAL = 20;

export const LEVELS: Level[] = [
  {
    id: 'semilla',
    name: 'Semilla',
    emoji: '🌱',
    summary: 'Perfil creado y primera lección lograda.',
    requirements: [{ label: 'Lograr la primera lección', done: (p) => p.achieved.size > 0 }],
  },
  {
    id: 'brote',
    name: 'Brote',
    emoji: '🌿',
    summary: 'Etapa 1 completa: baño en rutina y responde a su nombre.',
    requirements: [lesson('bano-rutina', 'Rutina de salidas al baño'), lesson('caso-nombre', 'Responder a su nombre')],
  },
  {
    id: 'explorador',
    name: 'Explorador',
    emoji: '🧭',
    summary: 'Socialización mayormente cubierta y etapa 2 completa.',
    requirements: [
      { label: `Socialización: ${SOCIAL_GOAL} cosas con experiencia buena`, done: (p) => p.socialCovered >= SOCIAL_GOAL },
      lesson('caso-mirarme', 'Mirarme'),
      lesson('caso-sentado', 'Sentado'),
      lesson('mord-suave', 'Mordida suave'),
    ],
  },
  {
    id: 'graduado',
    name: 'Graduado',
    emoji: '🎓',
    summary: 'Sentado, echado, ven y caminar sin jalar.',
    requirements: [
      lesson('caso-sentado', 'Sentado'),
      lesson('caso-echado', 'Echado'),
      lesson('caso-ven', 'Ven'),
      lesson('correa-sin-jalar', 'Caminar sin jalar'),
    ],
  },
];

/** Id con el que se marca un nivel alcanzado en la lista de cosas hechas (así se sincroniza solo). */
export const levelItemId = (id: LevelId) => `level-${id}`;

/** Último nivel alcanzado, en orden (cada nivel requiere el anterior). null si todavía ninguno. */
export function currentLevel(input: LevelInput): Level | null {
  let reached: Level | null = null;
  for (const level of LEVELS) {
    if (!level.requirements.every((r) => r.done(input))) break;
    reached = level;
  }
  return reached;
}

export function nextLevel(input: LevelInput): { level: Level; pending: string[]; done: number } | null {
  const current = currentLevel(input);
  const level = LEVELS[current ? LEVELS.indexOf(current) + 1 : 0];
  if (!level) return null;
  const pending = level.requirements.filter((r) => !r.done(input)).map((r) => r.label);
  return { level, pending, done: level.requirements.length - pending.length };
}

/** Días seguidos con práctica (sesión o socialización), terminando hoy o ayer. */
export function streak(practiceDates: string[], now: Date): number {
  const days = new Set(practiceDates.map((iso) => dayKey(new Date(iso))));
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1); // hoy todavía puede sumar
  let count = 0;
  while (days.has(dayKey(cursor))) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}
