-- SQL-Befehle für Team-Nachrichten Feature
-- Diese SQL-Befehle in Supabase SQL Editor ausführen

-- Tabelle für Team-Nachrichten
CREATE TABLE IF NOT EXISTS public.team_nachrichten (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    edited_by TEXT
);

-- Tabelle für Nachrichten-Log (Historie)
CREATE TABLE IF NOT EXISTS public.team_nachrichten_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nachricht_id UUID REFERENCES public.team_nachrichten(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- 'created', 'edited', 'deleted'
    performed_by TEXT NOT NULL,
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    old_message TEXT,
    new_message TEXT
);

-- Index für bessere Performance
CREATE INDEX IF NOT EXISTS idx_team_nachrichten_created_at ON public.team_nachrichten(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_nachrichten_log_nachricht_id ON public.team_nachrichten_log(nachricht_id);

-- RLS (Row Level Security) Policies - Jeder authentifizierte User kann alles
ALTER TABLE public.team_nachrichten ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_nachrichten_log ENABLE ROW LEVEL SECURITY;

-- Policy: Jeder kann Nachrichten lesen
CREATE POLICY "Jeder kann Nachrichten lesen" ON public.team_nachrichten
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Jeder kann Nachrichten erstellen
CREATE POLICY "Jeder kann Nachrichten erstellen" ON public.team_nachrichten
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy: Jeder kann Nachrichten aktualisieren
CREATE POLICY "Jeder kann Nachrichten aktualisieren" ON public.team_nachrichten
    FOR UPDATE
    TO authenticated
    USING (true);

-- Policy: Jeder kann Nachrichten löschen
CREATE POLICY "Jeder kann Nachrichten löschen" ON public.team_nachrichten
    FOR DELETE
    TO authenticated
    USING (true);

-- Policy: Jeder kann Log lesen
CREATE POLICY "Jeder kann Log lesen" ON public.team_nachrichten_log
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Jeder kann Log erstellen
CREATE POLICY "Jeder kann Log erstellen" ON public.team_nachrichten_log
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Kommentar: Fertig! Tabellen und Policies sind angelegt.
