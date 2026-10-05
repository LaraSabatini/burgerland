# Burgerland · Pedidos y fidelización

App para subir los Excel de pedidos, ver un resumen de ventas y llevar la fidelización de clientes con estrellas.

## Pantallas

- **Resumen** (`/`): ventas, pedidos, ticket promedio, clientes, unidades y pendiente de cobro. También muestra plata por medio de pago, ventas por zona, unidades por producto, extras, pedidos por hora, ventas por día y mejores clientes. Se puede filtrar por fechas.
- **Subir pedidos** (`/subir`): se arrastra el `.xlsx`, se revisa la vista previa y se confirma. Un pedido ya cargado (mismo número) se actualiza y no se duplica.
- **Clientes** (`/clientes`): panel de fidelización con las estrellas activas, el descuento actual, el próximo vencimiento y la última compra de cada cliente.
- **Ficha del cliente** (`/clientes/:id`): muestra cada compra marcada como activa (con su vencimiento), vencida o canjeada. Desde acá se registra el canje del 40 %, se carga el WhatsApp, se envía el mensaje y se copia el link de la tarjeta.
- **Tarjeta digital** (`/tarjeta/:token`): página pública, sin login, que ve el cliente. Muestra sus estrellas activas con la fecha de vencimiento de cada una, las vencidas, su nivel y el descuento disponible.
- **Usuarios** (`/usuarios`): alta y baja de usuarios y cambio de contraseña.

## Reglas de fidelización

Las reglas están en `src/lib/loyalty.ts`.

- **Estrellas:** cada compra no cancelada suma 1 estrella, que vence a los 30 días. Se pueden tener hasta 10 activas.
- **Descuentos:** 5⭐ 10% · 6⭐ 15% · 7⭐ 20% · 8⭐ 25% · 9⭐ 30% · 10⭐ 40%.
- **Canje del 40 %:** al registrarlo, el tablero vuelve a 0 y solo cuentan las compras posteriores. Se puede deshacer el último canje.
- **WhatsApp:** el botón abre WhatsApp con el mensaje ya escrito, pero hay que tocar enviar. El envío automático (WATI o WhatsApp Cloud API) queda para una próxima etapa.

## Correr en local

```bash
cp .env.example .env.local   # completar SESSION_SECRET y ADMIN_PASSWORD
npm install
npm run dev
```

La primera vez que arranca, si no hay usuarios, crea el usuario `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

## Notas sobre el Excel

- **Fechas:** el exportador guarda "4/10/26" (día/mes) como mes/día. La app lo detecta comparando con el rango de fechas del nombre del archivo (`pedidos_2026-10-04T00_00 - ...`). Si no lo puede detectar, invierte día y mes por defecto. En la vista previa se puede corregir con el interruptor "Invertir día y mes".
- **Clientes:** se identifican por su número de WhatsApp. El número se normaliza, así que +54 9 11 2345-6789, 011 15 2345 6789 y 1123456789 son el mismo cliente. Si dos pedidos tienen el mismo número con distinto nombre, son el mismo cliente, y su nombre es el del pedido más reciente.
- **Pedidos sin WhatsApp:** se importan y cuentan para las ventas, pero no suman estrellas. El cliente queda como "Sin WhatsApp" (se agrupa por nombre + dirección) hasta que se carga el número en su ficha. Si ese número ya es de otro cliente, se unifican y las compras pasan a sumar estrellas con su fecha original.
- **Pedidos excluidos:** los que tienen estado cancelado, rechazado o anulado no suman ventas ni estrellas.

## Deploy (Vercel + Turso)

El archivo SQLite local no sirve en Vercel. Hay que crear una base en [Turso](https://turso.tech) y configurar estas variables:

```
DATABASE_URL=libsql://<tu-db>.turso.io
DATABASE_AUTH_TOKEN=<token>
SESSION_SECRET=<openssl rand -base64 48>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<clave inicial>
```

Las tablas se crean solas en el primer request.
