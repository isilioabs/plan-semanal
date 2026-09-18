# Fase 1 · Arquitectura y límites

## Entregable local

app.html es la entrada de cuentas y agencias. Se compila desde src/workspace con el SDK oficial de Supabase incluido en assets/workspace.js. No se descarga un SDK de un CDN durante la ejecución. index.html conserva la operación local y puede abrirse dentro de la agencia mediante un puente en memoria.

El ejemplo disponible antes de configurar Supabase utiliza datos ficticios en memoria. No crea una cuenta, no contacta con Supabase y no conserva cambios al recargar. Todas las acciones que requieren cuentas reales están deshabilitadas.

## Aislamiento y guardado

- Las tablas expuestas tienen RLS y privilegios explícitos. anon no obtiene permisos operativos.
- Las funciones administrativas son SECURITY DEFINER con search_path vacío y verifican al actor en servidor. Las funciones privadas no se exponen a PostgREST.
- Crear agencia incluye miembro propietario y plan en una transacción. Una restricción mantiene una sola persona propietaria; la transferencia exige un miembro existente y degrada a la persona anterior a administración.
- Las invitaciones guardan el hash SHA-256 de un token aleatorio de 256 bits. Exigen correo verificado coincidente, caducan a los siete días y se consumen una vez. Su hash no es seleccionable por la API. No elevan el rol de un miembro que ya existe.
- Los administradores no pueden crear/modificar administradores ni propiedad. La propiedad sí administra los demás roles.
- Revocar elimina la pertenencia que consultan las políticas en cada solicitud, sin esperar a que caduque el JWT.
- El planner se carga de agency_plans. Guardar es una RPC con revisión esperada y bloqueo de fila; una versión vieja no se sobrescribe automáticamente. Antes de importar se conserva una recuperación en la misma transacción.
- Los formularios solo se cierran cuando se confirma el guardado. Un error conserva el borrador. Cambiar agencia o cerrar sesión invalida el puente y retira su iframe; una respuesta tardía no puede devolver datos a otra agencia.
- Los planes en nube no se escriben en localStorage. Se mantienen en memoria. El almacenamiento histórico local conserva su propia clave y nunca se importa de forma automática.
- Archivos: bucket privado, ruta exacta agencia/id, metadata previa y permisos tanto sobre metadata como sobre objetos. Las descargas usan sesión autenticada; la interfaz no genera enlaces públicos o firmados duraderos.

## Modelo de operación

| Entidad | Representa |
|---|---|
| clients | Contratantes o pagadores, distintos del punto de venta |
| brands | Marcas; pueden relacionarse con un contratante |
| chains / venues | Cadenas y puntos de venta con ciudad |
| campaigns / activations | Campaña y actividad concreta |
| activation_brands | Varias marcas en una misma activación |
| shifts | Intervalos horarios y número de personas requeridas |
| promoters / assignments | Perfil y asignación a turno; tarifa por hora, jornada o actividad |
| receivables | Cargos separados por pagador/marca |
| payables | Obligaciones de pago por asignación |
| settlements | Cobros o pagos parciales, identificados por su obligación |
| client_campaign_access | Campañas expresamente compartidas con un cliente |
| agency_files | Metadata y audiencia de documentos privados |

Las claves foráneas compuestas incluyen agency_id para impedir referencias a otra agencia. La unidad predominante del pago a personal es hour; los importes se guardan como centavos y moneda explícita. Este esquema prepara la operación; sus pantallas y reglas financieras completas corresponden a las fases 3–6.

## Permisos disponibles

| Rol | Alcance actual |
|---|---|
| Propiedad | Planner histórico completo, miembros, invitaciones, archivos y transferencia |
| Administración | Planner completo, archivos y miembros inferiores; no cambia propiedad ni administradores |
| Coordinación / supervisión | Lectura de activaciones, turnos y documentos dentro de ciudad y campaña autorizadas en las tablas nuevas |
| Promotora | Pertenencia identificada; módulos de campo todavía pendientes, acceso operativo denegado por defecto |
| Cliente | Solo archivos aprobados de campañas expresamente compartidas; portal visual posterior |

Cuando se fijan ciudades y campañas, ambas restricciones deben cumplirse. Arreglos vacíos significan todas las ciudades/campañas para coordinación y supervisión. No significan permiso económico ni acceso de cliente. El formulario muestra nombres de campañas existentes; la creación de campañas tendrá su interfaz en el módulo de planificación. Las restricciones sobre una campaña no disponible se conservan al editar.

El snapshot histórico mezcla finanzas y personal sin IDs de ciudad/campaña. Por eso solo propiedad y administración lo pueden leer o editar. Intentar ocultar sus importes en una tarjeta sin filtrar el JSON en servidor sería insuficiente.

## Comprobación y dependencias pendientes

Las pruebas locales ejecutan las migraciones en PostgreSQL con PGlite. Los esquemas auth/storage y la identidad autenticada se simulan solo dentro del test. Las políticas y funciones son las mismas migraciones del despliegue. Esto permite probar SQL real, pero no sustituye pruebas contra Auth, Storage, correo y OAuth del proyecto Supabase.

Falta crear/configurar ese proyecto, probar cuentas reales en dos dispositivos y verificar las mismas reglas a través de su API. No se afirma que Google/Apple, SMTP ni sincronización real estén activados.

La importación conserva el respaldo v2 como snapshot versionado. No crea pagadores, perfiles ni asignaciones a partir de textos ambiguos. El mapeo normalizado exige revisión posterior. El sistema no tiene aún modo sin conexión en nube, reconciliación automática, contabilidad completa ni sistema de membresías de pago.
