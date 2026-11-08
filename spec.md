# Especificación: App de Torneos (Gestor Local)

## 1. Propósito del Producto
La aplicación permite a los usuarios organizar, administrar y realizar el seguimiento de eventos de deportes electrónicos a nivel local de forma 100% online. A través de una plataforma interactiva e individual, el usuario puede registrar torneos, configurar participantes, gestionar las reglas de competencia y registrar los resultados de eventos casuales o de alto rendimiento.

La plataforma incorpora un sistema de ranking que clasifica a los jugadores registrados según su desempeño, facilitando el control de los emparejamientos y promoviendo un historial organizado del desarrollo competitivo de la comunidad local. Todas las funcionalidades requieren conexión a internet para su funcionamiento, incluyendo registro e inicio de sesión.

## 2. Requerimientos Funcionales
- **RF-01 — Registro de usuario:** El sistema deberá permitir crear una cuenta con nombre de usuario, correo electrónico, contraseña, confirmación de contraseña y aceptación de términos.
- **RF-02 — Inicio de sesión:** El sistema deberá permitir iniciar sesión con correo o nombre de usuario y contraseña, mostrar errores de validación y conservar la sesión mientras sea válida.
- **RF-03 — Cierre de sesión:** El sistema deberá permitir cerrar sesión de forma segura, eliminando la sesión activa y redirigiendo al usuario a la pantalla de inicio de sesión.
- **RF-04 — Navegación principal:** Después de autenticarse, el usuario deberá acceder a una barra de navegación inferior con las pestañas **Home**, **Torneos**, **Eventos** y **Perfil**. La pestaña activa deberá identificarse visualmente mediante un fondo gris más oscuro que cubra el área del botón seleccionado.
- **RF-05 — Página Home:** El sistema deberá mostrar torneos próximos, eventos destacados, actividad del usuario, ranking relevante y accesos rápidos para explorar o crear torneos. Los torneos de los que el usuario fue removido por un organizador no deberán aparecer en las colecciones de Home. El contador **"Following"** de la actividad del usuario únicamente sumará torneos que sigan activos (borrador, publicados o en curso); los torneos finalizados o cancelados dejarán de contarse.
- **RF-06 — Consulta de torneos:** La sección **Torneos** deberá permitir visualizar torneos públicos, propios y seguidos, buscarlos por nombre, juego u organizador, y filtrarlos por estado, fecha y alcance. Si el usuario fue removido de un torneo por su organizador, la tarjeta de previsualización deberá reemplazar la insignia de estado por una insignia **"Banned"** de color rojo.
- **RF-07 — Detalle de torneo:** El sistema deberá mostrar identidad visual, descripción, juego, organizador, fecha, hora, zona horaria, país, alcance, reglas, requisitos, cupos, participantes, estado, calendario y acciones disponibles según el rol. Si el usuario fue removido del torneo, la insignia de estado deberá reemplazarse por una insignia **"Banned"** de color rojo escarlata y la acción de inscripción deberá mostrar un botón deshabilitado **"Blocked"** con símbolo de prohibido.
- **RF-08 — Creación y edición de torneo:** El usuario autorizado deberá poder configurar nombre, descripción, imagen, juego, país, zona horaria, fechas, visibilidad, alcance, cupos, formato, reglas, requisitos, premios y periodo de inscripción.
- **RF-09 — Administración de torneos:** El organizador deberá poder guardar borradores, publicar, editar (mediante la acción **"Edit Tournament Configuration"**), cancelar, compartir torneos y gestionar sus inscripciones y participantes. La sección de gestión del detalle del torneo mostrará las acciones en el siguiente orden: **Manage Participants**, **Publish** (solo borradores), **Manage bracket**, **Cancel tournament** y **Edit Tournament Configuration**. La acción **"Manage Participants"** quedará bloqueada en cuanto el torneo inicie (estado `ongoing` o `completed`). Además, el organizador deberá disponer de la acción **"Start Tournament"** que inicia el torneo inmediatamente (publicado → en curso) sin esperar la fecha programada, conservando intacta la fecha de finalización. Para la gestión de participantes el sistema deberá ofrecer una pantalla dedicada (**"Manage Participants"**) que liste todos los registros con su nombre y estado, permitiendo aprobar pendientes, admitir jugadores en lista de espera, remover registrados y readmitir removidos o rechazados.
- **RF-10 — Inscripción y participación:** El usuario podrá validar requisitos, solicitar o cancelar su inscripción y consultar el estado de su participación en cada torneo. Si el usuario cancela su propia inscripción podrá volver a registrarse; en cambio, si fue removido o rechazado por el organizador (estado `rejected`), el sistema deberá impedir permanentemente su reingreso tanto en la validación de la interfaz como en la capa de datos, hasta que el organizador lo readmita. Una vez el torneo haya iniciado (estado `ongoing` o `completed`), la acción **"Cancel registration"** dejará de mostrarse. Si el participante fue eliminado del torneo en el bracket, en su lugar se mostrará un botón rojo deshabilitado **"You were ELIMINATED"** sin posibilidad de interacción.
- **RF-11 — Sección de eventos:** La sección **Eventos** deberá mostrar eventos próximos, activos y finalizados del usuario, con calendario, horarios, partidas, resultados, notificaciones y acceso al torneo relacionado.
- **RF-12 — Partidas y resultados:** El organizador autorizado deberá poder configurar fases y brackets, asignar partidas, publicar resultados y actualizar clasificaciones. La visualización del bracket deberá estar disponible para todos los usuarios en modo de solo lectura (a través del botón **"Check Bracket"**, visible en el detalle de los torneos en curso bajo la acción de inscripción), quedando la administración del bracket restringida exclusivamente al organizador o a un administrador.
- **RF-13 — Perfil:** La sección **Perfil** deberá mostrar avatar, nombre, descripción, país, juego favorito, estadísticas, ranking global o local, historial de torneos, torneos creados y configuración de cuenta. El indicador **"Playing"** únicamente contará los torneos en estado `ongoing` en los que el usuario esté registrado; **"Wins"** solo contará victorias definitivas de torneos completados (único superviviente) y **"Losses"** cada eliminación sufrida.
- **RF-14 — Edición de perfil y preferencias:** El usuario podrá modificar la información permitida, preferencias de notificaciones, privacidad y datos de su cuenta.
- **RF-15 — Notificaciones:** El sistema deberá informar sobre inscripciones, cambios de horario, inicio de partidas, resultados, invitaciones, remociones de torneos, eliminaciones en bracket y actualizaciones de torneos seguidos. Cuando un usuario con remociones o eliminaciones pendientes inicie sesión, el sistema deberá mostrar una pestaña emergente ("Removed from tournament" / "You were eliminated") que liste cada torneo del que fue removido o eliminado, marcándose como leídas al cerrarla. Desde la sección de notificaciones del perfil, el usuario podrá descartar todas sus notificaciones mediante un botón de cesta de basura con confirmación previa.
- **RF-16 — Roles y permisos:** El sistema deberá diferenciar como mínimo los roles **Usuario**, **Organizador** y **Administrador**, y mostrar únicamente las acciones autorizadas para cada rol.
- **RF-17 — Administración global:** El administrador deberá poder gestionar usuarios, roles, juegos, países, reglas, torneos reportados, reportes, parámetros globales y auditoría.
- **RF-18 — Navegación contextual:** Desde Home, Torneos, Eventos y Perfil, el usuario podrá abrir el detalle de un torneo y volver a la sección de origen conservando filtros, posición y contexto.
- **RF-19 — Zona horaria dependiente del país:** En el módulo de creación y edición de torneos, la selección de país, juego y zona horaria se realizará mediante menús desplegables. Las opciones del desplegable de zona horaria deberán filtrarse dinámicamente según el país seleccionado, mostrando únicamente las zonas horarias válidas para ese país. Si el país cambia y la zona horaria elegida ya no es válida, el sistema deberá limpiar la selección y solicitar una nueva.
- **RF-20 — Selectores de fecha y hora en la programación de torneos:** En el paso de fechas del formulario de creación y edición de torneos, los campos **Inicio de registro**, **Fin de registro**, **Inicio del torneo** y **Finalización del torneo** deberán capturarse exclusivamente mediante componentes de tipo DateTime Picker con interfaz de calendario (selección de día/mes/año) y de reloj (selección de hora/minutos) integrados, quedando bloqueada la entrada manual de texto en dichos campos. El sistema deberá deshabilitar y bloquear de forma estricta, tanto en la interfaz del calendario como en la validación lógica previa al guardado, cualquier fecha y hora anterior al momento actual más 24 horas (Hoy + 1 día), de modo que el inicio de registro, el fin de registro, el inicio del torneo y la finalización del torneo queden obligatoriamente planificados en tiempos futuros con hora y minutos específicos. Adicionalmente se deberá mantener la coherencia cronológica entre los cuatro hitos (el fin de registro no puede ser anterior al inicio de registro ni posterior al inicio del torneo, y la finalización del torneo no puede ser anterior a su inicio).
- **RF-21 — Contenido de demostración:** En instalaciones nuevas el sistema deberá generar datos de demostración en los que los torneos en curso (`ongoing`) se desarrollen entre el 15 y el 24 de noviembre de 2026, con ventanas de fechas variadas por torneo, capacidades de 12 a 20 participantes y todos sus cupos completamente ocupados.
- **RF-22 — Rondas como partidas multijugador:** Cada ronda de un stage se representa como una única tarjeta de match titulada **"Round N"** que aloja a todos los jugadores seleccionados para esa ronda (modelo `match_participants`). Los matches 1v1 heredados de datos de demostración mantienen su comportamiento clásico.
- **RF-23 — Creación de ronda con selección de jugadores:** La acción **"Add round"** deberá solicitar la cantidad de jugadores de la ronda (mínimo 2; mínimo 3 para stages de *double elimination*, con el aviso **"Minimum N players must participate."**) y desplegar a continuación una lista con checkboxes de los participantes registrados del torneo, con contador **"Match Players (seleccionados/N)"**. El sistema impedirá seleccionar más de N y exigirá exactamente N para confirmar.
- **RF-24 — Confirmación de participantes:** Al pulsar **"Confirm participants"** la selección queda bloqueada: desaparecen el input numérico, los checkboxes y el propio botón, mostrándose en su lugar un cuadro con el formato `Participant 1: nombre`, `Participant 2: nombre`, ..., `Participant N: nombre` (el prefijo **Participant N:** en negrilla) y el mensaje **"Participants confirmed for this match."**. Solo tras esta confirmación el sistema permite crear la ronda.
- **RF-25 — Inicio del match:** Bajo la confirmación aparecerá el botón **"Start match"**, que crea la ronda, persiste sus participantes y la marca como `ongoing` en el mismo instante. Una vez iniciado el match, la lista de jugadores queda en solo lectura (el cuadro Participant 1…N, sin checkboxes ni guardado de asignación).
- **RF-26 — Eliminación de jugadores por formato:** Al expandir una ronda en curso, el organizador verá el panel **"Select players to eliminate · {formato}"** con checkboxes sobre los participantes del match. En *single elimination* solo se permite marcar a 1 jugador (selección exclusiva); en *double elimination* se exige marcar exactamente N−1 y el botón se etiqueta **"Confirm eliminations"**, permaneciendo deshabilitado hasta completar la cuenta; en los demás formatos se exige dejar al menos 1 ganador.
- **RF-27 — Publicación de la ronda con mensaje del organizador:** La eliminación no se hace oficial hasta que el organizador escriba y publique un mensaje con los detalles de la ronda (panel **"Round details message"** obligatorio tras **Confirm elimination**; **"Back"** devuelve a la selección sin persistir nada). Al pulsar **"Send message"** el sistema completa la ronda, persiste el ganador y el texto de detalles, marca `eliminated = 1` en `match_participants` y notifica a todos los jugadores del match con el texto del organizador más una línea siguiente `Eliminated: nombres`.
- **RF-28 — Visualización de rondas completadas:** Al expandir una ronda completada, cualquier usuario (organizador, participante o espectador) verá el cuadro Participant 1…N, la línea de ganador(es) (`Winner: nombre` o `Winners: nombres` para supervivientes no eliminados), el mensaje de detalles del organizador y, en rojo, una línea `{Nombre} Eliminated` por cada jugador marcado como eliminado. Ningún dato del stage o de la ronda es modificable para quien no sea el organizador.
- **RF-29 — Cierre de stage:** El botón **"Close Stage"** (a la izquierda de **"Add round"**) pedirá confirmación y persistirá `stages.closed = 1`. Un stage cerrado no admite más rondas: desaparecen sus botones de gestión y se muestra el texto **"Stage closed."**, visible para organizadores, participantes y espectadores.
- **RF-30 — Descarte y cancelación de ronda:** El botón rojo **"Discard Round"** descartará la ronda en preparación (incluyendo el borrado del match pendiente si ya fue creado) y el botón **"Cancel Round"** dentro del match borrará el registro por completo, como si nunca se hubiera creado.
- **RF-31 — Exclusión de eliminados:** Los jugadores eliminados de un torneo no podrán volver a ser seleccionados en rondas futuras: el sistema los ocultará de las listas de checkboxes del formulario de ronda.
- **RF-32 — Notificación de eliminación:** Al publicarse una ronda, cada jugador eliminado recibirá una notificación de tipo `eliminated` ("You were eliminated") con el texto del organizador; la siguiente vez que abra la app se le mostrará una ventana emergente bloqueante con el mensaje, que se marca como leída al cerrarla.
- **RF-33 — Cierre automático y estadísticas:** Cuando solo quede un único participante no eliminado en un torneo, el sistema lo proclamará ganador definitivo: le registrará **+1 win** en el ranking del juego y marcará el torneo como `completed` automáticamente. Cada jugador eliminado registrará **+1 loss** en el momento de su eliminación. Un win únicamente se otorga por ganar la totalidad del torneo, nunca por ganar una ronda intermedia.
- **RF-34 — Historial de partidas:** El historial de matches del perfil incluirá las rondas multijugador en las que el jugador participó (además de los 1v1), mostrando la insignia **"Won"** si ganó o sobrevivió la ronda y **"Lost"** si fue eliminado, sin mostrar marcadores.

## 3. Requerimientos No Funcionales
- **RNF-01 — Aplicación móvil nativa:** Desarrollada exclusivamente para la plataforma Android mediante empaquetado compatible.
- **RNF-02 — Persistencia y Seguridad:** Toda la información de los torneos, usuarios y contraseñas se almacenará de forma segura. Las contraseñas se almacenarán como hashes usando Argon2id, y los datos de sesión se gestionarán de forma segura. La aplicación requiere conexión a internet para todas sus funcionalidades.
- **RNF-03 — Usabilidad Móvil:** La interfaz estará diseñada con patrones móviles (gestos, listas verticales, inputs nativos) organizando claramente el registro, búsquedas y flujos de creación.
- **RNF-04 — Validación de datos:** El sistema validará que los campos obligatorios (fechas válidas, nombres no vacíos, contraseñas seguras) se cumplan antes de realizar escrituras en la base de datos. En particular, los hitos cronológicos de un torneo (inicio/fin de registro e inicio/fin del torneo) deberán rechazarse si corresponden a un instante anterior a Hoy + 24 horas (ver RF-20).
- **RNF-05 — Idioma de la aplicación:** Toda la interfaz, navegación, mensajes y contenido estático de la aplicación se presentará en inglés.
- **RNF-06 — Conectividad:** La aplicación requiere conexión a internet activa para todas sus funcionalidades, incluyendo registro, inicio de sesión y todas las operaciones de torneos.

## 4. Descomposición Funcional por Módulos (Casos de Uso)
El modelado de los casos de uso del sistema se encuentra detallado en el siguiente archivo:
digramaDeCasosDeUsoTIERX.pdf

### Módulo A: Login y Registro
Controla el acceso inicial a la plataforma y el ciclo de vida de la sesión.

**User Journey A1 — Registro:**
1. El visitante entra a la página de bienvenida y selecciona **Registrarse**.
2. El sistema muestra el formulario de nombre, correo, contraseña, confirmación y términos.
3. El visitante envía el formulario; el sistema valida campos, unicidad y seguridad.
4. Si los datos son válidos, el sistema crea la cuenta activa, sin requerir verificación de correo ni códigos de confirmación.
5. El usuario inicia sesión y el sistema lo redirige a **Home**.

**User Journey A2 — Inicio de sesión:**
1. El visitante selecciona **Iniciar sesión**.
2. Ingresa correo o usuario y contraseña.
3. El sistema valida credenciales y crea la sesión.
4. El sistema abre **Home**; si las credenciales son incorrectas, conserva el formulario y muestra el error.

**User Journey A3 — Cierre de sesión:**
1. El usuario autenticado navega a la sección **Perfil**.
2. Selecciona la opción **Cerrar sesión** (Sign out/Logout).
3. El sistema elimina la sesión activa del almacenamiento seguro.
4. El usuario es redirigido a la pantalla de **Iniciar sesión**.
5. La sesión anterior ya no es válida y el usuario debe autenticarse nuevamente para acceder.

**Exclusiones del Módulo A:** El sistema no utiliza verificadores de cuenta de ningún tipo (códigos de verificación de correo, enlaces de confirmación ni verificación en dos pasos) y no incluye flujo de restablecimiento o recuperación de contraseña.

### Módulo B: Home y Navegación Inferior
Es el punto de entrada después del login y conecta **Home**, **Torneos**, **Eventos** y **Perfil**.

**User Journey B1 — Consultar Home:**
1. El sistema redirige al usuario autenticado a **Home**.
2. La vista HomeView carga de manera asíncrona un feed vertical compuesto exclusivamente por cuatro colecciones horizontales: Can interest you, Near you, Competitive y Others.
3. El usuario selecciona una tarjeta de torneo/evento dentro de cualquiera de los cuatro carruseles o interactúa con las acciones del header (Tournament Search, Filters, o Create Event).
4. l sistema procesa la selección y lo redirige a la vista detallada del elemento (DetailView) o al flujo de creación de torneos.
5. Al regresar, Home conserva su estado y actualiza la información modificada.

**User Journey B2 — Navegar por la barra inferior:**
1. El usuario selecciona una pestaña de la barra inferior.
2. El sistema marca la pestaña activa y carga su página sin cerrar la sesión.
3. El usuario puede cambiar entre **Home**, **Torneos**, **Eventos** y **Perfil**.
4. Al abrir un detalle desde cualquier pestaña, el sistema registra la sección de origen.
5. Al cerrar el detalle, el usuario regresa a la pestaña de origen con sus filtros y posición conservados.

### Módulo C: Gestión y Participación en Torneos
Implementa la pestaña **Torneos** para explorar competencias y administrar las competecias en la que el usuario ha participado.

**User Journey C1 — Buscar y consultar un torneo:**
1. Desde **Torneos**, aplica filtros por estado, fecha o alcance.
2. El feed vertical compuesto exclusivamente por cuatro colecciones horizontales: On going comp. Tournaments, On going non-comp. Tournaments, Past comp. Tournaments y Past non-comp. Tournaments, el cual es modificado gracias a la busqueda y filtros ingresados.
3. El usuario selecciona una tarjeta y el sistema abre el detalle.
4. El usuario consulta reglas, requisitos, cupos, participantes y calendario.
5. El usuario puede compartir, inscribirse, volver al listado o, si tiene permisos, editar y administrar.

**User Journey C2 — Crear y publicar un torneo:**
1. Desde **Home**, el usuario selecciona **Crear torneo**.
2. El sistema abre el formulario por pasos: información general, juego y ubicación, fechas, formato y cupos, reglas y requisitos, premios y visibilidad.
3. En el paso de fechas, el usuario define inicio de registro, fin de registro, inicio del torneo y finalización del torneo mediante selectores de calendario y reloj (DateTime Pickers); el sistema impide escribir la fecha manualmente y bloquea cualquier selección anterior a Hoy + 24 horas.
4. El usuario completa los datos y puede guardar un borrador.
5. El sistema valida campos obligatorios, fechas, cupos y coherencia del formato.
6. El usuario revisa la vista previa y puede seleccionar entre **Publicar** y **Editar**
7. Si el usuario selecciona el boton **Editar** el sistema abre nuevamente el formulario 
8. Si el usuario selecciona el boton **Publicar** el sistema crea el torneo, muestra su detalle y lo agrega al listado y a la actividad del usuario.

**User Journey C3 — Inscribirse:**
1. Desde **Home**, el usuario selecciona una de las tarjetas visibles dentro del feed vertical compuesto exclusivamente por cuatro colecciones horizontales: Can interest you, Near you, Competitive y Others, el cual es modificado gracias a la busqueda y filtros ingresados.
2. El usuario accede a la vista de detalle del torneo público y selecciona el botón de acción principal Inscribirse.
3. El sistema abre la interfaz de captura de datos para que el usuario complete sus credenciales y, tras presionar Sign In, el sistema valida el token de autenticación del usuario, las restricciones de nivel de cuenta, la disponibilidad de cupos remanentes y la vigencia del periodo cronológico de inscripción.
4. El sistema procesa la solicitud para registrar la postulación en la base de datos cambiando el estado del usuario a status: registered y renderiza inmediatamente el estado de confirmación en la UI.
5. El usuario recibe confirmación y el torneo aparece en **Torneos**.

**User Journey C4 — Administrar un torneo propio:**
1. El organizador entra a **Torneos** y selecciona **Mis torneos**.
2. Abre un torneo y selecciona **Administrar**.
3. El sistema muestra inscripciones, participantes, estado, edición, publicación, cancelación y cierre.
4. El organizador ejecuta una acción y confirma el cambio.
5. El sistema actualiza el estado, notifica a los afectados y vuelve al detalle del torneo.

### Módulo D: Eventos, Partidas y Resultados
Implementa la pestaña **Eventos** para el seguimiento de torneos en los que el usuario administra.

**User Journey D1 — Consultar eventos:**
1. El usuario selecciona **Eventos** en la barra inferior.
2. El sistema muestra pestañas o filtros para **Próximos**, **Activos** y **Finalizados**.
3. El usuario selecciona un evento y consulta calendario, horario, torneo relacionado y estado.
4. Si el torneo esta activo, el sistema muestra los contendientes a competir en la ronda ademas de informacion como la hora, bracket y canal o enlace disponible.
5. Si el torneo esta Finalizado, el sistema muestra la informacion del toreo como los ganadores, fecha de finalizacion y juego.

**User Journey D2 — Gestionar una ronda y publicar resultados:**
1. El organizador entra a **Eventos**, selecciona un torneo activo y abre **Manage bracket**.
2. Pulsa **Add round**, ingresa la cantidad de jugadores (mínimo 2; 3 en double elimination) y marca a los participantes en la lista de checkboxes.
3. Confirma con **Confirm participants**; el sistema bloquea la selección y muestra el cuadro Participant 1…N.
4. Pulsa **Start match**: la ronda se crea como `ongoing` y, al expandirla, aparece el panel **Select players to eliminate** según el formato del stage.
5. Pulsa **Confirm elimination(s)** y redacta el mensaje de detalles en **Round details message**.
6. Al pulsar **Send message** el sistema oficializa la eliminación, notifica a los jugadores (los eliminados reciben además la alerta emergente), suma +1 loss a cada eliminado y, si solo queda un superviviente, le otorga +1 win y completa el torneo automáticamente.
7. El organizador puede cerrar el stage con **Close Stage** o descartar la ronda con **Discard Round** / **Cancel Round**.

### Módulo E: Perfil y Cuenta del Usuario
Implementa la pestaña **Perfil** con base en la interfaz de usuario proporcionada.

**User Journey E1 — Consultar perfil:**
1. El usuario selecciona **Perfil** en la barra inferior.
2. El sistema muestra avatar, nombre, descripción, país, juego favorito, ranking, estadísticas, historial y torneos participados.
3. El usuario selecciona un torneo del historial o un indicador estadístico y se muestra la informacion general como la posicion en el bracket, fecha del torneo y juego.
4. El sistema tras abrir el detalle relacionado, le permite al usuario regresar a Perfil.

**User Journey E2 — Editar perfil:**
1. El usuario entra a **Perfil** y selecciona **Editar perfil**.
2. El sistema muestra los campos editables y preferencias.
3. El usuario actualiza avatar, nombre visible, descripción, país, juego favorito, privacidad o notificaciones.
4. El sistema valida los cambios y permite cancelar o guardar.
5. Al guardar, actualiza el perfil y devuelve al usuario a Perfil con la información nueva.

### Módulo F: Operación del Organizador
Amplía la gestión de torneos para organizadores autorizados.

**User Journey F1 — Operar un torneo:**
1. El organizador entra al detalle de un torneo propio desde **Eventos**.
2. Selecciona **Panel de organización**.
3. Gestiona participantes, aprobaciones, cupos, siembra, penalizaciones, fases, brackets, árbitros y horarios.
4. Registra partidas y resultados, resuelve disputas y publica actualizaciones.
5. Consulta estadísticas de participación, audiencia y rendimiento.
6. El sistema registra cada acción y notifica los cambios relevantes.

## 5. Stack Tecnológico
- **Framework:** React Native (Expo) + TypeScript
- **Estilos:** NativeWind (Tailwind CSS para React Native)
- **Base de datos:** SQLite (mediante [Expo SQLite](https://expo.dev)) para gestionar de forma relacional los usuarios, torneos y rankings. La aplicación funciona completamente online, requiriendo conexión a internet para todas las operaciones.

## 6. Diseño UI
La documentación de las pantallas e interfaces se encuentra disponible en el portafolio de diseño adjunto en la carpeta del proyecto:
UI_AppTorneos.pdf

## 7. Estructura de Archivos Requerida
src/
├── components/
│   ├── ui/          # Componentes atómicos (Card, Input, Badge, Button, Modal)
│   └── tournaments/ # TournamentList, TournamentCard, RankingRow
├── database/        # Inicialización de SQLite y esquemas de tablas (db.ts)
├── hooks/           # useTournaments (Queries SQL de inserción, filtrado y borrado)
├── types/           # tournament.ts (Interfaces de TypeScript para Torneos y Jugadores)
└── App.tsx          # Punto de entrada de la app, inicializador de la BD y navegación
