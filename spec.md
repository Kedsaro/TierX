# Especificación: App de Torneos (Gestor Local)

## 1. Propósito del Producto
La aplicación permite a los usuarios organizar, administrar y realizar el seguimiento de eventos de deportes electrónicos a nivel local de forma 100% autónoma y offline. A través de una plataforma interactiva e individual, el usuario puede registrar torneos, configurar participantes, gestionar las reglas de competencia y registrar los resultados de eventos casuales o de alto rendimiento.

La plataforma incorpora un sistema de simulación de ranking local que clasifica a los jugadores registrados en el dispositivo según su desempeño, facilitando el control de los emparejamientos y promoviendo un historial organizado del desarrollo competitivo de la comunidad local sin depender de servidores externos.

## 2. Requerimientos Funcionales
- **RF-01 — Registro de usuario:** El sistema deberá permitir crear una cuenta con nombre de usuario, correo electrónico, contraseña, confirmación de contraseña y aceptación de términos.
- **RF-02 — Inicio de sesión:** El sistema deberá permitir iniciar sesión con correo o nombre de usuario y contraseña, mostrar errores de validación, verificar la identidad mediante un código temporal de seis dígitos enviado al correo y conservar la sesión mientras sea válida.
- **RF-02.1 — Cierre de sesión:** El sistema deberá permitir cerrar sesión de forma segura, eliminando la sesión activa y redirigiendo al usuario a la pantalla de inicio de sesión.
- **RF-03 — Verificación y recuperación de cuenta:** El sistema deberá permitir verificar el correo mediante enlace, reenviar la verificación, solicitar recuperación y establecer una nueva contraseña mediante un token temporal.
- **RF-04 — Navegación principal:** Después de autenticarse, el usuario deberá acceder a una barra de navegación inferior con las pestañas **Home**, **Torneos**, **Eventos** y **Perfil**. La pestaña activa deberá identificarse visualmente.
- **RF-05 — Página Home:** El sistema deberá mostrar torneos próximos, eventos destacados, actividad del usuario, ranking relevante y accesos rápidos para explorar o crear torneos.
- **RF-06 — Consulta de torneos:** La sección **Torneos** deberá permitir visualizar torneos públicos, propios y seguidos, buscarlos por nombre, juego u organizador, y filtrarlos por juego, país, fecha, estado, visibilidad y alcance.
- **RF-07 — Detalle de torneo:** El sistema deberá mostrar identidad visual, descripción, juego, organizador, fecha, hora, zona horaria, país, alcance, reglas, requisitos, cupos, participantes, estado, calendario y acciones disponibles según el rol.
- **RF-08 — Creación y edición de torneo:** El usuario autorizado deberá poder configurar nombre, descripción, imagen, juego, país, zona horaria, fechas, visibilidad, alcance, cupos, formato, reglas, requisitos, premios y periodo de inscripción.
- **RF-09 — Administración de torneos:** El organizador deberá poder guardar borradores, publicar, editar, despublicar, cancelar, cerrar, compartir torneos y gestionar sus inscripciones y participantes.
- **RF-10 — Inscripción y participación:** El usuario podrá validar requisitos, solicitar o cancelar su inscripción y consultar el estado de su participación en cada torneo.
- **RF-11 — Sección de eventos:** La sección **Eventos** deberá mostrar eventos próximos, activos y finalizados del usuario, con calendario, horarios, partidas, resultados, notificaciones y acceso al torneo relacionado.
- **RF-12 — Partidas y resultados:** El organizador autorizado deberá poder configurar fases y brackets, asignar partidas, actualizar horarios, registrar marcadores, resolver disputas, publicar resultados y actualizar clasificaciones.
- **RF-13 — Perfil:** La sección **Perfil** deberá mostrar avatar, nombre, descripción, país, juego favorito, estadísticas, ranking global o local, historial de torneos, torneos creados y configuración de cuenta.
- **RF-14 — Edición de perfil y preferencias:** El usuario podrá modificar la información permitida, preferencias de notificaciones, privacidad y datos de su cuenta.
- **RF-15 — Notificaciones:** El sistema deberá informar sobre verificaciones, inscripciones, cambios de horario, inicio de partidas, resultados, invitaciones y actualizaciones de torneos seguidos.
- **RF-16 — Roles y permisos:** El sistema deberá diferenciar como mínimo los roles **Usuario**, **Organizador** y **Administrador**, y mostrar únicamente las acciones autorizadas para cada rol.
- **RF-17 — Administración global:** El administrador deberá poder gestionar usuarios, roles, juegos, países, reglas, torneos reportados, reportes, parámetros globales y auditoría.
- **RF-18 — Navegación contextual:** Desde Home, Torneos, Eventos y Perfil, el usuario podrá abrir el detalle de un torneo y volver a la sección de origen conservando filtros, posición y contexto.

## 3. Requerimientos No Funcionales
- **RNF-01 — Aplicación móvil nativa:** Desarrollada exclusivamente para la plataforma Android mediante empaquetado compatible.
- **RNF-02 — Persistencia y Seguridad Local:** Toda la información de los torneos, usuarios y contraseñas se almacenará de forma cifrada o segura dentro del almacenamiento privado del dispositivo mediante SQLite.
- **RNF-03 — Usabilidad Móvil:** La interfaz estará diseñada con patrones móviles (gestos, listas verticales, inputs nativos) organizando claramente el registro, búsquedas y flujos de creación.
- **RNF-04 — Validación de datos:** El sistema validará que los campos obligatorios (fechas válidas, nombres no vacíos, contraseñas seguras) se cumplan antes de realizar escrituras en la base de datos local.
- **RNF-05 — Idioma de la aplicación:** Toda la interfaz, navegación, mensajes y contenido estático de la aplicación se presentará en inglés.

## 4. Descomposición Funcional por Módulos (Casos de Uso)
El modelado de los casos de uso del sistema se encuentra detallado en el siguiente archivo:
digramaDeCasosDeUsoTIERX.pdf

### Módulo A: Login, Registro y Recuperación de Cuenta
Controla el acceso inicial a la plataforma y el ciclo de vida de la sesión.

**User Journey A1 — Registro y verificación:**
1. El visitante entra a la página de bienvenida y selecciona **Registrarse**.
2. El sistema muestra el formulario de nombre, correo, contraseña, confirmación y términos.
3. El visitante envía el formulario; el sistema valida campos, unicidad y seguridad.
4. Si los datos son válidos, el sistema crea la cuenta en estado pendiente y muestra confirmación.
5. El cliente renderiza la interfaz de verificación con una máscara de entrada restringida a 6 caracteres numéricos. Al ingresar el código recibido por correo, el sistema valida la coincidencia exacta del token y comprueba que el tiempo de vida (TTL) no haya expirado.
6. El sistema activa la cuenta y dirige al usuario a **Iniciar sesión**.
7. El usuario inicia sesión y el sistema lo redirige a **Home**.

**User Journey A2 — Inicio de sesión:**
1. El visitante selecciona **Iniciar sesión**.
2. Ingresa correo o usuario y contraseña.
3. El sistema valida credenciales y envía un código temporal de seis dígitos al correo del usuario.
4. El cliente renderiza la interfaz de verificación con una máscara de entrada restringida a 6 caracteres numéricos. Al ingresar el código recibido por correo, el sistema valida la coincidencia exacta del token y comprueba que el tiempo de vida (TTL) no haya expirado.
5. Si son correctas, crea la sesión y abre **Home**; si son incorrectas, conserva el formulario y muestra el error.

**User Journey A2.1 — Cierre de sesión:**
1. El usuario autenticado navega a la sección **Perfil**.
2. Selecciona la opción **Cerrar sesión** (Sign out/Logout).
3. El sistema elimina la sesión activa del almacenamiento seguro.
4. El usuario es redirigido a la pantalla de **Iniciar sesión**.
5. La sesión anterior ya no es válida y el usuario debe autenticarse nuevamente para acceder.

**User Journey A3 — Recuperación:**
1. El usuario selecciona **¿Olvidaste tu contraseña?**.
2. Ingresa su correo y solicita recuperación.
3. El sistema envía un codigo de 6 digitos al correo del usuario.
4. El cliente renderiza la interfaz de verificación con una máscara de entrada restringida a 6 caracteres numéricos. Al ingresar el código recibido por correo, el sistema valida la coincidencia exacta del token y comprueba que el tiempo de vida (TTL) no haya expirado.
5. El sistema confirma el cambio y vuelve a **Iniciar sesión**.

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
1. Desde **Torneos**, aplica filtros por país, fecha, estado, visibilidad o juego.
2. El feed vertical compuesto exclusivamente por cuatro colecciones horizontales: On going comp. Tournaments, On going non-comp. Tournaments, Past comp. Tournaments y Past non-comp. Tournaments, el cual es modificado gracias a la busqueda y filtros ingresados.
3. El usuario selecciona una tarjeta y el sistema abre el detalle.
4. El usuario consulta reglas, requisitos, cupos, participantes y calendario.
5. El usuario puede compartir, inscribirse, volver al listado o, si tiene permisos, editar y administrar.

**User Journey C2 — Crear y publicar un torneo:**
1. Desde **Home**, el usuario selecciona **Crear torneo**.
2. El sistema abre el formulario por pasos: información general, juego y ubicación, fechas, formato y cupos, reglas y requisitos, premios y visibilidad.
3. El usuario completa los datos y puede guardar un borrador.
4. El sistema valida campos obligatorios, fechas, cupos y coherencia del formato.
5. El usuario revisa la vista previa y puede seleccionar entre **Publicar** y **Editar**
6. Si el usuario selecciona el boton **Editar** el sistema abre nuevamente el formulario 
7. Si el usuario selecciona el boton **Publicar** el sistema crea el torneo, muestra su detalle y lo agrega al listado y a la actividad del usuario.

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

**User Journey D2 — Gestionar una partida y publicar resultados:**
1. El organizador entra a **Eventos** y selecciona un torneo activo.
2. Abre la sección de bracket o calendario y selecciona una partida.
3. Asigna participantes, horario y árbitro, o modifica los datos permitidos.
4. Registra el marcador y adjunta evidencia cuando sea requerida.
5. El sistema valida el resultado y actualiza la llave y la clasificación.
6. El organizador publica el resultado; el sistema notifica a participantes y espectadores.

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
- **Base de datos Local:** SQLite (mediante [Expo SQLite](https://expo.dev)) para gestionar de forma relacional los usuarios, torneos y rankings directamente en el almacenamiento interno de Android.

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
