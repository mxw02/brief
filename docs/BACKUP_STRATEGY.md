# Backup-Strategie für Brief

Diese Strategie legt verbindlich fest, **welche Daten**, **wann**, **wie** und **wohin** gesichert werden und wie ein Restore im Fehlerfall verifiziert wird.

---

## 1. Was wird gesichert? (Scope)

| Komponente | Inhalt | Quelle (Docker Compose) | Priorität |
| :--- | :--- | :--- | :--- |
| **PostgreSQL-Datenbank** | Spaces, Dokumente, Versionen/Drafts, Benutzer, Rollen, API-Token-Hashes, Einstellungen | Container `brief-postgres` (`pg_dump`) | Kritisch |
| **Workspace-Daten** | Lokale Metadaten / SQLite-Fallback (`BRIEF_DATA_DIR`) | Docker-Volume `brief_data` (`/app/data`) | Hoch |
| **Uploads & Anhänge** | Hochgeladene Bilder & Dateien (`BRIEF_UPLOADS_DIR`) | Docker-Volume `brief_uploads` (`/app/uploads`) | Kritisch |
| **Konfiguration & Secrets** | `AUTH_SECRET`, `POSTGRES_PASSWORD`, `OIDC_*`, `KANSO_API_URL`, `APP_URL` | `.env` | Kritisch |

> [!IMPORTANT]
> Ohne `AUTH_SECRET` aus `.env` werden bestehende Login-Sessions ungültig; ohne `POSTGRES_PASSWORD` startet der Restore-Container nicht mit den bisherigen Zugangsdaten. `.env` gehört daher zwingend ins verschlüsselte bzw. zugriffsgeschützte Backup (`chmod 600`).

---

## 2. Wann wird gesichert? (Zeitplan & RPO/RTO)

- **Täglich (automatisiert):** `03:00 Uhr` per Cronjob oder `systemd` Timer (`RPO = 24 Stunden`).
- **Vor jedem Update / jeder Migration:** Manuell vor `docker compose pull && docker compose up -d`.
- **Ziel-Wiederherstellungszeit (`RTO`):** `< 15 Minuten` auf einem vorbereiteten Docker-Host.

### Beispiel-Cronjob auf dem Server (`crontab -e`)

```cron
0 3 * * * cd /home/pi/brief && ./scripts/backup.sh --keep 14 >> /var/log/brief-backup.log 2>&1
```

---

## 3. Wie wird gesichert? (Verfahren & Aufbewahrung)

Das Skript [`scripts/backup.sh`](../scripts/backup.sh) erzeugt pro Lauf ein zeitgestempeltes Verzeichnis unter `./backups/YYYY-MM-DD_HH-MM-SS/` mit restriktiven Rechten (`umask 077`):

1. **Datenbank-Dump:** `pg_dump --clean --if-exists` über `docker compose exec -T postgres`, komprimiert als `database.sql.gz` (bei lokalem SQLite-Betrieb stattdessen Kopie von `brief.db`).
2. **Volume-Archive:** Komprimierte `tar.gz`-Archive für `brief_data` (`brief_data.tar.gz`) und `brief_uploads` (`brief_uploads.tar.gz`).
3. **Konfiguration:** Kopie von `.env` als `env.backup` (`chmod 600`; mit `--no-env` überspringbar).
4. **Integritätsprüfung:** `SHA256SUMS` für alle erzeugten Dateien.
5. **Retention-Policy:** Standardmäßig bleiben die **letzten 14 Backups** lokal erhalten (`--keep 14`); ältere Backup-Ordner werden automatisch bereinigt.

Manueller Aufruf:

```bash
./scripts/backup.sh
# oder mit eigenem Zielverzeichnis und Retention:
./scripts/backup.sh --dir /mnt/nas/brief-backups --keep 30
```

---

## 4. Wohin wird gesichert? (3-2-1-Regel)

Für produktive Instanzen gilt die **3-2-1-Backup-Regel** (3 Kopien, 2 unterschiedliche Medien, 1 Offsite-Kopie):

1. **Lokal (Schnell-Restore):** `./backups/` auf dem Docker-Host (für sofortigen Rollback vor Updates).
2. **Sekundärspeicher (LAN / NAS):** Tägliche Synchronisation nach dem Backup-Lauf per `rsync` oder `BorgBackup` auf ein NAS / einen zweiten Server.
3. **Offsite (Cloud / S3 / Backblaze B2):** Verschlüsselte Offsite-Replikation per `rclone` oder `restic` (schützt bei Hardware-Defekt oder Ransomware).

Beispiel-Erweiterung nach `./scripts/backup.sh`:

```bash
rclone sync /home/pi/brief/backups remote:brief-backups --transfers 4
```

---

## 5. Wiederherstellung (Restore) & Verifikation

Das Skript [`scripts/restore.sh`](../scripts/restore.sh) prüft zuerst `SHA256SUMS` und stellt anschließend Datenbank und Volumes wieder her:

```bash
./scripts/restore.sh ./backups/2026-11-18_03-00-00
```

### Regelmäßiger Restore-Test (monatlich empfohlen)
- Prüfen, ob `SHA256SUMS` ohne Fehler durchläuft (`sha256sum -c SHA256SUMS`).
- Ein aktuelles Backup testweise auf einer Staging-/Test-Instanz einspielen und Anmeldung, Spaces, Dokumente sowie Uploads prüfen.
