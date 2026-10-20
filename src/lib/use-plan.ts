import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { CONTENT, type GoalId } from '../content';
import { ageInWeeks } from './age';
import { getDogGoals, getDoneItems, getLastPracticed, getSocializationLogs, type Dog, type SocializationLog } from './db';
import { dayKey, type PlanProfile, type Progress } from './plan';

export type PlanState = {
  profile: PlanProfile;
  progress: Progress;
  /** Ids marcados: lista de preparación, lecciones logradas y guías leídas. */
  done: Set<string>;
  socialLogs: SocializationLog[];
  /** Cosas de socialización con al menos una experiencia buena. */
  socialCovered: Set<string>;
};

export function buildProfile(dog: Dog, chosenGoals: GoalId[], now = new Date()): PlanProfile {
  return {
    weeks: ageInWeeks(dog.birth_date, now),
    breed: dog.breed,
    chosenGoals,
    dailyMinutes: dog.daily_minutes ?? 10,
    preArrival: !!dog.arrival_date && dog.arrival_date > dayKey(now),
    pottySpot: dog.potty_spot,
    household: dog.household,
  };
}

/** Carga el estado del plan cada vez que la pantalla gana foco. */
export function usePlan(dog: Dog | null) {
  const db = useSQLiteContext();
  const [state, setState] = useState<PlanState | null>(null);

  const reload = useCallback(async () => {
    if (!dog) return;
    const [goals, done, lastPracticed, socialLogs] = await Promise.all([
      getDogGoals(db, dog.id),
      getDoneItems(db, dog.id),
      getLastPracticed(db, dog.id),
      getSocializationLogs(db, dog.id),
    ]);
    const lessonIds = new Set(CONTENT.lessons.map((l) => l.id));
    setState({
      profile: buildProfile(dog, goals),
      progress: { achieved: new Set([...done].filter((id) => lessonIds.has(id))), lastPracticed },
      done,
      socialLogs,
      socialCovered: new Set(socialLogs.filter((l) => l.reaction === 'bien').map((l) => l.item_id)),
    });
  }, [db, dog]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { state, reload };
}
