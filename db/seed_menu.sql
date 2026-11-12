-- Menú actual de La Sazón (copiado del panel en producción el 12/11/2026).
-- Pizzitas: precio_simple = 4 porciones, precio_doble = 8 porciones.

insert into productos (categoria, nombre, descripcion, precio_simple, precio_doble, precio_triple) values
  ('hamburguesa', 'Americana',           'Cheddar, panceta ahumada, huevo a la chapa, salsita triple', 12000, 14500, 16000),
  ('hamburguesa', 'Bacon Cheese',        'Extra cheddar, extra panceta ahumada, salsita triple', 12000, 14500, 16000),
  ('hamburguesa', 'BBQ Onion',           'Cheddar, panceta ahumada, barbacoa, aros de cebolla Mc Cain x3', 12000, 14500, 16000),
  ('hamburguesa', 'Caramelizada',        'Cheddar, panceta ahumada, cebolla caramelizada a la chapa, salsita triple', 12000, 14500, 16000),
  ('hamburguesa', 'Clásica',             'Cheddar, huevo a punto, lechuga, tomate, cebolla morada, salsa triple', 12000, 14500, 16000),
  ('hamburguesa', 'Crispy Melt',         'Cheddar, panceta ahumada, aros de cebollita crispy, salsa La Sazón', 12000, 14500, 16000),
  ('hamburguesa', 'Full Cheese',         'Extra cheddar, salsita triple', 12000, 13000, 14000),
  ('hamburguesa', 'La Culposa',          'Salsa de panceta ahumada con trocitos de la misma, crispy crocante, panceta ahumada, doble cheddar, carne', 12000, 14500, 16000),
  ('hamburguesa', 'La Sazón',            'Cheddar, panceta ahumada, salsa La Sazón', 12000, 14500, 16000),
  ('hamburguesa', 'Oklahomaxxx',         'Cheddar, panceta, salsa de la casa, cebollita en pluma smasheada junto con la carne', 12000, 14500, 16000),
  ('hamburguesa', 'Onion Pickles Lover', 'Cebolla en brunoise, pepinos encurtidos, cheddar, panceta ahumada, mostaza y ketchup', 12000, 14500, 16000),
  ('pizzita', '3 Quesos',               'Muzza, queso parmesano, queso azul, oliva', 13000, 16000, null),
  ('pizzita', 'Cherrys y Albahaca',     'Salsa de tomate, muzza, cherrys, albahaca, oliva', 14000, 16000, null),
  ('pizzita', 'Fugazza',                'Salsa de tomate, muzza, cebollita en pluma', 13000, 15000, null),
  ('pizzita', 'Jamón y Morrones',       'Salsa de tomate, muzza, jamón, morrones asados, ajillo, oliva', 14000, 16000, null),
  ('pizzita', 'Margarita',              'Salsa de tomate, muzza, albahaca, oliva', 13000, 15000, null),
  ('pizzita', 'Muzza Simple',           'Salsa de tomate, muzza, aceite oliva', 11000, 13000, null),
  ('pizzita', 'Napolitana',             'Salsa de tomate, muzza, tomates, ajillo', 13000, 15000, null),
  ('pizzita', 'Pepperoni',              'Salsa de tomate, muzza, pepperonis', 13000, 15000, null),
  ('pizzita', 'Queso Azul',             'Salsa de tomate, muzza, queso azul, oliva', 13000, 15000, null),
  ('pizzita', 'Queso Azul y Cebollita', 'Salsa de tomate, muzza, queso azul, cebollita en pluma', 14000, 16000, null),
  ('pizzita', 'Queso Azul y Nueces',    'Salsa de tomate, muzza, queso azul, nueces, oliva', 14000, 16000, null),
  ('pizzita', 'Queso Azul y Panceta',   'Salsa de tomate, lardones de panceta, queso azul', 14000, 16000, null);

-- Premio de fidelización por defecto: una hamburguesa La Sazón simple
update fidelidad_config
   set premio_producto_id = (select id from productos where categoria = 'hamburguesa' and nombre = 'La Sazón')
 where id = 1;
