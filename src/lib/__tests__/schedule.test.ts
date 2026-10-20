import { isQuiet, parseTime, pottySlots, pottyStatus } from '../schedule';

const QS = parseTime('22:00');
const QE = parseTime('06:00');
const at = (h: number, m = 0, day = 20) => new Date(2026, 9, day, h, m);

describe('recordatorios de baño', () => {
  it('cuenta desde el último registro y salta la noche con un aviso de buenos días', () => {
    const slots = pottySlots({ lastLog: at(19, 30), now: at(20), intervalMin: 60, quietStart: QS, quietEnd: QE, horizonMin: 14 * 60 });
    expect(slots.slice(0, 4).map((s) => [s.at.getDate(), s.at.getHours(), s.at.getMinutes(), s.kind])).toEqual([
      [20, 20, 30, 'interval'],
      [20, 21, 30, 'interval'],
      [21, 6, 0, 'morning'],
      [21, 7, 0, 'interval'],
    ]);
  });

  it('nunca pasa de 40 avisos', () => {
    expect(pottySlots({ lastLog: null, now: at(8), intervalMin: 15, quietStart: QS, quietEnd: QE })).toHaveLength(40);
  });

  it('detecta cuando ya toca salir', () => {
    const s = pottyStatus({ lastLog: at(10), now: at(12, 15), intervalMin: 60, quietStart: QS, quietEnd: QE });
    expect(s.overdue).toBe(true);
    expect(s.next?.getHours()).toBe(13);
  });

  it('de noche no marca "toca salir"', () => {
    const s = pottyStatus({ lastLog: at(21), now: at(23, 30), intervalMin: 60, quietStart: QS, quietEnd: QE });
    expect(s).toMatchObject({ overdue: false, quiet: true });
  });

  it('silencio que cruza la medianoche', () => {
    expect(isQuiet(at(5, 59), QS, QE)).toBe(true);
    expect(isQuiet(at(6, 0), QS, QE)).toBe(false);
    expect(isQuiet(at(22, 0), QS, QE)).toBe(true);
  });

  it('valida horas', () => {
    expect(parseTime('7:05')).toBe(425);
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('abc')).toBeNull();
  });
});
