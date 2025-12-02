# 📖 Blitz-Protokoll Benutzerhandbuch

Eine einfache Anleitung für die tägliche Nutzung von Blitz-Protokoll.

---

## 🔐 Anmeldung

1. Öffne die Blitz-Protokoll Webseite
2. Gib deinen **Benutzernamen** ein (z.B. `mueller`)
   - ⚠️ NICHT die Email-Adresse, nur den Namen!
3. Gib dein **Passwort** ein
4. Klicke **"Anmelden"**

### Erstes Login

Beim **ersten Mal** musst du dein Passwort ändern:
- Gib dein **altes Passwort** ein
- Gib dein **neues Passwort** ein (mindestens 8 Zeichen)
- Gib das **neue Passwort nochmal** ein (zur Bestätigung)
- Klicke **"Passwort ändern"**

✅ Du bist jetzt eingeloggt!

---

## 📊 Dashboard (Startseite)

Nach dem Login siehst du das **Dashboard** – deine Übersicht über alle Protokolle.

### Datum wechseln

```
← Vorheriger Tag  │  Dienstag, 3. Dezember 2024  │  Nächster Tag →
                         [Zu heute springen]
```

- Klicke **←** für den Tag **davor**
- Klicke **→** für den Tag **danach**
- Klicke **"Zu heute springen"** um zu heute zurückzukehren

### Schnellübersicht (wenn Protokoll vorhanden)

Oben siehst du **farbige Karten** mit wichtigen Infos:

- **👥 15 Personen anwesend** (lila) → Wie viele Leute heute da sind
- **🌅 Max** (blau) → Wer macht morgen Frühdienst
- **⚠️ Leitung im Haus fehlt!** (rot) → Wichtige Felder wurden nicht ausgefüllt
- **ℹ️ Hinweise** (gelb) → Optionale Felder fehlen

### Was kann ich tun?

**Wenn noch KEIN Protokoll für den Tag existiert:**
- Klicke **"✏️ Neues Protokoll erstellen"**

**Wenn schon ein Protokoll existiert:**
- Klicke **"✏️ Protokoll bearbeiten"** → Änderungen vornehmen
- Klicke **"🖨️ Drucken / PDF"** → Protokoll ausdrucken oder als PDF speichern
- Klicke **"🗑️ Protokoll löschen"** → Protokoll komplett löschen (Vorsicht!)

---

## ✏️ Protokoll erstellen/bearbeiten

### Allgemeine Informationen

#### 1. Anwesenheit eintragen

- Klicke auf **"Person hinzufügen"**
- Es öffnet sich ein Fenster mit allen Kolleg*innen
- **Klicke auf Namen** um sie auszuwählen (werden blau)
- Klicke **"Auswahl übernehmen"**

💡 **Abwesend** wird automatisch berechnet (alle die NICHT anwesend sind)

#### 2. Weitere Pflichtfelder

- **Leitung im Haus**: Name eingeben (z.B. "Sarah")
- **Spätdienst**: Name eingeben (z.B. "Tom")

⚠️ Diese Felder **MÜSSEN** ausgefüllt werden (werden rot markiert wenn leer)

#### 3. Optionale Felder

- **Wer geht essen**: Namen eingeben (z.B. "Max, Anna, Tom")
- **Frühdienst (nächster Tag)**: Name eingeben (z.B. "Lisa")
- **Sonstiges**: Freier Text für besondere Ereignisse

### Belegungsplanung (Tabelle)

Die **große Tabelle** zeigt, welche Personen zu welcher Zeit in welchen Räumen sind.

```
┌────────┬─────────────┬─────────────┬─────────────┐
│ Raum   │ 12:25-13:10 │ 13:15-14:00 │ 14:00-14:30 │
├────────┼─────────────┼─────────────┼─────────────┤
│ Mensa  │ [+ Person]  │ Max, Anna   │             │
│ Hof    │ Tom         │ [+ Person]  │ Lisa        │
│ ...    │             │             │             │
└────────┴─────────────┴─────────────┴─────────────┘
```

#### Person hinzufügen

1. Klicke auf **"+ Person zu diesem Zeitslot/Raum hinzufügen"**
2. Wähle Person aus dem Dropdown
3. Die Person erscheint in der Tabelle

#### Mehrere Personen

- Du kannst auch **direkt in die Felder schreiben**
- Trenne mehrere Namen mit **Komma**: `Max, Anna, Tom`

#### Warnung bei Doppelbelegung

Wenn eine Person zur **gleichen Zeit in 2 Räumen** ist:
- Siehst du eine **rote Warnung** ⚠️
- Beispiel: "Max ist gleichzeitig in Mensa UND Hof"
- Bitte korrigieren!

### Speichern

Klicke unten auf **"Speichern"** – fertig! ✅

Du kommst automatisch zurück zum Dashboard.

---

## 📝 Team-Nachrichten (Notizen)

### Nachrichten-Fenster öffnen

Klicke oben rechts auf das **📝 Symbol**

(Wenn eine **Zahl** daneben steht, gibt es so viele Nachrichten)

### Neue Nachricht schreiben

1. Gib deinen Text in das **große Textfeld** ein
2. Klicke **"Erstellen"** (oder drücke **Strg+Enter**)
3. Deine Nachricht erscheint **sofort** – auch bei allen anderen! 🎉

**Beispiel:**
```
"Komme morgen erst um 12 Uhr wegen Arzttermin"
```

### Nachrichten sehen

Alle Nachrichten werden angezeigt mit:
- **Wer** hat sie geschrieben
- **Wann** wurde sie geschrieben (z.B. "vor 2 Stunden")
- **Bearbeitet?** Falls jemand sie geändert hat

### Nachricht bearbeiten

**NUR DEINE EIGENEN** Nachrichten kannst du bearbeiten:

1. Klicke **"✏️ Bearbeiten"** bei deiner Nachricht
2. Ändere den Text
3. Klicke **"💾 Speichern"** oder **"✕ Abbrechen"**

### Nachricht löschen

**JEDER** kann **jede** Nachricht löschen:

1. Klicke **"🗑️ Löschen"** bei beliebiger Nachricht
2. Bestätige mit **"OK"**
3. Nachricht verschwindet

💡 Die Nachricht bleibt im **Log** gespeichert (siehe unten)

### Log ansehen (Historie)

Um zu sehen **was mit einer Nachricht passiert** ist:

1. Klicke **"📜 Log"** bei der Nachricht
2. Du siehst die komplette Geschichte:
   - 📝 **Erstellt** von Max am 3.12.2024 um 10:30
   - ✏️ **Bearbeitet** von Max am 3.12.2024 um 11:15
   - 🗑️ **Gelöscht** von Anna am 3.12.2024 um 14:00

**Hinweis:** Logs werden nach **3 Tagen automatisch gelöscht**

---

## 🖨️ Drucken / PDF Export

### So geht's

1. Öffne ein **Protokoll** im Dashboard
2. Klicke **"🖨️ Drucken / PDF"**
3. Die **Druckvorschau** öffnet sich

### Als PDF speichern

1. Im Druckdialog wähle **"Als PDF speichern"** (statt Drucker)
2. Wähle einen **Speicherort** (z.B. Desktop)
3. Gib einen **Dateinamen** ein (z.B. "Protokoll-03-12-2024")
4. Klicke **"Speichern"**

✅ **Alles ist auf EINER Seite** – perfekt zum Ausdrucken oder Archivieren!

### Was wird gedruckt?

**Ja:**
- ✅ Datum und Überschrift
- ✅ Allgemeine Informationen (Anwesenheit, Leitung, etc.)
- ✅ Belegungsplanung (komplette Tabelle)

**Nein:**
- ❌ Buttons (Bearbeiten, Löschen, etc.)
- ❌ Farbige Statistik-Karten
- ❌ Navigation

---

## 🎨 Dark Mode (Dunkles Design)

Klicke oben rechts auf **🌙** (Mond-Symbol)

- **🌙** = Wechsle zu **hellem** Design
- **☀️** = Wechsle zu **dunklem** Design

Deine Einstellung wird **gespeichert** für nächstes Mal.

---

## 🔄 Gleichzeitiges Bearbeiten

**Was passiert wenn zwei Personen gleichzeitig bearbeiten?**

### Warnung beim Öffnen

Wenn jemand anderes **gerade bearbeitet**, siehst du eine **gelbe Warnung**:

```
⚠️ Max bearbeitet dieses Protokoll gerade auch.
   Änderungen können überschrieben werden!
```

Du kannst **trotzdem** bearbeiten, aber sei vorsichtig!

### Warnung beim Speichern

Wenn die andere Person **speichert während du arbeitest**:
- Siehst du eine **Popup-Meldung**: "Das Protokoll wurde von einem anderen Nutzer geändert!"
- Du wirst gefragt: **"Seite neu laden?"**
- **Ja** → Deine Änderungen gehen verloren, du siehst die neue Version
- **Nein** → Du arbeitest weiter, überschreibst aber vielleicht die Änderungen der anderen Person

💡 **Tipp:** Sprecht euch ab wer gerade bearbeitet!

---

## ⚙️ Einstellungen (für normale Nutzer)

Klicke oben rechts auf **⚙️** (Zahnrad)

### Was kann ich sehen?

**Als normaler Nutzer** siehst du:
- **Personenliste** → Alle Kolleg*innen (nur ansehen, nicht ändern)
- **Raumliste** → Alle Räume (nur ansehen, nicht ändern)
- **Tagesvorlagen** → Vorlagen für Wochentage (nur ansehen, nicht ändern)

**Ändern kannst du NICHTS** – das kann nur ein Admin!

### Passwort ändern

Momentan musst du einen Admin fragen, um dein Passwort zu ändern.

*(In Zukunft könnte hier eine "Passwort ändern" Funktion sein)*

---

## ❓ Häufige Fragen

### Muss ich beim ersten Login das Passwort ändern?

**Ja!** Aus Sicherheitsgründen musst du beim ersten Mal ein neues Passwort wählen.

### Kann ich ein altes Protokoll nachträglich ändern?

**Ja!** Wähle das Datum im Dashboard → **"✏️ Bearbeiten"** → Ändern → Speichern

### Kann ich sehen wer was geändert hat?

Nein, im Protokoll selbst nicht. Aber bei **Team-Nachrichten** kannst du den **Log** ansehen.

### Was bedeutet die Zahl beim 📝 Symbol?

Das ist die **Anzahl der Team-Nachrichten**. Wenn du sie öffnest und schließt, verschwindet die Zahl.

### Wie lange bleiben Protokolle gespeichert?

**Unbegrenzt** – bis jemand sie manuell löscht.

### Kann ich Protokolle von mehreren Tagen auf einmal sehen?

Ja! Klicke oben auf **"Wochenansicht"** – dann siehst du **Mo-Fr** auf einen Blick.

### Funktioniert es auf dem Handy?

**Ja!** Die Webseite passt sich automatisch an. Aber zum Bearbeiten ist ein **Tablet oder PC** bequemer.

### Was ist wenn ich mein Passwort vergessen habe?

Frag einen **Admin**, der kann dir ein neues Passwort geben (beim nächsten Login musst du es dann wieder ändern).

---

## 🎯 Tipischer Tagesablauf

### Morgens (Frühdienst)

1. Anmelden
2. Dashboard öffnen → **Heutiges Datum**
3. **"✏️ Neues Protokoll erstellen"**
4. **Anwesenheit** eintragen (wer ist da?)
5. **Leitung im Haus** eintragen
6. **Spätdienst** eintragen
7. **Frühdienst für morgen** eintragen
8. **Speichern**

### Tagsüber

1. Protokoll öffnen → **"✏️ Bearbeiten"**
2. **Belegungsplanung** ausfüllen (wer ist wo?)
3. **Speichern**

### Abends (Spätdienst)

1. Protokoll öffnen → **"✏️ Bearbeiten"**
2. **"Sonstiges"** ausfüllen (gab es besondere Ereignisse?)
3. **Speichern**
4. Optional: **"🖨️ Drucken / PDF"** für Archiv

### Team-Kommunikation

**Beispiel:** Du kommst morgen später

1. Klicke **📝**
2. Schreibe: *"Komme morgen erst um 12 Uhr wegen Arzttermin"*
3. Klicke **"Erstellen"**
4. ✅ Alle Kollegen sehen es **sofort**!

---

## 🆘 Probleme / Hilfe

### "Ich kann mich nicht anmelden"

→ Prüfe:
- ✅ Nur den **Benutzernamen** eingeben (NICHT die Email!)
- ✅ **Passwort** korrekt?
- ✅ Groß-/Kleinschreibung beachten

→ Falls weiterhin Probleme: **Admin** fragen

### "Ich sehe keine Personen/Räume"

→ Ein **Admin** muss diese zuerst in den **Einstellungen** anlegen

### "Meine Änderungen werden nicht gespeichert"

→ Prüfe:
- ✅ Hast du auf **"Speichern"** geklickt?
- ✅ Waren **Pflichtfelder** (Leitung, Spätdienst) ausgefüllt?
- ✅ Bearbeitet gerade jemand anderes? (gelbe Warnung)

### "Ich sehe die Team-Nachrichten nicht"

→ Klicke auf **📝** oben rechts. Falls es nicht funktioniert: Seite neu laden (F5)

---

## 📞 Wer kann mir helfen?

Bei Fragen oder Problemen wende dich an einen **Administrator**.

**Admins erkennst du in den Einstellungen** (sie haben einen orangen Badge "Admin")

---

**Viel Erfolg mit Blitz-Protokoll!** 🚀
