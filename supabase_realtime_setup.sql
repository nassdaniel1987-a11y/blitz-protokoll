-- REALTIME SETUP: Gleichzeitiges Bearbeiten mit Live-Updates
-- Dieses SQL in Supabase SQL Editor ausführen

-- 1. Tabelle für aktive Editoren erstellen
CREATE TABLE IF NOT EXISTS public.active_editors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protokoll_date DATE NOT NULL,
    username TEXT NOT NULL,
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(protokoll_date, username)
);

-- 2. Index für Performance
CREATE INDEX IF NOT EXISTS idx_active_editors_protokoll_date ON public.active_editors(protokoll_date);
CREATE INDEX IF NOT EXISTS idx_active_editors_last_heartbeat ON public.active_editors(last_heartbeat);

-- 3. RLS aktivieren
ALTER TABLE public.active_editors ENABLE ROW LEVEL SECURITY;

-- 4. Policies für active_editors
CREATE POLICY "Jeder kann aktive Editoren sehen" ON public.active_editors
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Jeder kann sich als Editor eintragen" ON public.active_editors
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Jeder kann seinen Heartbeat updaten" ON public.active_editors
    FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Jeder kann sich als Editor austragen" ON public.active_editors
    FOR DELETE
    TO authenticated
    USING (true);

-- 5. Funktion zum Aufräumen inaktiver Editoren (älter als 30 Sekunden)
CREATE OR REPLACE FUNCTION cleanup_inactive_editors()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.active_editors
    WHERE last_heartbeat < NOW() - INTERVAL '30 seconds';
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_inactive_editors() TO authenticated;

-- 6. Realtime für protokolle Tabelle aktivieren
ALTER PUBLICATION supabase_realtime ADD TABLE public.protokolle;

-- 7. Realtime für active_editors Tabelle aktivieren
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_editors;

-- 8. Realtime für team_nachrichten Tabelle aktivieren
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_nachrichten;

-- Fertig! Realtime ist jetzt aktiviert.
