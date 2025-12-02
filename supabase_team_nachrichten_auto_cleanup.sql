-- AUTO-CLEANUP: Alte Log-Einträge automatisch löschen
-- Dieses SQL in Supabase SQL Editor ausführen

-- 1. Funktion erstellen, die Log-Einträge älter als 3 Tage löscht
CREATE OR REPLACE FUNCTION cleanup_old_team_nachrichten_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.team_nachrichten_log
    WHERE performed_at < NOW() - INTERVAL '3 days';
END;
$$;

-- 2. Policy erstellen, damit authenticated User die Funktion aufrufen können
GRANT EXECUTE ON FUNCTION cleanup_old_team_nachrichten_logs() TO authenticated;

-- 3. Optional: Einmalig ausführen, um alte Einträge zu löschen
-- Kommentiere die nächste Zeile aus, wenn du es direkt ausführen willst:
-- SELECT cleanup_old_team_nachrichten_logs();
