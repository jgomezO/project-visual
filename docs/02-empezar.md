# 02 · Empezar

## Acceso

Prism usa el login de Google con tu cuenta `@veevart.com`. La primera vez que entrás, el sistema verifica además que la misma cuenta tenga acceso al Jira corporativo — si no lo tenés, la sesión no arranca y vas a ver un mensaje en `/login` indicando el motivo.

No hay registro manual ni passwords. Si tu cuenta de Google no tiene acceso a Veevart o no estás en Jira, hablá con [completar con canal de soporte].

<!-- TODO: definir canal de Slack o persona de contacto cuando se establezca -->

Una vez logueado, podés cerrar la sesión desde el menú con tu avatar (esquina superior derecha del topbar).

## La primera pantalla

Después del login te lleva a `/projects`, la lista de proyectos de Jira sincronizados. Cada proyecto aparece como una tarjeta con:

- El nombre del proyecto y su [key](01-introduccion.md#glosario-proyecto) en tipografía monoespaciada.
- El [Lead](01-introduccion.md#glosario-lead) asignado en Jira.
- Dos números grandes: total de issues activas y completadas (no se cuentan las [issues borradas](01-introduccion.md#glosario-issue-borrada)).
- Un chip con la cantidad de [narrativas](01-introduccion.md#glosario-narrativa) si el proyecto tiene al menos una.

Si en algún momento un [sync](01-introduccion.md#glosario-sync) falló parcial o totalmente, aparece un chip de aviso justo debajo del título principal con el detalle de qué proyectos fallaron y por qué.

## Las tres vistas de un proyecto

Click en una tarjeta de proyecto te lleva a `/projects/[key]`, que tiene un header con los KPIs (total / completadas / atrasadas / bloqueadas) y debajo tres tabs:

### Lista

La tabla de [issues](01-introduccion.md#glosario-issue) del proyecto, agrupadas por épica. Cada fila muestra el tipo, el key, el resumen, el estado, el asignado y la fecha de vencimiento. Hay filtros arriba: "Solo activas" (esconde las completadas), "Solo con due date" (esconde las que no tienen fecha), y — si el proyecto tiene al menos una [issue borrada](01-introduccion.md#glosario-issue-borrada) — un tercer toggle "Mostrar borradas" para ver el rastro de lo que fue eliminado en Jira.

Hacer click en una fila abre un panel lateral con el detalle del ticket: parent, hijos, sub-tasks, dependencias técnicas, link a Jira.

### Roadmap

Las épicas del proyecto en una línea de tiempo. Cada épica aparece como una barra de color según su estado (rojo = atrasada, azul = en curso, gris = futura, verde = completada si activás el toggle "Mostrar completadas"). Una línea roja vertical marca el día de hoy.

Arriba tenés presets de rango ("Este trimestre", "Próximos 6 meses", "Próximo año", "Todo") y un selector de fechas manual. Cualquier rango que apliques queda en la URL — si compartís el link, el destinatario ve exactamente el mismo recorte que vos.

Las épicas que no tienen fechas o que están afuera del rango visible aparecen agrupadas en una sección "Sin planificar" debajo del chart.

### Narrativas

La lista de narrativas que escribiste para este proyecto. Cada una se muestra como una tarjeta con su título, un chip indicando si es [borrador o publicada](01-introduccion.md#glosario-borrador-publicada), un menú de tres puntos (Duplicar, Eliminar) y un botón para abrir la [vista pública](01-introduccion.md#glosario-vista-publica). Para crear una narrativa nueva, "+ Nueva narrativa" arriba a la derecha. Los detalles del flujo de escritura están en [03 · Escribir una narrativa](03-narrativas.md).

## Cambiar el idioma

Hay un selector de idioma en el topbar (EN / ES). El cambio aplica al toque, recuerda tu preferencia entre sesiones y respeta el contexto en el que estabas — los parámetros de URL (por ejemplo el rango del Roadmap) se preservan al switchear. La vista pública tiene su propio switcher en la barra de acciones superior, que se oculta automáticamente en [presentation mode](01-introduccion.md#glosario-presentation-mode).

## Resincronizar manualmente

El sync automático corre una vez al día, pero a veces necesitás algo más fresco — por ejemplo, acabás de cerrar un epic en Jira diez minutos antes de una reunión y querés que aparezca completado en la narrativa. El botón **Resincronizar** está en el header de `/projects` y dispara una sincronización en el momento.

Una sync manual toma típicamente entre 20 y 40 segundos para todo el conjunto de proyectos. Mientras corre, el botón se desactiva y muestra un spinner. Cuando termina, si todo salió bien, los datos están actualizados; si algún proyecto falló, aparece el chip de aviso con el detalle.

No hay forma de cancelar una sync en curso. Si querés interrumpirla, esperá a que termine — no se rompe nada por dejarla correr.
