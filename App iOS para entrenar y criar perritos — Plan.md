# Dachsi — Plan de la app

Oct 19, 2026 · @Daniel

## Visión y propuesta de valor

Una app iOS que le dice al dueño de un cachorro qué entrenar hoy, según la edad exacta de su perro y su raza, en sesiones de 5 minutos. El primer usuario y caso de prueba es una salchicha (dachshund) que llega a casa pronto.

**El problema.** Las primeras 16 semanas definen mucho del carácter del perro, pero el dueño primerizo recibe consejos sueltos de YouTube, foros y familiares, sin orden ni seguimiento. No sabe qué es urgente (socialización) y qué puede esperar (trucos).

**Usuario objetivo.**

- Primario: dueño primerizo con cachorro de 8 a 24 semanas, ocupado, que quiere hacerlo bien desde el inicio.
- Secundario: familias donde varias personas entrenan al mismo perro y necesitan usar las mismas señales.

**Diferenciadores.**

- Plan por edad en semanas, no un catálogo de lecciones: la app abre en "lo de hoy".
- Notas por raza: empezar con salchicha (espalda, terquedad, ladrido) y sumar razas después.
- Rutina y crianza en el mismo lugar: horario de idas al baño, comidas, siestas, vacunas y entrenamiento.
- Hogar compartido: toda la familia ve el progreso y las palabras de señal acordadas.
- Bilingüe español/inglés desde el día uno, con contenido pensado para Latinoamérica.

## Nombres para la app

Decidido: **Dachsi**. Arranca enfocada en salchichas, que es su mejor gancho; si luego se suman otras razas, Dachsi queda como marca y las razas nuevas entran como "packs". Antes de publicar hay que revisar disponibilidad en App Store, dominio y redes. Las demás opciones quedan como referencia.

| Nombre | Idea | Pros | Contras |
| --- | --- | --- | --- |
| Pawso | paw + paso | Bilingüe, memorable, sugiere progreso | Hay que verificar que no exista |
| Cachorrito | Directo en español | Claro para el público latino | Difícil de pronunciar en inglés |
| PupPath | El camino del cachorro | Claro en inglés, transmite "plan" | Genérico, posible competencia |
| Huellita | Huella pequeña | Tierno, muy latino | Poco descriptivo de "entrenar" |
| Semana Perruna | Plan por semanas | Explica el concepto central | Largo para ícono de app |
| Sit & Grow | Entrenar y crecer | Une entrenamiento y crianza | Solo funciona en inglés |
| Dachsi | Diminutivo de dachshund | Perfecto si la app arranca solo con salchichas | Limita la expansión a otras razas |

**Mascota y niveles (decidido):** la guía de la app es **Churro**, una salchicha ilustrada y animada que celebra logros, explica lecciones y acompaña los recordatorios. Los niveles de progreso son:

| Nivel | Se alcanza cuando... |
| --- | --- |
| Semilla | Perfil creado y primera lección completada |
| Brote | Etapa 1 completa (baño en rutina, responde a su nombre) |
| Explorador | Checklist de socialización mayormente cubierto y etapa 2 completa |
| Graduado | Etapas 3 a 5 completas: sentado, echado, quieto, ven y caminar con correa |

Cada subida de nivel muestra una animación de Churro y guarda una foto del cachorro en su línea de tiempo.

### Y para la cachorra

Para entrenar funcionan mejor los nombres de 2 sílabas que no suenen como una orden (evitar "Neo" por "no" o "Kit" por "sit").

- Dulces: Canela, Galleta, Mochi, Churrita, Nutella, Almendra
- Ticos: Pipa, Chiqui, Mora, Tica, Guaria
- Con humor de salchicha: Frankie, Wiener, Brisket, Pretzel, Tostada
- Clásicos: Lola, Luna, Frida, Nina, Greta

## Funcionalidades

El MVP cubre lo que necesitas las primeras 8 semanas con tu salchicha: plan diario, registro del baño y recordatorios. Todo lo demás espera a validar que lo usas a diario.

| Funcionalidad | Qué hace | Fase |
| --- | --- | --- |
| Perfil del cachorro | Nombre, raza, fecha de nacimiento, foto, peso | MVP |
| Hoy | 2-3 lecciones de 5 min según la edad en semanas | MVP |
| Lecciones | Pasos, video o animación corta, errores comunes, criterio de "logrado" | MVP |
| Registro de baño | Un toque para marcar pipí/popó dentro o fuera; muestra patrones | MVP |
| Recordatorios | Salidas al baño, comidas, siestas, sesiones | MVP |
| Checklist de socialización | Personas, sonidos, superficies, lugares, manipulación | MVP |
| Progreso | Racha diaria, habilidades logradas, línea de tiempo con fotos | MVP |
| Salud | Vacunas, desparasitación, peso, citas al veterinario | Fase 2 |
| Clicker integrado | Sonido de clicker y temporizador de sesión | Fase 2 |
| Widget y Live Activity | "Próxima salida al baño en 12 min" en pantalla de bloqueo | Fase 2 |
| Hogar compartido | Varias personas, mismas señales, registro común | Fase 2 |
| Apple Watch | Marcar baño y clicker desde la muñeca | Fase 3 |
| Más razas | Notas específicas por raza | Fase 3 |
| Coach con IA | Preguntas libres ("muerde los cables") respondidas con base en el contenido de la app | Fase 3 |
| Comunidad | Compartir hitos y fotos | Fase 3 |

## Plan de contenido

El contenido se organiza en 5 etapas por edad, con la socialización como prioridad hasta las 16 semanas, porque es la ventana que no se recupera después. Todo usa refuerzo positivo: premio, juego o elogio; nada de castigo físico ni gritos.

### Currículo por etapa

| Etapa | Edad | Prioridades | Habilidades |
| --- | --- | --- | --- |
| 1. Llegada | 8-10 semanas | Rutina, confianza, baño, dormir en su espacio | Responder a su nombre, ir al lugar del baño, guacal o corral como sitio seguro, aceptar que la toquen |
| 2. Socialización intensa | 10-14 semanas | Exponer con calma a personas, sonidos, superficies, autos, otros perros vacunados | Sentado, mirarme, inhibición de mordida, soltar juguete, collar y arnés |
| 3. Bases | 14-18 semanas | Cerrar la ventana de socialización, primeros paseos tras vacunas | Echado, quieto corto, ven (llamada), caminar sin jalar, dejarlo |
| 4. Adolescencia temprana | 4-6 meses | Constancia: es cuando "olvidan" todo | Quieto con distracciones, llamada en parque cercado, esperar en puertas, calma en casa |
| 5. Adolescencia | 6-12 meses | Reforzar sin retroceder, manejar ladrido y caza | Repaso con distracciones, trucos de enriquecimiento, olfato, buenos modales con visitas |

Las fechas de vacunas y de primeras salidas a la calle las define el veterinario; la app solo recuerda lo que el dueño registre.

### Formato de cada lección

1. Para qué sirve, en una frase.
2. Qué necesitas (premios pequeños, clicker, correa).
3. Pasos, de 3 a 6, cada uno con su criterio para avanzar.
4. Errores comunes.
5. "Logrado cuando...": por ejemplo, 8 de 10 repeticiones en dos lugares distintos.

### Notas específicas para salchichas

- **Espalda:** evitar saltos desde sillones y camas y escaleras frecuentes; usar rampas y cargarla sosteniendo pecho y cadera. Mantener el peso ideal.
- **Baño:** tienen fama de ser de las razas más difíciles de enseñar; la app debe insistir en horarios fijos, salir después de comer, dormir y jugar, y premiar en el momento.
- **Terquedad e independencia:** sesiones muy cortas, premios de alto valor, convertir todo en juego.
- **Ladrido y caza:** fueron criadas para cazar tejones; enseñar "silencio" y dar salidas al instinto con juegos de olfato y escarbar.
- **Apego:** practicar desde temprano ratos cortos a solas para prevenir ansiedad por separación.

### Biblioteca de crianza (artículos cortos)

- Preparar la casa antes de la llegada
- Primera noche y el llanto
- Mordisqueo y dentición
- Qué hacer con accidentes dentro de casa
- Juego adecuado con niños
- Señales de estrés en cachorros
- Cuándo llamar al veterinario

Todo el contenido debe revisarlo un entrenador certificado antes de publicar.

## Arquitectura técnica (Expo)

App en Expo (React Native + TypeScript), programada desde Windows y probada en el iPhone con Expo Go, sin pagar la cuenta de Apple por ahora. Sin servidor propio en el MVP: los datos viven en el iPhone con SQLite y el contenido va incluido en la app. Cuando se pague la cuenta de Apple, el mismo código se compila como app propia con EAS Build en la nube, sin Mac.

&#91;embedded content: arquitectura de la app · 7 componentes\]

La app solo le pregunta al motor del plan qué toca hoy; el motor combina la edad y raza del perro con el contenido y lo registrado.

**Stack**

- UI: Expo SDK más reciente, Expo Router (pestañas por archivos), TypeScript.
- Persistencia: `expo-sqlite` local, con exportar/importar JSON para no perder el historial al pasar de Expo Go a app propia.
- Recordatorios: `expo-notifications` con notificaciones locales (funcionan en Expo Go).
- Fotos, clicker y vibración: `expo-image-picker`, `expo-audio`, `expo-haptics`.
- Churro animado: Lottie o Reanimated (Rive requiere app propia).
- Widgets y Live Activities (Fase 2): requieren app propia vía EAS Build y la cuenta de Apple.
- Contenido: archivos JSON versionados en el repositorio, editables sin tocar código.
- Coach con IA (Fase 3): llamada a un modelo de lenguaje desde una función serverless, con las lecciones como contexto.

**Modelo de datos**

| Entidad | Campos clave |
| --- | --- |
| Dog | nombre, raza, fecha de nacimiento, foto, peso |
| Lesson | id, etapa, edad mínima/máxima en semanas, pasos, criterio de logrado |
| SessionLog | perro, lección, fecha, repeticiones, éxito de 1 a 5, nota |
| PottyLog | perro, fecha/hora, tipo (pipí/popó), dentro o fuera |
| SocializationItem | categoría, descripción, fecha de exposición, reacción |
| Reminder | tipo, hora o intervalo, activo |
| HealthEvent (Fase 2) | tipo (vacuna, desparasitación, cita), fecha, nota |

## Plan de desarrollo

La cachorra llega el domingo 25 de octubre, así que el MVP personal se comprime a un sprint de 6 días (lunes 19 a sábado 24) con solo lo que se usa desde la primera hora: perfil, registro de baño, recordatorios, pantalla Hoy con la etapa 1 y socialización. Progreso con fotos, Churro animado y los niveles pasan a las dos primeras semanas con ella.

&#91;embedded content: hoja de ruta · 4 fases, 3 compuertas\]

Cada compuerta se cruza solo cuando se cumple lo indicado debajo. Si un día se atrasa, lo primero que se recorta es la socialización (puede vivir unos días en una nota) y nunca el registro de baño ni los recordatorios.

**Sprint de llegada, día por día**

1. **Lunes 19:** proyecto Expo con TypeScript y Expo Router, base SQLite (perros, registros de baño, recordatorios), onboarding y perfil del cachorro, 4 pestañas.
2. **Martes 20:** registro de baño de un toque (pipí/popó, dentro/fuera) con historial del día.
3. **Miércoles 21:** recordatorios locales: salida al baño cada X minutos, comidas y siestas, editables.
4. **Jueves 22:** motor del plan y pantalla Hoy; escribir 5-6 lecciones de la etapa 1 en JSON (nombre, baño, guacal, manipulación, primera noche).
5. **Viernes 23:** checklist de socialización, ícono de la app y Churro como ilustración fija.
6. **Sábado 24:** probar un día simulado en Expo Go, cargar el perfil de la cachorra y ajustar horarios.
7. **Domingo 25:** llega la cachorra; Dachsi empieza a registrar desde la primera salida al baño.

**Prácticas**

- Expo Go sin pagar: desactivar la actualización automática de Expo Go mientras dure el MVP, porque solo soporta el SDK más reciente. La cuenta de Apple ($99/año) se paga cuando haga falta app propia, widgets o TestFlight.
- Pruebas unitarias del motor del plan (es la lógica más crítica).
- Usar la app cada día con la cachorra y anotar fricciones; eso define las dos semanas siguientes.

## Diseño, UX y tono

La app debe usarse con una mano mientras la otra sostiene premios o la correa: botones grandes, acciones de un toque y nada de formularios largos.

**Navegación (4 pestañas):** Hoy · Aprender · Registro · Perfil.

**Principios de UX**

- Hoy primero: al abrir se ve lo que toca y la próxima salida al baño.
- Un toque para registrar: pipí, popó, comida, siesta.
- Temporizador visible en cada sesión, con cierre a los 5 minutos para no agotar al cachorro.
- Celebrar avances con fotos y una línea de tiempo, no con puntos ni presión.
- Modo oscuro y textos dinámicos (Dynamic Type) desde el inicio.

**Tono de marca:** cálido, práctico y sin culpas. "Hoy hubo dos accidentes, es normal a esta edad" en vez de "Fallaste". Frases cortas, tuteo en español.

**Estilo visual:** colores cálidos (caramelo, crema, verde suave), ilustraciones planas de Churro, tipografía redondeada. Para el domingo, Churro va como ilustración fija; la versión animada (con Lottie o Reanimated) llega en las dos semanas siguientes. El onboarding pide nombre, fecha de nacimiento, raza y foto, y muestra el plan de la primera semana en menos de un minuto.

## Monetización y lanzamiento

Primero se construye para tu salchicha; la monetización se decide cuando el MVP pase 8 semanas de uso real.

**Modelo sugerido: freemium.**

- Gratis: etapa 1 completa, registro de baño y recordatorios.
- Premium (suscripción mensual o anual, o pago único de por vida): todas las etapas, hogar compartido, salud, widgets y coach con IA.
- Usar StoreKit 2; precios a validar con usuarios de prueba.

**Camino al App Store**

1. Cuenta de Apple Developer Program (pago anual) y app propia con EAS Build.
2. TestFlight con 10-20 dueños de cachorros: grupos de Facebook de salchichas en Costa Rica, veterinarias y criadores.
3. Política de privacidad y etiquetas de privacidad del App Store.
4. Ficha en español e inglés, capturas con la salchicha real como protagonista.
5. Lanzamiento suave en Costa Rica y Latinoamérica, luego EE. UU.

**Crecimiento:** contenido en Instagram y TikTok mostrando el progreso real de tu cachorra semana a semana; alianzas con veterinarias y criadores para recomendar la app al entregar cachorros.

## Riesgos y próximos pasos

El riesgo mayor es el tiempo: la cachorra llega antes de que la app esté lista, así que el plan arranca con el contenido y el registro de baño, que sirven desde el primer día.

| Riesgo | Mitigación |
| --- | --- |
| La cachorra llega antes del MVP | Empezar por contenido en notas y una versión mínima en TestFlight personal |
| Consejos incorrectos o desactualizados | Revisión por entrenador certificado; citar fuentes; evitar cualquier consejo médico |
| Parecer consejo veterinario | Aviso claro: la app no reemplaza al veterinario; salud solo como registro y recordatorio |
| Mercado con apps establecidas | Diferenciarse por raza, idioma español y hogar compartido |
| Alcance que crece sin control | MVP cerrado; nuevas ideas van a una lista para Fase 2 |
| Producir videos toma mucho tiempo | Empezar con ilustraciones y fotos propias; videos con tu salchicha más adelante |

**Próximos pasos**

- [x] Elegir nombre de la app: Dachsi
- [ ] Verificar disponibilidad de Dachsi en App Store, dominio y redes
- [ ] Escribir las lecciones de la etapa 1 (8-10 semanas)
- [ ] Completar el sprint de llegada antes del sábado 24
- [ ] Buscar entrenador que revise el contenido
- [ ] Elegir el nombre de la cachorra
