# Agency Planner — Fases 0 y 1 en local

Versión de fiabilidad del plan semanal existente. Mantiene el diseño y el archivo publicable index.html; el código editable está en src/.

La fase 1 añade app.html: acceso, agencias privadas, equipo, roles, invitaciones, archivos y el planner conectado a Supabase. El backend aún no está configurado; la app indica esa dependencia y permite explorar un ejemplo ficticio en memoria. Consulta [Activar Supabase](docs/fase-1-configuracion.md) y [Arquitectura y permisos](docs/fase-1-arquitectura.md).

## Ejecutar

Desarrollado y probado con Node.js 24. Instala las dependencias fijadas en package-lock.json con npm ci --cache .npm-cache.

- npm run build: compilar.
- npm test: ejecutar regresiones.
- npm start: servir en http://127.0.0.1:4173.
- npm run package: compilar y generar los únicos archivos publicables dentro de release/.

Abre /app.html para la fase 1 o /index.html para el planner local. El servidor solo expone esos HTML y los assets compilados; nunca respaldos, configuración, .git ni fuentes.

## Cambios

- Guardado verificado; si falla, el formulario permanece abierto.
- Detección de una copia desactualizada al intentar guardar desde otra pestaña.
- Importación de respaldos antiguos y versión 2, validación estructural y vista previa.
- Copia de recuperación antes de sustituir datos; descarga y restauración de esa copia.
- Repetición con nuevo ID, pendiente de realizar/cobrar y sin material marcado como entregado.
- Archivo y reactivación de actividades, descuentos y productos, conservando referencias históricas.
- Validación de importes, fechas y horarios, incluyendo fin al día siguiente.
- Cero diferenciado de tarifa ausente, totales coherentes para registros activos.
- Diálogos con foco, Escape y aviso por cambios sin guardar.
- Archivo publicado sin datos operativos iniciales; ejemplo ficticio opcional.

## Datos y compatibilidad

Se conserva la clave local plan-trade-zulia-v1 para leer la información existente al sustituir el HTML en el mismo origen. Los respaldos incorporan schemaVersion: 2. Las colecciones históricas y campos adicionales se conservan; los registros estructuralmente inválidos se rechazan con un mensaje, sin sustituir datos.

Los registros archivados permanecen en los respaldos y se excluyen de los totales activos. La app anterior no conoce ese estado: al volver a una versión antigua se debe usar la copia previa al cambio, no un respaldo v2 con archivo.

Una URL de localhost no comparte almacenamiento con GitHub Pages. Abrir el nuevo archivo no traslada datos entre orígenes: se usa un respaldo JSON.

El planner independiente guarda datos solo en el navegador. Dentro de la agencia, la fase 1 utiliza el backend y revisión transaccional cuando se configure Supabase. La demostración funciona únicamente en memoria y lo indica expresamente. La detección de pestañas del modo local no es una transacción multiusuario.

## Estructura

- src/phase0.js: validación, normalización, importes, repetición y persistencia comprobada.
- src/actions.js: acciones del controlador y estados de error/restauración.
- src/component.js: presentación de datos para el runtime existente.
- src/template.html: interfaz.
- src/dialogs.js: teclado y foco.
- src/data.js: configuración vacía y utilidades de fecha.
- src/vendor-assets.json y src/shell.html: recursos y empaquetador conservados del archivo original.
- scripts/build.cjs: genera un único HTML sin descargar librerías al compilar.
- tests/: regresiones de persistencia, restauración, historial y cálculo.
- docs/reglas-del-negocio.md: decisiones confirmadas para las siguientes fases.

## Antes de publicar

1. Obtener el respaldo real del navegador de la agencia.
2. Probar la importación en local y cotejar registros, estados y totales.
3. Descargar también el respaldo previo y verificar recuperación.
4. Revisar cambios y ejecutar pruebas/compilación.
5. Hacer commit y push al finalizar la revisión.

No incluir respaldos reales en Git. private/, backups/ y archivos *.local.json están ignorados. No se ha reescrito el historial del repositorio.
