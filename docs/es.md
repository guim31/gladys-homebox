# Homebox

Siga el inventario de su hogar en Gladys con
[Homebox](https://github.com/sysadminsmedia/homebox), el sistema de inventario
y organización autoalojado: cuántos objetos tiene, cuánto valen, las garantías
que vencen pronto y los mantenimientos pendientes. Todo se queda en su red
local: Gladys habla directamente con Homebox, y solo lo lee.

Probada con servidores Homebox reales, 0.26.2 y 0.21.0 (la imagen Docker
oficial). Sus comentarios son bienvenidos en el foro de Gladys.

## Requisitos previos

- Gladys Assistant 5.1 o posterior.
- Un servidor Homebox accesible desde la máquina de Gladys, en el puerto 7745
  por defecto, o detrás de un proxy inverso.
- Con Homebox 0.26 o posterior: una clave de API (Homebox → su perfil →
  Claves de API). Con un Homebox más antiguo: el correo y la contraseña de un
  usuario de Homebox. La integración ve el inventario (el «grupo») de ese
  usuario.

## Configuración

1. Abra la pestaña **Configuración** de la integración.
2. En **Dirección de Homebox**, introduzca la dirección IP del servidor, por
   ejemplo `192.168.1.50`: la integración usa entonces el puerto 7745. Añada un
   puerto si el suyo es otro (`192.168.1.50:3100`). Detrás de un proxy inverso,
   introduzca la dirección completa (`https://example.org/homebox`).
3. Pegue una **clave de API**, o rellene **Correo** y **Contraseña**. La clave
   de API tiene prioridad si ambos están rellenados.
4. **Garantía que vence en (días)**: una garantía cuenta como a punto de
   vencer este número de días antes de su fin (30 por defecto).
5. **Mantenimiento próximo en (días)**: con cuánta antelación un
   mantenimiento programado cuenta como próximo (7 por defecto).
6. **Un dispositivo por ubicación** (desactivado por defecto) añade un
   dispositivo por cada ubicación principal de Homebox.
7. **Leer Homebox cada**: 5, 15 (por defecto), 30 o 60 minutos.
8. **Idioma de nombres y mensajes** fija los nombres de las funciones (fijados
   al añadir el dispositivo), los textos y las fechas de las variables de
   escena. Francés por defecto.
9. Guarde y use **Probar la conexión**: muestra la versión de Homebox y el
   número de objetos y ubicaciones.
10. En la pestaña **Descubrir**, añada los dispositivos que quiera seguir.

## Dispositivos

**Homebox** (un dispositivo para su inventario):

| Función                     | Valor                                                              |
| --------------------------- | ------------------------------------------------------------------ |
| Objetos                     | número de objetos, sin los archivados                              |
| Ubicaciones                 | número de ubicaciones                                              |
| Valor total                 | precio de compra × cantidad de cada objeto, en la moneda del grupo |
| Garantías a punto de vencer | objetos cuya garantía termina en la ventana configurada            |
| Mantenimientos atrasados    | mantenimientos programados cuya fecha ya pasó                      |
| Próximos mantenimientos     | mantenimientos programados en la ventana configurada               |
| Próximo mantenimiento       | nombre, objeto y fecha del próximo mantenimiento, o «Ninguno»      |
| Próximo fin de garantía     | objeto y fecha de la próxima garantía que vence, o «Ninguno»       |

Gladys tiene una unidad para el euro, el dólar y la libra esterlina; otra
moneda aparece en el nombre de la función, por ejemplo «Valor total (CHF)».
Las garantías de por vida nunca terminan; las garantías ya vencidas no se
cuentan.

**Una ubicación** (opción): **Objetos** (número de objetos guardados allí,
sububicaciones incluidas) y **Valor**. Solo las ubicaciones principales
tienen un dispositivo.

## Widget del panel

**Inventario del hogar**: cuatro mosaicos (objetos, valor, garantías,
mantenimientos pendientes) y la lista de lo que viene, lo más próximo
primero: mantenimientos atrasados (en rojo), próximos mantenimientos,
garantías que vencen. Solo lectura.

## Disparadores de escena

- **Garantía a punto de vencer**: la garantía de un objeto entra en la
  ventana configurada. Una vez por objeto y fecha de fin. Variables: objeto,
  ubicación, fecha de fin, días restantes.
- **Mantenimiento pendiente**: un mantenimiento programado alcanza su fecha
  sin completarse. Una vez por mantenimiento. Variables: mantenimiento,
  objeto, fecha prevista, días de retraso.

La primera lectura tras la instalación es silenciosa: lo que ya está
pendiente se muestra en el dispositivo, no se anuncia. Los disparadores se
activan en la primera lectura tras el cambio (después de medianoche, en el
intervalo configurado).

## Acciones de escena

**Buscar un objeto en Homebox**: indique un nombre (`Pilas AA`); la acción lee
Homebox y devuelve **Encontrado**, **Objetos coincidentes**, **Objeto**,
**Ubicación** (la ruta completa, `Garaje / Estante`) y **Cantidad**. El nombre
exacto tiene prioridad, luego los nombres que lo contienen; los objetos
archivados se ignoran.

## Ejemplos de escenas

- **Recordatorio de mantenimiento**: disparador «Mantenimiento pendiente» →
  enviar un mensaje «Toca {{triggerEvent.data.maintenance}} en
  {{triggerEvent.data.item}}».
- **Garantía**: disparador «Garantía a punto de vencer» → mensaje «La
  garantía de {{triggerEvent.data.item}} termina el
  {{triggerEvent.data.expires}}».
- **Comprobar un stock**: cada domingo a las 10:00 → «Buscar un objeto en
  Homebox» (`Pilas AA`) → continuar solo si la cantidad es inferior a 4 →
  mensaje «Quedan pocas pilas AA (guardadas en …)».

## Solución de problemas

- **«Acceso denegado»**: compruebe la clave de API (puede haber caducado o
  haberse borrado en Homebox), o el correo y la contraseña. Las claves de API
  solo existen desde Homebox 0.26: en una versión anterior, use el correo y la
  contraseña.
- **«Homebox no responde»**: compruebe la dirección y el puerto desde la
  máquina de Gladys. El contenedor usa una red en puente: `localhost` es el
  propio contenedor, introduzca en su lugar la dirección IP del servidor.
- **«Esta dirección no responde como Homebox»**: responde una página de acceso
  de un proxy en lugar de Homebox. Introduzca la dirección del propio
  Homebox, o deje pasar la máquina de Gladys.
- Para ver más detalles en los registros de la integración, configure
  `LOG_LEVEL=debug`.

## Límites

- Solo lectura: la integración nunca modifica su inventario.
- Cada lectura son unas cinco peticiones (incluida la exportación CSV de todo
  el inventario): mantenga un intervalo largo con un inventario muy grande.
- Un solo grupo de Homebox, el de la clave de API o del usuario.
- Sin relación con el proyecto Homebox.
