# Fase 1 · Activar Supabase

La integración está preparada localmente. Crear el proyecto, configurar correo/Google/Apple y verificar los recorridos reales son requisitos pendientes para cerrar esta fase. Nada se ha publicado.

## 1. Crear el proyecto de desarrollo

1. Entra en https://supabase.com/dashboard y crea una organización y un proyecto para desarrollo. Conserva la contraseña de base de datos en tu gestor de contraseñas.
2. Usa proyectos distintos para desarrollo, pruebas y producción. Las cuentas y datos de cada proyecto quedan separados. El plan gratuito para usuarios de Agency Planner no significa que todos los proveedores sean gratuitos o ilimitados.
3. En el editor SQL del proyecto nuevo, ejecuta los archivos siguientes completos y en este orden:

   - supabase/migrations/202609050001_agencies.sql
   - supabase/migrations/202609050002_operational_model.sql
   - supabase/migrations/202609050003_private_storage.sql

No están diseñados para ejecutarse repetidamente ni sobre otro esquema ya existente. Cada archivo usa una transacción: si falla, corrige la causa y vuelve a ejecutar solo el archivo que no se aplicó. No borres tablas para resolver un error en un proyecto con datos.

La tercera migración crea el bucket privado agency-private. No lo conviertas en público. Las políticas de objetos necesitan la metadata de agency_files y comprueban membresía y permisos en cada solicitud.

## 2. Configurar correo y URLs

En Authentication:

- Activa el proveedor Email y la confirmación de correo. La app exige mínimo 8 caracteres, un número, una mayúscula, una minúscula y un símbolo especial (por ejemplo, un punto). Supabase agrupa esos cuatro tipos de caracteres en una sola opción; por eso se incluyó también la minúscula. Se seleccionó esta opción, se introdujo el mínimo de 8 y se pulsó Save en el proyecto conectado. La comprobación posterior del servidor quedó bloqueada por el error interno de Guardian; confirmar los valores persistidos cuando se recupere el navegador. La compilación local ya está completada.
- Para desarrollo local, configura Site URL como http://127.0.0.1:4173/app.html y añade esa URL exacta a Redirect URLs. Si usas localhost, añade también http://localhost:4173/app.html; utiliza siempre el mismo origen durante un flujo PKCE.
- Para el despliegue actual previsto, el retorno es https://isilioabs.github.io/plan-semanal/app.html. Usa esta URL como Site URL del proyecto de producción, no del proyecto de desarrollo.
- Configura SMTP con un proveedor y remitente de tu dominio antes del piloto. El servicio predeterminado tiene restricciones; no se debe asumir que enviará a cualquier agencia.
- Verifica las plantillas de confirmación y recuperación. El enlace debe regresar a app.html para que el SDK procese la sesión.
- Mantén los límites de frecuencia de autenticación. Configura protección adicional contra abuso antes de abrir registros públicamente.
- Habilita la vinculación manual de identidades para los botones «Vincular Google/Apple» de Mi cuenta. No vinculamos cuentas basándonos solo en un correo escrito por el usuario.

El SDK usa PKCE. Abre el enlace de confirmación/recuperación en el navegador donde comenzaste el proceso. Si otro dispositivo no tiene el verificador, vuelve a solicitarlo desde ese dispositivo. Los datos operativos no se cachean localmente; el SDK sí conserva la sesión para mantener el acceso.

## 3. Configurar Google

1. Configura la pantalla de consentimiento de Google y un cliente OAuth para aplicación web.
2. Añade como URI de redirección autorizada la URL de callback que muestra Supabase: https://TU-PROYECTO.supabase.co/auth/v1/callback.
3. Si el consentimiento está en modo pruebas, añade las cuentas que vayas a utilizar.
4. Activa Google en Supabase y guarda allí Client ID y Client Secret. El secreto nunca va en el código de la web.
5. Tras probarlo, cambia providers.google a true en la configuración pública local.

## 4. Configurar Apple

Un correo @icloud.com ya puede registrarse mediante Email. «Continuar con Apple» es otro método y requiere configuración propia.

Configura Sign in with Apple en Apple Developer, el Service ID para web, el dominio y URL de retorno que correspondan a Supabase, y las credenciales del proveedor. Guarda las credenciales exclusivamente en Supabase. La autenticación web de Apple requiere renovar su secreto de forma periódica; registra el vencimiento para que no deje de funcionar. Configura también las fuentes de correo de Apple si usarás su dirección privada de retransmisión.

Tras probar el acceso y la vinculación, cambia providers.apple a true. Los botones permanecen deshabilitados mientras falte esa configuración. Tener correo iCloud no implica disponer de las credenciales de Sign in with Apple.

## 5. Conectar la web

Copia config/public.example.json como config/public.local.json y completa:

```json
{
  "supabaseUrl": "https://TU-PROYECTO.supabase.co",
  "supabasePublishableKey": "sb_publishable_TU_CLAVE_PUBLICA",
  "providers": { "google": false, "apple": false },
  "environment": "development"
}
```

Solo se admite clave publicable o la antigua anon. La compilación rechaza sb_secret y service_role. El archivo local está ignorado por Git; la URL y clave publicable se incorporan al JavaScript generado y son visibles por diseño. La seguridad depende de los permisos de la base de datos, no de ocultar esa clave.

En una terminal situada en el proyecto:

```powershell
npm ci --cache .npm-cache
npm run build
npm test
npm start
```

Abre http://127.0.0.1:4173/app.html. El planner local sigue en /index.html. La app usa archivos relativos y admite el subdirectorio /plan-semanal/ de GitHub Pages.

## 6. Prueba real obligatoria antes del cierre

1. Registra y verifica dos correos distintos. Crea una agencia A con uno y B con el otro.
2. Guarda una actividad en A. Inicia sesión con la misma cuenta en otro navegador/dispositivo y verifica el registro.
3. Desde B, solicita el ID conocido de A en la API: no debe devolver plan, miembros, documentos ni auditoría. Repite sin sesión.
4. Invita un tercer correo: correo incorrecto, enlace revocado, vencido y consumido deben fallar. La aceptación válida incorpora únicamente la agencia y el rol autorizados.
5. Revoca al miembro manteniendo su sesión abierta. La siguiente solicitud a datos/archivos debe denegarse; la interfaz revalida al volver a la app y cada 60 segundos. Ningún sistema puede retirar una copia que esa persona ya descargó.
6. Abre el plan en dos sesiones. Guarda primero en una y luego en la otra. La segunda debe conservar el borrador y avisar del conflicto. No reintentes a ciegas: exporta el borrador, recarga y reconcilia.
7. Sube un PDF ficticio a A y comprueba su descarga autenticada. B y una sesión cerrada no deben poder acceder al objeto, aunque conozcan su ruta.
8. Prueba recuperación de contraseña, cierre de sesión, expiración y acceso/vinculación de Google y Apple. Apple con correo privado debe probarse expresamente.
9. Importa el respaldo real solo en la agencia seleccionada, tras validar cantidades y totales. La operación reemplaza el plan compartido completo; conserva recuperación en la nube y descarga una copia externa.

## Publicación posterior

El usuario pidió mantener el trabajo local y esperar el respaldo real antes de commit/push. No se ha activado un despliegue automático. Cuando se valide el respaldo, compila con la configuración pública del entorno correspondiente, ejecuta las pruebas y genera npm run package. Publica únicamente el contenido de release/: index.html, app.html y assets/. No publiques la carpeta completa del proyecto ni archivos privados.

El snapshot del planner es un puente de migración. Se conserva completo, sin adivinar relaciones entre cliente, cadena, marca y pagador. Su normalización a las nuevas entidades se revisará con la agencia en las siguientes fases.

## Documentación oficial

- Autenticación y contraseñas: https://supabase.com/docs/guides/auth/passwords
- PKCE: https://supabase.com/docs/guides/auth/sessions/pkce-flow
- Google: https://supabase.com/docs/guides/auth/social-login/auth-google
- Apple: https://supabase.com/docs/guides/auth/social-login/auth-apple
- Vinculación: https://supabase.com/docs/guides/auth/auth-identity-linking
- RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Archivos privados: https://supabase.com/docs/guides/storage/security/access-control
