# Diagnóstico de acceso de Sensity Home (solo lectura)

## Hallazgo principal
- La base de datos de CasaFlow está **pausada** (Lovable Cloud sin saldo). Mientras siga así, **nadie** puede iniciar sesión, ni Sensity Home ni otras organizaciones. Esta es la causa actual de la falta de acceso.
- Según el historial de cambios, la última acción sobre Sensity Home fue **reactivarla** (de suspendida a activa). No hay ningún cambio posterior que la vuelva a suspender. No pude confirmarlo directamente porque la base de datos no responde.

## Cómo funciona el acceso hoy
- Cada organización tiene un estado: pendiente, activa, suspendida o revocada. Solo "activa" deja entrar.
- Cada usuario entra con su propia cuenta y pertenece a una organización con un rol (dueño, recepción, limpieza, mantenimiento, contabilidad) y un estado propio (activo o suspendido).
- Los trabajadores solo ven las propiedades que tienen asignadas.

## Qué verificar cuando la base de datos vuelva
1. Que el estado de Sensity Home sea "activa".
2. Que la cuenta del dueño (sensityhomeoficial@gmail.com) exista una sola vez y esté activa en su organización.
3. Estado de cada uno de sus 5 usuarios; por ejemplo, recepción (emmanuel.hernandez…) aparecía suspendido.
4. Conteos sin cambios: 27 propiedades, 39 reservas, 85 calendarios.
5. Que ninguna otra organización haya cambiado y que tu acceso de administrador siga igual.

## Cómo reactivar sin duplicar nada
- **No crear usuarios nuevos** ni enviar invitaciones nuevas: las cuentas ya existen.
- Si Sensity Home no aparece activa: cambiar únicamente su estado a "activa" desde el panel privado (Licencias).
- Si un usuario concreto está suspendido: reactivar solo ese usuario desde Equipo.
- Si alguien olvidó su contraseña: usar "Recuperar contraseña" con su mismo correo.

## Limitaciones
- Sin base de datos no pude leer estados, usuarios ni conteos actuales.
- Para reactivar la base de datos tu plan necesita permitir saldo de Cloud (cambiar a un plan de pago). Después de eso, hago la verificación anterior sin modificar datos.
