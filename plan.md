# Plan de desarrollo - TierX

## 1. Objetivo

Construir una aplicacion movil nativa para Android, con toda la interfaz en ingles, que permita registrar usuarios, iniciar sesion, explorar y administrar torneos, participar en eventos y consultar perfiles y rankings. La aplicacion priorizara el funcionamiento offline y almacenara los datos de negocio en SQLite local, de acuerdo con los requisitos del spec.

## 2. Alcance del proyecto y del MVP

### MVP

- Registro, inicio de sesion, cierre de sesion, verificacion y recuperacion de cuenta (RF-01 a RF-03, RF-02.1).
- Navegacion principal y contextual entre Home, Torneos, Eventos y Perfil (RF-04, RF-18).
- Home, consulta, busqueda, filtrado y detalle de torneos (RF-05 a RF-07).
- Creacion, edicion, publicacion e inscripcion basica a torneos (RF-08 a RF-10).
- Perfil y preferencias principales (RF-13 y RF-14).
- Persistencia local, validaciones, seguridad y uso sin conexion para operaciones locales.
- Interfaz, textos, mensajes y contenido estatico en ingles (RNF-05).

### Fases posteriores al MVP

- Seguimiento de eventos, partidas, brackets y resultados (RF-11 y RF-12).
- Notificaciones y actualizaciones de torneos (RF-15).
- Roles completos de Usuario, Organizador y Administrador y administracion global (RF-16 y RF-17).
- Ampliacion de perfiles, rankings, estadisticas, auditoria y gestion de reportes conforme a los modulos E y F.

Las fases posteriores forman parte del alcance total del proyecto, aunque no del primer entregable funcional. Deben permanecer como pendientes hasta contar con implementacion, pruebas y criterios de salida cumplidos.

## 3. Decisiones tecnicas

- **Framework:** React Native con Expo.
- **Lenguaje:** TypeScript.
- **Estilos:** NativeWind.
- **Persistencia:** Expo SQLite en el almacenamiento privado de Android.
- **Arquitectura:** componentes de UI, tipos, hooks de acceso a datos y capa de base de datos separadas.
- **Navegacion:** navegacion movil con pantallas independientes y retorno mediante el back stack.
- **Idioma:** ingles para todos los elementos visibles de la aplicacion; no se ofrecera selector de idioma en esta version (RNF-05).
- **Seguridad local:** no guardar contrasenas en texto plano; almacenar un hash o mecanismo seguro equivalente y proteger los datos locales.
- **Compatibilidad offline:** las operaciones de consulta y gestion local deben funcionar sin servidor externo; los flujos de correo y notificaciones remotas requieren definir un servicio y su comportamiento sin conexion.

## 4. Fases de trabajo

### Fase 1 - Preparacion del proyecto

1. Preparar el entorno Android en Windows 11 siguiendo la guia de configuracion de emulador incluida abajo.
2. Crear o configurar el proyecto Expo con React Native y TypeScript.
3. Instalar y configurar NativeWind y Expo SQLite.
4. Definir la navegacion principal y la estructura de carpetas indicada en la especificacion.
5. Configurar variables de entorno y reglas de calidad de codigo.

#### Emulador Android en Windows 11

1. Instalar Android Studio desde el sitio oficial de Android Developers. En el asistente de configuracion, instalar Android SDK, Android SDK Platform-Tools y Android Emulator.
2. En Android Studio, abrir **Tools > SDK Manager** e instalar la plataforma Android y las herramientas de compilacion requeridas por la version de Expo del proyecto. Confirmar que Android SDK Platform-Tools y Android Emulator esten instalados en **SDK Tools**.
3. Activar la virtualizacion de hardware (Intel VT-x o AMD-V/SVM) en UEFI/BIOS. En Windows, habilitar **Windows Hypervisor Platform** si el emulador lo requiere y reiniciar el equipo. Confirmar la aceleracion con `emulator -accel-check`.
4. Definir `ANDROID_HOME` con la ruta del SDK (por defecto `%LOCALAPPDATA%\Android\Sdk`) y agregar `%ANDROID_HOME%\platform-tools` y `%ANDROID_HOME%\emulator` al `Path` del usuario. Abrir una terminal nueva para que lea las variables actualizadas.
5. En **Tools > Device Manager**, crear un dispositivo virtual (por ejemplo, un perfil Pixel) e instalar una imagen de sistema x86_64 compatible con la plataforma objetivo del proyecto. Iniciar el AVD y completar su configuracion inicial.
6. Verificar que Windows detecte el dispositivo y que Expo pueda abrir la app con `adb devices`, `emulator -list-avds` y `npm run android` desde la raiz del proyecto.

Si las rutas o menus cambian entre versiones de Android Studio, usar **SDK Manager** para consultar la ruta real del SDK y **Device Manager** para administrar los AVD. No guardar variables privadas ni claves dentro del repositorio.

**Entregable:** proyecto ejecutable en Android con navegacion base.

**Verificacion del desarrollador:** comprobar aceleracion del emulador, confirmar que el AVD aparece en `adb devices`, iniciar la aplicacion con `npm run android`, recorrer Home, Tournaments, Events y Profile, y comprobar que no hay errores de compilacion ni de ejecucion.

**Criterio de salida:** Android Studio, SDK y AVD quedan configurados en Windows 11; el emulador inicia y es detectado por ADB; la aplicacion abre y las cuatro rutas principales responden sin errores.

### Fase 2 - Modelo de datos y persistencia

1. Diseñar el esquema SQLite para usuarios, torneos, juegos, paises y rankings.
2. Crear la inicializacion de la base de datos y las migraciones necesarias en `src/database/db.ts`.
3. Definir interfaces TypeScript para torneos, usuarios y jugadores.
4. Implementar operaciones de insercion, consulta, actualizacion y eliminacion.
5. Agregar indices para busquedas por juego, pais y estado del torneo.

**Entregable:** base de datos local inicializada y probada.

**Verificacion del desarrollador:** iniciar la aplicacion, confirmar que SQLite crea o actualiza el esquema, insertar un registro de prueba, consultarlo, modificarlo y eliminarlo; reiniciar la aplicacion y comprobar la persistencia.

**Criterio de salida:** las migraciones se ejecutan sin errores, las operaciones CRUD funcionan y las restricciones impiden guardar datos invalidos.

### Fase 3 - Componentes y estilos base

1. Crear los componentes atomicos `Card`, `Input`, `Badge`, `Button` y `Modal`.
2. Crear componentes de torneos como `TournamentList`, `TournamentCard` y `RankingRow`.
3. Definir estados visuales para carga, lista vacia, error y validacion.
4. Asegurar adaptacion a diferentes tamanos de pantalla y uso de controles nativos.

**Entregable:** biblioteca minima de UI reutilizable y consistente con el diseno entregado.

**Verificacion del desarrollador:** abrir una pantalla de prueba que use todos los componentes, revisar estados normal, carga, vacio, error y validacion, y probarla en un dispositivo o emulador con diferentes tamanos de pantalla.

**Criterio de salida:** los componentes se renderizan sin errores, no generan desbordamientos visibles y mantienen un comportamiento consistente en los estados definidos.

### Fase 4 - Acceso y autenticacion

1. Implementar las pantallas de registro e inicio de sesion.
2. Validar nombre de usuario, correo y contrasena antes de escribir en SQLite.
3. Crear el flujo de verificacion de cuenta con codigo de seis digitos.
4. Implementar el flujo de inicio de sesion con verificacion de dos factores mediante codigo de seis digitos enviado al correo.
5. Implementar el cierre de sesion con eliminacion segura de la sesion y redireccion al login.
6. Mantener el estado de sesion y proteger las pantallas que requieren usuario autenticado.
7. Preparar una interfaz de servicio para sustituir el flujo local por JWT/OAuth2 cuando exista un backend.

**Entregable:** usuario registrado y autenticado localmente con validaciones funcionales.

**Verificacion del desarrollador:** registrar un usuario valido, intentar registros con campos vacios, correo invalido y contrasena insegura, verificar la cuenta con codigo de seis digitos, iniciar sesion con credenciales correctas y verificar el codigo de seis digitos enviado al correo, cerrar sesion y verificar que la sesion se elimina correctamente, rechazar credenciales incorrectas y codigos invalidos o expirados.

**Criterio de salida:** solo se crean usuarios validos, la contrasena no se almacena en texto plano, la sesion se mantiene correctamente y las pantallas protegidas bloquean usuarios no autenticados.

### Fase 5 - Consulta y administracion de torneos

1. Implementar la pantalla de listado de torneos.
2. Agregar busqueda por texto.
3. Agregar filtros por tipo de juego y pais.
4. Permitir abrir el detalle de un torneo.
5. Mostrar acciones de administracion solo para los torneos creados por el usuario.
6. Implementar el hook `useTournaments` para centralizar las consultas SQLite.

**Entregable:** catalogo local consultable, filtrable y administrable.

**Verificacion del desarrollador:** cargar torneos de prueba, buscar por texto, aplicar filtros por juego y pais, combinar filtros, abrir un detalle y comprobar que las acciones de administracion solo aparecen para el creador.

**Criterio de salida:** el listado refleja los datos de SQLite, la busqueda y los filtros devuelven resultados correctos, y los estados de lista vacia y error son visibles.

### Fase 6 - Creacion, detalle y edicion

1. Crear el formulario de nuevo torneo.
2. Validar fecha y hora, campos obligatorios, visibilidad, alcance y requisitos.
3. Guardar el torneo validado en SQLite.
4. Mostrar una vista con todas las especificaciones del torneo creado.
5. Implementar la edicion y actualizacion del torneo.
6. Implementar el cierre de la vista y el regreso al listado mediante el back stack.

**Entregable:** flujo de creacion, edicion y consulta de torneos (RF-06 a RF-09).

**Verificacion del desarrollador:** crear un torneo valido, confirmar que aparece en el detalle y en el listado, intentar guardar fechas o campos invalidos, editarlo, cerrar la vista y verificar el regreso al catalogo.

**Criterio de salida:** ningun torneo invalido se guarda, los datos creados y editados persisten al reiniciar la aplicacion y el flujo de cierre retorna a la pantalla de consulta.

### Fase 7 - Pruebas y entrega Android

1. Probar los flujos MVP RF-01 a RF-10, RF-13, RF-14 y RF-18 en Android.
2. Verificar persistencia despues de cerrar y volver a abrir la aplicacion.
3. Probar validaciones con datos vacios, fechas invalidas y contrasenas inseguras.
4. Verificar busqueda y filtros combinados.
5. Comprobar que el uso principal funcione sin conexion.
6. Generar el paquete Android y documentar la instalacion.

**Entregable:** version candidata del MVP y paquete compatible con Android.

**Verificacion del desarrollador:** ejecutar la lista completa de pruebas en un dispositivo Android limpio, repetir los flujos despues de reiniciar la aplicacion, desconectar la red, revisar la interfaz y generar el paquete Android.

**Criterio de salida:** los requisitos MVP asignados a las fases 1 a 7 funcionan sin regresiones, la persistencia local se conserva sin conexion, la interfaz esta en ingles, no hay bloqueos durante el uso principal y el paquete se instala correctamente.

### Fase 8 - Inscripciones, eventos y perfil completo

1. Completar el ciclo de inscripcion y participacion: requisitos, solicitud, cancelacion, cupos y estado (RF-10).
2. Implementar las vistas de Eventos para eventos proximos, activos y finalizados, relacionadas con sus torneos (RF-11).
3. Completar el perfil con historial, estadisticas y ranking local, y las preferencias permitidas (RF-13 y RF-14).
4. Conservar el contexto de origen al abrir y cerrar detalles (RF-18).

**Entregable:** flujos completos de participacion, eventos y perfil.

**Verificacion del desarrollador:** probar solicitudes y cancelaciones de inscripcion, cupos agotados, estados de eventos, datos de perfil y retorno a la seccion de origen.

**Criterio de salida:** los datos y estados se conservan en SQLite y los flujos muestran resultados correctos tras reiniciar la aplicacion.

### Fase 9 - Operacion de partidas y resultados

1. Implementar la administracion de fases, brackets, partidas y horarios (RF-12).
2. Permitir asignar participantes y responsables, registrar marcadores y resolver disputas.
3. Actualizar clasificaciones y publicar resultados.
4. Registrar cambios y mostrar resultados en los detalles de eventos y torneos.

**Entregable:** flujo verificable de operacion de un torneo hasta la publicacion de resultados.

**Verificacion del desarrollador:** recorrer un torneo de prueba desde la configuracion de fases hasta la publicacion, incluyendo validacion de resultados y actualizacion del ranking.

**Criterio de salida:** solo usuarios autorizados pueden modificar partidas; resultados y clasificaciones persisten y se reflejan de forma consistente.

### Fase 10 - Roles, notificaciones y administracion

1. Aplicar permisos para Usuario, Organizador y Administrador en pantallas y operaciones (RF-16).
2. Implementar notificaciones para verificaciones, inscripciones, horarios, partidas, resultados e invitaciones (RF-15).
3. Implementar las funciones administrativas para usuarios, roles, catalogos, reportes, parametros globales y auditoria (RF-17).
4. Registrar acciones administrativas y validar acceso no autorizado.

**Entregable:** operacion protegida por roles y modulo administrativo auditable.

**Verificacion del desarrollador:** probar cada rol con acciones permitidas y denegadas, el ciclo de notificaciones y las operaciones de administracion con registro de auditoria.

**Criterio de salida:** los permisos se aplican de manera consistente en interfaz y logica de negocio, y las acciones administrativas quedan trazables.

### Fase 11 - Validacion integral y entrega final

1. Ejecutar pruebas de aceptacion para RF-01 a RF-18 y RNF-01 a RNF-05.
2. Verificar flujos offline y documentar dependencias que requieran correo o servicios externos.
3. Revisar todas las pantallas contra `UI_AppTorneos.pdf` y probar navegacion contextual.
4. Generar y validar el paquete Android final.

**Entregable:** version final Android con todos los requisitos implementados o con pendientes formalmente identificados.

**Criterio de salida:** todos los requisitos se encuentran trazados a una implementacion y prueba; cualquier requisito no completado se reporta como pendiente y no como aceptado.

## 5. Modelo de datos inicial

### Usuario

- `id`
- `username`
- `email`
- `password_hash`
- `is_verified`
- `role`
- `created_at`

### Torneo

- `id`
- `name`
- `start_datetime`
- `game_id`
- `country_id`
- `visibility`
- `scope`
- `requirements`
- `status`
- `created_by`
- `created_at`
- `updated_at`

### Catalogos y soporte

- `games`: juegos disponibles y sus categorias.
- `countries`: paises y regiones.
- `players`: jugadores registrados localmente.
- `rankings`: puntuacion, posicion y estadisticas basicas del jugador.
- `registrations`: inscripciones y estado de participacion por torneo.
- `events`, `stages` y `matches`: eventos, fases, partidas, horarios, resultados y disputas.
- `notifications`: notificaciones locales y estado de lectura; las remotas requieren servicio externo.
- `user_preferences`: privacidad y preferencias de notificacion, sin selector de idioma.
- `reports` y `audit_logs`: reportes y trazabilidad de las acciones administrativas.

El modelo se incorporara por fases; las tablas no necesarias para el MVP pueden agregarse en las fases 8 a 10. Las relaciones deben usar claves foraneas y restricciones para impedir torneos sin usuario creador, juego o pais valido, e inscripciones o partidas duplicadas o inconsistentes.

## 6. Criterios de aceptacion

- Cada requisito RF-01 a RF-18 debe estar asociado a una fase, una pantalla o servicio responsable y una prueba de aceptacion antes de marcarse como completado.
- El registro, inicio de sesion, verificacion y recuperacion validan los datos y estados definidos; las contrasenas no se almacenan en texto plano.
- Home y la navegacion permiten acceder a Torneos, Eventos y Perfil, y al volver de un detalle conservan la seccion de origen y su contexto.
- La busqueda y los filtros de torneos contemplan nombre, juego, organizador, pais, fecha, estado, visibilidad y alcance.
- La creacion, publicacion, edicion, cancelacion, cierre e inscripcion respetan fechas, cupos, requisitos, permisos y persistencia local.
- Los eventos muestran estados y calendario; las partidas, resultados, disputas y clasificaciones se actualizan de forma consistente.
- El perfil presenta informacion, historial, estadisticas y ranking disponibles, y solo permite editar campos autorizados.
- Los roles limitan las acciones permitidas; la administracion global y las acciones sensibles quedan registradas.
- Toda la interfaz, navegacion, mensajes y contenido estatico se presenta en ingles (RNF-05), sin preferencia de cambio de idioma.
- Los datos locales persisten en SQLite y las operaciones locales definidas funcionan sin conexion; las dependencias de red se documentan y prueban por separado.
- La aplicacion cumple RNF-01 a RNF-04 y muestra estados de carga, vacio, error y validacion en los flujos correspondientes.

## 7. Riesgos y decisiones pendientes

- **Offline frente a verificacion y recuperacion por correo:** RF-03 requiere correo y tokens temporales, mientras el producto se define como offline. Antes de implementar el flujo final se debe decidir si el correo real requiere conectividad, o si se acepta un modo local/simulado; no se debe presentar el modo simulado como envio real.
- **JWT/OAuth2 frente a autonomia local:** JWT/OAuth2 presupone un servicio de identidad. Se recomienda encapsularlo en una interfaz para usar autenticacion local durante el MVP y cambiar de proveedor sin modificar las pantallas.
- **Cifrado de SQLite:** Expo SQLite ofrece persistencia local, pero la proteccion de secretos debe definirse antes de produccion. Las credenciales y claves sensibles deben usar almacenamiento seguro del dispositivo y hashing apropiado.
- **Documentos de UI y casos de uso:** antes de cerrar la implementacion se deben contrastar las pantallas con `UI_AppTorneos.pdf` y el alcance de los casos de uso con el diagrama referenciado en `spec.md`.

## 8. Estructura inicial esperada

```text
src/
├── components/
│   ├── ui/
│   └── tournaments/
├── database/
├── hooks/
├── types/
└── App.tsx
```

La estructura puede ampliarse con carpetas de navegacion, pantallas y servicios cuando el proyecto lo requiera, manteniendo separadas la interfaz, la logica de negocio y la persistencia.

## 9. Validacion contra los documentos fuente

### Punto 6 de `spec.md`: portafolio de diseno UI

El portafolio `UI_AppTorneos.pdf` contiene 18 pantallas o estados visuales. El desarrollo debe utilizarlas como referencia de navegacion, contenido y jerarquia visual, no solo como inspiracion.

| Elemento identificado en el portafolio | Fase responsable | Validacion |
| --- | --- | --- |
| Perfil, preferencias y juego favorito | Fases 3 y 8 | Comprobar datos visibles y editables, preferencias permitidas y acceso desde la navegacion principal. |
| Estadisticas, ranking e historial | Fases 2, 8 y 9 | Verificar el modelo local y estados vacios/con datos para ranking e historial. |
| Recuperacion y cambio de contrasena | Fase 4 | Validar campos, confirmacion, codigo temporal y rechazo de valores invalidos. |
| Verificacion de correo y reenvio | Fase 4 | Comprobar estado pendiente, expiracion, confirmacion y reenvio; distinguir modo simulado de servicio real. |
| Listado, filtros, detalle, creacion y administracion de torneos | Fases 5, 6 y 8 | Probar filtros del spec, acciones por rol, inscripcion, edicion y retorno al contexto. |
| Navegacion inferior, Home, Eventos y estados | Fases 1, 3 y 8 | Recorrer las cuatro secciones, revisar carga/vacio/error y probar navegacion contextual en Android. |
| Brackets, partidas y resultados | Fase 9 | Completar un flujo de torneo con registro y publicacion de resultados. |
| Interfaz en ingles | Todas las fases | Revisar pantallas, validaciones, notificaciones y estados para asegurar que no queden textos visibles en otro idioma. |

**Criterio de validacion del punto 6:** cada pantalla del portafolio debe estar asignada a una ruta o componente del proyecto, conservar su flujo de navegacion y superar una prueba visual y funcional en un emulador o dispositivo Android. Las pantallas que dependan de funcionalidades fuera del MVP deben quedar registradas como pendientes, no como funcionalidades terminadas.

### Punto 4 de `spec.md`: modulos y casos de uso

| Modulo | Casos de uso considerados | Cobertura en el plan |
| --- | --- | --- |
| A. Login, registro y recuperacion de cuenta | Registro, verificacion, reenvio, inicio de sesion y recuperacion | Fase 4; dependencia del envio real de correo registrada como decision pendiente. |
| B. Home y navegacion inferior | Feed de Home, cuatro pestañas, detalle y retorno al contexto | Fases 1, 3 y 5; se valida navegacion contextual en Fase 8. |
| C. Gestion y participacion en torneos | Consulta, filtros, detalle, creacion, publicacion, inscripcion y administracion | Fases 5, 6 y 8; el alcance de filtros sigue RF-06. |
| D. Eventos, partidas y resultados | Eventos proximos/activos/finalizados, calendario, brackets, partidas y resultados | Fases 8 y 9; requiere pruebas de autorizacion y consistencia de clasificaciones. |
| E. Perfil y cuenta del usuario | Perfil, historial, estadisticas, ranking, edicion y preferencias | Fases 2, 8 y 10; no incluye cambio de idioma. |
| F. Operacion del organizador | Participantes, aprobaciones, cupos, siembra, penalizaciones, arbitros, disputas y estadisticas | Fases 8 a 10, segun dependencias de eventos, permisos y auditoria. |
| Administracion global (RF-17) | Usuarios, roles, catalogos, reglas, reportes, parametros y auditoria | Fase 10; complemento administrativo de RF-16 y del modulo F. |

**Criterio de validacion del punto 4:** ningun caso de uso puede marcarse como completado sin pantalla o servicio responsable, prueba funcional y criterio de aceptacion. Los casos asignados a fases posteriores permanecen pendientes hasta superar su verificacion.

### Resultado de la validacion

- Los RF-01 a RF-18 y RNF-01 a RNF-05 tienen cobertura en las fases, criterios de aceptacion o decisiones pendientes del plan.
- Los seis modulos del punto 4 y las pantallas del portafolio UI quedan vinculados a fases y comprobaciones concretas.
- El plan separa el alcance del MVP de las fases posteriores sin descartar requisitos del spec ni presentar trabajo pendiente como implementado.
- La interfaz en ingles es un requisito transversal de todas las fases.
