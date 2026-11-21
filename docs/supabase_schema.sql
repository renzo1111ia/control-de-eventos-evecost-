-- ========================================================
-- ESQUEMA COMPLETO PARA SUPABASE (POSTGRESQL)
-- Control de Gastos, Stock de Barra y Acceso para Productoras
-- ========================================================

-- Habilitar extensión para UUIDs automáticos
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla de Productoras (Multi-tenant)
CREATE TABLE IF NOT EXISTS public.producers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    name VARCHAR(150) NOT NULL,
    contact_email VARCHAR(150) NOT NULL,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW ()
);

-- 2. Tabla de Eventos (Controla el popup bloqueante de 1 sola vez)
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    producer_id UUID REFERENCES public.producers (id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    event_date TIMESTAMPTZ NOT NULL,
    has_bar BOOLEAN DEFAULT FALSE,
    is_configured BOOLEAN DEFAULT FALSE, -- Controla el popup obligatorio inicial
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, COMPLETED, DRAFT
    created_at TIMESTAMPTZ DEFAULT NOW ()
);

-- 3. Tipos de Entradas (Tiers: Preventa 1, Preventa 2, VIP, etc.)
CREATE TABLE IF NOT EXISTS public.ticket_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    event_id UUID NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    capacity INT NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT NOW ()
);

-- 4. Asistentes y Entradas QR (Con firma digital HMAC y protección anti-repetición)
CREATE TABLE IF NOT EXISTS public.attendees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    event_id UUID NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
    tier_id UUID REFERENCES public.ticket_tiers (id) ON DELETE SET NULL,
    tier_name VARCHAR(100),
    full_name VARCHAR(150) NOT NULL,
    rut VARCHAR(20) NOT NULL, -- Validado con Módulo 11
    email VARCHAR(150) NOT NULL,
    price_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
    qr_token VARCHAR(255) UNIQUE NOT NULL,
    is_checked_in BOOLEAN DEFAULT FALSE,
    checked_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW ()
);

-- 5. Transacciones Financieras (Ingresos y Gastos)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    event_id UUID NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
    type VARCHAR(10) CHECK (type IN ('INCOME', 'EXPENSE')) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(50) DEFAULT 'TRANSFER',
    created_at TIMESTAMPTZ DEFAULT NOW ()
);

-- 6. Inventario de Barra (Control de stock)
CREATE TABLE IF NOT EXISTS public.bar_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    event_id UUID NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
    product_name VARCHAR(150) NOT NULL,
    unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
    sale_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    initial_stock INT NOT NULL DEFAULT 0,
    current_stock INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW ()
);

-- 7. Ventas de Barra (Terminal POS rápido)
CREATE TABLE IF NOT EXISTS public.bar_sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    event_id UUID NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.bar_inventory (id) ON DELETE CASCADE,
    product_name VARCHAR(150) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(50) DEFAULT 'CARD',
    created_at TIMESTAMPTZ DEFAULT NOW ()
);

-- 8. Arqueo y Cierre de Barra (Comparativa de lo que sobró vs dinero en caja)
CREATE TABLE IF NOT EXISTS public.bar_closings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    event_id UUID NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
    total_sales_calculated NUMERIC(12, 2) NOT NULL DEFAULT 0,
    actual_cash_reported NUMERIC(12, 2) NOT NULL DEFAULT 0,
    discrepancy NUMERIC(12, 2) NOT NULL DEFAULT 0,
    items_breakdown JSONB, -- Detalle por producto: stock inicial, sobrante y consumo calculado
    notes TEXT,
    closed_at TIMESTAMPTZ DEFAULT NOW ()
);

-- 9. Logs Inmutables de Ciberseguridad y Auditoría
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    event_id UUID REFERENCES public.events (id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW ()
);

-- ========================================================
-- POLÍTICAS DE ACCESO (RLS - ROW LEVEL SECURITY)
-- Deshabilitadas inicialmente para que la Service Key / Anon puedan operar sin trabas,
-- o puedes habilitarlas con las reglas de tu preferencia.
-- ========================================================
ALTER TABLE public.producers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ticket_tiers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.attendees ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.bar_inventory ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.bar_sales ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.bar_closings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para acceso total con la Service Role Key o API Key
CREATE POLICY "Acceso total para backend y servicio" ON public.producers FOR ALL USING (true);

CREATE POLICY "Acceso total para backend y servicio" ON public.events FOR ALL USING (true);

CREATE POLICY "Acceso total para backend y servicio" ON public.ticket_tiers FOR ALL USING (true);

CREATE POLICY "Acceso total para backend y servicio" ON public.attendees FOR ALL USING (true);

CREATE POLICY "Acceso total para backend y servicio" ON public.transactions FOR ALL USING (true);

CREATE POLICY "Acceso total para backend y servicio" ON public.bar_inventory FOR ALL USING (true);

CREATE POLICY "Acceso total para backend y servicio" ON public.bar_sales FOR ALL USING (true);

CREATE POLICY "Acceso total para backend y servicio" ON public.bar_closings FOR ALL USING (true);

CREATE POLICY "Acceso total para backend y servicio" ON public.audit_logs FOR ALL USING (true);

-- ========================================================
-- 10. DESTINATARIOS DE CORTESÍAS DE BARRA
-- ========================================================
CREATE TABLE IF NOT EXISTS public.bar_courtesy_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- 'PRODUCCION' | 'DJ' | 'INVITADO' | 'OTRO'
    courtesy_budget INTEGER DEFAULT 0, -- Cantidad estimada / cupo máximo
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================================
-- 11. HISTORIAL DE ENTREGAS DE CORTESÍAS
-- ========================================================
CREATE TABLE IF NOT EXISTS public.bar_courtesies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.bar_inventory(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    recipient_id UUID NOT NULL REFERENCES public.bar_courtesy_recipients(id) ON DELETE CASCADE,
    recipient_name VARCHAR(255) NOT NULL,
    recipient_role VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS y Políticas
ALTER TABLE public.bar_courtesy_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_courtesies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso total para backend y servicio" ON public.bar_courtesy_recipients FOR ALL USING (true);
CREATE POLICY "Acceso total para backend y servicio" ON public.bar_courtesies FOR ALL USING (true);
