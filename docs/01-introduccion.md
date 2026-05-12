# 01 · Introducción

## Qué es Prism

Prism es el dashboard interno de Veevart que conecta con Jira y muestra, para cada proyecto, las tres preguntas que un stakeholder no técnico siempre hace:

- ¿Este proyecto va en fecha?
- ¿Qué lo está bloqueando ahora mismo?
- ¿Qué pasó en él esta semana?

No es un reemplazo de Jira ni una vista alternativa del backlog. Si un proyecto tiene 200 tickets, Prism no los lista los 200 — los agrupa, los resume y los traduce a un lenguaje que un C-level, un account manager o un cliente entiende sin necesidad de saber qué es una sub-task.

## Quiénes lo usan

Dos audiencias bien distintas:

- **PMs (vos).** Sos quien escribe. Cada PM revisa el estado de su proyecto en Prism, valida que los datos de Jira estén bien sincronizados, y arma una o varias *narrativas* — documentos curados por vos que explican el proyecto a otros.
- **Stakeholders (C-level, Customer Success, Implementations, account managers, clientes).** Son quienes leen. Reciben de vos una URL pública de una narrativa o miran la lista de proyectos.

Hoy todo usuario logueado de Prism puede leer cualquier narrativa de cualquier proyecto, aunque el caso típico es que el PM mande la URL específica a quien necesita leerla.

## Cómo se relaciona con Jira

Prism **lee** de Jira, nunca le escribe. Lo que ves en Prism es siempre una foto de Jira en un momento dado — no podés cambiar el estado de una issue, mover una fecha, o asignar un ticket desde acá. Eso se sigue haciendo en Jira.

La foto se actualiza dos veces:

- **Automáticamente, todos los días a las 06:00 UTC** (≈01:00 hora Colombia, 03:00 hora Argentina). Es decir, cuando empezás el día, ya tenés los datos del día anterior procesados.
- **Manualmente, cuando lo necesites.** Hay un botón "Resincronizar" en la pantalla principal que dispara una sync en el momento — útil si acabás de cambiar algo crítico en Jira y querés verlo reflejado antes de una reunión.

Lo que las narrativas agregan por encima de Jira es la capa de *prosa* que Jira no tiene: el "por qué" de una fase, el "qué significa esto para el cliente" de un workstream, los riesgos explícitos con sus mitigaciones, las dependencias cross-team con sus compromisos. Esa capa la escribís vos y vive solamente en Prism.

## Glosario

Todos los términos que vas a encontrar en el resto de la documentación, definidos una sola vez acá. Si en otro doc ves un término en *itálica* o linkeado, podés volver a esta lista para refrescar qué significa.

### <a id="glosario-proyecto"></a>Proyecto

Un proyecto de Jira que Prism sincroniza. Aparece como una tarjeta en la pantalla principal y tiene su propia página de detalle con tres vistas. Prism solo conoce los proyectos que están sincronizados — si un proyecto de Jira no aparece, hay que pedir que se sume al sync.

### <a id="glosario-issue"></a>Issue

Cualquier ticket de Jira. Puede ser una épica, una historia, una tarea, una sub-task o un bug. Prism los muestra agrupados por épica en la vista Lista y los usa también dentro de las narrativas, donde vos los vinculás manualmente a un workstream.

### <a id="glosario-sync"></a>Sync

La actualización automática diaria que trae los datos de Jira a Prism. Corre una vez por día a las 06:00 UTC. También se puede correr manualmente con el botón "Resincronizar". Si un sync falla parcialmente (algunos proyectos fallaron, otros no), aparece un chip de aviso en la pantalla principal con el detalle.

### <a id="glosario-issue-borrada"></a>Issue borrada

Una issue que existía en Jira y fue eliminada upstream (alguien la borró en Jira). Prism detecta esto en el siguiente sync y la marca como borrada, pero no la elimina de su base de datos — la deja visible con un cue visual (gris, tachado, icono de papelera) para que se entienda que esa issue *existió* pero ya no está activa. Si la issue se restaura en Jira, Prism también la "resucita" en el próximo sync.

### <a id="glosario-narrativa"></a>Narrativa

El documento que el PM escribe para presentar un proyecto a una audiencia. Una narrativa tiene un título, un overview, un resumen de estado, una serie de fases, opcionalmente workstreams sueltos (sin fase), dependencias cross-team y riesgos. Un proyecto puede tener varias narrativas — por ejemplo una para el board ejecutivo y otra para el cliente.

### <a id="glosario-fase"></a>Fase

Un bloque temporal dentro de una narrativa: "Descubrimiento", "Build", "Lanzamiento", "Estabilización", etc. Cada fase tiene un nombre, un objetivo (qué se persigue), un rationale (por qué se hace), fechas de inicio y fin, un estado (próxima, en curso, completada, en riesgo) y opcionalmente un porcentaje de progreso manual que sobrescribe el cálculo automático.

### <a id="glosario-workstream"></a>Workstream

Una corriente de trabajo dentro de una fase, o suelta como "transversal" sin fase asignada. Tiene un nombre, una descripción en prosa y una lista de issues de Jira vinculadas. El progreso del workstream se calcula automáticamente a partir del estado de esas issues.

### <a id="glosario-dependencia"></a>Dependencia

Un compromiso cross-team que condiciona la entrega del proyecto. Por ejemplo: "el equipo de Auth tiene que entregarnos el SSO antes del 15 de junio". Cada dependencia tiene un PoD/Provider, una fecha de "lo necesitamos para", una fecha de "esperan entregar", un estado de compromiso (propuesto, acordado, confirmado, en riesgo, bloqueado), provider issue keys opcionales y notas de coordinación.

### <a id="glosario-pod-provider"></a>PoD / Provider

El equipo o squad externo del que dependés para una dependencia. Puede ser un equipo de Veevart que tiene su propio proyecto de Jira sincronizado (en cuyo caso Prism te ayuda a linkear las issues del proveedor) o un equipo cuyo Jira no está conectado (en cuyo caso anotás el nombre como texto libre).

### <a id="glosario-riesgo"></a>Riesgo

Algo que podría salir mal, escrito explícitamente por el PM. Tiene un título, una descripción, una severidad (baja, media, alta), una lista de impactos (qué pasa si se materializa) y una lista de mitigaciones (qué estamos haciendo para evitarlo). Opcionalmente puede apuntar a una o más dependencias relacionadas, lo que crea un cross-link en la vista pública.

### <a id="glosario-vista-publica"></a>Vista pública / Preview

La URL de solo lectura de una narrativa, sin chrome de edición. Es la que el PM comparte con stakeholders. La ven solo usuarios logueados de Prism — por ahora no hay link público sin login.

### <a id="glosario-presentation-mode"></a>Presentation mode

Un modo de la vista pública con tipografía ampliada y sin las barras de acción, pensado para mostrar la narrativa en vivo (proyector, screen share, reunión). Se activa con un toggle en la barra superior de la preview o agregando `?mode=presentation` a la URL. Tecla `ESC` para salir.

### <a id="glosario-ai-assist"></a>AI assist

Funcionalidad que usa Claude (de Anthropic) para generar o refinar el texto de la descripción de un workstream. Hoy es el único lugar donde Prism usa AI; el resto del contenido lo escribís vos.

### <a id="glosario-borrador-publicada"></a>Borrador / Publicada

El estado de una narrativa. Una narrativa nueva nace como borrador (visible para el equipo pero con banner de aviso en la vista pública). Cuando vos la publicás, deja de tener ese banner y se considera lista para compartir. Podés despublicarla en cualquier momento.

### <a id="glosario-stakeholder"></a>Stakeholder

La persona a quien va dirigida una narrativa. Puede ser interno (un account manager, un líder de Customer Success, un C-level) o externo (un cliente, un partner). El stakeholder no necesita conocer Jira ni ningún detalle técnico: la narrativa está escrita para que lo entienda sin contexto previo del proyecto.

### <a id="glosario-lead"></a>Lead

El responsable del proyecto en Jira. Prism lo muestra automáticamente en cada tarjeta y en el header del proyecto, tomándolo del lead asignado en Jira. No es un campo editable desde Prism.
