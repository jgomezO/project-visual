# 03 · Escribir una narrativa

La [narrativa](01-introduccion.md#glosario-narrativa) es el flujo de trabajo principal del PM en Prism: lo que toma más tiempo de escribir, lo que más vale al stakeholder y lo que más cuesta improvisar cinco minutos antes de una reunión.

## Cuándo escribir una

Escribís una narrativa cuando vas a presentarle el estado del proyecto a alguien que **no mira Jira**. Casos típicos:

- Reunión quincenal de cuenta con un cliente.
- Status semanal a un líder de Customer Success o Implementations.
- Demo a un C-level interno o un partner.
- Documento de hand-off cuando rotás de proyecto.

Si la audiencia sí mira Jira (ej. otro PM, un dev), no necesitás una narrativa — alcanza con la tab Lista o Roadmap del proyecto. La narrativa cobra valor cuando la persona del otro lado no tiene contexto del backlog y necesita el "por qué" además del "qué".

Un proyecto puede tener varias narrativas. Es común tener una para el board ejecutivo (más conceptual, menos detalle) y otra para el cliente (con foco en entregables y fechas). Duplicar una narrativa existente para crear una variante es la forma más rápida.

## Crear una narrativa

Desde la tab **Narrativas** del proyecto, "+ Nueva narrativa" arriba a la derecha. Te pide un título obligatorio y nada más. Apenas confirmás, te lleva al editor con la narrativa en estado [borrador](01-introduccion.md#glosario-borrador-publicada) — visible para tu equipo pero con un banner en la vista pública avisando que todavía no está lista para compartir.

Si lo que querés es una variante de una narrativa que ya existe, "Duplicar" del menú de tres puntos te crea una copia exacta con "(copia)" añadido al título. Editás la copia y dejás el original intacto.

## La estructura

Una narrativa tiene tres niveles:

1. **El nodo raíz.** El "envelope" del documento: título, subtítulo opcional, overview en prosa, status summary (un párrafo de "cómo va el proyecto hoy"), y un sub-heading opcional para la sección de riesgos.

2. **Las [fases](01-introduccion.md#glosario-fase).** Bloques temporales que dividen el proyecto. Una narrativa típica tiene entre 2 y 5 fases.

3. **Los [workstreams](01-introduccion.md#glosario-workstream).** Las corrientes de trabajo concretas. Cada workstream cuelga de una fase o queda suelto al nivel raíz como "transversal".

Además, al nivel raíz hay dos secciones independientes que no entran en la estructura jerárquica:

- **[Dependencias](01-introduccion.md#glosario-dependencia).** Compromisos cross-team que condicionan la entrega.
- **[Riesgos](01-introduccion.md#glosario-riesgo).** Cosas que podrían salir mal, con sus mitigaciones.

El sidebar izquierdo del editor te muestra esta estructura como un árbol navegable. Click en un nodo carga su formulario al medio. Hay botones "+ Agregar fase", "+ Agregar workstream", "+ Agregar dependencia" y "+ Agregar riesgo" en sus secciones respectivas.

## Fases

Cada fase representa un período del proyecto: "Descubrimiento", "Diseño", "Build", "Lanzamiento", "Estabilización", lo que tenga sentido para ese proyecto en particular. Los campos de una fase son:

- **Nombre.** Corto, descriptivo. Aparece como el título de la sección de la fase en la vista pública.
- **Objetivo.** Qué se persigue en esta fase. Una o dos frases. Es lo primero que lee el stakeholder.
- **Rationale.** Por qué se hace lo que se hace. Va detrás de un "Ver el por qué" en la vista pública para no saturar al lector que solo quiere el resumen.
- **Estado.** Próxima, en curso, completada, en riesgo. Lo elegís manualmente — no se infiere del estado de las issues.
- **Fechas.** Inicio y fin. Opcionales pero recomendadas porque alimentan el sentido de "dónde estamos" del Roadmap mental del lector.
- **Progreso manual (opcional).** Un porcentaje del 0 al 100 que sobrescribe el cálculo automático basado en issues. Útil cuando vos sabés que la fase está al 80% por contexto que las issues no reflejan (por ejemplo, fase de diseño con entregables que no son tickets).

Si no llenás el progreso manual, Prism lo calcula automáticamente como el promedio del progreso de los workstreams de la fase (que a su vez se calcula a partir del estado de las issues vinculadas).

## Workstreams

Un workstream es una corriente de trabajo concreta dentro del proyecto. Ejemplos: "Integración con SSO", "Diseño del onboarding", "Migración de la base de clientes". Los campos:

- **Nombre.** Específico y orientado al outcome, no a la actividad. "Pago con Stripe" antes que "Implementación de Stripe".
- **Descripción.** Prosa. Acá es donde explicás *qué hace* este workstream en términos que el stakeholder entiende. Idealmente: 2-4 oraciones. Si tenés [AI assist](01-introduccion.md#glosario-ai-assist) habilitado, podés generar un primer borrador a partir de las issues vinculadas — más en [05 · AI assist](05-ai-assist.md).
- **Fase.** A qué fase pertenece, o "Sin fase" si es transversal. Los workstreams transversales se renderizan después de todas las fases en la vista pública, en su propia sección "Workstreams cross-cutting".
- **Issues vinculadas.** La lista de issues de Jira que componen este workstream. Detalles en la sección siguiente.

El progreso del workstream se calcula automáticamente: promedia el estado de Done de las issues vinculadas (recorriendo el árbol hacia abajo cuando son épicas con stories). No hay forma de sobrescribirlo manualmente — la idea es que si querés un progreso distinto, ajustás las issues en Jira o usás el override manual de la fase.

## Vincular issues

El campo de issues del workstream tiene un autocomplete que busca por [key](01-introduccion.md#glosario-issue) o por título dentro del proyecto. Tipeás 2-3 caracteres y aparecen sugerencias; click en una la agrega como chip al workstream.

Las [issues borradas](01-introduccion.md#glosario-issue-borrada) en Jira **no aparecen como sugerencias** — el autocomplete las filtra para que no las puedas vincular por accidente. Pero si vinculaste una issue antes de que se borrara, el chip cambia de aspecto: queda gris, con el key tachado, un icono de papelera y un tooltip con la fecha en que se detectó la eliminación. La idea es que veas el rastro, no que se borre solo del workstream — vos decidís si lo removés (botón X del chip) o lo dejás como referencia histórica.

Si un chip aparece en color ámbar con un icono de alerta, la issue no está en el sync (puede ser un proyecto de Jira que Prism no conoce, o un key mal tipeado). Verificá el key y resincronizá si hace falta.

## Dependencias

Las dependencias modelan los compromisos cross-team que condicionan la entrega del proyecto. Por ejemplo: "el equipo de Auth nos tiene que entregar el SSO antes del 15 de junio", "necesitamos que el equipo de Data nos confirme el schema antes del lanzamiento".

Cada dependencia tiene su propio formulario en el sidebar (grupo "Dependencias") con estos campos:

- **Título.** Una frase. "Auth — SSO listo para integrar".
- **Descripción.** Prosa opcional con el detalle del compromiso.
- **[PoD / Provider](01-introduccion.md#glosario-pod-provider).** El equipo del que dependés. Si ese equipo tiene un proyecto de Jira sincronizado en Prism, podés vincularlo con el campo "Provider project key" — esto habilita el autocomplete de provider issues para apuntar a tickets específicos. Si el equipo no está sincronizado, dejás el campo como texto libre.
- **Provider issue keys.** Lista de issues del equipo proveedor que componen este compromiso. Mismo autocomplete que en workstreams, pero scope al proyecto del provider.
- **Fecha "lo necesitamos para".** Cuándo necesitás que esté entregado para no afectar tu plan.
- **Fecha "esperan entregar".** Cuándo el equipo proveedor te dijo que va a entregar. Si la dejás vacía y hay issues del provider vinculadas, Prism la deriva como el máximo de las fechas de vencimiento de esas issues y se lo indica al stakeholder con "(estimado por issues)".
- **Estado del compromiso.** Propuesto, acordado, confirmado, en riesgo, bloqueado. Lo curás vos: refleja la realidad política/de coordinación, no se deriva de Jira.
- **Notas de coordinación.** Prosa libre. Quién dijo qué, cuándo, en qué reunión.
- **Workstream impactado (opcional).** Si la dependencia afecta a un workstream específico de tu narrativa, podés apuntarlo acá y el stakeholder ve el cross-link.

El nivel de riesgo de la dependencia (bajo / medio / alto / crítico) se calcula automáticamente combinando dos señales: el gap entre la fecha "necesitamos" y la fecha "esperan entregar", y el estado del compromiso. Un compromiso bloqueado siempre es crítico; un retraso de 14+ días con compromiso fragil (propuesto o en riesgo) también es crítico; el resto sigue una escalera más suave.

## Riesgos

Los riesgos son cosas que podrían salir mal y que vos como PM decidís hacer explícitas. Es la sección donde no se trata de cómo va el proyecto sino de qué podría romper la entrega. Cada riesgo tiene:

- **Identificador.** R1, R2, R3, etc., asignado automáticamente y estable para siempre. Si borrás R2, el siguiente riesgo nuevo no se llama R2 — se llama R4. Esto permite que un riesgo mencionado en un mail o un screenshot mantenga su referencia.
- **Título.** Una frase.
- **Descripción.** Prosa opcional.
- **Severidad.** Baja, media, alta. La elegís vos.
- **Impactos.** Lista de bullets. Qué pasa si el riesgo se materializa. Mínimo uno.
- **Mitigaciones.** Lista de bullets. Qué estamos haciendo para evitarlo. Mínimo uno.
- **Dependencias relacionadas (opcional).** Selección de las dependencias de la narrativa que se conectan con este riesgo. Genera cross-links bidireccionales en la vista pública (la dependencia muestra "Mencionada por R1", el riesgo muestra "Dependencias relacionadas: D2").

Las dependencias también tienen identificadores estables (D1, D2, D3, ...) con la misma lógica de no-reúso.

## Autoguardado

No hay botón "Guardar". Prism guarda automáticamente cada cambio 1.5 segundos después del último tecleo. Un indicador en el header del editor muestra el estado: guardando, guardado, error. Si ves "error", aparece un botón "Reintentar" — clickealo después de verificar tu conexión.

Cuando navegás entre nodos del árbol (por ejemplo, click de "Fase Build" a "Workstream Auth"), Prism hace un flush sincrónico antes de cambiar de pantalla — no perdés cambios del formulario que dejaste. Si el flush falla, la navegación queda en pausa hasta que resuelvas el error o desistas.

**Importante:** Prism no tiene undo. Lo que escribiste queda escrito; si borrás una fase / workstream / dependencia / riesgo, se va para siempre. Si vas a borrar algo grande, considerá duplicar la narrativa primero.

## Publicar

Una narrativa nueva nace en estado [borrador](01-introduccion.md#glosario-borrador-publicada). La podés compartir igual — la [vista pública](01-introduccion.md#glosario-vista-publica) muestra un banner ámbar con la leyenda "Borrador, no listo para compartir externamente" — pero el stakeholder ve que es un draft.

Cuando termines de editar, click en **Publicar** en el header del editor. El banner desaparece y la narrativa pasa a estado publicada. Podés despublicarla en cualquier momento con el mismo botón.

La diferencia entre borrador y publicada es solo visual; ambos estados son accesibles por la misma URL pública para cualquier usuario logueado. La intención del estado es comunicar la madurez del documento al stakeholder.

## AI assist

Hay un solo lugar donde Prism usa AI: el campo descripción del workstream. Botón "Generar con AI" cuando está vacío, botón "Refinar con AI" cuando ya tiene texto. Los detalles, casos de uso y consideraciones de privacidad están en [05 · AI assist](05-ai-assist.md).

## El editor en mobile

El editor de narrativas está pensado para pantallas medianas o grandes. En mobile / tablet vertical te muestra un mensaje "Editor disponible en pantallas más anchas" y no carga la UI de edición. Si necesitás escribir en movilidad, la mejor opción es abrir la vista en la versión web del navegador de tu tablet en orientación horizontal, o usar un laptop.

Cuando termines de escribir, leé cómo se ve la versión final en [04 · La vista pública](04-vista-publica.md).
