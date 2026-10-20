// Aviso de "hubo un cambio local": la base de datos lo emite y la sincronización lo escucha.
type Listener = () => void;
const listeners = new Set<Listener>();

export function onLocalChange(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitLocalChange() {
  for (const l of listeners) l();
}
