# Tareas de desarrollo - TierX

Checklist derivado de [spec.md](spec.md) y [plan.md](plan.md). Mantener las tareas futuras pendientes hasta que su implementacion y validacion esten completas.

## Prioridades

- **MVP:** requerido para la primera version funcional.
- **Posterior:** alcance del proyecto que se implementara despues del MVP.
- **Transversal:** aplica a todas las fases.

## 0. Decisiones y preparacion

- [x] **T-001 [MVP]** Revisar `UI_AppTorneos.pdf` y `digramaDeCasosDeUsoTIERX.pdf`; relacionar pantallas, casos de uso y requisitos RF con tareas de este archivo. Pantallas de perfil/ranking -> T-090 a T-094; acceso/recuperacion -> T-040 a T-048; Home, navegacion y torneos -> T-050 a T-074; eventos y partidas -> T-080 a T-086; administracion -> T-100 a T-105. Los actores visitante, participante y administrador quedan cubiertos en los flujos respectivos.
- [ ] **T-002 [MVP]** Acordar como conviviran el funcionamiento offline y la verificacion/recuperacion por correo de RF-03; documentar claramente cualquier modo local simulado.
- [x] **T-003 [MVP]** Definir estrategia de almacenamiento seguro para credenciales y datos locales antes de implementar autenticacion: cifrar SQLite con SQLCipher, guardar la clave de cifrado y secretos de sesion en Android Keystore mediante `expo-secure-store`, almacenar solo hashes de contrasena con sal y una funcion KDF apropiada (Argon2id), y nunca persistir contrasenas en texto plano. Validar compatibilidad de dependencias con el build nativo de Expo antes de implementarla.
- [x] **T-004 [Transversal]** Establecer que textos, controles, mensajes, errores, estados y contenido estatico de la app se presentaran en ingles (RNF-05); no agregar selector de idioma.

**Pendiente de acuerdo para T-002:** la verificacion real de correo y la recuperacion por email necesitan conectividad. Recomendacion: mantener el correo real como flujo que requiere internet y permitir que las demas funciones locales sigan operando offline; una verificacion simulada/local no debe mostrarse como correo enviado ni cuenta verificada por email.

## 1. Preparacion del proyecto (Plan: Fase 1)

- [x] **T-010 [MVP]** Crear/configurar el proyecto React Native con Expo y TypeScript (RNF-01).
- [x] **T-011 [MVP]** Instalar y configurar NativeWind y Expo SQLite.
- [x] **T-012 [MVP]** Configurar navegacion Android con las secciones Home, Torneos, Eventos y Perfil (RF-04).
- [x] **T-013 [MVP]** Crear la estructura inicial de `src/components`, `src/database`, `src/hooks`, `src/types` y `src/App.tsx`.
- [x] **T-014 [MVP]** Configurar reglas de calidad y validaciones automatizadas del proyecto.
	- [x] Configurar TypeScript estricto, `npm run typecheck`, ESLint con `npm run lint` y `.env.example` sin secretos.
	- [x] Validar versiones con `expo install --check` y generar el bundle de Android con Metro.
- [x] **T-015 [MVP]** Instalar Android Studio en Windows 11 e incluir Android SDK, Platform-Tools y Android Emulator. Verificado en `C:\Program Files\Android\Android Studio`; ADB 37.0.1 y Emulator 37.1.11 responden desde `%LOCALAPPDATA%\Android\Sdk`.
- [x] **T-016 [MVP]** Instalar en SDK Manager la plataforma y herramientas de compilacion requeridas por la version de Expo del proyecto. Instalados Android 36, Build Tools 36.0.0 y la imagen `android-36;google_apis;x86_64` para React Native/Expo SDK 57.
	- [x] **T-017 [MVP]** Habilitar virtualizacion (VT-x o AMD-V/SVM), configurar Windows Hypervisor Platform cuando aplique y verificar aceleracion con `emulator -accel-check`.
	- [x] El procesador AMD Ryzen 7 8700F reporta virtualizacion de firmware habilitada (`VirtualizationFirmwareEnabled=True`).
	- [x] Windows Hypervisor Platform (WHPX) esta instalado y operativo; `emulator -accel-check` devuelve `WHPX is installed and usable`.
- [x] **T-018 [MVP]** Configurar `ANDROID_HOME` y agregar `platform-tools` y `emulator` al `Path` del usuario; abrir una terminal nueva y validar `adb` y `emulator`. Persistidos `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `JAVA_HOME` y las rutas de Platform-Tools, Emulator, Command-line Tools y JBR en el entorno de usuario; ADB y Emulator verificados.
- [x] **T-019 [MVP]** Crear e iniciar un AVD Pixel con imagen x86_64 compatible con el proyecto; verificarlo con `emulator -list-avds` y `adb devices`, ejecutar la app con `npm run android`, recorrer Home, Tournaments, Events y Profile y corregir fallos de inicio o navegacion. Verificado `TierX_Pixel_API36` (Pixel 6, Android 16/API 36, Google APIs/x86_64), ADB `emulator-5554`, bundle Metro y navegacion por las cuatro pestañas.

**Aceptacion:** Android Studio, SDK y AVD quedan configurados en Windows 11; el emulador inicia y es detectado por ADB; la app abre y se recorren las cuatro pestañas sin errores. T-015 a T-019 completadas y verificadas en la PC de desarrollo.

## 2. Modelo de datos y persistencia (Plan: Fase 2)

- [x] **T-020 [MVP]** Diseñar las tablas iniciales para usuarios, torneos, juegos, paises, participantes y rankings en `src/database/schema.ts`.
- [x] **T-021 [MVP]** Implementar inicializacion, migraciones versionadas y restricciones SQLite en `src/database/db.ts` (version actual: 2).
- [x] **T-022 [MVP]** Definir tipos TypeScript para usuarios, torneos, jugadores, rankings, juegos y paises en `src/types/`.
- [x] **T-023 [MVP]** Implementar operaciones CRUD y consultas parametrizadas para usuarios, jugadores y torneos, además de catalogos y rankings en `src/database/repositories.ts`.
- [x] **T-024 [MVP]** Agregar indices para busquedas por nombre, juego, pais, organizador, estado, visibilidad, fecha y rankings.
- [x] **T-025 [Posterior]** Extender el modelo con tablas base para inscripciones, eventos, fases, partidas, notificaciones, preferencias, reportes y auditoria (RF-10 a RF-17). El esquema queda preparado; la logica funcional de esos modulos sigue asignada a las fases posteriores.
- [x] **T-026 [MVP]** Probar migraciones, restricciones, CRUD y persistencia despues de reiniciar la app (RNF-02, RNF-04). Verificado en el AVD: `user_version=2`, tablas requeridas, claves foraneas activas, filtros, CRUD, rechazo de capacidad invalida y `SQLite v2 persistence and integration checks passed` en dos aperturas.

**Aceptacion:** el esquema se crea y migra correctamente; las operaciones validas persisten y los datos invalidos son rechazados.

## 3. Componentes y estilos base (Plan: Fase 3)

- [x] **T-030 [MVP]** Crear componentes reutilizables `Card`, `Input`, `Badge`, `Button` y `Modal` en `src/components/ui/`.
- [x] **T-031 [MVP]** Crear `TournamentList`, `TournamentCard` y `RankingRow` en `src/components/tournaments/`.
- [x] **T-032 [MVP]** Implementar estados de carga, lista vacia, error y validacion en los componentes correspondientes. `TournamentList` y `FeedbackState` cubren carga/vacio/error; `Input` expone error y hint de validacion.
- [x] **T-033 [MVP]** Revisar controles nativos, legibilidad y adaptacion a distintos tamanos de pantalla (RNF-03). Verificado en el AVD Android 16 a 1080x2400 y 720x1600; búsqueda con teclado nativo, filtro/modal y barra inferior comprobados sin recortes en el viewport reducido.
- [x] **T-034 [Transversal]** Verificar que textos y mensajes de los componentes esten en ingles (RNF-05). Controles y estados implementados con textos visibles en ingles.

La pantalla `Tournaments` ya consume el hook SQLite y presenta búsqueda, filtro de estado y feedback real. El AVD no contiene torneos de usuario, por lo que la lista muestra correctamente el estado vacío; mostrar tarjetas con datos de torneo depende de las fases de datos/flujo correspondientes.

**Aceptacion:** los componentes se renderizan en Android en estados normales y alternativos sin desbordamientos ni errores visibles.

## 4. Acceso y autenticacion (Plan: Fase 4; RF-01 a RF-03)

- [x] **T-040 [MVP]** Implementar registro con usuario, correo, contrasena, confirmacion y aceptacion de terminos en `src/screens/auth/RegisterScreen.tsx`; crear la cuenta como pendiente de verificacion.
- [x] **T-041 [MVP]** Validar campos, unicidad, formato de correo y seguridad de contrasena antes de guardar (RNF-04). Validaciones de interfaz y restricciones SQLite de username/email; contrasena de 10-12 caracteres con mayuscula, minuscula y numero.
- [x] **T-042 [MVP]** Guardar credenciales de forma segura; nunca almacenar contrasenas en texto plano (RNF-02). Hash Argon2id con salt aleatoria en SQLite; id de sesion persistido mediante `expo-secure-store`/Android Keystore.
- [ ] **T-043 [MVP]** Implementar verificacion de cuenta con token temporal de seis digitos, expiracion y opcion de reenvio.
	- [x] Implementar pantalla de verificacion, entrada numerica de seis digitos y contrato `EmailAccountProvider` para envio, verificacion y reenvio.
	- [ ] Conectar proveedor real de correo que genere/valide tokens, TTL y reenvio. Sigue pendiente de la decision T-002 y de un servicio online; la app no marca cuentas verificadas por si sola.
- [x] **T-044 [MVP]** Implementar inicio de sesion con correo o nombre de usuario, errores de validacion, verificacion de dos factores mediante codigo temporal de seis digitos enviado al correo y conservacion de sesion. Se rechazan credenciales incorrectas, cuentas no verificadas y codigos invalidos o expirados.
- [ ] **T-045 [MVP]** Implementar recuperacion de contrasena con codigo temporal y establecimiento de una nueva contrasena.
	- [x] Implementar pantalla y contrato de servicio para solicitar codigo, ingresarlo y actualizar la contrasena con Argon2id.
	- [ ] Conectar envio y validacion remotos del codigo de recuperacion; depende de la decision T-002 y del proveedor email.
- [x] **T-046 [MVP]** Proteger las pantallas autenticadas con una compuerta de sesion; permitir cerrar sesion desde Profile y borrar el id guardado en SecureStore.
- [x] **T-047 [MVP]** Encapsular autenticacion tras `AuthService` y `EmailAccountProvider` para integrar un proveedor futuro sin acoplar las pantallas a la red.
- [ ] **T-048 [MVP]** Probar registro correcto/incorrecto, verificacion, expiracion, reenvio, recuperacion, verificacion de dos factores en login y credenciales de inicio de sesion.
	- [x] Probar validaciones de formulario, aceptacion de terminos, hash Argon2id, registro pendiente, bloqueo de login no verificado, login verificado, contraseña incorrecta, restauracion de sesion y logout mediante `runAuthIntegrationChecks` y el AVD.
	- [ ] Probar envio/reenvio, expiracion de token, verificacion real, verificacion de dos factores en login y recuperacion real cuando se integre el proveedor online.

**Aceptacion:** las cuentas y sesiones locales respetan sus estados, los errores se muestran en ingles y los secretos se almacenan de forma segura. Los flujos RF-03 solo se consideran completos tras resolver T-002 e integrar/probar un proveedor real de correo.

## 5. Home, navegacion y consulta de torneos (Plan: Fases 5 y 6; RF-04 a RF-07, RF-18)

- [ ] **T-050 [MVP]** Implementar barra inferior con Home, Torneos, Eventos y Perfil e identificacion visual de la pestaña activa.
- [ ] **T-051 [MVP]** Implementar Home con colecciones Can interest you, Near you, Competitive y Others, actividad, ranking y accesos rapidos.
- [ ] **T-052 [MVP]** Implementar listado de torneos publicos, propios y seguidos.
- [ ] **T-053 [MVP]** Implementar busqueda por nombre, juego y organizador.
- [ ] **T-054 [MVP]** Implementar filtros por juego, pais, fecha, estado, visibilidad y alcance.
- [ ] **T-055 [MVP]** Implementar detalle de torneo con identidad visual, organizador, fechas, zona horaria, reglas, requisitos, cupos, participantes, estado y calendario.
- [ ] **T-056 [MVP]** Implementar `useTournaments` para centralizar consultas SQLite.
- [ ] **T-057 [MVP]** Mantener la seccion de origen, filtros y posicion al abrir y cerrar un detalle (RF-18).
- [ ] **T-058 [MVP]** Probar busqueda, filtros combinados, listado vacio, errores y navegacion contextual.

**Aceptacion:** los listados y detalles corresponden a SQLite, los filtros contemplan RF-06 y el usuario vuelve a la vista de origen conservando su contexto.

## 6. Creacion y administracion de torneos (Plan: Fase 6; RF-08 y RF-09)

- [ ] **T-060 [MVP]** Crear formulario por pasos para informacion general, juego/ubicacion, fechas, formato/cupos, reglas/requisitos, premios y visibilidad.
- [ ] **T-061 [MVP]** Validar campos, fechas, zona horaria, cupos y coherencia del formato antes de guardar.
- [ ] **T-062 [MVP]** Permitir guardar borradores y crear/publicar torneos.
- [ ] **T-063 [MVP]** Implementar edicion del torneo y vista previa antes de publicar.
- [ ] **T-064 [MVP]** Implementar acciones permitidas de edicion, despublicacion, cancelacion y cierre.
- [ ] **T-065 [MVP]** Restringir acciones de administracion al organizador autorizado.
- [ ] **T-066 [MVP]** Probar persistencia de torneos, validaciones y permisos despues de reiniciar la app.

**Aceptacion:** el torneo valido se guarda y se refleja en listado y detalle; datos invalidos y acciones no autorizadas se rechazan.

## 7. Inscripciones y participacion (Plan: Fase 8; RF-10)

- [ ] **T-070 [MVP]** Validar requisitos y periodo de inscripcion antes de aceptar una solicitud.
- [ ] **T-071 [MVP]** Implementar solicitud, cancelacion y consulta del estado de participacion.
- [ ] **T-072 [MVP]** Validar disponibilidad de cupos y evitar inscripciones duplicadas.
- [ ] **T-073 [MVP]** Mostrar confirmacion y reflejar el torneo en la seccion correspondiente.
- [ ] **T-074 [MVP]** Probar cupos agotados, periodo cerrado, requisitos no cumplidos y cancelacion.

**Aceptacion:** cada inscripcion tiene un estado consistente, respeta las reglas del torneo y persiste localmente.

## 8. Eventos, partidas y resultados (Plan: Fases 8 y 9; RF-11 y RF-12)

- [ ] **T-080 [Posterior]** Implementar Eventos con vistas de proximos, activos y finalizados.
- [ ] **T-081 [Posterior]** Mostrar calendario, horarios, torneo relacionado, estado, participantes, bracket y enlaces disponibles.
- [ ] **T-082 [Posterior]** Implementar configuracion de fases, brackets y asignacion de partidas.
- [ ] **T-083 [Posterior]** Permitir asignar participantes, horarios y arbitros autorizados.
- [ ] **T-084 [Posterior]** Implementar registro de marcadores, evidencia cuando corresponda y gestion de disputas.
- [ ] **T-085 [Posterior]** Actualizar clasificaciones y publicar resultados en eventos y torneos.
- [ ] **T-086 [Posterior]** Probar ciclo de partida, autorizacion, resultado, disputa y persistencia.

**Aceptacion:** los eventos y resultados reflejan el estado persistido; solo organizadores autorizados pueden gestionar partidas.

## 9. Perfil, preferencias y ranking (Plan: Fases 8 y 9; RF-13 y RF-14)

- [ ] **T-090 [MVP]** Implementar Perfil con avatar, nombre, descripcion, pais, juego favorito, estadisticas, ranking e historial disponibles.
- [ ] **T-091 [MVP]** Mostrar torneos creados y participados, y permitir abrir sus detalles.
- [ ] **T-092 [MVP]** Implementar edicion de perfil para campos permitidos y preferencias de privacidad/notificaciones.
- [ ] **T-093 [MVP]** Implementar ranking local y su actualizacion segun resultados disponibles.
- [ ] **T-094 [MVP]** Probar guardar/cancelar cambios, validaciones y estados vacios del perfil.

**Aceptacion:** el perfil presenta datos persistentes y solo permite modificar informacion autorizada; no hay selector de idioma.

## 10. Roles, notificaciones y administracion (Plan: Fase 10; RF-15 a RF-17)

- [ ] **T-100 [Posterior]** Implementar roles Usuario, Organizador y Administrador.
- [ ] **T-101 [Posterior]** Aplicar permisos en interfaz y logica de negocio, incluyendo rechazo de acceso no autorizado.
- [ ] **T-102 [Posterior]** Implementar notificaciones para verificaciones, inscripciones, horarios, partidas, resultados, invitaciones y torneos seguidos.
- [ ] **T-103 [Posterior]** Implementar administracion de usuarios, roles, juegos, paises, reglas, torneos reportados, reportes y parametros globales.
- [ ] **T-104 [Posterior]** Registrar acciones administrativas en auditoria.
- [ ] **T-105 [Posterior]** Probar permisos permitidos/denegados, notificaciones y trazabilidad de cambios.

**Aceptacion:** cada rol solo puede ejecutar acciones autorizadas y las operaciones administrativas quedan auditadas.

## 11. Pruebas integrales y entrega Android (Plan: Fases 7 y 11; RNF-01 a RNF-05)

- [ ] **T-110 [MVP]** Ejecutar pruebas de aceptacion de las tareas MVP y requisitos asociados antes de publicar la primera version.
- [ ] **T-111 [MVP]** Verificar persistencia SQLite tras cerrar/reabrir y ejecutar los flujos locales sin conexion.
- [ ] **T-112 [Transversal]** Revisar en todas las pantallas ingles, validacion de datos, accesibilidad y estados de carga/vacio/error.
- [ ] **T-113 [MVP]** Comparar flujos y pantallas MVP con `UI_AppTorneos.pdf` y registrar lo pendiente.
- [ ] **T-114 [MVP]** Generar, instalar y probar el paquete Android en un dispositivo o emulador limpio.
- [ ] **T-115 [Posterior]** Ejecutar pruebas integrales RF-01 a RF-18 y RNF-01 a RNF-05 antes de declarar completo el alcance total.
- [ ] **T-116 [Posterior]** Documentar requisitos pendientes, dependencias de correo/servicios externos y resultados de validacion final.

**Aceptacion:** la version MVP cumple sus tareas etiquetadas MVP; el proyecto completo solo se declara terminado cuando se validan tambien las tareas posteriores y todos los RF/RNF.
