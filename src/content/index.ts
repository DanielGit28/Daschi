// Contenido de la app en JSON: se edita sin tocar código. Aquí solo se le ponen tipos.
import checklists from './checklists.json';
import goals from './goals.json';
import lessons from './lessons.json';
import tips from './tips.json';

export type GoalId =
  | 'bano'
  | 'socializacion'
  | 'mordiscos'
  | 'dormir'
  | 'caso'
  | 'solo'
  | 'correa'
  | 'ladridos'
  | 'trucos'
  | 'olfato'
  | 'manipulacion'
  | 'espalda';

export type Goal = {
  id: GoalId;
  name: string;
  emoji: string;
  summary: string;
  /** Se incluye sola mientras el cachorro tenga menos de estas semanas. */
  urgentUntilWeeks?: number;
  /** Se incluye sola para estas razas (texto que aparece en la raza, en minúsculas). */
  breeds?: string[];
};

export type LessonStep = { text: string; next: string };

export type Lesson = {
  id: string;
  goal: GoalId;
  /** 'practica': sesión de 5 min con temporizador; 'guia': para leer. */
  kind: 'practica' | 'guia';
  title: string;
  minWeeks: number;
  maxWeeks?: number;
  /** Orden dentro de la ruta del enfoque. */
  order: number;
  /** Lección que conviene lograr antes. */
  after?: string;
  /** Útil antes de que el cachorro llegue a casa. */
  beforeArrival?: boolean;
  purpose: string;
  needs: string[];
  steps: LessonStep[];
  mistakes: string[];
  doneWhen: string;
  dachshund?: string;
};

export type PottySpot = 'patio' | 'calle' | 'empapador';
export type Household = 'solo' | 'familia' | 'ninos';

export type Tip = {
  id: string;
  goal: GoalId;
  text: string;
  preArrival?: boolean;
  minWeeks?: number;
  maxWeeks?: number;
  spot?: PottySpot;
  household?: Household;
  breeds?: string[];
};

export type ChecklistItem = { id: string; group: string; text: string };

export type Content = {
  goals: Goal[];
  lessons: Lesson[];
  tips: Tip[];
  prep: ChecklistItem[];
  socialization: ChecklistItem[];
};

export const CONTENT: Content = {
  goals: goals as Goal[],
  lessons: lessons as Lesson[],
  tips: tips as Tip[],
  prep: checklists.prep,
  socialization: checklists.socialization,
};

export const goalById = (id: string) => CONTENT.goals.find((g) => g.id === id);
export const lessonById = (id: string) => CONTENT.lessons.find((l) => l.id === id);

/**
 * Adapta el texto al cachorro: {nombre} → nombre; {o} → o/a y {lo} → lo/la según el sexo
 * (ej. "tranquil{o}", "saca{lo}"). Sin sexo indicado se usa el masculino genérico.
 */
export function personalize(text: string, dog: { name: string; sex?: 'macho' | 'hembra' | null }) {
  const female = dog.sex === 'hembra';
  return text
    .replaceAll('{nombre}', dog.name)
    .replaceAll('{o}', female ? 'a' : 'o')
    .replaceAll('{lo}', female ? 'la' : 'lo');
}
