import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Mascot, Spots } from '../../components/Mascot';
import { PottyRow, pottyLabel } from '../../components/PottyRow';
import { Button, Card, CheckRow, H2, Muted, ProgressBar, Screen } from '../../components/ui';
import { CONTENT, goalById, personalize, type Lesson } from '../../content';
import { ageLabel, parseISODate, stageForWeeks } from '../../lib/age';
import {
  addPottyLog,
  addSocializationLog,
  deletePottyLog,
  getLastPottyLog,
  getPottyLogsSince,
  getReminders,
  setItemDone,
  updateReminder,
  type PottyKind,
  type PottyLog,
  type PottyPlace,
  type Reminder,
} from '../../lib/db';
import { useDog } from '../../lib/dog-context';
import { syncReminders } from '../../lib/notifications';
import { activeGoals, dayKey, pottyAdvice, socializationPicks, tipOfDay, todayLessons } from '../../lib/plan';
import { parseTime, pottyStatus } from '../../lib/schedule';
import { colors, radius, space } from '../../lib/theme';
import { usePlan, type PlanState } from '../../lib/use-plan';

function startOfToday() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const UNDO_MS = 8000;

export default function Hoy() {
  const db = useSQLiteContext();
  const { dog } = useDog();
  const { state: plan, reload: reloadPlan } = usePlan(dog);
  const [logs, setLogs] = useState<PottyLog[]>([]);
  const [lastLog, setLastLog] = useState<PottyLog | null>(null);
  const [pottyReminder, setPottyReminder] = useState<Reminder | null>(null);
  const [now, setNow] = useState(() => new Date());
  // Último toque, para poder deshacerlo durante unos segundos.
  const [undo, setUndo] = useState<{ id: string; label: string } | null>(null);

  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);

  const load = useCallback(async () => {
    if (!dog) return;
    const [today, last, reminders] = await Promise.all([
      getPottyLogsSince(db, dog.id, startOfToday()),
      getLastPottyLog(db, dog.id),
      getReminders(db, dog.id),
    ]);
    setLogs(today);
    setLastLog(last);
    setPottyReminder(reminders.find((r) => r.interval_min != null) ?? null);
    setNow(new Date());
  }, [db, dog]);

  useFocusEffect(
    useCallback(() => {
      load();
      // Refrescar la cuenta regresiva mientras la pantalla está visible.
      const timer = setInterval(() => setNow(new Date()), 30_000);
      return () => clearInterval(timer);
    }, [load]),
  );

  if (!dog || !plan) return null;

  const stage = stageForWeeks(plan.profile.weeks);
  const t = (text: string) => personalize(text, dog.name);
  const lessons = todayLessons(plan.profile, plan.progress, CONTENT, now);
  const tip = tipOfDay(plan.profile, CONTENT, now);
  const outside = logs.filter((l) => l.place === 'fuera').length;
  const inside = logs.filter((l) => l.place === 'dentro').length;

  async function log(kind: PottyKind, place: PottyPlace) {
    if (!dog) return;
    const id = await addPottyLog(db, dog.id, kind, place);
    setUndo({ id, label: pottyLabel({ kind, place }) });
    await load();
    await syncReminders(db); // la próxima salida se cuenta desde este registro
  }

  async function remove(id: string) {
    setUndo(null);
    await deletePottyLog(db, id);
    await load();
    await syncReminders(db);
  }

  async function toggleItem(itemId: string, done: boolean) {
    if (!dog) return;
    await setItemDone(db, dog.id, itemId, done);
    await reloadPlan();
  }

  if (plan.profile.preArrival) {
    const arrival = parseISODate(dog.arrival_date!)!;
    const daysLeft = Math.round((arrival.getTime() - parseISODate(dayKey(now))!.getTime()) / (24 * 60 * 60 * 1000));
    return (
      <Screen title={`Preparando todo para ${dog.name}`}>
        <Card style={styles.hero}>
          <Spots />
          <Mascot size={92} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.age}>{daysLeft === 1 ? '¡Llega mañana!' : `Faltan ${daysLeft} días`}</Text>
            <Muted>Mientras tanto, dejemos la casa lista.</Muted>
            <SwitchDog />
          </View>
        </Card>
        <PrepChecklist plan={plan} onToggle={toggleItem} />
        <LessonList title="Para leer antes de que llegue" lessons={lessons} plan={plan} now={now} />
        {tip ? <TipCard text={t(tip.text)} /> : null}
      </Screen>
    );
  }

  const advice = pottyAdvice(inside, outside, pottyReminder?.enabled ? pottyReminder.interval_min : null);
  const socialActive = activeGoals(plan.profile, CONTENT.goals).some((a) => a.goal.id === 'socializacion');

  async function applyInterval(minutes: number) {
    if (!pottyReminder) return;
    await updateReminder(db, pottyReminder.id, { interval_min: minutes });
    await load();
    await syncReminders(db);
  }

  async function socialGood(itemId: string) {
    if (!dog) return;
    await addSocializationLog(db, dog.id, itemId, 'bien');
    await reloadPlan();
  }

  return (
    <Screen title={`Hoy con ${dog.name}`}>
      <Card style={styles.hero}>
        <Spots />
        <Mascot size={92} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.age}>{ageLabel(dog.birth_date)}</Text>
          <Muted>
            Etapa {stage.number} · {stage.name}
          </Muted>
          <SwitchDog />
        </View>
      </Card>

      <NextOuting reminder={pottyReminder} lastLog={lastLog} now={now} />

      <Card>
        <H2>Baño</H2>
        <View style={styles.row}>
          <Stat value={outside} label="afuera" color={colors.success} />
          <Stat value={inside} label="accidentes" color={colors.accent} />
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Button label="💧 Pipí afuera" variant="green" onPress={() => log('pipi', 'fuera')} big />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="💩 Popó afuera" variant="green" onPress={() => log('popo', 'fuera')} big />
          </View>
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Button label="Pipí adentro" variant="secondary" onPress={() => log('pipi', 'dentro')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Popó adentro" variant="secondary" onPress={() => log('popo', 'dentro')} />
          </View>
        </View>
        {undo ? (
          <View style={styles.undo}>
            <Text style={styles.undoText}>{undo.label} registrado</Text>
            <Pressable onPress={() => remove(undo.id)} hitSlop={10} accessibilityRole="button">
              <Text style={styles.undoAction}>Deshacer</Text>
            </Pressable>
          </View>
        ) : null}
        {logs.length === 0 ? (
          <Muted>Todavía no hay registros hoy.</Muted>
        ) : (
          <View>
            {logs.map((l) => (
              <PottyRow key={l.id} log={l} onDelete={(x) => remove(x.id)} />
            ))}
          </View>
        )}
        {inside > 0 ? <Muted>Los accidentes son normales a esta edad. Limpiá con limpiador enzimático y seguí con la rutina.</Muted> : null}
        {advice ? (
          <View style={styles.advice}>
            <Text style={styles.adviceText}>🧠 {advice.text}</Text>
            {advice.suggestInterval ? (
              <Button label={`Avisarme cada ${advice.suggestInterval} min`} variant="secondary" onPress={() => applyInterval(advice.suggestInterval!)} />
            ) : null}
          </View>
        ) : null}
      </Card>

      <LessonList title="Lecciones de hoy" lessons={lessons} plan={plan} now={now} />

      {socialActive ? (
        <Card>
          <H2>🌎 Socialización de hoy</H2>
          <Muted>Probá con calma y premios. Si le fue bien, tocá 😀.</Muted>
          {socializationPicks(CONTENT.socialization, plan.socialCovered, now).map((item) => (
            <View key={item.id} style={styles.socialRow}>
              <Text style={styles.socialText}>{item.text}</Text>
              <Pressable onPress={() => socialGood(item.id)} hitSlop={8} style={styles.socialButton} accessibilityLabel="Le fue bien">
                <Text style={styles.socialButtonText}>😀</Text>
              </Pressable>
            </View>
          ))}
          <Pressable onPress={() => router.push('/socializacion')} hitSlop={8}>
            <Text style={styles.link}>
              Ver lista completa ({plan.socialCovered.size}/{CONTENT.socialization.length}) ›
            </Text>
          </Pressable>
        </Card>
      ) : null}

      {tip ? <TipCard text={t(tip.text)} /> : null}
    </Screen>
  );
}

/** Enlace para cambiar de mascota o registrar otra. */
function SwitchDog() {
  return (
    <Pressable onPress={() => router.push('/mascotas')} hitSlop={8} style={styles.switchDog} accessibilityRole="button">
      <Text style={styles.switchDogText}>Cambiar mascota ▾</Text>
    </Pressable>
  );
}

function LessonList({ title, lessons, plan, now }: { title: string; lessons: Lesson[]; plan: PlanState; now: Date }) {
  const today = dayKey(now);
  return (
    <Card>
      <H2>{title}</H2>
      {lessons.length === 0 ? <Muted>¡Todo al día! Repasá lo logrado o explorá otros enfoques en Aprender.</Muted> : null}
      {lessons.map((l) => {
        const goal = goalById(l.goal);
        const last = plan.progress.lastPracticed.get(l.id);
        const doneToday = last != null && dayKey(new Date(last)) === today;
        return (
          <Pressable key={l.id} onPress={() => router.push(`/leccion/${l.id}`)} style={styles.lesson}>
            <Text style={styles.lessonEmoji}>{goal?.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.lessonTitle}>{l.title}</Text>
              <Text style={styles.lessonMeta}>
                {l.kind === 'guia' ? 'Guía para leer' : '5 minutos'} · {goal?.name}
                {doneToday ? ' · ✓ hecha hoy' : ''}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        );
      })}
    </Card>
  );
}

function PrepChecklist({ plan, onToggle }: { plan: PlanState; onToggle: (id: string, done: boolean) => void }) {
  const done = CONTENT.prep.filter((i) => plan.done.has(i.id)).length;
  const groups = new Map<string, typeof CONTENT.prep>();
  for (const item of CONTENT.prep) groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
  return (
    <Card>
      <View style={styles.prepHeader}>
        <H2>📋 Lista de preparación</H2>
        <Text style={styles.prepCount}>
          {done}/{CONTENT.prep.length}
        </Text>
      </View>
      <ProgressBar value={done} max={CONTENT.prep.length} />
      {[...groups.entries()].map(([group, items]) => (
        <View key={group}>
          <Text style={styles.prepGroup}>{group}</Text>
          {items.map((item) => (
            <CheckRow key={item.id} checked={plan.done.has(item.id)} label={item.text} onPress={() => onToggle(item.id, !plan.done.has(item.id))} />
          ))}
        </View>
      ))}
    </Card>
  );
}

function TipCard({ text }: { text: string }) {
  return (
    <Card style={styles.tip}>
      <Text style={styles.tipTitle}>💡 Tip del día</Text>
      <Text style={styles.tipText}>{text}</Text>
    </Card>
  );
}

function NextOuting({ reminder, lastLog, now }: { reminder: Reminder | null; lastLog: PottyLog | null; now: Date }) {
  if (!reminder?.enabled || !reminder.interval_min) {
    return (
      <Pressable onPress={() => router.push('/recordatorios')}>
        <Card>
          <Muted>🔔 Activá el recordatorio de baño para que Dachsi te avise cuándo salir.</Muted>
        </Card>
      </Pressable>
    );
  }
  const quietEnd = parseTime(reminder.quiet_end);
  const { overdue, quiet, next } = pottyStatus({
    lastLog: lastLog ? new Date(lastLog.logged_at) : null,
    now,
    intervalMin: reminder.interval_min,
    quietStart: parseTime(reminder.quiet_start),
    quietEnd,
  });
  const clock = (d: Date) => d.toLocaleTimeString('es-CR', { hour: 'numeric', minute: '2-digit' });
  const inMin = next ? Math.max(0, Math.round((next.getTime() - now.getTime()) / 60000)) : null;

  let title: string;
  let detail: string;
  if (quiet) {
    title = '🌙 Silencio de noche';
    detail = `Avisos de nuevo a las ${reminder.quiet_end}.`;
  } else if (overdue) {
    title = '🚪 ¡Ya toca salir!';
    detail = 'Registrá la salida y el reloj vuelve a empezar.';
  } else {
    title = next ? `Próxima salida: ${clock(next)}` : 'Sin próxima salida';
    detail = inMin != null ? (inMin < 1 ? 'Ahora' : `En ${inMin < 60 ? `${inMin} min` : `${Math.floor(inMin / 60)} h ${inMin % 60} min`}`) : '';
  }

  return (
    <Card style={overdue ? styles.overdue : undefined}>
      <Text style={styles.nextTitle}>{title}</Text>
      <Muted>{detail}</Muted>
    </Card>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={[styles.stat, { borderColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.accentSoft, borderColor: colors.accentSoft, overflow: 'hidden' },
  switchDog: { alignSelf: 'flex-start', marginTop: space.xs },
  switchDogText: { fontSize: 14, fontWeight: '700', color: colors.accent },
  age: { fontSize: 20, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', gap: space.sm },
  undo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 12,
  },
  undoText: { color: colors.text, fontSize: 15, flex: 1 },
  undoAction: { color: colors.accent, fontSize: 15, fontWeight: '800' },
  overdue: { backgroundColor: colors.accentSoft, borderColor: colors.accent, borderWidth: 2 },
  nextTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  advice: { gap: space.sm, backgroundColor: colors.accentSoft, borderRadius: radius.sm, padding: space.md },
  adviceText: { fontSize: 15, color: colors.text, lineHeight: 21 },
  lesson: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  lessonEmoji: { fontSize: 26 },
  lessonTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  lessonMeta: { fontSize: 14, color: colors.textMuted },
  chevron: { fontSize: 24, color: colors.textMuted },
  socialRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 6 },
  socialText: { flex: 1, fontSize: 16, color: colors.text },
  socialButton: { backgroundColor: colors.successSoft, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 8 },
  socialButtonText: { fontSize: 20 },
  link: { fontSize: 15, fontWeight: '700', color: colors.accent },
  prepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  prepCount: { fontSize: 16, fontWeight: '700', color: colors.success },
  prepGroup: { fontSize: 14, fontWeight: '700', color: colors.textMuted, marginTop: space.sm, textTransform: 'uppercase' },
  tip: { backgroundColor: colors.successSoft, borderColor: colors.success },
  tipTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  tipText: { fontSize: 16, color: colors.text, lineHeight: 23 },
  stat: { flex: 1, borderWidth: 2, borderRadius: radius.sm, paddingVertical: space.sm, alignItems: 'center' },
  statValue: { fontSize: 26, fontWeight: '800' },
  statLabel: { fontSize: 13, color: colors.textMuted },
});
