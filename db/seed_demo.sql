-- ============================================================================
-- DATOS DE EJEMPLO para mostrar el sistema funcionando (NO usar en producción).
-- Insumos, recetas y precios son estimaciones razonables para arrancar: el local
-- tiene que reemplazarlos por sus gramajes y costos reales.
-- Proveedores y clientes son ficticios.
-- Requiere schema.sql + seed_menu.sql aplicados antes.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Insumos: (nombre, categoría, unidad de stock, unidad de compra, equivalencia,
--           stock mínimo, precio de referencia por unidad de compra)
-- ---------------------------------------------------------------------------
insert into insumos (nombre, categoria, unidad, unidad_compra, equivalencia, stock_minimo, costo_unitario)
select nombre, categoria, unidad, unidad_compra, equivalencia, minimo, round(precio / equivalencia, 4)
from (values
  ('Bollo de carne',     'Carnes',            'bollo',  'kg',             10,   80,   9100),
  ('Pan de papa',        'Panificados',       'pan',    'docena',         12,   48,   6000),
  ('Masa de pizza',      'Panificados',       'g',      'kg',             1000, 3000, 1800),
  ('Cheddar en fetas',   'Lácteos y quesos',  'feta',   'kg',             50,   100,  14000),
  ('Muzzarella',         'Lácteos y quesos',  'g',      'kg',             1000, 4000, 8800),
  ('Queso azul',         'Lácteos y quesos',  'g',      'kg',             1000, 600,  16000),
  ('Queso parmesano',    'Lácteos y quesos',  'g',      'kg',             1000, 300,  22000),
  ('Panceta ahumada',    'Fiambres',          'feta',   'kg',             40,   120,  15800),
  ('Jamón cocido',       'Fiambres',          'g',      'kg',             1000, 500,  11000),
  ('Pepperoni',          'Fiambres',          'g',      'kg',             1000, 300,  20500),
  ('Huevo',              'Almacén',           'unidad', 'maple x30',      30,   30,   6000),
  ('Cebolla',            'Verduras',          'g',      'kg',             1000, 2500, 1100),
  ('Cebolla morada',     'Verduras',          'g',      'kg',             1000, 500,  1800),
  ('Lechuga',            'Verduras',          'g',      'kg',             1000, 300,  2800),
  ('Tomate',             'Verduras',          'g',      'kg',             1000, 1500, 2200),
  ('Tomates cherry',     'Verduras',          'g',      'kg',             1000, 400,  6000),
  ('Albahaca',           'Verduras',          'g',      'atado 50 g',     50,   40,   800),
  ('Morrones asados',    'Almacén',           'g',      'frasco 1 kg',    1000, 300,  7000),
  ('Salsa triple',       'Salsas y aderezos', 'g',      'kg',             1000, 1000, 4500),
  ('Salsa La Sazón',     'Salsas y aderezos', 'g',      'kg',             1000, 1000, 5000),
  ('Salsa barbacoa',     'Salsas y aderezos', 'g',      'kg',             1000, 400,  5500),
  ('Salsa de tomate',    'Salsas y aderezos', 'g',      'kg',             1000, 2500, 2500),
  ('Mostaza y ketchup',  'Salsas y aderezos', 'g',      'kg',             1000, 400,  3500),
  ('Pepinos encurtidos', 'Salsas y aderezos', 'g',      'frasco 1 kg',    1000, 300,  6500),
  ('Aceite de oliva',    'Almacén',           'ml',     'litro',          1000, 300,  18000),
  ('Nueces',             'Almacén',           'g',      'kg',             1000, 150,  20000),
  ('Aros de cebolla',    'Congelados',        'unidad', 'bolsa 1 kg',     45,   45,   9000),
  ('Cebollita crispy',   'Congelados',        'g',      'kg',             1000, 400,  9000),
  ('Caja hamburguesa',   'Descartables',      'unidad', 'paquete x100',   100,  100,  16000),
  ('Caja pizza',         'Descartables',      'unidad', 'paquete x50',    50,   40,   12000)
) as v(nombre, categoria, unidad, unidad_compra, equivalencia, minimo, precio);

-- ---------------------------------------------------------------------------
-- Recetas (cantidades en la unidad de stock de cada insumo)
-- Hamburguesas: simple / doble / triple. Pizzitas: simple = 4 porc., doble = 8 porc.
-- ---------------------------------------------------------------------------
-- Base de todas las hamburguesas: carne según tamaño, pan y caja
insert into receta_items (producto_id, insumo_id, cant_simple, cant_doble, cant_triple)
select p.id, i.id, b.s, b.d, b.t
from productos p
cross join (values ('Bollo de carne', 1, 2, 3), ('Pan de papa', 1, 1, 1), ('Caja hamburguesa', 1, 1, 1)) as b(insumo, s, d, t)
join insumos i on i.nombre = b.insumo
where p.categoria = 'hamburguesa';

-- Base de todas las pizzitas: masa y caja
insert into receta_items (producto_id, insumo_id, cant_simple, cant_doble, cant_triple)
select p.id, i.id, b.s, b.d, 0
from productos p
cross join (values ('Masa de pizza', 180, 350), ('Caja pizza', 1, 1)) as b(insumo, s, d)
join insumos i on i.nombre = b.insumo
where p.categoria = 'pizzita';

-- Ingredientes particulares
insert into receta_items (producto_id, insumo_id, cant_simple, cant_doble, cant_triple)
select p.id, i.id, v.s, v.d, v.t
from (values
  -- hamburguesas
  ('Americana',           'Cheddar en fetas',   1, 2, 3),
  ('Americana',           'Panceta ahumada',    2, 3, 4),
  ('Americana',           'Huevo',              1, 1, 1),
  ('Americana',           'Salsa triple',       25, 30, 35),
  ('Bacon Cheese',        'Cheddar en fetas',   2, 3, 4),
  ('Bacon Cheese',        'Panceta ahumada',    3, 4, 5),
  ('Bacon Cheese',        'Salsa triple',       25, 30, 35),
  ('BBQ Onion',           'Cheddar en fetas',   1, 2, 3),
  ('BBQ Onion',           'Panceta ahumada',    2, 3, 4),
  ('BBQ Onion',           'Salsa barbacoa',     25, 30, 35),
  ('BBQ Onion',           'Aros de cebolla',    3, 3, 3),
  ('Caramelizada',        'Cheddar en fetas',   1, 2, 3),
  ('Caramelizada',        'Panceta ahumada',    2, 3, 4),
  ('Caramelizada',        'Cebolla',            60, 70, 80),
  ('Caramelizada',        'Salsa triple',       25, 30, 35),
  ('Clásica',             'Cheddar en fetas',   1, 2, 3),
  ('Clásica',             'Huevo',              1, 1, 1),
  ('Clásica',             'Lechuga',            15, 15, 20),
  ('Clásica',             'Tomate',             40, 40, 50),
  ('Clásica',             'Cebolla morada',     15, 15, 20),
  ('Clásica',             'Salsa triple',       25, 30, 35),
  ('Crispy Melt',         'Cheddar en fetas',   1, 2, 3),
  ('Crispy Melt',         'Panceta ahumada',    2, 3, 4),
  ('Crispy Melt',         'Cebollita crispy',   20, 25, 30),
  ('Crispy Melt',         'Salsa La Sazón',     25, 30, 35),
  ('Full Cheese',         'Cheddar en fetas',   3, 5, 7),
  ('Full Cheese',         'Salsa triple',       25, 30, 35),
  ('La Culposa',          'Cheddar en fetas',   2, 4, 6),
  ('La Culposa',          'Panceta ahumada',    3, 4, 5),
  ('La Culposa',          'Cebollita crispy',   20, 25, 30),
  ('La Culposa',          'Salsa La Sazón',     30, 35, 40),
  ('La Sazón',            'Cheddar en fetas',   1, 2, 3),
  ('La Sazón',            'Panceta ahumada',    2, 3, 4),
  ('La Sazón',            'Salsa La Sazón',     25, 30, 35),
  ('Oklahomaxxx',         'Cheddar en fetas',   1, 2, 3),
  ('Oklahomaxxx',         'Panceta ahumada',    2, 3, 4),
  ('Oklahomaxxx',         'Cebolla',            40, 70, 100),
  ('Oklahomaxxx',         'Salsa La Sazón',     25, 30, 35),
  ('Onion Pickles Lover', 'Cheddar en fetas',   1, 2, 3),
  ('Onion Pickles Lover', 'Panceta ahumada',    2, 3, 4),
  ('Onion Pickles Lover', 'Cebolla',            30, 30, 40),
  ('Onion Pickles Lover', 'Pepinos encurtidos', 25, 30, 35),
  ('Onion Pickles Lover', 'Mostaza y ketchup',  20, 25, 30),
  -- pizzitas
  ('3 Quesos',               'Muzzarella',      130, 250, 0),
  ('3 Quesos',               'Queso parmesano', 20, 40, 0),
  ('3 Quesos',               'Queso azul',      40, 80, 0),
  ('3 Quesos',               'Aceite de oliva', 5, 10, 0),
  ('Cherrys y Albahaca',     'Salsa de tomate', 60, 110, 0),
  ('Cherrys y Albahaca',     'Muzzarella',      130, 250, 0),
  ('Cherrys y Albahaca',     'Tomates cherry',  60, 110, 0),
  ('Cherrys y Albahaca',     'Albahaca',        3, 5, 0),
  ('Cherrys y Albahaca',     'Aceite de oliva', 5, 10, 0),
  ('Fugazza',                'Salsa de tomate', 60, 110, 0),
  ('Fugazza',                'Muzzarella',      130, 250, 0),
  ('Fugazza',                'Cebolla',         80, 150, 0),
  ('Jamón y Morrones',       'Salsa de tomate', 60, 110, 0),
  ('Jamón y Morrones',       'Muzzarella',      130, 250, 0),
  ('Jamón y Morrones',       'Jamón cocido',    60, 110, 0),
  ('Jamón y Morrones',       'Morrones asados', 40, 70, 0),
  ('Jamón y Morrones',       'Aceite de oliva', 5, 10, 0),
  ('Margarita',              'Salsa de tomate', 60, 110, 0),
  ('Margarita',              'Muzzarella',      130, 250, 0),
  ('Margarita',              'Albahaca',        3, 5, 0),
  ('Margarita',              'Aceite de oliva', 5, 10, 0),
  ('Muzza Simple',           'Salsa de tomate', 60, 110, 0),
  ('Muzza Simple',           'Muzzarella',      130, 250, 0),
  ('Muzza Simple',           'Aceite de oliva', 5, 10, 0),
  ('Napolitana',             'Salsa de tomate', 60, 110, 0),
  ('Napolitana',             'Muzzarella',      130, 250, 0),
  ('Napolitana',             'Tomate',          80, 150, 0),
  ('Pepperoni',              'Salsa de tomate', 60, 110, 0),
  ('Pepperoni',              'Muzzarella',      130, 250, 0),
  ('Pepperoni',              'Pepperoni',       40, 75, 0),
  ('Queso Azul',             'Salsa de tomate', 60, 110, 0),
  ('Queso Azul',             'Muzzarella',      130, 250, 0),
  ('Queso Azul',             'Queso azul',      50, 90, 0),
  ('Queso Azul',             'Aceite de oliva', 5, 10, 0),
  ('Queso Azul y Cebollita', 'Salsa de tomate', 60, 110, 0),
  ('Queso Azul y Cebollita', 'Muzzarella',      130, 250, 0),
  ('Queso Azul y Cebollita', 'Queso azul',      50, 90, 0),
  ('Queso Azul y Cebollita', 'Cebolla',         60, 110, 0),
  ('Queso Azul y Nueces',    'Salsa de tomate', 60, 110, 0),
  ('Queso Azul y Nueces',    'Muzzarella',      130, 250, 0),
  ('Queso Azul y Nueces',    'Queso azul',      50, 90, 0),
  ('Queso Azul y Nueces',    'Nueces',          15, 25, 0),
  ('Queso Azul y Nueces',    'Aceite de oliva', 5, 10, 0),
  ('Queso Azul y Panceta',   'Salsa de tomate', 60, 110, 0),
  ('Queso Azul y Panceta',   'Queso azul',      70, 130, 0),
  ('Queso Azul y Panceta',   'Panceta ahumada', 3, 5, 0)
) as v(producto, insumo, s, d, t)
join productos p on p.nombre = v.producto
join insumos i on i.nombre = v.insumo;

-- ---------------------------------------------------------------------------
-- Proveedores (ficticios)
-- ---------------------------------------------------------------------------
insert into proveedores (nombre, rubro, contacto, telefono, dias_entrega, demora_prometida_horas, pedido_minimo, condicion_pago, notas) values
  ('Frigorífico Don Ramón',   'Carnes',                         'Ramón',   '+5493814000101', 'Lun a Sáb',       24, 50000,  'Contado',  'Entrega a primera hora. Bollos de 100 g ya armados.'),
  ('Carnes del Valle',        'Carnes',                         'Silvia',  '+5493814000102', 'Mar, Jue y Sáb',  24, 80000,  '7 días',   'Más barato pero suele atrasarse.'),
  ('Panificadora El Molino',  'Panificados',                    'Diego',   '+5493814000103', 'Todos los días',  12, 20000,  'Contado',  'Pan de papa y bollos de masa.'),
  ('Lácteos del Norte',       'Quesos y fiambres',              'Marcela', '+5493814000104', 'Lun y Jue',       48, 100000, '15 días',  null),
  ('Mayorista San Cayetano',  'Almacén, fiambres, descartables','Mostrador','+5493814000105','Lun a Vie',       24, 60000,  'Contado',  'Se puede retirar en el local.'),
  ('Verdulería La Huerta',    'Verduras',                       'Chino',   '+5493814000106', 'Lun a Sáb',       6,  10000,  'Contado',  null);

-- Listas de precios (por unidad de compra). Días hacia atrás desde hoy.
insert into precios_proveedor (proveedor_id, insumo_id, precio, fecha, origen)
select pr.id, i.id, v.precio, current_date - v.dias, 'lista'
from (values
  ('Frigorífico Don Ramón',  'Bollo de carne',     9100, 32),
  ('Frigorífico Don Ramón',  'Bollo de carne',     9500, 10),
  ('Frigorífico Don Ramón',  'Panceta ahumada',    17000, 32),
  ('Carnes del Valle',       'Bollo de carne',     9200, 32),
  ('Mayorista San Cayetano', 'Bollo de carne',     10200, 20),
  ('Panificadora El Molino', 'Pan de papa',        6000, 32),
  ('Panificadora El Molino', 'Masa de pizza',      1800, 32),
  ('Mayorista San Cayetano', 'Pan de papa',        6600, 20),
  ('Lácteos del Norte',      'Cheddar en fetas',   14000, 32),
  ('Lácteos del Norte',      'Muzzarella',         8800, 32),
  ('Lácteos del Norte',      'Queso azul',         16000, 32),
  ('Lácteos del Norte',      'Queso parmesano',    22000, 32),
  ('Lácteos del Norte',      'Panceta ahumada',    16500, 32),
  ('Lácteos del Norte',      'Jamón cocido',       11000, 32),
  ('Lácteos del Norte',      'Pepperoni',          21000, 32),
  ('Mayorista San Cayetano', 'Cheddar en fetas',   14900, 20),
  ('Mayorista San Cayetano', 'Muzzarella',         9400, 20),
  ('Mayorista San Cayetano', 'Queso azul',         17500, 20),
  ('Mayorista San Cayetano', 'Panceta ahumada',    15800, 32),
  ('Mayorista San Cayetano', 'Jamón cocido',       11800, 20),
  ('Mayorista San Cayetano', 'Pepperoni',          20500, 32),
  ('Mayorista San Cayetano', 'Huevo',              6000, 32),
  ('Mayorista San Cayetano', 'Morrones asados',    7000, 32),
  ('Mayorista San Cayetano', 'Salsa triple',       4500, 32),
  ('Mayorista San Cayetano', 'Salsa La Sazón',     5000, 32),
  ('Mayorista San Cayetano', 'Salsa barbacoa',     5500, 32),
  ('Mayorista San Cayetano', 'Salsa de tomate',    2500, 32),
  ('Mayorista San Cayetano', 'Mostaza y ketchup',  3500, 32),
  ('Mayorista San Cayetano', 'Pepinos encurtidos', 6500, 32),
  ('Mayorista San Cayetano', 'Aceite de oliva',    18000, 32),
  ('Mayorista San Cayetano', 'Nueces',             20000, 32),
  ('Mayorista San Cayetano', 'Aros de cebolla',    9000, 32),
  ('Mayorista San Cayetano', 'Cebollita crispy',   9000, 32),
  ('Mayorista San Cayetano', 'Caja hamburguesa',   16000, 32),
  ('Mayorista San Cayetano', 'Caja pizza',         12000, 32),
  ('Mayorista San Cayetano', 'Cebolla',            1300, 20),
  ('Mayorista San Cayetano', 'Tomate',             2500, 20),
  ('Verdulería La Huerta',   'Huevo',              6300, 32),
  ('Verdulería La Huerta',   'Cebolla',            1100, 32),
  ('Verdulería La Huerta',   'Cebolla morada',     1800, 32),
  ('Verdulería La Huerta',   'Lechuga',            2800, 32),
  ('Verdulería La Huerta',   'Tomate',             2200, 32),
  ('Verdulería La Huerta',   'Tomates cherry',     6000, 32),
  ('Verdulería La Huerta',   'Albahaca',           800, 32)
) as v(proveedor, insumo, precio, dias)
join proveedores pr on pr.nombre = v.proveedor
join insumos i on i.nombre = v.insumo;

-- ---------------------------------------------------------------------------
-- Clientes (ficticios)
-- ---------------------------------------------------------------------------
insert into clientes (telefono, nombre, direccion_default, creado_en)
select '+54938150000' || lpad(n::text, 2, '0'), nombre, direccion, now() - make_interval(days => 31 + n)
from (values
  (1, 'Martina Gómez', 'Av. Mate de Luna 2150'), (2, 'Joaquín Pérez', 'San Martín 845'),
  (3, 'Sofía Díaz', 'Laprida 1320'), (4, 'Tomás Romero', null), (5, 'Valentina Ruiz', 'Junín 560'),
  (6, 'Lucas Fernández', 'Av. Aconquija 1450'), (7, 'Camila Sosa', null), (8, 'Mateo Álvarez', 'Crisóstomo Álvarez 980'),
  (9, 'Julieta Torres', 'Santiago 1120'), (10, 'Benjamín Castro', null), (11, 'Agustina Herrera', 'Muñecas 450'),
  (12, 'Facundo Medina', 'Av. Roca 2300'), (13, 'Florencia Acosta', null), (14, 'Nicolás Ríos', 'Lamadrid 740'),
  (15, 'Milagros Vega', 'Marcos Paz 1650'), (16, 'Santiago Molina', null), (17, 'Abril Ortiz', 'Salta 890'),
  (18, 'Franco Suárez', 'Av. Belgrano 3100'), (19, 'Delfina Rojas', null), (20, 'Ignacio Paz', 'Rivadavia 520'),
  (21, 'Lucía Navarro', 'Córdoba 1880'), (22, 'Thiago Giménez', null), (23, 'Morena Luna', 'Jujuy 1015'),
  (24, 'Bruno Cabrera', 'Av. Sarmiento 760'), (25, 'Pilar Ibáñez', null)
) as v(n, nombre, direccion);

-- ---------------------------------------------------------------------------
-- 30 días de operación: compras a proveedores (por la mañana) y ventas (a la noche).
-- Cada venta pasa por procesar_pedido(), igual que desde el panel: descuenta stock
-- según receta y evalúa el premio de fidelidad.
-- ---------------------------------------------------------------------------
do $$
declare
  zona        constant text := 'America/Argentina/Buenos_Aires';
  hoy         date := (now() at time zone zona)::date;
  d           integer;
  dia         date;
  n           integer;
  k           integer;
  l           integer;
  v_lineas    integer;
  v_ped       uuid;
  v_cli       uuid;
  v_dir       text;
  v_fecha     timestamptz;
  v_canal     text;
  v_mod       text;
  v_pago      text;
  v_estado    text;
  v_prod      record;
  v_tam       text;
  v_cant      integer;
  v_precio    numeric;
  v_cupon     record;
  v_desc      numeric;
  v_sub       numeric;
  -- compras
  g           record;
  v_comp      uuid;
  v_prov      uuid;
  v_pedida    timestamptz;
  v_recibida  timestamptz;
  ins         record;
  v_consumo   numeric;
  v_desde_cant numeric;
  v_qty       numeric;
  v_items     integer;
  v_r         numeric;
begin
  perform setseed(0.42);

  for d in reverse 29..0 loop
    dia := hoy - d;

    -- ===================== COMPRAS (10 a 11 hs) =====================
    for g in
      select * from (values
        ('carne',    2, 0),
        ('molino',   2, 1),
        ('lacteos',  4, 2),
        ('mayorista',5, 3),
        ('huerta',   3, 1)
      ) as t(grupo, cada, offs)
      where (29 - d) % t.cada = t.offs
    loop
      v_prov := case g.grupo
        when 'carne'     then (select id from proveedores where nombre = case when (29 - d) % 6 = 4 then 'Carnes del Valle' else 'Frigorífico Don Ramón' end)
        when 'molino'    then (select id from proveedores where nombre = 'Panificadora El Molino')
        when 'lacteos'   then (select id from proveedores where nombre = 'Lácteos del Norte')
        when 'mayorista' then (select id from proveedores where nombre = 'Mayorista San Cayetano')
        else                  (select id from proveedores where nombre = 'Verdulería La Huerta')
      end;

      v_pedida := (dia::timestamp + interval '10 hours' + random() * interval '60 minutes') at time zone zona;
      if v_pedida > now() then continue; end if;

      insert into compras (proveedor_id, estado, pedida_en, creado_en)
      values (v_prov, 'pedida', v_pedida, v_pedida)
      returning id into v_comp;

      v_items := 0;
      for ins in
        select i.* from insumos i
        where i.nombre = any (case g.grupo
          when 'carne'     then array['Bollo de carne']
          when 'molino'    then array['Pan de papa', 'Masa de pizza']
          when 'lacteos'   then array['Cheddar en fetas', 'Muzzarella', 'Queso azul', 'Queso parmesano', 'Jamón cocido']
          when 'mayorista' then array['Panceta ahumada', 'Pepperoni', 'Huevo', 'Morrones asados', 'Salsa triple', 'Salsa La Sazón',
                                      'Salsa barbacoa', 'Salsa de tomate', 'Mostaza y ketchup', 'Pepinos encurtidos', 'Aceite de oliva',
                                      'Nueces', 'Aros de cebolla', 'Cebollita crispy', 'Caja hamburguesa', 'Caja pizza']
          else                  array['Cebolla', 'Cebolla morada', 'Lechuga', 'Tomate', 'Tomates cherry', 'Albahaca']
        end)
      loop
        -- Se pide lo necesario para cubrir el consumo de un ciclo de compra, descontando
        -- lo que ya hay y lo que está en camino. (El stock inicial se agrega al final.)
        select coalesce(-sum(m.cantidad), 0) into v_consumo
        from movimientos_stock m
        where m.insumo_id = ins.id and m.tipo in ('venta', 'cancelacion') and m.creado_en > v_pedida - interval '7 days';
        v_consumo := case when 29 - d = 0 then ins.stock_minimo * 0.3
                          else v_consumo / least(7, 29 - d) end;          -- consumo diario

        select coalesce(sum(ci.cantidad_pedida), 0) * ins.equivalencia into v_desde_cant
        from compras c join compra_items ci on ci.compra_id = c.id
        where ci.insumo_id = ins.id and c.estado = 'pedida' and c.id <> v_comp;

        v_qty := (v_consumo * g.cada - (ins.stock_actual + v_desde_cant)) / ins.equivalencia;
        v_qty := case when ins.unidad_compra in ('kg', 'litro') then ceil(v_qty * 2) / 2 else ceil(v_qty) end;
        if v_qty <= 0 then continue; end if;

        insert into compra_items (compra_id, insumo_id, cantidad_pedida, precio_unitario)
        values (v_comp, ins.id, v_qty,
                (select pp.precio from precios_proveedor pp
                  where pp.proveedor_id = v_prov and pp.insumo_id = ins.id and pp.fecha <= dia
                  order by pp.fecha desc limit 1));
        v_items := v_items + 1;
      end loop;

      if v_items = 0 then
        delete from compras where id = v_comp;
        continue;
      end if;

      update compras set total = (select sum(cantidad_pedida * precio_unitario) from compra_items where compra_id = v_comp)
      where id = v_comp;

      -- velocidad y cumplimiento de cada proveedor
      v_recibida := v_pedida + case g.grupo
        when 'carne'     then case when (29 - d) % 6 = 4 then interval '40 hours' + random() * interval '16 hours'
                                   else interval '19 hours' + random() * interval '8 hours' end
        when 'molino'    then interval '8 hours' + random() * interval '6 hours'
        when 'lacteos'   then interval '38 hours' + random() * interval '24 hours'
        when 'mayorista' then case when d <= 1 then interval '44 hours' + random() * interval '6 hours'   -- la última viene atrasada
                                   else interval '20 hours' + random() * interval '10 hours' end
        else                  interval '3 hours' + random() * interval '4 hours'
      end;

      if v_recibida <= now() then
        if g.grupo = 'carne' and (29 - d) % 6 = 4 then
          update compra_items set cantidad_recibida = floor(cantidad_pedida * (0.8 + random() * 0.12)) where compra_id = v_comp;
        elsif g.grupo = 'mayorista' and random() < 0.35 then
          update compra_items set cantidad_recibida = case when random() < 0.25 then 0 else cantidad_pedida end where compra_id = v_comp;
        end if;
        perform recibir_compra(v_comp, v_recibida);
        update compras set pagada = (g.grupo not in ('lacteos') or v_recibida < now() - interval '15 days')
                                     and not (g.grupo = 'carne' and (29 - d) % 6 = 4 and v_recibida > now() - interval '7 days'),
                           medio_pago = case when g.grupo in ('molino', 'huerta') then 'efectivo' else 'transferencia' end
        where id = v_comp;
      end if;
    end loop;

    -- ===================== VENTAS =====================
    n := case
      when d = 0 then 7
      else 14 + floor(random() * 10)::int
           + case extract(dow from dia) when 5 then 9 when 6 then 12 when 0 then 5 else 0 end
    end;

    for k in 1..n loop
      if d = 0 then
        v_fecha := now() - make_interval(mins => 8 + (n - k) * 25 + floor(random() * 15)::int);
      else
        -- en orden cronológico, como se cargan en la realidad
        v_fecha := (dia::timestamp + interval '19 hours 30 minutes' + ((k - 1 + random()) * interval '260 minutes') / n) at time zone zona;
      end if;

      v_cli := null;
      v_dir := null;
      if random() < 0.62 then
        select id, direccion_default into v_cli, v_dir from clientes
        where telefono = '+54938150000' || lpad((1 + floor(power(random(), 1.8) * 25))::int::text, 2, '0');
      end if;

      v_r := random();
      v_canal := case when v_r < 0.45 then 'mostrador' when v_r < 0.75 then 'whatsapp' when v_r < 0.9 then 'telefono' else 'app' end;
      v_r := random();
      v_mod := case
        when v_canal = 'mostrador' then case when v_r < 0.6 then 'take_away' else 'salon' end
        else case when v_r < 0.65 then 'delivery' else 'take_away' end
      end;
      v_r := random();
      v_pago := case when v_r < 0.35 then 'efectivo' when v_r < 0.8 then 'transferencia' when v_r < 0.9 then 'debito' else 'mercado_pago' end;

      v_estado := case
        when d = 0 and k = n then 'en_preparacion'
        when d = 0 and k = n - 1 then 'confirmado'
        when d > 0 and random() < 0.05 then 'cancelado'
        else 'entregado'
      end;

      insert into pedidos (cliente_id, canal, modalidad, estado, direccion_entrega, medio_pago, creado_en)
      values (v_cli, v_canal, v_mod, v_estado,
              case when v_mod = 'delivery' then coalesce(v_dir, 'Barrio Norte, Tucumán') end,
              v_pago, v_fecha)
      returning id into v_ped;

      v_lineas := 1 + (case when random() < 0.45 then 1 else 0 end) + (case when random() < 0.12 then 1 else 0 end);
      for l in 1..v_lineas loop
        select * into v_prod from productos
        where activo and categoria = case when random() < 0.7 then 'hamburguesa' else 'pizzita' end
        order by random() limit 1;

        v_r := random();
        if v_prod.categoria = 'hamburguesa' then
          v_tam := case when v_r < 0.3 then 'simple' when v_r < 0.8 then 'doble' else 'triple' end;
        else
          v_tam := case when v_r < 0.5 then 'simple' else 'doble' end;
        end if;
        v_precio := case v_tam when 'simple' then v_prod.precio_simple when 'doble' then v_prod.precio_doble else v_prod.precio_triple end;
        v_cant := case when random() < 0.8 then 1 else 2 end;

        insert into pedido_items (pedido_id, producto_id, tamano, cantidad, precio_unitario)
        values (v_ped, v_prod.id, v_tam, v_cant, v_precio);
      end loop;

      -- si el cliente tiene un cupón vigente, muchas veces lo usa
      v_desc := 0;
      if v_cli is not null and v_estado <> 'cancelado' then
        select * into v_cupon from cupones
        where cliente_id = v_cli and estado = 'disponible' and (vence_en is null or vence_en > v_fecha)
        order by creado_en limit 1;
        if found and random() < 0.65 then
          if v_cupon.tipo = 'producto' then
            select case v_cupon.tamano when 'simple' then precio_simple when 'doble' then precio_doble else precio_triple end
              into v_precio from productos where id = v_cupon.producto_id;
            insert into pedido_items (pedido_id, producto_id, tamano, cantidad, precio_unitario, es_regalo)
            values (v_ped, v_cupon.producto_id, v_cupon.tamano, 1, v_precio, true);
            v_desc := v_precio;
          end if;
          update cupones set estado = 'usado', usado_en = v_fecha, pedido_uso_id = v_ped where id = v_cupon.id;
          update pedidos set cupon_id = v_cupon.id where id = v_ped;
        end if;
      end if;

      select coalesce(sum(cantidad * precio_unitario), 0) into v_sub from pedido_items where pedido_id = v_ped;
      update pedidos set subtotal = v_sub, descuento = v_desc, total = v_sub - v_desc where id = v_ped;

      perform procesar_pedido(v_ped);
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Stock inicial (hace 31 días) calculado para que hoy cada insumo quede en un
-- nivel creíble. Tres insumos quedan a propósito por debajo del mínimo para que
-- se vean las alertas.
-- ---------------------------------------------------------------------------
insert into movimientos_stock (insumo_id, tipo, cantidad, costo_unitario, nota, creado_en)
select i.id, 'inicial',
       greatest(round(i.stock_minimo * coalesce(o.factor, 1.8) - i.stock_actual), 0),
       i.costo_unitario, 'Stock inicial (conteo)', now() - interval '31 days'
from insumos i
left join (values ('Bollo de carne', 0.55), ('Panceta ahumada', 0.7), ('Cebollita crispy', 0.35), ('Pan de papa', 1.4)) as o(nombre, factor)
  on o.nombre = i.nombre;

-- Un par de mermas cargadas a mano
insert into movimientos_stock (insumo_id, tipo, cantidad, costo_unitario, nota, creado_en)
select i.id, 'merma', -v.cant, i.costo_unitario, v.nota, now() - make_interval(days => v.dias)
from (values
  ('Lechuga', 150, 'Se pasó, no estaba fresca', 4),
  ('Pan de papa', 6, 'Pan del día anterior', 2),
  ('Tomate', 400, 'Golpeados', 6)
) as v(nombre, cant, nota, dias)
join insumos i on i.nombre = v.nombre;
