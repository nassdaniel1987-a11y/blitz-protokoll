# Admin-System Setup

## Ersten Admin-User erstellen

### 1. User in Supabase erstellen

1. Gehe zu **Supabase Dashboard** → **Authentication** → **Users**
2. Klicke auf **"Add user"** → **"Create new user"**
3. Fülle aus:
   - **Email**: `admin@blitz-protokoll.local` (oder beliebiger username@blitz-protokoll.local)
   - **Password**: Ein sicheres Passwort
   - **Auto Confirm User**: ✅ (aktivieren)

### 2. Admin-Flag setzen

1. Klicke auf den neu erstellten User
2. Gehe zum Tab **"User Metadata"** (oder "RAW JSON")
3. Klicke auf **"Edit"** (falls möglich) oder kopiere die JSON
4. Füge das `is_admin` Flag hinzu:

```json
{
  "is_admin": true
}
```

**ODER** nutze den SQL Editor:

```sql
-- Ersetze 'admin' mit dem tatsächlichen Username
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{is_admin}',
  'true'::jsonb
)
WHERE email = 'admin@blitz-protokoll.local';
```

### 3. Login und User-Verwaltung nutzen

1. Logge dich mit dem Admin-User ein
2. Gehe zu **Einstellungen**
3. Du siehst jetzt den Abschnitt **"Benutzerverwaltung"** (nur für Admins)
4. Dort kannst du neue User erstellen

## User-Rollen

### Admin-User (`is_admin: true`)
- Kann neue User erstellen
- Kann User bearbeiten/deaktivieren
- Kann alle Einstellungen ändern
- Hat Zugriff auf User-Verwaltung

### Normaler User (kein `is_admin` Flag)
- Kann Protokolle bearbeiten
- Kann Team-Nachrichten schreiben
- Kann eigene Einstellungen sehen (Personen, Räume, Vorlagen)
- **KEIN** Zugriff auf User-Verwaltung

## Neue User erstellen (als Admin)

1. Gehe zu **Einstellungen** → **Benutzerverwaltung**
2. Klicke auf **"Neuer Benutzer"**
3. Fülle aus:
   - **Username**: z.B. "mueller" (wird zu mueller@blitz-protokoll.local)
   - **Initial-Passwort**: Temporäres Passwort
4. Der neue User **MUSS** beim ersten Login das Passwort ändern
5. Das `must_change_password` Flag wird automatisch gesetzt

## Sicherheit

- **Nur Admins** können User erstellen/bearbeiten
- **Jeder User** muss beim ersten Login das Passwort ändern
- Initial-Passwörter sollten **sicher** sein (min. 8 Zeichen)
- Admin-Flag kann nur in Supabase Dashboard oder per SQL geändert werden
