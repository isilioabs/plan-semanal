# Fase 2 · Primer bloque: directorios

Implementado localmente el 16 de septiembre de 2026.

- Promotoras: nombre, ciudad, teléfono, correo, disponibilidad como nota y tarifa de referencia por hora en USD o VES.
- Clientes: nombre, persona de contacto, teléfono y correo.
- Marcas: nombre y asociación opcional con un cliente de la misma agencia.
- Crear, editar, buscar sin distinguir acentos, archivar y reactivar fichas.
- Propiedad y administración acceden a los directorios; las políticas RLS conservan el aislamiento entre agencias.
- Las escrituras comprueban la revisión de la ficha para evitar sobrescribir cambios de otra sesión. Los errores conservan el formulario.
- Advertencia al salir con cambios sin guardar y bloqueo de navegación durante el guardado.

## Base de datos

La migración `202609140004_directory.sql` se aplicó al proyecto `pudrmbcgvixlfnokmtgk` mediante SQL Editor el 16 de septiembre de 2026. Supabase devolvió «Success. No rows returned». Agrega columnas, restricciones y revisión de fichas. No elimina registros ni modifica las políticas de acceso.

En otras instalaciones debe aplicarse después de las tres migraciones previas. No volver a ejecutarla en el proyecto ya actualizado.

## Validación

- Compilación de la app y suite de pruebas Node/PostgreSQL.
- Pruebas de aislamiento entre agencias, rechazo de revisión obsoleta, tarifa cero y tarifa desconocida, validación monetaria y paginación de más de 500 fichas.
- Navegador con módulo real y cliente aislado en memoria: creación y edición de promotora, búsqueda sin acentos, archivo, creación de cliente y asociación de marca.
- Formulario de marca revisado a 390 píxeles, sin desbordamiento horizontal.
- No se añadieron registros ficticios a la agencia real. Falta que el usuario pruebe crear una ficha desde su sesión autenticada; la sesión de la app no estaba abierta en el navegador de pruebas.

La prueba visual aislada se abre con `node scripts/preview-directory.cjs` en el puerto 4174. No conecta con Supabase y sus datos desaparecen al recargar. No forma parte de la app publicada.

## Límites de este bloque

Los directorios todavía no alimentan los campos libres del plan semanal existente. No se importan nombres automáticamente porque requieren revisión de duplicados y correspondencias. La tarifa no genera pagos ni cambia importes anteriores. La nota de disponibilidad no detecta cruces de horario.

Siguiente bloque: activaciones con múltiples marcas, turnos, asignación de promotoras y detección de conflictos. Después: horas realizadas, cuentas por cobrar y pagos a promotoras.
