-- ADMIN FUNCTIONS: User-Verwaltung für Admin-User
-- Dieses SQL in Supabase SQL Editor ausführen

-- 1. Funktion: Prüfen ob aktueller User Admin ist
CREATE OR REPLACE FUNCTION is_user_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean,
        false
    );
END;
$$;

GRANT EXECUTE ON FUNCTION is_user_admin() TO authenticated;

-- 2. Funktion: Alle User auflisten (nur für Admins)
CREATE OR REPLACE FUNCTION get_all_users()
RETURNS TABLE (
    id uuid,
    email text,
    created_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    is_admin boolean,
    must_change_password boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Prüfen ob aktueller User Admin ist
    IF NOT is_user_admin() THEN
        RAISE EXCEPTION 'Nur Admins können User auflisten';
    END IF;

    RETURN QUERY
    SELECT
        u.id,
        u.email::text,
        u.created_at,
        u.last_sign_in_at,
        COALESCE((u.raw_user_meta_data ->> 'is_admin')::boolean, false) as is_admin,
        COALESCE((u.raw_user_meta_data ->> 'must_change_password')::boolean, false) as must_change_password
    FROM auth.users u
    ORDER BY u.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_all_users() TO authenticated;

-- HINWEIS: User erstellen und löschen muss über Supabase Service Role Key erfolgen
-- Das kann nicht über RPC gemacht werden aus Sicherheitsgründen
-- Dafür brauchen wir entweder:
-- 1. Supabase Edge Functions (empfohlen)
-- 2. Oder manuelles Erstellen im Dashboard

-- Aber wir können User-Metadata ändern:

-- 3. Funktion: User-Metadata ändern (nur für Admins)
CREATE OR REPLACE FUNCTION update_user_metadata(
    user_id uuid,
    new_metadata jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Prüfen ob aktueller User Admin ist
    IF NOT is_user_admin() THEN
        RAISE EXCEPTION 'Nur Admins können User-Metadata ändern';
    END IF;

    -- User-Metadata aktualisieren
    UPDATE auth.users
    SET raw_user_meta_data = new_metadata
    WHERE id = user_id;

    RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION update_user_metadata(uuid, jsonb) TO authenticated;

-- Fertig! Admin-Funktionen sind angelegt.
-- WICHTIG: Für User-Erstellung siehe ADMIN_SETUP.md
