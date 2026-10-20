@AGENTS.md

## Git

- No hagas commits ni push. El usuario revisa los cambios del código y hace los commits él mismo.
- Al terminar una tarea, dejá los cambios sin commitear y resumí qué archivos cambiaron.

## Pruebas

- Probá bien lo importante, pero sin exagerar: el usuario prefiere velocidad.
- Por defecto, al terminar: `npx tsc --noEmit` y `npx jest` (los tests existentes). Agregá tests nuevos solo para lógica crítica (motor del plan, sincronización, migraciones de base de datos).
- No hagas builds, exports, renders, servidores locales ni pruebas de punta a punta en cada cambio. Reservalos para cuando el cambio lo justifique (deploy, configuración de build, servidor) o el usuario lo pida.
