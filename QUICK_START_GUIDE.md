# 🚀 Blitz-Protokoll Quick Start Guide

Willkommen bei Blitz-Protokoll! Diese Anleitung hilft dir, die Anwendung einzurichten und zu nutzen.

---

## 📋 Inhaltsverzeichnis

1. [Erste Schritte - Supabase Setup](#1-erste-schritte---supabase-setup)
2. [Ersten Admin-User erstellen](#2-ersten-admin-user-erstellen)
3. [Anmeldung](#3-anmeldung)
4. [Dashboard verstehen](#4-dashboard-verstehen)
5. [Protokoll erstellen/bearbeiten](#5-protokoll-erstellenbearbeiten)
6. [Team-Nachrichten nutzen](#6-team-nachrichten-nutzen)
7. [Einstellungen](#7-einstellungen)
8. [Drucken/PDF Export](#8-druckenpdf-export)

---

## 1. Erste Schritte - Supabase Setup

### SQL-Dateien in Supabase ausführen

Öffne dein **Supabase Dashboard** → **SQL Editor** und führe folgende SQL-Dateien **in dieser Reihenfolge** aus:

#### a) **Realtime aktivieren** (Wichtig!)
```sql
-- Datei: supabase_realtime_setup.sql
-- Kopiere den kompletten Inhalt und führe ihn aus
```
✅ Aktiviert Live-Updates für Protokolle und Team-Nachrichten

#### b) **Team-Nachrichten Tabellen**
```sql
-- Datei: supabase_team_nachrichten.sql
-- Kopiere den kompletten Inhalt und führe ihn aus
```
✅ Erstellt Tabellen für Team-Notizen mit Log-Funktion

#### c) **Team-Nachrichten Fixes**
```sql
-- Datei: supabase_team_nachrichten_fix_cascade.sql
-- Kopiere den kompletten Inhalt und führe ihn aus
```
✅ Behebt Log-Löschung beim Nachrichten löschen

#### d) **Auto-Cleanup für Logs**
```sql
-- Datei: supabase_team_nachrichten_auto_cleanup.sql
-- Kopiere den kompletten Inhalt und führe ihn aus
```
✅ Löscht automatisch Logs älter als 3 Tage

#### e) **Admin-Funktionen**
```sql
-- Datei: supabase_admin_functions.sql
-- Kopiere den kompletten Inhalt und führe ihn aus
```
✅ Ermöglicht User-Verwaltung für Admins

---

## 2. Ersten Admin-User erstellen

### Option A: Per SQL (Empfohlen)

1. Gehe zu **Supabase Dashboard** → **Authentication** → **Users**
2. Klicke **"Add user"** → **"Create new user"**
3. Fülle aus:
   - **Email**: `admin@blitz-protokoll.local`
   - **Password**: Dein sicheres Passwort
   - **Auto Confirm User**: ✅ aktivieren
4. Klicke **"Create user"**

5. Führe dieses SQL aus (ersetze die Email wenn nötig):
```sql
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{is_admin}',
  'true'::jsonb
)
WHERE email = 'admin@blitz-protokoll.local';
```

### Option B: Im Dashboard

1. Wie Option A Schritt 1-4
2. User anklicken → **User Metadata** bearbeiten
3. Füge hinzu:
```json
{
  "is_admin": true
}
```

---

## 3. Anmeldung

1. Öffne die Blitz-Protokoll Anwendung
2. Login-Seite:
   - **Username**: `admin` (OHNE @blitz-protokoll.local)
   - **Passwort**: Dein gewähltes Passwort
3. Klicke **"Anmelden"**

✅ Du bist jetzt eingeloggt und siehst das Dashboard!

---

## 4. Dashboard verstehen

### Hauptelemente

```
┌─────────────────────────────────────────────────────┐
│  Blitz-Protokoll    📝 🗂️ ⚙️ 🌙 [Abmelden]         │
└─────────────────────────────────────────────────────┘
│                                                       │
│  [Tagesansicht]  [Wochenansicht]                     │
│                                                       │
│  ← Vorheriger Tag  │  [Heute: 2. Dez 2025]  │  →    │
│                                                       │
├───────────────────────────────────────────────────────┤
│  SCHNELLSTATISTIK (nur wenn Protokoll vorhanden)      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │👥 15     │ │🌅 Max    │ │⚠️ Fehlt  │             │
│  │Anwesend  │ │Morgen    │ │Leitung!  │             │
│  └──────────┘ └──────────┘ └──────────┘             │
├───────────────────────────────────────────────────────┤
│  PROTOKOLL                                            │
│  [Bearbeiten] [Drucken] [Löschen]                    │
│                                                       │
│  Allgemeine Informationen                            │
│  Anwesenheit: Max, Anna, Tom...                      │
│  Leitung im Haus: Sarah                              │
│  ...                                                  │
│                                                       │
│  Belegungsplanung                                    │
│  [Tabelle mit Räumen und Zeitslots]                 │
└───────────────────────────────────────────────────────┘
```

### Schnellstatistik erklärt

- **👥 Personen anwesend** (lila): Zeigt Anzahl anwesender Personen
- **🌅 Frühdienst morgen** (blau): Wer macht morgen Frühdienst
- **⚠️ Wichtige Felder fehlen** (rot): Leitung oder Spätdienst nicht eingetragen
- **ℹ️ Hinweise** (gelb): Optional fehlende Felder (Essen, Frühdienst)

### Buttons oben rechts

- **📝** = Team-Nachrichten (mit Badge-Counter)
- **⚙️** = Einstellungen
- **🌙/☀️** = Dark Mode umschalten
- **Abmelden** = Logout

---

## 5. Protokoll erstellen/bearbeiten

### Neues Protokoll erstellen

1. Wähle im Dashboard ein Datum (z.B. Morgen)
2. Klicke **"✏️ Neues Protokoll erstellen"**
3. Fülle die Felder aus:

#### Allgemeine Informationen

- **Anwesenheit**: Klick auf "Person hinzufügen" → wähle aus Liste
- **Abwesend**: Wird automatisch berechnet
- **Wer geht essen**: Namen eingeben
- **Leitung im Haus**: Name eingeben (⚠️ Pflichtfeld!)
- **Spätdienst**: Name eingeben (⚠️ Pflichtfeld!)
- **Frühdienst (nächster Tag)**: Name eingeben
- **Sonstiges**: Freier Text für Notizen

#### Belegungsplanung

- Klicke auf **"Person zu diesem Zeitslot/Raum hinzufügen"**
- Wähle Person aus Dropdown
- Mehrere Personen möglich (komma-getrennt)

### Vorlage nutzen (bei neuem Protokoll)

1. Wenn du ein neues Protokoll erstellst, siehst du **"Aus Vorlage erstellen"**
2. Wähle eine Vorlage aus dem Dropdown
3. Klicke **"Vorlage anwenden"**
4. Alle Felder werden vorausgefüllt

### Validierung

Während der Eingabe siehst du:
- ✅ **Grün**: Alles OK
- ⚠️ **Orange**: Wichtige Felder fehlen
- ❌ **Rot**: Person doppelt eingeteilt (zur selben Zeit in 2 Räumen)

### Speichern

1. Klicke **"Speichern"**
2. Toast-Nachricht: "Protokoll erfolgreich gespeichert!"
3. Automatische Weiterleitung zum Dashboard

---

## 6. Team-Nachrichten nutzen

### Nachrichten-Modal öffnen

Klicke auf den **📝** Button oben rechts (Badge zeigt Anzahl der Nachrichten)

### Neue Nachricht erstellen

1. Gib Text in das Eingabefeld ein
2. Klicke **"Erstellen"** oder drücke **Strg+Enter**
3. Die Nachricht erscheint sofort bei ALLEN Usern (Realtime!)

### Nachricht bearbeiten

1. Klicke auf **"✏️ Bearbeiten"** bei deiner eigenen Nachricht
2. Ändere den Text
3. Klicke **"💾 Speichern"** oder **"✕ Abbrechen"**

### Nachricht löschen

1. Klicke auf **"🗑️ Löschen"** bei beliebiger Nachricht (JEDER kann löschen!)
2. Bestätige mit "OK"
3. Nachricht wird gelöscht, aber **im Log bleibt sie erhalten**

### Log ansehen

1. Klicke auf **"📜 Log"** bei einer Nachricht
2. Siehe komplette Historie:
   - 📝 Erstellt von X am Y
   - ✏️ Bearbeitet von X am Y
   - 🗑️ Gelöscht von X am Y

---

## 7. Einstellungen

Gehe zu **⚙️ Einstellungen** oben rechts

### Benutzerverwaltung (nur für Admins)

**Neuen User erstellen:**
1. Klicke **"+ Neuer Benutzer"**
2. Gib Username ein (z.B. "mueller")
3. Gib Initial-Passwort ein (mind. 8 Zeichen)
4. Klicke **"Benutzer erstellen"**
5. User **muss** beim ersten Login das Passwort ändern

**User-Status ändern:**
- **🔓 Pflicht entfernen**: Entfernt Passwort-Änderungspflicht
- **👑 Zum Admin machen**: Gibt Admin-Rechte
- **👤 Admin entfernen**: Entfernt Admin-Rechte

### Personenliste

- Füge Kolleg*innen hinzu: Namen eingeben → **"+ Hinzufügen"**
- Personen löschen: **✕** neben Name
- Wird für Anwesenheitsauswahl und Belegungsplanung genutzt

### Raumliste

- Füge Räume hinzu: Label eingeben → **"+ Hinzufügen"**
- Räume löschen: **✕** neben Raum
- ID wird automatisch generiert (z.B. "mensa" für "Mensa")

### Tagesvorlagen

- **Neue Vorlage**: Klicke **"+ Neue Vorlage"**
- **Vorlage bearbeiten**: Klicke **"✏️"** neben Vorlage
- **Vorlage löschen**: Klicke **"🗑️"** neben Vorlage
- Vorlagen können für Wochentage wiederverwendet werden

**Nicht vergessen:** Klicke **"Alle Einstellungen speichern"** am Ende!

---

## 8. Drucken/PDF Export

### Protokoll drucken

1. Öffne ein Protokoll im Dashboard
2. Klicke **"🖨️ Drucken / PDF"**
3. Druckvorschau öffnet sich
4. **Alles ist auf EINER Seite** (A4 Querformat)

### Als PDF speichern

1. Im Druckdialog wähle **"Als PDF speichern"**
2. Wähle Speicherort
3. Fertig!

### Was wird gedruckt?

✅ **Gedruckt:**
- Blitz-Protokoll Überschrift + Datum
- Allgemeine Informationen (kompakt, 4 Spalten)
- Belegungsplanung (komplette Tabelle)

❌ **NICHT gedruckt:**
- Header mit Buttons
- Schnellstatistik
- Navigation
- Bearbeiten/Löschen Buttons

---

## 🎯 Typischer Workflow

### Morgens (Frühdienst)

1. Login als Frühdienst-Person
2. Dashboard öffnen → Heute's Datum
3. Klicke **"✏️ Neues Protokoll erstellen"**
4. Optional: Vorlage für Wochentag auswählen
5. Anwesenheit eintragen (Personen auswählen)
6. Leitung im Haus eintragen
7. Spätdienst eintragen
8. Frühdienst für morgen eintragen
9. Speichern

### Tagsüber (Belegungsplanung)

1. Protokoll öffnen → **"✏️ Bearbeiten"**
2. Belegungsplan ausfüllen (Räume + Zeitslots)
3. Bei Doppelbelegung siehst du Warnung
4. Speichern

### Abends (Spätdienst)

1. Protokoll öffnen
2. "Sonstiges" ergänzen (besondere Ereignisse)
3. Speichern
4. Optional: **"🖨️ Drucken / PDF"** für Archiv

### Team-Kommunikation

1. **📝** öffnen
2. Nachricht schreiben: "Komme morgen erst um 12 Uhr"
3. Alle anderen sehen es sofort (Realtime!)

---

## ❓ Häufige Fragen

### Kann ich ein Protokoll nachträglich ändern?

Ja! Öffne das Protokoll → **"✏️ Bearbeiten"** → Änderungen machen → Speichern

### Was passiert wenn mehrere gleichzeitig bearbeiten?

Du siehst eine **gelbe Warnung** mit Namen der anderen Person. Bei Speichern wird eine Warnung angezeigt. **Realtime** verhindert Datenverlust!

### Wie lange bleiben Team-Nachrichten?

Team-Nachrichten bleiben unbegrenzt. **Logs werden nach 3 Tagen automatisch gelöscht.**

### Kann ich alte Protokolle löschen?

Ja, öffne das Protokoll → **"🗑️ Protokoll löschen"** → Bestätigen

### Funktioniert es auf dem iPad?

Ja! Die Anwendung ist responsive und funktioniert auf Tablets und Handys.

---

## 🆘 Probleme?

### "Fehler beim Laden"

→ Prüfe ob alle SQL-Dateien in Supabase ausgeführt wurden

### "Realtime funktioniert nicht"

→ Prüfe in Supabase: **Database** → **Replication** → `team_nachrichten`, `protokolle`, `active_editors` aktiviert?

### "Kann keine User erstellen"

→ Prüfe ob Edge Function `bright-api` deployed ist (oder erstelle User manuell im Supabase Dashboard)

### "Passwort vergessen"

→ Wende dich an einen Admin, der kann das Passwort zurücksetzen

---

## 🎉 Fertig!

Du bist jetzt bereit, Blitz-Protokoll zu nutzen!

**Viel Erfolg!** 🚀

---

**Hinweis:** Detaillierte technische Informationen findest du in `ADMIN_SETUP.md`
