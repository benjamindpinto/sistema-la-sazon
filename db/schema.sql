-- ============================================================================
-- Sistema de gestión La Sazón — esquema completo (Postgres 15+ / Supabase)
--
-- Módulos:
--   · Usuarios (login del panel)
--   · Menú (productos con precio simple/doble/triple) + recetas por tamaño
--   · Ventas (pedidos + ítems) → descuentan stock según la receta
--   · Stock (insumos + movimientos, con conversión unidad de compra → unidad de uso)
--   · Proveedores (listas de precios, compras, recepción y velocidad de entrega)
--   · Fidelización (cada N compras el cliente gana un cupón)
--
-- La lógica que tiene que ser consistente sí o sí (stock, recepción de compras y
-- cupones) vive en funciones de la base, así corre dentro de la misma transacción
-- que la venta o la compra que la dispara.
-- ============================================================================

set client_min_messages = warning;

-- ---------------------------------------------------------------------------
-- Usuarios del panel
-- ---------------------------------------------------------------------------
create table usuarios (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  nombre        text,
  password_hash text not null,
  creado_en     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------------
create table clientes (
  id                uuid primary key default gen_random_uuid(),
  telefono          text not null unique,
  nombre            text,
  direccion_default text,
  notas             text,
  creado_en         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Menú
-- ---------------------------------------------------------------------------
create table productos (
  id            uuid primary key default gen_random_uuid(),
  categoria     text not null,              -- hamburguesa | pizzita | acompanamiento | bebida | postre
  nombre        text not null,
  descripcion   text,
  precio_simple numeric(12,2) not null check (precio_simple >= 0),
  precio_doble  numeric(12,2) check (precio_doble >= 0),
  precio_triple numeric(12,2) check (precio_triple >= 0),
  activo        boolean not null default true,
  creado_en     timestamptz not null default now(),
  unique (categoria, nombre)
);

-- ---------------------------------------------------------------------------
-- Stock: insumos
--   unidad         = en qué se cuenta el stock y se arman las recetas (bollo, pan, feta, g...)
--   unidad_compra  = cómo se compra (kg, docena, maple...)
--   equivalencia   = cuántas "unidad" trae una "unidad_compra" (1 kg de carne = 10 bollos)
--   costo_unitario = costo de UNA unidad de stock según la última compra
-- ---------------------------------------------------------------------------
create table insumos (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null unique,
  categoria      text not null default 'Otros',
  unidad         text not null default 'unidad',
  unidad_compra  text not null default 'unidad',
  equivalencia   numeric(14,4) not null default 1 check (equivalencia > 0),
  stock_actual   numeric(14,3) not null default 0,
  stock_minimo   numeric(14,3) not null default 0 check (stock_minimo >= 0),
  costo_unitario numeric(14,4) not null default 0 check (costo_unitario >= 0),
  activo         boolean not null default true,
  notas          text,
  creado_en      timestamptz not null default now()
);

-- Receta de cada producto: cuánto de cada insumo lleva según el tamaño
create table receta_items (
  id          uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete cascade,
  insumo_id   uuid not null references insumos(id) on delete restrict,
  cant_simple numeric(12,3) not null default 0 check (cant_simple >= 0),
  cant_doble  numeric(12,3) not null default 0 check (cant_doble >= 0),
  cant_triple numeric(12,3) not null default 0 check (cant_triple >= 0),
  unique (producto_id, insumo_id)
);

-- ---------------------------------------------------------------------------
-- Proveedores
-- ---------------------------------------------------------------------------
create table proveedores (
  id                     uuid primary key default gen_random_uuid(),
  nombre                 text not null unique,
  rubro                  text,
  contacto               text,
  telefono               text,
  email                  text,
  direccion              text,
  cuit                   text,
  dias_entrega           text,                 -- "Lun, Mié y Vie"
  demora_prometida_horas integer check (demora_prometida_horas >= 0),
  pedido_minimo          numeric(12,2),
  condicion_pago         text,                 -- "Contado", "7 días", "15 días"
  notas                  text,
  activo                 boolean not null default true,
  creado_en              timestamptz not null default now()
);

create table compras (
  id           uuid primary key default gen_random_uuid(),
  numero       bigint generated always as identity,
  proveedor_id uuid not null references proveedores(id) on delete restrict,
  estado       text not null default 'pedida' check (estado in ('pedida', 'recibida', 'cancelada')),
  pedida_en    timestamptz not null default now(),
  recibida_en  timestamptz,
  total        numeric(12,2) not null default 0,
  pagada       boolean not null default false,
  medio_pago   text,
  comprobante  text,
  notas        text,
  creado_en    timestamptz not null default now()
);
create index compras_proveedor_idx on compras (proveedor_id, pedida_en desc);

create table compra_items (
  id                uuid primary key default gen_random_uuid(),
  compra_id         uuid not null references compras(id) on delete cascade,
  insumo_id         uuid not null references insumos(id) on delete restrict,
  cantidad_pedida   numeric(12,3) not null check (cantidad_pedida > 0),   -- en unidad_compra
  cantidad_recibida numeric(12,3) check (cantidad_recibida >= 0),         -- en unidad_compra
  precio_unitario   numeric(12,2) not null check (precio_unitario >= 0)   -- por unidad_compra
);
create index compra_items_compra_idx on compra_items (compra_id);
create index compra_items_insumo_idx on compra_items (insumo_id);

-- Lista de precios por proveedor (precio por unidad_compra del insumo). Cada fila es
-- un precio vigente desde "fecha"; se carga a mano (lista) o sale de una compra.
create table precios_proveedor (
  id           uuid primary key default gen_random_uuid(),
  proveedor_id uuid not null references proveedores(id) on delete cascade,
  insumo_id    uuid not null references insumos(id) on delete cascade,
  precio       numeric(12,2) not null check (precio >= 0),
  fecha        date not null default current_date,
  origen       text not null default 'lista' check (origen in ('lista', 'compra')),
  compra_id    uuid references compras(id) on delete cascade,
  nota         text,
  creado_en    timestamptz not null default now()
);
create index precios_proveedor_idx on precios_proveedor (insumo_id, proveedor_id, fecha desc, creado_en desc);

-- ---------------------------------------------------------------------------
-- Ventas
-- ---------------------------------------------------------------------------
create table pedidos (
  id                uuid primary key default gen_random_uuid(),
  numero            bigint generated always as identity,
  cliente_id        uuid references clientes(id) on delete set null,
  canal             text not null default 'mostrador' check (canal in ('mostrador', 'telefono', 'whatsapp', 'app', 'otro')),
  modalidad         text not null default 'take_away' check (modalidad in ('take_away', 'delivery', 'salon')),
  estado            text not null default 'entregado' check (estado in ('pendiente', 'confirmado', 'en_preparacion', 'en_camino', 'entregado', 'cancelado')),
  direccion_entrega text,
  medio_pago        text not null default 'efectivo',
  subtotal          numeric(12,2) not null default 0,
  descuento         numeric(12,2) not null default 0,
  total             numeric(12,2) not null default 0,
  cupon_id          uuid,
  notas             text,
  creado_en         timestamptz not null default now()
);
create index pedidos_creado_idx on pedidos (creado_en desc);
create index pedidos_cliente_idx on pedidos (cliente_id, creado_en desc);

create table pedido_items (
  id              uuid primary key default gen_random_uuid(),
  pedido_id       uuid not null references pedidos(id) on delete cascade,
  producto_id     uuid not null references productos(id) on delete restrict,
  tamano          text not null default 'simple' check (tamano in ('simple', 'doble', 'triple')),
  cantidad        integer not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null,
  es_regalo       boolean not null default false,     -- producto entregado por un cupón
  costo_unitario  numeric(12,2)                       -- costo de receta al momento de la venta
);
create index pedido_items_pedido_idx on pedido_items (pedido_id);
create index pedido_items_producto_idx on pedido_items (producto_id);

-- ---------------------------------------------------------------------------
-- Movimientos de stock (libro mayor). El stock_actual del insumo se mantiene por trigger.
--   cantidad > 0 entra stock, < 0 sale. Siempre en la unidad de stock del insumo.
-- ---------------------------------------------------------------------------
create table movimientos_stock (
  id             uuid primary key default gen_random_uuid(),
  insumo_id      uuid not null references insumos(id) on delete cascade,
  tipo           text not null check (tipo in ('inicial', 'compra', 'venta', 'cancelacion', 'ajuste', 'merma')),
  cantidad       numeric(14,3) not null,
  costo_unitario numeric(14,4),
  pedido_id      uuid references pedidos(id) on delete set null,
  compra_id      uuid references compras(id) on delete set null,
  nota           text,
  creado_en      timestamptz not null default now()
);
create index movimientos_insumo_idx on movimientos_stock (insumo_id, creado_en desc);
create index movimientos_pedido_idx on movimientos_stock (pedido_id);
create index movimientos_creado_idx on movimientos_stock (creado_en desc);

create function trg_movimiento_stock() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update insumos set stock_actual = stock_actual + new.cantidad where id = new.insumo_id;
  elsif tg_op = 'DELETE' then
    update insumos set stock_actual = stock_actual - old.cantidad where id = old.insumo_id;
  end if;
  return null;
end $$;

create trigger movimiento_stock_aplica
  after insert or delete on movimientos_stock
  for each row execute function trg_movimiento_stock();

-- ---------------------------------------------------------------------------
-- Fidelización
-- ---------------------------------------------------------------------------
create table fidelidad_config (
  id                 integer primary key default 1 check (id = 1),
  activo             boolean not null default true,
  compras_necesarias integer not null default 5 check (compras_necesarias between 1 and 100),
  ventana_dias       integer check (ventana_dias > 0),        -- null = sin límite de tiempo
  monto_minimo       numeric(12,2) not null default 0,        -- compra mínima para que cuente
  premio_tipo        text not null default 'producto' check (premio_tipo in ('producto', 'porcentaje', 'monto')),
  premio_valor       numeric(12,2),                           -- % o $ según el tipo
  premio_producto_id uuid references productos(id) on delete set null,
  premio_tamano      text not null default 'simple' check (premio_tamano in ('simple', 'doble', 'triple')),
  vencimiento_dias   integer check (vencimiento_dias > 0),    -- null = no vence
  mensaje            text
);

create table cupones (
  id               uuid primary key default gen_random_uuid(),
  codigo           text not null unique,
  cliente_id       uuid not null references clientes(id) on delete cascade,
  origen           text not null default 'fidelidad' check (origen in ('fidelidad', 'manual')),
  tipo             text not null check (tipo in ('producto', 'porcentaje', 'monto')),
  valor            numeric(12,2),
  producto_id      uuid references productos(id) on delete set null,
  tamano           text check (tamano in ('simple', 'doble', 'triple')),
  estado           text not null default 'disponible' check (estado in ('disponible', 'usado', 'anulado')),
  pedido_origen_id uuid references pedidos(id) on delete set null,
  pedido_uso_id    uuid references pedidos(id) on delete set null,
  creado_en        timestamptz not null default now(),
  vence_en         timestamptz,
  usado_en         timestamptz,
  nota             text
);
create index cupones_cliente_idx on cupones (cliente_id, creado_en desc);

alter table pedidos
  add constraint pedidos_cupon_fk foreign key (cupon_id) references cupones(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Costo de receta por producto y tamaño (con el último costo de cada insumo)
-- ---------------------------------------------------------------------------
create view v_costo_receta as
select
  p.id as producto_id,
  coalesce(sum(ri.cant_simple * i.costo_unitario), 0)::numeric(12,2) as costo_simple,
  coalesce(sum(ri.cant_doble  * i.costo_unitario), 0)::numeric(12,2) as costo_doble,
  coalesce(sum(ri.cant_triple * i.costo_unitario), 0)::numeric(12,2) as costo_triple,
  count(ri.id)::int as insumos_en_receta
from productos p
left join receta_items ri on ri.producto_id = p.id
left join insumos i on i.id = ri.insumo_id
group by p.id;

-- ---------------------------------------------------------------------------
-- Progreso de fidelización de cada cliente hoy: compras que cuentan desde su
-- último premio (y dentro de la ventana de días si está configurada).
-- ---------------------------------------------------------------------------
create view v_progreso_fidelidad as
with cfg as (
  select * from fidelidad_config where id = 1
),
ultimo as (
  select c.cliente_id, max(coalesce(po.creado_en, c.creado_en)) as desde
  from cupones c
  left join pedidos po on po.id = c.pedido_origen_id
  where c.origen = 'fidelidad' and c.estado <> 'anulado'
  group by c.cliente_id
)
select
  cl.id as cliente_id,
  (select count(*)
     from pedidos p
    where p.cliente_id = cl.id
      and p.estado <> 'cancelado'
      and p.total > 0
      and p.total >= cfg.monto_minimo
      and (u.desde is null or p.creado_en > u.desde)
      and (cfg.ventana_dias is null or p.creado_en > now() - make_interval(days => cfg.ventana_dias))
  )::int as compras_en_ciclo,
  cfg.compras_necesarias,
  cfg.activo as programa_activo
from clientes cl
cross join cfg
left join ultimo u on u.cliente_id = cl.id;

-- ---------------------------------------------------------------------------
-- Stock de un pedido: deja los movimientos del pedido iguales a lo que dice su
-- receta (o en cero si está cancelado). Es idempotente: se puede llamar después
-- de crear, cancelar o reactivar una venta y sólo registra la diferencia.
-- ---------------------------------------------------------------------------
create function sincronizar_stock_pedido(p_pedido_id uuid) returns void language plpgsql as $$
declare
  v_estado text;
  v_fecha  timestamptz;
  r        record;
begin
  select estado, creado_en into v_estado, v_fecha from pedidos where id = p_pedido_id;

  for r in
    with objetivo as (
      select ri.insumo_id,
             sum(pi.cantidad * case pi.tamano when 'simple' then ri.cant_simple
                                              when 'doble'  then ri.cant_doble
                                              else ri.cant_triple end) as consumo
      from pedido_items pi
      join receta_items ri on ri.producto_id = pi.producto_id
      where pi.pedido_id = p_pedido_id
        and v_estado is not null and v_estado <> 'cancelado'
      group by ri.insumo_id
    ),
    actual as (
      select insumo_id, -sum(cantidad) as consumo
      from movimientos_stock
      where pedido_id = p_pedido_id
      group by insumo_id
    )
    select coalesce(o.insumo_id, a.insumo_id) as insumo_id,
           coalesce(o.consumo, 0) - coalesce(a.consumo, 0) as diferencia
    from objetivo o
    full join actual a on a.insumo_id = o.insumo_id
  loop
    if abs(r.diferencia) > 0.0005 then
      insert into movimientos_stock (insumo_id, tipo, cantidad, costo_unitario, pedido_id, creado_en)
      values (
        r.insumo_id,
        case when r.diferencia > 0 then 'venta' else 'cancelacion' end,
        -r.diferencia,
        (select costo_unitario from insumos where id = r.insumo_id),
        p_pedido_id,
        case when r.diferencia > 0 then least(coalesce(v_fecha, now()), now()) else now() end
      );
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Fidelización: si con este pedido el cliente llega a N compras (desde su último
-- premio y dentro de la ventana de días, si hay), le genera el cupón.
-- Devuelve el id del cupón generado o null.
-- ---------------------------------------------------------------------------
create function evaluar_fidelidad(p_pedido_id uuid) returns uuid language plpgsql as $$
declare
  cfg       fidelidad_config%rowtype;
  v_cliente uuid;
  v_estado  text;
  v_fecha   timestamptz;
  v_desde   timestamptz;
  v_cuenta  integer;
  v_cupon   uuid;
  v_codigo  text;
begin
  select * into cfg from fidelidad_config where id = 1;
  if not found or not cfg.activo then return null; end if;

  select cliente_id, estado, creado_en into v_cliente, v_estado, v_fecha from pedidos where id = p_pedido_id;
  if v_cliente is null or v_estado = 'cancelado' then return null; end if;

  if exists (select 1 from cupones where pedido_origen_id = p_pedido_id and estado <> 'anulado') then
    return null;
  end if;

  -- el ciclo arranca después del último premio de fidelidad (no anulado)
  select max(coalesce(po.creado_en, c.creado_en)) into v_desde
  from cupones c
  left join pedidos po on po.id = c.pedido_origen_id
  where c.cliente_id = v_cliente and c.origen = 'fidelidad' and c.estado <> 'anulado';

  select count(*) into v_cuenta
  from pedidos p
  where p.cliente_id = v_cliente
    and p.estado <> 'cancelado'
    and p.total > 0
    and p.total >= cfg.monto_minimo
    and p.creado_en <= v_fecha
    and (v_desde is null or p.creado_en > v_desde)
    and (cfg.ventana_dias is null or p.creado_en > v_fecha - make_interval(days => cfg.ventana_dias));

  if v_cuenta < cfg.compras_necesarias then return null; end if;

  loop
    v_codigo := 'SAZ-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from cupones where codigo = v_codigo);
  end loop;

  insert into cupones (codigo, cliente_id, origen, tipo, valor, producto_id, tamano,
                       pedido_origen_id, creado_en, vence_en, nota)
  values (
    v_codigo, v_cliente, 'fidelidad', cfg.premio_tipo,
    case when cfg.premio_tipo = 'producto' then null else cfg.premio_valor end,
    case when cfg.premio_tipo = 'producto' then cfg.premio_producto_id else null end,
    case when cfg.premio_tipo = 'producto' then cfg.premio_tamano else null end,
    p_pedido_id, v_fecha,
    case when cfg.vencimiento_dias is null then null else v_fecha + make_interval(days => cfg.vencimiento_dias) end,
    'Premio por ' || cfg.compras_necesarias || ' compras'
  )
  returning id into v_cupon;

  return v_cupon;
end $$;

-- ---------------------------------------------------------------------------
-- Procesa una venta recién cargada o modificada: guarda el costo de receta de
-- cada ítem, descuenta stock y evalúa el premio de fidelidad.
-- ---------------------------------------------------------------------------
create function procesar_pedido(p_pedido_id uuid) returns uuid language plpgsql as $$
begin
  update pedido_items pi
     set costo_unitario = case pi.tamano when 'simple' then v.costo_simple
                                         when 'doble'  then v.costo_doble
                                         else v.costo_triple end
    from v_costo_receta v
   where v.producto_id = pi.producto_id
     and pi.pedido_id = p_pedido_id
     and pi.costo_unitario is null;

  perform sincronizar_stock_pedido(p_pedido_id);
  return evaluar_fidelidad(p_pedido_id);
end $$;

-- ---------------------------------------------------------------------------
-- Recepción de una compra: suma el stock (convertido a unidad de stock), actualiza
-- el costo del insumo si es la compra más reciente, registra el precio pagado en
-- la lista del proveedor y recalcula el total con lo que llegó de verdad.
-- Antes de llamarla se puede completar compra_items.cantidad_recibida; si queda
-- vacía se asume que llegó todo lo pedido.
-- ---------------------------------------------------------------------------
create function recibir_compra(p_compra_id uuid, p_fecha timestamptz default now()) returns void language plpgsql as $$
declare
  v_proveedor uuid;
  r record;
begin
  update compras set estado = 'recibida', recibida_en = p_fecha
   where id = p_compra_id and estado = 'pedida'
  returning proveedor_id into v_proveedor;
  if not found then
    raise exception 'La compra no está pendiente de recepción';
  end if;

  update compra_items set cantidad_recibida = cantidad_pedida
   where compra_id = p_compra_id and cantidad_recibida is null;

  for r in
    select ci.insumo_id, ci.cantidad_recibida, ci.precio_unitario, i.equivalencia
    from compra_items ci join insumos i on i.id = ci.insumo_id
    where ci.compra_id = p_compra_id and ci.cantidad_recibida > 0
  loop
    insert into movimientos_stock (insumo_id, tipo, cantidad, costo_unitario, compra_id, creado_en)
    values (r.insumo_id, 'compra', r.cantidad_recibida * r.equivalencia,
            r.precio_unitario / r.equivalencia, p_compra_id, p_fecha);

    if not exists (
      select 1 from compras c2 join compra_items ci2 on ci2.compra_id = c2.id
      where ci2.insumo_id = r.insumo_id and c2.estado = 'recibida'
        and c2.id <> p_compra_id and c2.recibida_en > p_fecha and ci2.cantidad_recibida > 0
    ) then
      update insumos set costo_unitario = r.precio_unitario / r.equivalencia where id = r.insumo_id;
    end if;

    insert into precios_proveedor (proveedor_id, insumo_id, precio, fecha, origen, compra_id)
    values (v_proveedor, r.insumo_id, r.precio_unitario,
            (p_fecha at time zone 'America/Argentina/Buenos_Aires')::date, 'compra', p_compra_id);
  end loop;

  update compras
     set total = (select coalesce(sum(cantidad_recibida * precio_unitario), 0) from compra_items where compra_id = p_compra_id)
   where id = p_compra_id;
end $$;

-- ---------------------------------------------------------------------------
-- Anula una compra. Si ya se había recibido, descuenta el stock que había sumado.
-- ---------------------------------------------------------------------------
create function anular_compra(p_compra_id uuid) returns void language plpgsql as $$
declare
  v_estado text;
  r record;
begin
  select estado into v_estado from compras where id = p_compra_id for update;
  if v_estado is null then raise exception 'La compra no existe'; end if;
  if v_estado = 'cancelada' then return; end if;

  if v_estado = 'recibida' then
    for r in
      select insumo_id, sum(cantidad) as cantidad
      from movimientos_stock where compra_id = p_compra_id group by insumo_id
    loop
      if r.cantidad <> 0 then
        insert into movimientos_stock (insumo_id, tipo, cantidad, compra_id, nota)
        values (r.insumo_id, 'ajuste', -r.cantidad, p_compra_id, 'Compra anulada');
      end if;
    end loop;
    delete from precios_proveedor where compra_id = p_compra_id;
  end if;

  update compras set estado = 'cancelada' where id = p_compra_id;
end $$;

-- Configuración inicial de fidelización (se ajusta desde el panel)
insert into fidelidad_config (id, activo, compras_necesarias, ventana_dias, monto_minimo, premio_tipo,
                              premio_valor, premio_tamano, vencimiento_dias, mensaje)
values (1, true, 5, null, 0, 'producto', null, 'simple', 30,
        '¡Hola {nombre}! Gracias por elegirnos {compras} veces 🍔 Te ganaste {premio}. Mostrá el código {codigo} en tu próximo pedido{vence}.');

-- El panel se conecta con el usuario dueño de la base; nadie más debe leer estas tablas.
-- En Supabase esto cierra el acceso por la API pública (anon/authenticated).
do $$
declare t text;
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    foreach t in array array['usuarios','clientes','productos','insumos','receta_items','proveedores','compras',
                             'compra_items','precios_proveedor','pedidos','pedido_items','movimientos_stock',
                             'fidelidad_config','cupones'] loop
      execute format('alter table %I enable row level security', t);
    end loop;
    revoke all on all tables in schema public from anon, authenticated;
  end if;
end $$;
