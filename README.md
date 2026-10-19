# Dachsi 🌭

App para entrenar y criar cachorros, empezando por una salchicha. Expo (React Native + TypeScript), probada en iPhone con Expo Go.

## Correrla en Windows

1. Instalá **Node.js LTS** (nodejs.org) y **Git**.
2. En el iPhone, instalá **Expo Go** desde el App Store.
3. En esta carpeta:

   ```bash
   npm install
   npx expo start
   ```

4. Escaneá el QR con la cámara del iPhone. La PC y el iPhone tienen que estar en la misma red Wi-Fi.
   Si no conecta (firewall o red de oficina): `npx expo start --tunnel`.

Cada vez que guardás un archivo, la app se recarga sola en el teléfono.

## Comandos útiles

```bash
npx expo install <paquete>   # siempre en vez de npm install <paquete>
npm run typecheck            # revisar tipos
npx expo-doctor              # diagnosticar dependencias
```

## Estructura

```
src/
  app/                 rutas (Expo Router: cada archivo es una pantalla)
    _layout.tsx        SQLite + perfil del perro + navegación
    index.tsx          decide entre onboarding y "Hoy"
    onboarding.tsx     alta del cachorro
    (tabs)/            Hoy · Aprender · Registro · Perfil
  components/          UI reutilizable (botones, tarjetas, formulario)
  lib/
    db.ts              esquema SQLite, migraciones, consultas, exportar/importar
    age.ts             edad en semanas y etapa del plan
    theme.ts           colores y espaciados
```

## Estado del sprint de llegada

- [x] Lunes 19 — proyecto, base de datos, onboarding, perfil, 4 pestañas
- [ ] Martes 20 — registro de baño completo (ya hay botones rápidos en "Hoy" y la lista de 7 días)
- [ ] Miércoles 21 — recordatorios locales (ya están creados en la base, apagados)
- [ ] Jueves 22 — motor del plan y lecciones de la etapa 1
- [ ] Viernes 23 — checklist de socialización, ícono y Churro ilustrado
- [ ] Sábado 24 — día de prueba y perfil real de la cachorra

## Notas

- Expo Go solo soporta el SDK más reciente: desactivá la actualización automática de Expo Go mientras dure el MVP.
- Los datos viven dentro de Expo Go. Usá **Perfil → Exportar respaldo** de vez en cuando.
