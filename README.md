# Sistema de gestión · La Sazón

Panel de gestión para La Sazón (hamburguesas y pizzitas). Es la versión 2 del panel actual
(`la-sazon.vercel.app`), sin el agente conversacional, y suma stock por receta, proveedores y fidelización.

## Qué hace

| Sección | Para qué sirve |
| --- | --- |
| **Nueva venta** | Caja rápida: se toca el producto en simple / doble / triple (o 4 / 8 porciones), se carga el cliente por WhatsApp y, si tiene un cupón, se aplica. Al registrar, **descuenta el stock según la receta**. |
| **Ventas** | Listado por período, estado y búsqueda. Cancelar una venta devuelve los insumos al stock, libera el cupón que se usó y anula el premio que había generado. |
| **Stock** | Insumos con **unidad de uso y unidad de compra** (1 kg de carne = 10 bollos). Muestra cuántos días alcanza cada insumo, qué hay en camino, el conteo físico (ajuste), las mermas y **cuántas ventas de cada producto se pueden hacer con lo que hay**. |
| **Compras** | Pedidos a proveedores. Al recibirlos se suma el stock, se actualiza el costo y queda registrado el precio. Mide cuánto tardó cada entrega y si llegó completa. Avisa de las compras atrasadas y de la deuda con proveedores. Puede mandar el pedido por WhatsApp. |
| **Proveedores** | Ficha y puntaje de cada uno: velocidad real contra la prometida, % de entregas a tiempo, % de entregas completas y en cuántos insumos es el más barato. **Comparador de precios** y cálculo de cuánto se hubiera ahorrado. |
| **Menú y recetas** | Precios, **costo de receta y margen por tamaño**. Editor de recetas (con opción de copiar la receta de otro producto). |
| **Clientes** | Historial, gasto, lo que más pide y avance hacia el premio. Se puede regalar un cupón a mano. |
| **Fidelización** | Reglas configurables: cada **N compras** (con plazo de días o sin límite), con compra mínima opcional, el premio (producto gratis, % o $ de descuento) y el vencimiento del cupón. El cupón se genera solo al registrar la venta que lo completa. Muestra quién está a una compra del premio y qué cupones están por vencer, con mensaje de WhatsApp listo para enviar. |
| **Dashboard** | Ventas, ingresos, ticket promedio, **margen bruto real** (con el costo de las recetas), simples / dobles / triples vendidas, stock crítico y alertas. |

## Cómo está armado

- Next.js 16 + React 19 + Tailwind 4, con la misma identidad visual del panel actual.
- Postgres (pensado para Supabase). Toda la lectura y escritura se hace del lado del servidor con `pg`;
  la API pública de Supabase queda cerrada (RLS activado y sin permisos para `anon`).
- La lógica que no puede fallar vive en funciones de la base y corre en la misma transacción que la venta o la compra:
  - `procesar_pedido()`: guarda el costo de la receta, descuenta el stock y evalúa el premio.
  - `sincronizar_stock_pedido()`: es idempotente; sirve para crear, cancelar y reactivar ventas.
  - `recibir_compra()` / `anular_compra()`
  - `evaluar_fidelidad()`
- Login propio con email y contraseña (bcrypt + cookie firmada), igual que el panel actual.

## Correrlo en la compu (con datos de ejemplo)

```bash
npm install
npm run db:local          # crea una base Postgres local con datos de ejemplo y la deja corriendo
# en otra terminal:
npm run dev               # http://localhost:3000
```

Usuario de prueba: `demo@lasazon.com` / `lasazon2026`

`.env.local` para la base local:

```
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54329/postgres
DB_POOL_MAX=3
SESSION_SECRET=<cualquier texto largo>
```

- `npm run db:local -- --reset` borra la base y la vuelve a crear.
- `npm run db:local -- --vacia` crea la base sólo con el menú real, sin datos de ejemplo.

## Datos

- `db/schema.sql`: estructura completa (tablas, vistas, funciones y trigger de stock).
- `db/seed_menu.sql`: el menú real de La Sazón (23 productos con sus precios, copiados del panel actual el 12/11/2026).
- `db/seed_demo.sql`: **sólo para mostrar el sistema**. Tiene insumos, recetas y costos estimados, 6 proveedores y 25 clientes
  ficticios, y 30 días de ventas y compras simuladas. No se carga en producción.

## Producción

- **Supabase:** proyecto `LA-SAZON` (`dtkvugbmhhdlqzmdczeg`, São Paulo), organización BENAUTOMATION.
  Tiene cargados `schema.sql`, `seed_menu.sql` y `supabase_rol_app.sql`, aplicados como migraciones. No tiene datos de ejemplo.
- **Conexión:** el panel entra con un rol propio, `app_lasazon`, por el Transaction pooler
  (`aws-1-sa-east-1.pooler.supabase.com:6543`, usuario `app_lasazon.dtkvugbmhhdlqzmdczeg`).
  Ese rol sólo tiene permisos sobre estas tablas. RLS está activo y la API pública de Supabase no ve nada.
- **Vercel:** se importa este repo y se cargan `DATABASE_URL`, `DB_POOL_MAX=3` y `SESSION_SECRET`.
  Los valores están en `.env.vercel`, que no se sube a git.
- **Usuarios del panel:**
  `node --env-file=.env.vercel scripts/crear-usuario.mjs email@dominio.com "contraseña" "Nombre"`
  Si el email ya existe, cambia la contraseña.

Para una base nueva: aplicar `db/schema.sql`, `db/seed_menu.sql` y `db/supabase_rol_app.sql`, y darle contraseña al rol con
`alter role app_lasazon with password '...'`.

## Pendiente con el cliente

- Gramajes reales de cada receta (cuántos gramos tiene el bollo, cuántas fetas lleva cada hamburguesa, etc.).
- Proveedores reales con sus precios y la demora que prometen.
- Reglas de fidelización: cuántas compras, si hay plazo, qué se regala y en cuánto vence.
  Hoy están en 5 compras, sin plazo, una La Sazón simple de regalo y 30 días de vencimiento. Se cambian desde el panel.
- Si se quieren traer los clientes y las ventas del panel actual, hace falta acceso a esa base.
