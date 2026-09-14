# Validación de fase 0 local

Fecha: 5 de septiembre de 2026.

La implementación local está lista para revisar. El cierre con datos de la agencia y la publicación quedan pendientes del respaldo real del navegador utilizado por la agencia. No se ha hecho commit ni push.

## Verificación automática

- Compilación del HTML publicable completada.
- 31 pruebas aprobadas: compatibilidad de respaldos, validación, cálculo de importes, persistencia, conflictos entre pestañas, errores de almacenamiento, repetición, archivo y confirmaciones.
- El respaldo ficticio antiguo conserva tres actividades y un descuento; el total activo conocido es USD 90, con una actividad sin tarifa. La actividad cancelada de USD 1.000 no incrementa ese total.
- Revisión de espacios y conflictos con git diff --check sin errores.

## Verificación en navegador local

- Inicio vacío y carga voluntaria del ejemplo ficticio.
- Importación del archivo tests/fixtures/legacy-example.json con vista previa antes de reemplazar datos.
- Aplicación del respaldo, conservación del registro sin fecha y visualización de la tarifa ausente.
- Recuperación de los dos eventos anteriores desde la copia local generada antes de importar.
- Rechazo de importe negativo conservando abierto el formulario.
- Repetición confirmada para la semana siguiente, con cobro pendiente y sin POP entregado; el original conserva sus estados.
- Archivo y reactivación de producto.
- Cierre con Escape y devolución del foco.
- Revisión visual de agenda y formulario con viewport de 390 × 844: sin desbordamiento horizontal de la página; las pestañas tienen desplazamiento propio.
- Sin errores de consola observados durante la comprobación final.

Las comprobaciones usan únicamente datos ficticios en localhost. No modifican los datos guardados en GitHub Pages.

## Pendiente para cerrar y publicar

1. Recibir el JSON exportado desde el navegador de la agencia y guardarlo fuera de Git.
2. Validarlo con node scripts/audit-backup.cjs RUTA_AL_RESPALDO.
3. Importarlo en local y cotejar cantidad de actividades, descuentos, fechas, estados, importes y campos relevantes con la agencia.
4. Comprobar exportación y recuperación con esa copia real.
5. Revisar el resultado y entonces hacer commit y push.

La exportación PDF conserva el mecanismo de impresión existente; no se ha validado aquí la paginación final de un PDF real. Esta fase sigue usando almacenamiento del navegador. Cuentas, Google/Apple, sincronización y aislamiento por agencia corresponden a fase 1; el rediseño de marca y motion pertenece a las fases siguientes.
