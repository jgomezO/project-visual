# 06 · Preguntas frecuentes

Las preguntas están ordenadas por frecuencia y urgencia: las más comunes primero, los casos límite al final. Si tu pregunta no aparece acá, escribí a [completar con canal de soporte].

<!-- TODO: definir canal de Slack o persona de contacto cuando se establezca -->

## ¿Cuándo se actualizan los datos desde Jira?

Hay un [sync](01-introduccion.md#glosario-sync) automático todos los días a las **06:00 UTC** (aproximadamente 01:00 hora Colombia, 03:00 hora Argentina). Es decir, cuando empezás tu jornada, ya tenés los datos de la mañana procesados.

Si necesitás los datos del último minuto, hay un botón **Resincronizar** en el header de `/projects` que dispara un sync manual. Toma típicamente 20-40 segundos. Más detalle en [02 · Empezar](02-empezar.md#resincronizar-manualmente).

## El sync falló — ¿qué hago?

Si en `/projects` ves un chip de aviso debajo del título principal con "Sync parcial · N proyecto(s) falló" o "Sync falló", click en el chip para ver el detalle de qué proyectos fallaron y con qué error.

Casi siempre la solución es **reintentar**: click en "Resincronizar". Los fallos transitorios (Jira lento, una request que se cortó) se resuelven en el siguiente intento.

Si el mismo proyecto falla repetidamente, posiblemente haya cambiado algo en Jira (un proyecto archivado, permisos modificados, custom fields removidos) que requiere intervención del equipo de Prism. Reportá a [completar con canal de soporte].

## Mi narrativa no aparece en la vista pública

Tres causas típicas, en orden de probabilidad:

1. **El link no es el correcto.** La URL de la vista pública tiene el formato `/projects/[key]/narratives/[id]/preview` — fijate que tenga `/preview` al final. Si te lleva a `/edit`, es la URL del editor, no de la pública.
2. **La persona que abrió el link no está logueada en Prism.** Hoy la vista pública requiere cuenta `@veevart.com`. Más detalle en la pregunta sobre compartir externamente.
3. **No es un problema — la narrativa está en estado [borrador](01-introduccion.md#glosario-borrador-publicada).** Las narrativas borrador se ven igual pero con un banner ámbar arriba avisando "Borrador, no listo para compartir". Si querés que ese banner desaparezca, click en "Publicar" en el header del editor.

## ¿Qué pasa si una issue se borra en Jira?

Prism la detecta automáticamente en el siguiente sync exitoso del proyecto y la marca como [issue borrada](01-introduccion.md#glosario-issue-borrada). La issue **no se elimina** de la base de datos de Prism: queda visible con un cue visual (gris, summary tachado, icono de papelera) en varios lugares:

- En la tab Lista del proyecto (oculta por default, visible con el toggle "Mostrar borradas").
- En el Roadmap nunca se muestra — el roadmap es para planificación, no para histórico.
- En cualquier narrativa que la haya vinculado: el chip en el [workstream](01-introduccion.md#glosario-workstream) o en el provider de la [dependencia](01-introduccion.md#glosario-dependencia) cambia a la versión borrada con su tooltip de fecha.
- En el autocomplete de issues del editor, las borradas **nunca** sugieren — no podés vincular accidentalmente a una issue que ya no existe en Jira.

Los KPIs y contadores de progreso del proyecto **no las cuentan**: si tenías 100 issues y borraron una, "Total: 99". Lo mismo para los progresos derivados (workstream, fase, global).

Si alguien restaura la issue en Jira (deshacer el delete), Prism la "resucita" automáticamente en el siguiente sync — el `deleted_at` se limpia y vuelve a aparecer como activa. No hace falta intervención manual.

## No veo el toggle "Mostrar borradas" en la tab Lista

El toggle aparece **solo si el proyecto tiene al menos una issue borrada**. Si tu proyecto nunca tuvo deletions detectadas, el filtro queda oculto para no saturar la barra con una affordance sin uso. En cuanto el sync detecte la primera borrada, el toggle aparece automáticamente.

## ¿Puedo compartir una narrativa con alguien que no tiene cuenta de Prism?

Hoy **no directamente**. La [vista pública](01-introduccion.md#glosario-vista-publica) requiere login con cuenta `@veevart.com` que tenga acceso a Jira. Si compartís la URL con un cliente externo o un partner, se topa con la pantalla de login y no puede entrar.

Las opciones disponibles para audiencia externa:

1. **Exportar a PDF** con Cmd+P / Ctrl+P → "Guardar como PDF" desde la vista pública y mandar el PDF.
2. **Screen-share en reunión en vivo**, idealmente en [presentation mode](01-introduccion.md#glosario-presentation-mode).
3. **Screenshot** de la sección puntual.

Los tokenized share links (URLs públicas con token, sin login) están en el roadmap pero no implementados. Más detalle en [04 · La vista pública](04-vista-publica.md#quien-puede-ver).

## ¿Puedo deshacer un cambio?

**No.** Prism no tiene undo. Lo que escribiste queda escrito, lo que borraste se va para siempre. Esto vale especialmente para:

- Borrar una fase / workstream / dependencia / riesgo: irreversible.
- Borrar una narrativa entera: irreversible.
- Reemplazar texto en un campo con AI assist: el original se pierde si elegís "Usar versión refinada" y no copiaste antes.

Si vas a hacer un cambio grande y no estás seguro, una buena práctica es **duplicar la narrativa** primero (menú de tres puntos en la tarjeta de la narrativa, opción "Duplicar"), trabajar sobre la copia y dejar el original como backup. Cuando te quedes con la versión definitiva, eliminás la otra.

## ¿Quién puede editar una narrativa?

Hoy **cualquier usuario logueado** de Prism puede editar cualquier narrativa de cualquier proyecto. No hay permisos por usuario, por proyecto o por rol todavía. La gobernanza pasa por la comunicación dentro del equipo, no por el sistema.

Permisos granulares (por proyecto, por rol PM/lectura, equipo dueño) están en el roadmap pero no implementados.

## ¿Funciona en mobile?

**La vista pública: sí.** El layout es responsive y se lee bien en pantallas chicas. El [presentation mode](01-introduccion.md#glosario-presentation-mode) no está pensado para mobile pero la vista normal sí.

**El editor de narrativas: no.** En mobile / tablet vertical te aparece un mensaje "Editor disponible en pantallas más anchas" y no carga la UI. Es una decisión deliberada — el editor tiene un sidebar + panel central que no funciona bien en menos de ~768px de ancho. Si necesitás editar en movilidad, abrí el navegador en orientación horizontal (tablet apaisada) o usá un laptop.

## ¿Cómo reporto un bug o pido una feature?

Escribí a [completar con canal de soporte] con:

- Qué intentabas hacer.
- Qué esperabas que pasara.
- Qué pasó en realidad.
- La URL en la que estabas cuando ocurrió (especialmente útil si tiene parámetros como `?from=...&to=...`).
- Un screenshot si es visual.

Para features nuevas, lo mismo: qué problema querés resolver, cómo lo resolvés hoy y qué se te ocurre que ayudaría. Cuanto más concreto el caso de uso, mejor.
