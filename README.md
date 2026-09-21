# Reisekasse

Eine kleine geteilte App, um Reiseausgaben mit einer zweiten Person zu tracken,
nach Tagen zu sehen und am Ende fair zu splitten. Keine Installation nötig,
läuft als reine HTML/CSS/JS-Seite im Browser. Änderungen synchronisieren sich
in Echtzeit zwischen allen, die den gleichen Link geöffnet haben.

## Einmalige Einrichtung (ca. 5 Minuten)

Die App braucht ein kostenloses Firebase-Projekt als Datenspeicher (Firestore).
Das übernimmst du einmalig selbst, danach läuft alles automatisch.

1. Gehe zu **https://console.firebase.google.com** und logge dich mit einem
   Google-Konto ein.
2. **Projekt hinzufügen** → einen Namen vergeben (z. B. „Reisekasse") →
   Google Analytics kannst du deaktivieren, wird nicht gebraucht.
3. Im Projekt links im Menü auf **Build → Firestore Database** →
   **Datenbank erstellen** → Modus **„Testmodus"** wählen (das reicht für
   dieses private Zwei-Personen-Tool) → Region auswählen (z. B. `eur3`) →
   Erstellen.
4. Im Projekt links im Menü auf das Zahnrad **⚙️ Projekteinstellungen**.
   Unten bei „Meine Apps" auf das Symbol **`</>`** (Web-App hinzufügen) →
   einen Namen vergeben → **App registrieren**. Firebase **hosting** musst
   du dabei nicht aktivieren.
5. Du bekommst jetzt ein Code-Snippet mit einem Objekt `firebaseConfig`, das
   ungefähr so aussieht:

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "reisekasse-xxxx.firebaseapp.com",
     projectId: "reisekasse-xxxx",
     storageBucket: "reisekasse-xxxx.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123",
   };
   ```

   Kopiere diese Werte und trage sie in `app.js` ganz oben bei
   `const firebaseConfig = { ... }` ein (ersetze die Platzhalter).

   **Hinweis:** Dieser `apiKey` ist bei Firebase-Web-Apps kein Geheimnis im
   klassischen Sinn — er darf im Frontend-Code stehen. Die eigentliche
   Absicherung passiert über die Firestore Security Rules (siehe unten), nicht
   durch Geheimhaltung dieses Werts.

6. **Firestore-Regeln anpassen** (wichtig, sonst bleibt „Testmodus" nur 30 Tage
   offen und sperrt sich danach automatisch): Im Firebase-Menü unter
   **Firestore Database → Regeln**, den Inhalt ersetzen durch:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /trips/{tripId} {
         allow read, write: if true;
         match /expenses/{expenseId} {
           allow read, write: if true;
         }
       }
     }
   }
   ```

   Das öffnet den Zugriff für jeden, der die Trip-ID (also den Link) kennt —
   bewusst einfach gehalten für dieses private Zwei-Personen-Tool, ohne
   Login-System. Niemand ohne den Link kann eine Trip-ID erraten (sie ist ein
   zufälliger 8-stelliger Code).

## Nutzung

- Öffne `index.html` im Browser (Doppelklick reicht, oder per
  `python3 -m http.server` im Ordner starten und `http://localhost:8000`
  öffnen).
- Beim ersten Öffnen wird automatisch eine neue Trip-ID in die URL
  geschrieben (`?trip=abc12345`). Fülle die Basisdaten aus (Reisename, zwei
  Namen, Start-/Enddatum).
- Klicke oben rechts auf **🔗 Link teilen**, um den Link (inkl. Trip-ID) zu
  kopieren, und schicke ihn deiner Freundin. Wer den Link öffnet, sieht
  denselben Trip live mit.
- Ausgaben eintragen: Betrag, Kategorie, Beschreibung, wer bezahlt hat, und
  Datum. Für Posten wie eine mehrtägig gebuchte Unterkunft die Checkbox
  „Mehrtägig" aktivieren und ein Enddatum wählen — der Betrag wird dann
  automatisch gleichmäßig auf die Tage im Zeitraum verteilt.
- Oben siehst du Gesamtausgaben, Tagesdurchschnitt und die Split-Übersicht
  (wer wem wie viel schuldet).

## Online verfügbar machen (optional)

Damit ihr nicht beide lokal einen Server starten müsst, könnt ihr die drei
Dateien kostenlos hosten, z. B. mit **GitHub Pages**:

1. Repo-Einstellungen → **Pages** → als Quelle den `main`-Branch und den
   Root-Ordner wählen → Speichern.
2. Nach ein bis zwei Minuten ist die Seite unter
   `https://<dein-github-name>.github.io/RK/` erreichbar.
3. Den Link mit `?trip=...` (wie oben beschrieben) teilen.

## Technik

- Reines HTML/CSS/JavaScript, kein Build-Schritt, keine Abhängigkeiten außer
  dem Firebase-SDK (wird direkt per CDN geladen).
- Firestore übernimmt Speicherung und Echtzeit-Synchronisation
  (`onSnapshot`), es ist also kein eigener Server nötig.
- Datenmodell: `trips/{tripId}` (Name, Personen, Zeitraum) und
  `trips/{tripId}/expenses/{expenseId}` (Betrag, Beschreibung, Kategorie,
  bezahlt von, Start-/Enddatum).
