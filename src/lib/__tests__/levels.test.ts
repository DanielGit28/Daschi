import { CONTENT } from '../../content';
import { currentLevel, LEVELS, nextLevel, streak } from '../levels';

const progress = (ids: string[], socialCovered = 0) => ({ achieved: new Set(ids), socialCovered });

describe('niveles', () => {
  it('cada lección que piden los niveles existe', () => {
    const ids = new Set(CONTENT.lessons.map((l) => l.id));
    const asked = ['bano-rutina', 'caso-nombre', 'caso-mirarme', 'caso-sentado', 'mord-suave', 'caso-echado', 'caso-ven', 'correa-sin-jalar'];
    for (const id of asked) expect(ids).toContain(id);
    expect(LEVELS).toHaveLength(4);
  });

  it('sube en orden y no salta niveles', () => {
    expect(currentLevel(progress([]))).toBeNull();
    expect(currentLevel(progress(['prep-casa']))?.id).toBe('semilla');
    expect(currentLevel(progress(['bano-rutina', 'caso-nombre']))?.id).toBe('brote');
    // Tiene todo lo de Graduado pero no la socialización de Explorador: se queda en Brote.
    const graduadoSinSocial = ['bano-rutina', 'caso-nombre', 'caso-mirarme', 'caso-sentado', 'mord-suave', 'caso-echado', 'caso-ven', 'correa-sin-jalar'];
    expect(currentLevel(progress(graduadoSinSocial))?.id).toBe('brote');
    expect(currentLevel(progress(graduadoSinSocial, 20))?.id).toBe('graduado');
  });

  it('dice qué falta para el siguiente', () => {
    const next = nextLevel(progress(['bano-rutina']));
    expect(next?.level.id).toBe('brote');
    expect(next?.pending).toEqual(['Responder a su nombre']);
  });
});

describe('racha', () => {
  const now = new Date(2026, 9, 28, 20, 0);
  const at = (day: number) => new Date(2026, 9, day, 10).toISOString();

  it('cuenta días seguidos hasta hoy', () => {
    expect(streak([at(26), at(27), at(28), at(28)], now)).toBe(3);
  });

  it('si hoy todavía no practicó, cuenta hasta ayer', () => {
    expect(streak([at(26), at(27)], now)).toBe(2);
  });

  it('un día sin práctica corta la racha', () => {
    expect(streak([at(24), at(25), at(27)], now)).toBe(1);
    expect(streak([at(20)], now)).toBe(0);
  });
});
