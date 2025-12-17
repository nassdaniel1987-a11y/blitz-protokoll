-- Migration: Protocol Changelog (Änderungshistorie)
-- Erstellt: 2025-12-17
-- Zweck: Trackt wer wann was in Protokollen geändert hat

-- Tabelle für Protokoll-Änderungen
CREATE TABLE IF NOT EXISTS protocol_changelog (
    id BIGSERIAL PRIMARY KEY,
    protokoll_date DATE NOT NULL,
    username TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    change_type TEXT NOT NULL, -- 'create', 'update', 'delete'
    field_name TEXT, -- z.B. "Raum 1, 12:25-13:10" oder "Spätdienst"
    old_value TEXT,
    new_value TEXT,
    description TEXT -- z.B. "Protokoll erstellt"
);

-- Index für schnelle Abfragen nach Datum
CREATE INDEX IF NOT EXISTS idx_protocol_changelog_date
    ON protocol_changelog(protokoll_date);

-- Index für Zeitstempel (für chronologische Sortierung)
CREATE INDEX IF NOT EXISTS idx_protocol_changelog_timestamp
    ON protocol_changelog(timestamp DESC);

-- Index für Username (falls wir nach User filtern wollen)
CREATE INDEX IF NOT EXISTS idx_protocol_changelog_username
    ON protocol_changelog(username);

-- RLS (Row Level Security) aktivieren
ALTER TABLE protocol_changelog ENABLE ROW LEVEL SECURITY;

-- Policy: Jeder authentifizierte User kann alle Changelog-Einträge lesen
CREATE POLICY "Jeder kann Changelog lesen"
    ON protocol_changelog
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Jeder authentifizierte User kann Changelog-Einträge erstellen
CREATE POLICY "Jeder kann Changelog erstellen"
    ON protocol_changelog
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Kommentar zur Tabelle
COMMENT ON TABLE protocol_changelog IS
    'Änderungshistorie für Protokolle. Trackt wer wann was geändert hat für Nachvollziehbarkeit und DSGVO-Konformität.';
