-- Migration: Active Field Editors Tabelle für Live-Editing
-- Erstellt: 2025-12-13
-- Zweck: Trackt welcher User welches Feld (Slot+Raum) gerade bearbeitet

-- Tabelle für aktive Feld-Editoren
CREATE TABLE IF NOT EXISTS active_field_editors (
    id BIGSERIAL PRIMARY KEY,
    protokoll_date DATE NOT NULL,
    field_key TEXT NOT NULL,
    username TEXT NOT NULL,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ein Feld kann nur von einem User gleichzeitig bearbeitet werden
    UNIQUE(protokoll_date, field_key)
);

-- Index für schnelle Abfragen nach Datum
CREATE INDEX IF NOT EXISTS idx_active_field_editors_date
    ON active_field_editors(protokoll_date);

-- Index für schnelle Cleanup-Abfragen
CREATE INDEX IF NOT EXISTS idx_active_field_editors_last_updated
    ON active_field_editors(last_updated);

-- RLS (Row Level Security) aktivieren
ALTER TABLE active_field_editors ENABLE ROW LEVEL SECURITY;

-- Policy: Jeder authentifizierte User kann alle Einträge lesen
CREATE POLICY "Jeder kann Field-Editors sehen"
    ON active_field_editors
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Jeder authentifizierte User kann Field-Editor registrieren
CREATE POLICY "Jeder kann sich als Field-Editor registrieren"
    ON active_field_editors
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy: Jeder kann Field-Editor-Einträge aktualisieren (für UPSERT)
CREATE POLICY "Jeder kann Field-Editor aktualisieren"
    ON active_field_editors
    FOR UPDATE
    TO authenticated
    USING (true);

-- Policy: User können eigene oder alte Einträge löschen
CREATE POLICY "Jeder kann Field-Editor-Einträge löschen"
    ON active_field_editors
    FOR DELETE
    TO authenticated
    USING (true);

-- Kommentar zur Tabelle
COMMENT ON TABLE active_field_editors IS
    'Trackt welcher User welches Feld in einem Protokoll gerade bearbeitet. Für Live-Editing und Feld-Level-Locking.';
