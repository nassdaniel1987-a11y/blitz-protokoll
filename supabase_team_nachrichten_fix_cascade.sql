-- MIGRATION: Fix CASCADE delete issue in team_nachrichten_log
-- Dieses SQL in Supabase SQL Editor ausführen, um das Log-Problem zu beheben

-- Schritt 1: Alte Log-Tabelle löschen (CASCADE entfernt auch den Index und Policies)
DROP TABLE IF EXISTS public.team_nachrichten_log CASCADE;

-- Schritt 2: Log-Tabelle neu erstellen mit ON DELETE SET NULL statt CASCADE
CREATE TABLE public.team_nachrichten_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nachricht_id UUID REFERENCES public.team_nachrichten(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- 'created', 'edited', 'deleted'
    performed_by TEXT NOT NULL,
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    old_message TEXT,
    new_message TEXT
);

-- Schritt 3: Index neu erstellen
CREATE INDEX idx_team_nachrichten_log_nachricht_id ON public.team_nachrichten_log(nachricht_id);

-- Schritt 4: RLS aktivieren
ALTER TABLE public.team_nachrichten_log ENABLE ROW LEVEL SECURITY;

-- Schritt 5: Policies neu erstellen
CREATE POLICY "Jeder kann Log lesen" ON public.team_nachrichten_log
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Jeder kann Log erstellen" ON public.team_nachrichten_log
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Fertig! Jetzt werden Log-Einträge beim Löschen von Nachrichten NICHT mehr gelöscht.
-- Die nachricht_id wird auf NULL gesetzt, aber der Log-Eintrag bleibt erhalten.
