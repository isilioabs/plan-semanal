# Fase 1 · Entrega local y validación

Revisión final: 7 de septiembre de 2026.

Estado: integración local preparada; activación y validación con Supabase real pendientes. No se ha hecho commit, push ni despliegue.

## Entregado

- app.html con registro, acceso, recuperación, selección/creación de agencia, equipo, invitaciones, permisos, archivos y cuenta.
- SDK oficial de Supabase empaquetado localmente; configuración publicable separada de los secretos.
- Tres migraciones SQL: agencias/autorización, modelo operativo y almacenamiento privado.
- Planner existente conectado mediante un puente en memoria; confirmación remota antes de cerrar formularios, control de revisión y recuperación al importar.
- Demostración ficticia identificada, sin crear cuentas ni conservar datos al recargar.
- Guías de configuración y arquitectura, paquete release/ con lista explícita de archivos.
- Versiones por contenido en las URLs de JavaScript/CSS para evitar cargar una compilación anterior desde caché.

## Verificado

Compilación y empaquetado completados. 46 pruebas aprobadas, incluyendo:

- Las 31 regresiones de fase 0.
- SQL ejecutado en PostgreSQL mediante PGlite: aislamiento por agencia, acceso anónimo denegado, correo verificado, invitaciones con caducidad/revocación, ámbitos por ciudad/campaña, referencias entre agencias rechazadas, control de revisión, recuperación, objetos privados, reportes autorizados y transferencia de propiedad.
- Puente de agencia: conserva borrador ante fallo, espera confirmación de guardado, rechaza guardados simultáneos y descarta respuestas de una sesión invalidada.
- Selector de agencias limitado al usuario actual; rechazo de claves secretas en la configuración del navegador.

Revisión en navegador con datos ficticios: acceso, registro, recuperación, selección de agencia, importación y guardado en la demostración, equipo y aviso de cambios sin guardar. Cancelar la salida conserva el formulario; confirmarla permite cambiar de sección.

Revisión móvil a 390 × 844: acceso/recuperación y equipo legibles, sin desbordamiento horizontal del documento. El menú de secciones utiliza desplazamiento propio. No se observaron errores de consola en la comprobación final.

## Pendiente para cerrar la fase completa

1. Crear el proyecto Supabase y ejecutar las migraciones.
2. Configurar confirmación de correo, SMTP, URLs de retorno y vinculación.
3. Activar y probar Google y Apple con sus credenciales.
4. Repetir aislamiento, revocación y descarga privada a través de la API real; comprobar guardado desde dos dispositivos.
5. Validar el respaldo real de la agencia antes de migrar su operación y publicar.

Las pruebas SQL simulan auth/storage dentro del entorno local; no equivalen a haber probado los servicios alojados ni OAuth. El esquema operativo está preparado, pero sus módulos de personal, coordinación, campo y finanzas conservan el alcance de las fases posteriores. El snapshot histórico solo se permite a propiedad y administración porque contiene información mezclada que no admite filtros seguros por ciudad/campaña.

Siguiente paso: seguir docs/fase-1-configuracion.md. La entrada local es http://127.0.0.1:4173/app.html; el planner independiente permanece en http://127.0.0.1:4173/index.html.
