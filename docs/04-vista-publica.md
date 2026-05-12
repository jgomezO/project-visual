# 04 · La vista pública

La [vista pública](01-introduccion.md#glosario-vista-publica) es la cara presentable de una [narrativa](01-introduccion.md#glosario-narrativa): la URL que vos compartís con un [stakeholder](01-introduccion.md#glosario-stakeholder) y que él lee sin tener que entender Prism, Jira ni el editor.

## Para qué sirve

Tres usos típicos:

- **Compartir en un mail o un Slack.** Pegás la URL y el destinatario hace click. Si tiene cuenta de Prism, ve la narrativa en su versión presentable; si no, le pide login (más detalle más abajo).
- **Meter en una deck de presentación.** Tomás un screenshot o usás Cmd+P / Ctrl+P para exportar a PDF.
- **Mostrar en vivo en una reunión.** Para esto está el [presentation mode](01-introduccion.md#glosario-presentation-mode), pensado para screen-share o proyección.

La vista pública no tiene chrome de edición — no se ve el sidebar del árbol, no aparecen botones de "Editar" o "Eliminar", el indicador de autoguardado está ausente, el topbar general de Prism tampoco se ve. Solo hay una barra superior mínima con el logo "PRISM", el switcher de idioma, un link "Editor" para volver a editarla, y el toggle de modo presentación. Esa barra desaparece entera en modo presentación e impresión.

## Cómo llegar

Desde el editor, hay un botón "Vista previa" en el header — abre la versión pública en una nueva pestaña.

La URL tiene este formato:

```
/projects/[key]/narratives/[id]/preview
```

donde `[key]` es la [key del proyecto](01-introduccion.md#glosario-proyecto) y `[id]` es el id de la narrativa. Es la URL que vas a copiar y pegar al compartir.

## Qué se ve

De arriba hacia abajo:

- **Header.** Título de la narrativa, subtítulo si lo definiste, metadatos (proyecto, lead, última actualización) y el overview. Si el overview es largo, hay un "Leer más" que lo expande. Acá también aparecen counters de "N dependencias", "N riesgos" y, si hay críticos, un counter destacado en rojo — son anchor-links que llevan a las secciones correspondientes.
- **Status summary.** Una card con accent lavanda, ubicada arriba del todo, que contiene el párrafo que vos escribiste en el campo "Resumen de estado". Es lo más leído por stakeholders apurados.
- **Banner de borrador.** Solo aparece si la narrativa está en estado [borrador](01-introduccion.md#glosario-borrador-publicada). Es una franja ámbar con un ícono de alerta avisando "este documento es borrador". Desaparece cuando publicás.
- **Fases.** Una sección por cada [fase](01-introduccion.md#glosario-fase), en orden. Cada sección tiene el nombre de la fase, su estado (badge con color funcional), fechas, un objetivo, un botón "Ver el por qué" que despliega el rationale, una barra de progreso, y los workstreams de la fase como cards.
- **Workstreams transversales.** Si hay [workstreams](01-introduccion.md#glosario-workstream) sin fase, aparecen en una sección "Workstreams cross-cutting" después de la última fase.
- **Dependencias.** Si la narrativa tiene al menos una [dependencia](01-introduccion.md#glosario-dependencia), aparece la sección "Dependencias" con cada una como una card. La card muestra el riesgo con un borde lateral coloreado, el identificador (D1, D2...), el título, el provider, las fechas, el estado de compromiso, las notas de coordinación, y si hay riesgos que la mencionan, un footer "Mencionada por R1, R3".
- **Riesgos.** Si la narrativa tiene al menos un [riesgo](01-introduccion.md#glosario-riesgo), aparece la sección "Riesgos" con cada uno como una card. La card muestra la severidad con un borde lateral, el identificador (R1, R2...), el título, la descripción, dos listas (impactos en rojo y mitigaciones en verde) y, si tiene dependencias relacionadas, chips clickeables que linkean a D1, D2, etc.
- **Footer.** Un texto plano "Creado con Prism · Veevart". Sin link — es lectura para audiencia externa.

Cada workstream card empieza colapsada mostrando solo el nombre, el counter de issues ("4 issues" / "4 issues • 1 borrada"), un counter de "atrasadas" si las hay, y un badge de progreso. Click en "Ver detalles" expande la card y muestra la lista de [issues](01-introduccion.md#glosario-issue) vinculadas con su tipo (ícono), key, summary, estado y asignado. Las issues borradas aparecen en gris con el summary tachado y un icono de papelera; las que no están sincronizadas aparecen en ámbar con un icono de alerta.

## Presentation mode

Si vas a mostrar la narrativa en vivo (proyector, screen-share, demo a cliente), activá el [presentation mode](01-introduccion.md#glosario-presentation-mode):

- Click en el toggle de la barra superior, **o**
- Agregá `?mode=presentation` al final de la URL.

Lo que cambia:

- Tipografía del H1 más grande (de `text-5xl` a `text-7xl` en pantallas grandes).
- Ancho del contenido ligeramente más generoso (1152px vs 1024px).
- Espacio entre secciones más amplio.
- La barra superior con el switcher de idioma y el link al editor desaparece.
- El footer desaparece.
- El patrón decorativo de fondo se atenúa un escalón.

Tecla **ESC** sale del modo presentación. Si compartís el link con `?mode=presentation` en la URL, quien la abra empieza directamente en modo presentación — útil para preparar una pestaña antes de una demo.

## Imprimir

Cmd+P / Ctrl+P imprime la narrativa con un estilo optimizado para papel:

- Todos los collapsibles se expanden automáticamente (rationale de fase, descripción de workstreams, lista de issues de cada workstream, notas largas de coordinación).
- Los botones de "Ver más" / "Ver detalles" / "Ver el por qué" desaparecen.
- Los colores se preservan en navegadores que soportan `print-color-adjust: exact` (Chrome, Safari, Firefox modernos) — los badges de estado, los chips de riesgo y los counters quedan con su color original.
- El toggle de modo presentación y la barra superior no se imprimen.

Para guardar como PDF: Cmd+P / Ctrl+P → destino "Guardar como PDF". Es la mejor forma de tener una versión sin necesidad de Prism, por ejemplo para adjuntar a un mail formal.

<a id="quien-puede-ver"></a>
## Quién puede ver

Hoy la vista pública requiere que el lector esté logueado en Prism con una cuenta `@veevart.com` que tenga acceso a Jira. Cualquier usuario logueado puede leer cualquier narrativa de cualquier proyecto.

**Lo que esto significa en la práctica:**

- Compartir con un compañero interno de Veevart con cuenta: funciona, abre y lee.
- Compartir con un cliente externo, un partner o alguien sin cuenta `@veevart.com`: no funciona directamente. Se topa con la pantalla de login y no puede entrar.

Hoy no hay tokenized share links (URLs públicas con token, sin login). Está en el roadmap pero no está implementado. Mientras tanto, las opciones para compartir con audiencia externa son:

1. **Exportar a PDF** (Cmd+P → Guardar como PDF) y enviar el PDF.
2. **Screen-share en una reunión en vivo**, idealmente en [presentation mode](01-introduccion.md#glosario-presentation-mode).
3. **Screenshot** de la sección puntual que necesitás transmitir.

## Borrador vs publicada

Recordatorio del estado [borrador / publicada](01-introduccion.md#glosario-borrador-publicada): la diferencia visible en la vista pública es el banner ámbar arriba que aparece solo en borrador. No hay diferencia de acceso entre los dos estados — cualquier usuario logueado puede leer una narrativa borrador igual que una publicada. El estado comunica intencionalidad: "esto está terminado y listo para compartir" vs "todavía estoy laburando en esto".

Si compartís una URL de una narrativa que después despublicaste, la URL sigue funcionando para quien tiene cuenta — vuelve al estado de borrador con su banner ámbar. Pensalo más como un toggle de "listo / no listo" que como un toggle de "público / privado".
