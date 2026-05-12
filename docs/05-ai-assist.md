# 05 · AI assist

Hoy Prism usa AI en un solo lugar: el campo descripción del [workstream](01-introduccion.md#glosario-workstream). El resto de la narrativa la escribís vos. La idea es que la descripción del workstream es lo que más cuesta arrancar desde cero ("¿cómo le explico a un stakeholder qué hace este workstream en 3 oraciones?") y donde un primer borrador automático es valioso.

## Qué hace

[AI assist](01-introduccion.md#glosario-ai-assist) toma las [issues](01-introduccion.md#glosario-issue) que vinculaste al workstream — sus títulos y resúmenes — y le pide a Claude Haiku 4.5 (un modelo de Anthropic) que escriba o ajuste un texto descriptivo en prosa, orientado al stakeholder no técnico.

Hay dos operaciones distintas: **Generar** (cuando el campo está vacío) y **Refinar** (cuando ya hay texto).

## Generar

Cuando abrís el formulario de un workstream y la descripción está vacía, al lado del label "Descripción" hay un botón **Generar con AI**.

- Click → el campo se limpia y el texto generado va apareciendo en vivo, palabra por palabra. No es magia, es streaming: la AI escribe progresivamente y vos lo ves en tiempo real.
- Mientras genera, el campo de texto queda deshabilitado — no podés tipear encima del stream.
- Cuando termina, el texto generado queda como cualquier otro contenido editable del campo. Lo podés ajustar a mano, borrarlo entero, o dejarlo.
- El autoguardado de Prism lo persiste 1.5 segundos después.

**Requisito previo:** el workstream tiene que tener al menos una issue vinculada. Si no tiene ninguna, el botón aparece deshabilitado con un tooltip explicativo — la AI necesita el contexto de las issues para escribir algo coherente.

## Refinar

Cuando ya hay texto en el campo, el botón cambia a **Refinar con AI**. Esto abre un modal con vista comparativa:

- A la izquierda, tu texto original (inmutable).
- A la derecha, la versión refinada de la AI (también con streaming en vivo).
- Tres acciones en el footer del modal:
  - **Mantener original.** Cierra el modal, no aplica nada. Lo que estaba en el campo queda igual.
  - **Refinar de nuevo.** Vuelve a correr el refinamiento sobre el original (no sobre el refinado anterior). Útil si la primera versión no te convenció.
  - **Usar versión refinada.** Aplica el texto de la derecha al campo. El original se reemplaza.

La AI **no encadena refinamientos**: cada "Refinar de nuevo" parte del texto original, no del último refinado. Si querés refinar el refinado, aplicalo y volvé a clickear el botón de refinar.

## Cuándo conviene

Casos donde la AI ahorra tiempo:

- **Arrancar de cero.** Tenés las issues vinculadas pero no sabés cómo describir el workstream. Generar te da un primer borrador en 5 segundos que después editás. Casi siempre vale más como punto de partida que como producto final.
- **Pulir prosa que ya tiene contenido pero suena técnica o desordenada.** Refinar suele acortar, reordenar y subir el registro un escalón hacia "ejecutivo". Útil cuando vas a presentar a un C-level y tu primer borrador está demasiado cerca del lenguaje de Jira.

Casos donde **no** conviene:

- **Cuando el contenido depende de información que no está en las issues.** Si el "por qué" del workstream vive en una decisión de producto, un compromiso con cliente, o cualquier cosa que no salga del título/resumen del ticket, la AI no la va a inventar bien. Escribilo a mano.
- **Cuando ya escribiste algo que te gusta.** Refinar puede mover el texto en una dirección que no querés. Es un punto de partida, no un editor sustituto.

## Privacidad y costos

Cuando clickeás Generar o Refinar, Prism le manda a la API de Anthropic:

- Los títulos y resúmenes de las issues vinculadas al workstream (resumen truncado a 200 caracteres por issue para mantener el tamaño del prompt acotado).
- El texto actual del campo (solo en Refinar).
- El prompt interno que Prism usa para guiar al modelo.

No se manda nada más: no se mandan otros workstreams de tu narrativa, ni datos de otras issues que no estén vinculadas a este workstream, ni el nombre del proyecto o del cliente.

Cada llamada queda registrada en una tabla interna `ai_usage` con: tu email, qué operación (generar / refinar), qué workstream, qué narrativa, cuántos tokens entraron y salieron, el costo en USD (centavos típicamente), la duración, y si terminó en éxito / error / cancelada. Es un audit log inmutable — vos no podés borrarlo ni modificarlo, pero podés consultar tu propio historial.

El costo por llamada es del orden de centavos. Una sesión típica de edición no llega a USD 0.10 en gasto de AI.

## Errores comunes

- **"Necesitás vincular issues primero".** El botón está gris y tooltipeable. Vinculá al menos una issue al workstream y el botón se habilita.
- **"La generación tardó demasiado".** Si la AI no responde en ~60 segundos, Prism corta. Reintentá; si pasa repetidamente, posiblemente Anthropic esté caído del lado del proveedor. Probá en unos minutos.
- **"Error de configuración".** Significa que la API key de Anthropic del lado servidor está mal seteada o se quedó sin crédito. Esto NO es algo que el PM pueda resolver — avisá a [completar con canal de soporte].

<!-- TODO: definir canal de Slack o persona de contacto cuando se establezca -->

- **Si cerrás el modal de Refinar antes de aceptar.** La generación que estaba corriendo se cancela. El costo parcial igual se cobra (pagás lo que la AI ya procesó hasta el momento del cancel) — es una limitación del modelo de cobro de Anthropic, no algo que Prism pueda evitar. En la práctica, una cancelación temprana cuesta menos de un centavo.

Cuando termines de editar tu workstream, mirá cómo queda en la [vista pública](04-vista-publica.md).
