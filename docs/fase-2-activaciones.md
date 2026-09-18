# Fase 2 · Activaciones, turnos y asignaciones

## Alcance entregado

- Activaciones separadas por agencia con cliente, ciudad, lugar, dirección, notas y estado.
- Varias marcas por activación, pensadas para expos y eventos multimarcas.
- Turnos con inicio, fin y cantidad de promotoras requeridas.
- Asignaciones con estado, moneda y tarifa por hora copiada desde la ficha de la promotora.
- Indicador de cobertura por turno y búsqueda de activaciones.
- Detección de cruces tanto en el navegador como en PostgreSQL.
- Revisión optimista para impedir que una pestaña obsoleta sobrescriba cambios recientes.

El plan semanal histórico permanece disponible y sin conversiones automáticas. Las activaciones nuevas usan las tablas operativas canónicas y los directorios creados en el bloque anterior.

## Migración

`supabase/migrations/202609170005_activation_scheduling.sql` se aplicó al proyecto `pudrmbcgvixlfnokmtgk` mediante SQL Editor el 17 de septiembre de 2026. Supabase devolvió `Success. No rows returned`.

La migración es aditiva: añade detalles y revisión a activaciones, revisión a turnos y asignaciones, la función transaccional `save_activation` y dos defensas de solapamiento. No elimina registros existentes.

En otra instalación debe ejecutarse después de `202609140004_directory.sql`. No debe ejecutarse de nuevo en un proyecto que ya la tenga aplicada.

## Reglas operativas

- La tarifa predeterminada es por hora y puede ajustarse en cada asignación.
- Los estados pendientes, confirmados y completados ocupan horario. Los rechazados, reemplazados y cancelados no bloquean un nuevo turno.
- Dos turnos consecutivos son válidos cuando uno termina exactamente a la hora en que empieza el siguiente.
- Cambiar el horario de un turno también vuelve a comprobar todas sus promotoras.
- Las cancelaciones se conservan como historial; la interfaz no borra activaciones ni asignaciones.

## Validación

La suite cubre varias marcas, validación de horarios y dinero, cobertura, aislamiento por agencia, compare-and-swap y rechazo de cruces tanto al asignar como al editar un turno. La compilación incluye el módulo en `assets/workspace.js`.
