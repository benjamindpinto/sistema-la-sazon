-- ============================================================================
-- Usuario de base de datos propio del panel (sólo para Supabase).
-- El panel se conecta con este rol por el pooler, no con "postgres".
-- La contraseña se define aparte (no queda guardada en las migraciones):
--   alter role app_lasazon with password '...';
-- Conexión: postgresql://app_lasazon.<ref>:<password>@<pooler>:6543/postgres
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_lasazon') then
    create role app_lasazon login noinherit;
  end if;
end $$;

grant usage on schema public to app_lasazon;
grant select, insert, update, delete on all tables in schema public to app_lasazon;
grant usage, select on all sequences in schema public to app_lasazon;
grant execute on all functions in schema public to app_lasazon;
alter default privileges in schema public grant select, insert, update, delete on tables to app_lasazon;
alter default privileges in schema public grant usage, select on sequences to app_lasazon;

-- RLS: el panel ve y modifica todo; la API pública (anon/authenticated) no ve nada.
do $$
declare t text;
begin
  foreach t in array array['usuarios','clientes','productos','insumos','receta_items','proveedores','compras',
                           'compra_items','precios_proveedor','pedidos','pedido_items','movimientos_stock',
                           'fidelidad_config','cupones'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'panel_acceso_total') then
      execute format('create policy panel_acceso_total on %I for all to app_lasazon using (true) with check (true)', t);
    end if;
  end loop;
end $$;
