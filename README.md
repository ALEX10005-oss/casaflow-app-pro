# CasaFlow Command

Prompt maestro para Figma — UX/UI completo de CasaFlow

Diseña la experiencia UX/UI completa de una plataforma SaaS llamada CasaFlow, dedicada a empresas que administran propiedades vacacionales.

El diseño debe representar una empresa con aproximadamente 26 propiedades y debe estar construido a partir de necesidades operativas reales.

No agregar pantallas, botones o módulos únicamente por estética.

Cada componente debe representar una acción o información que tenga una función concreta.

Arquitectura de usuarios

Diseñar tres experiencias separadas:

Propietario / Administrador.

Empleados.

Panel privado de plataforma.

No mezclar sus navegaciones.

Flujo inicial

Diseñar:

Login

Logo CasaFlow.

Correo.

Contraseña.

Iniciar sesión.

Crear cuenta.

Recuperar contraseña.

Registro

Nombre.

Apellidos.

Empresa.

Teléfono.

Correo.

Contraseña.

Confirmar contraseña.

Verificación de correo

Pantalla limpia indicando que el usuario debe verificar su email.

Acceso pendiente

Si la cuenta aún no tiene autorización:

“Tu cuenta ha sido registrada. Estamos preparando el acceso de tu organización.”

No mostrar al cliente detalles internos de licenciamiento.

PANEL DEL PROPIETARIO

Diseñar navegación lateral con:

Dashboard.

Calendario.

Reservas.

Propiedades.

Huéspedes.

Operaciones.

Finanzas.

Reportes.

WhatsApp.

Integraciones.

Equipo.

Alertas.

Estado del sistema.

Configuración.

Dashboard

Debe mostrar:

26 propiedades.

Ocupadas.

Disponibles.

Mantenimiento.

Check-ins hoy.

Check-outs hoy.

Reservas próximas.

Ocupación mensual.

Ingresos.

Gastos.

Utilidad.

Limpiezas pendientes.

Mantenimiento.

Alertas.

Estado de canales.

Diseñar visualmente la jerarquía para que el propietario identifique primero lo urgente.

Calendario PMS

Diseñar una vista profesional de calendario multi-propiedad.

Filas:

Propiedad 01.

Propiedad 02.

…

Propiedad 26.

Columnas:

Fechas.

Mostrar bloques correspondientes a estancias.

Estados visuales:

Disponible.

Reservada.

Ocupada.

Bloqueada.

Mantenimiento.

Al hacer clic sobre reserva existente:

abrir detalle.

Al hacer clic sobre espacio vacío:

permitir únicamente:

Bloquear propiedad

No diseñar botón “Nueva reserva”.

Reservas

Diseñar tabla/listado con:

Código.

Huésped.

Propiedad.

Canal.

Check-in.

Check-out.

Estado.

Pago.

Filtros:

Propiedad.

Canal.

Estado.

Periodo.

Detalle:

Información de huésped.

Información de estancia.

Canal.

Pago.

Historial.

Comunicación.

Alertas.

No incluir función de crear reserva.

Propiedades

Diseñar:

Lista

Imagen.

Nombre.

Ubicación.

Estado.

Ocupación.

Integraciones.

Próxima reserva.

Detalle

Pestañas:

Información.

Calendario.

Reservas.

Operaciones.

Finanzas.

Integraciones.

Automatizaciones.

Campos:

Dirección.

Capacidad.

Check-in.

Check-out.

WiFi.

Contraseña.

Accesos.

Instrucciones.

Huéspedes

Diseñar lista de huéspedes que provienen de reservaciones.

No incluir “Agregar huésped”.

Detalle:

Datos.

Estancia actual.

Historial.

Comunicación.

Incidencias.

Limpieza

Diseñar tablero operativo.

Estados:

Pendiente.

Asignada.

En proceso.

Completada.

Incidencia.

Mostrar:

Propiedad.

Checkout.

Próximo check-in.

Responsable.

Prioridad.

Estado.

Mantenimiento

Diseñar listado de incidencias.

Mostrar:

Propiedad.

Problema.

Responsable.

Prioridad.

Estado.

Fecha.

En formulario incluir:

¿El problema impide recibir huéspedes?

porque puede generar bloqueo de propiedad.

Finanzas

Diseñar:

Ingresos.

Gastos.

Comisiones.

Costos de limpieza.

Mantenimiento.

Utilidad.

Desgloses:

Por propiedad.

Por canal.

Por mes.

Reportes

Diseñar filtros superiores:

Hoy.

Semana.

Mes.

Año.

Personalizado.

Reportes:

Ocupación.

Rentabilidad.

Reservas.

Canales.

Operaciones.

WhatsApp

Diseñar módulo independiente.

Navegación:

Automatizaciones.

Plantillas.

Historial.

Configuración.

Automatizaciones

Tarjeta:

Nombre:
Pre check-in

Evento:
24 horas antes

Plantilla:
Pre check-in estándar

Estado:
Activa

Acciones:

Editar.

Duplicar.

Activar/desactivar.

Eliminar.

Plantillas

Editor con variables:

{{guest_name}}

{{property_name}}

{{check_in}}

{{check_out}}

{{address}}

{{wifi_name}}

{{wifi_password}}

{{access_code}}

Historial

Tabla:

Huésped.

Propiedad.

Mensaje.

Fecha.

Estado.

Integraciones

Diseñar tarjetas:

Airbnb.

Booking.

VRBO.

Web.

WhatsApp.

Estados:

Conectado.

Desconectado.

Error.

Sincronizando.

Mostrar última sincronización.

Para Airbnb/Booking/VRBO permitir configurar por propiedad.

Equipo

Diseñar lista:

Nombre.

Rol.

Estado.

Último acceso.

Roles:

Manager.

Recepción.

Limpieza.

Mantenimiento.

Contabilidad.

Acción principal:

Invitar trabajador

Alertas

Diseñar centro de notificaciones priorizadas.

Ejemplos:

Conflicto de reserva.

Error de calendario.

WhatsApp fallido.

Limpieza atrasada.

Mantenimiento urgente.

Nueva reserva.

PANEL DE EMPLEADOS

Crear variantes diferentes según rol.

Limpieza — móvil prioritario

Diseñar principalmente para teléfono.

Inicio:

“Tienes 4 tareas hoy”

Tarjetas:

Villa 08

Checkout:
11:00

Próximo check-in:
15:00

Limpieza:
11:30–14:00

Acciones grandes:

Iniciar.

Subir fotos.

Reportar incidencia.

Finalizar.

Navegación:

Inicio.

Mis tareas.

Calendario.

Incidencias.

Cuenta.

Mantenimiento

Inicio:

Incidencias nuevas.

Urgentes.

En proceso.

Detalle:

Propiedad.

Problema.

Dirección.

Evidencias.

Prioridad.

Acciones:

Aceptar.

Iniciar.

Subir evidencia.

Registrar materiales.

Resolver.

Recepción

Dashboard:

Check-ins hoy.

Check-outs hoy.

Próximos huéspedes.

Mensajes.

Incidencias.

Acceso:

Llegadas.

Salidas.

Huéspedes.

Estancias.

WhatsApp.

No mostrar funciones administrativas.

Contabilidad

Diseñar:

Ingresos.

Gastos.

Pagos.

Comisiones.

Reportes.

No mostrar herramientas de operación.

PANEL PRIVADO DE PLATAFORMA

Diseñar como producto administrativo separado.

No utilizar navegación compartida con CasaFlow cliente.

Pantallas:

Dashboard

Clientes.

Empresas.

Licencias activas.

Pendientes.

Suspendidas.

Problemas técnicos.

Clientes

Tabla:

Empresa.

Responsable.

Estado.

Propiedades.

Usuarios.

Licencia.

Licencias

Mostrar:

Empresa.

Tipo.

Estado.

Propiedades permitidas.

Usuarios permitidos.

iCal.

WhatsApp.

API.

Activación.

Expiración.

Acciones:

Activar.

Suspender.

Revocar.

Editar límites.

Este panel debe visualizarse como una herramienta interna distinta.

Diseño visual general

Estética:

Moderna.

Profesional.

SaaS B2B.

Limpia.

Premium sin exceso decorativo.

Fondo claro.

Espacios amplios.

Tipografía muy legible.

Menú lateral.

Iconografía sencilla.

Estados fácilmente reconocibles.

Evitar interfaces saturadas.

Desktop prioritario para propietario.

Mobile/tablet prioritario para empleados.

Componentes Figma

Crear sistema de componentes reutilizables:

Sidebar.

Header.

Breadcrumb.

Metric card.

Table.

Filter bar.

Property card.

Reservation block.

Status badge.

Alert.

Modal.

Form.

User avatar.

Timeline.

Empty state.

Error state.

Loading state.

Calendar event.

Integration card.

Task card.

Message status.

Crear variantes para:

Active.

Hover.

Disabled.

Error.

Success.

Warning.

Prototipo

Crear conexiones reales de prototipo entre las pantallas principales.

Priorizar estos flujos:

Propietario

Login

→ Dashboard

→ Calendario

→ Reserva existente

→ Huésped

Mantenimiento

Dashboard

→ Incidencia

→ Asignar empleado

→ Bloqueo de propiedad

WhatsApp

Reserva

→ Automatización

→ Mensaje

→ Historial

Empleado limpieza

Login

→ Tarea

→ Iniciar

→ Reportar incidencia

→ Finalizar

Plataforma privada

Login independiente

→ Clientes

→ Empresa

→ Licencia

→ Activar/Suspender

Regla final

El diseño debe hacer evidente que CasaFlow no es solamente una interfaz administrativa.

Debe mostrar visualmente la lógica:

Reserva externa → CasaFlow → calendario → huésped → WhatsApp → operación → finanzas → reportes.

No crear pantallas sin una función clara.

No incluir “Demo”.

No incluir “Crear reserva”.

No incluir “Agregar huésped”.

CasaFlow debe parecer un producto listo para comercializar.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://casaflow-app-pro.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7c35a83f-bfa2-4aab-b1cf-f3f4c98c0880).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
