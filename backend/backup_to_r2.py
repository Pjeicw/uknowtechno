"""
backup_to_r2.py — nightly disaster-recovery backup to Cloudflare R2 (Phase 3 hardened).

Fixes over the original:
  1. SQLite files are snapshotted with the online backup API (sqlite3 `.backup`)
     instead of hot-copied, so a half-written page can't corrupt the restore.
  2. Absolute paths resolved relative to this script — cron-safe regardless of CWD.
  3. R2 retention: old archives are pruned so backups don't pile up forever.
  4. Failure alerting: non-zero exit + optional webhook ping so a silently
     failing backup doesn't go unnoticed for weeks.

Run: python backup_to_r2.py   (intended as a nightly cron job)
"""

import os
import sys
import shutil
import zipfile
import sqlite3
import datetime
import tempfile

import boto3
from botocore.exceptions import NoCredentialsError
from dotenv import load_dotenv

load_dotenv()

# --- Paths (absolute, resolved from this file — cron-safe) -------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))

# Directories to archive wholesale (non-db files: PocketBase uploads, etc.)
BACKUP_DIRS = [
    os.path.join(PROJECT_ROOT, "pb_data"),
    os.path.join(PROJECT_ROOT, "qdrant_storage"),
]
# SQLite databases to snapshot safely (path -> archive name).
SQLITE_DBS = [
    os.path.join(PROJECT_ROOT, "rag.db"),
    os.path.join(PROJECT_ROOT, "pb_data", "data.db"),
]

# --- R2 config ---------------------------------------------------------------
R2_BUCKET = os.getenv("CLOUDFLARE_R2_BUCKET")
R2_ACCESS_KEY = os.getenv("CLOUDFLARE_R2_ACCESS_KEY")
R2_SECRET_KEY = os.getenv("CLOUDFLARE_R2_SECRET_KEY")
CF_ACCOUNT_ID = os.getenv("CLOUDFLARE_ACCOUNT_ID", "YOUR_ACCOUNT_ID")
R2_ENDPOINT = f"https://{CF_ACCOUNT_ID}.r2.cloudflarestorage.com"

RETENTION_DAYS = int(os.getenv("BACKUP_RETENTION_DAYS", "14"))
# Optional webhook (e.g. a Cloudflare Worker or ntfy URL) pinged on failure.
ALERT_WEBHOOK_URL = os.getenv("BACKUP_ALERT_WEBHOOK", "")


def snapshot_sqlite(src_path: str, dest_path: str) -> None:
    """Consistent point-in-time copy of a live SQLite DB via the backup API."""
    src = sqlite3.connect(src_path)
    dst = sqlite3.connect(dest_path)
    try:
        with dst:
            src.backup(dst)  # atomic, safe even while the DB is in use
    finally:
        src.close()
        dst.close()


def create_backup_archive(output_filename: str, staging_dir: str) -> str:
    """Stage safe DB snapshots + copy other data, then zip it all. Returns path."""
    # 1. Safe snapshots of each SQLite database.
    for db_path in SQLITE_DBS:
        if os.path.exists(db_path):
            dest = os.path.join(staging_dir, os.path.basename(db_path))
            snapshot_sqlite(db_path, dest)
            print(f"Snapshotted DB: {db_path}")

    # 2. Copy non-db directory contents (skip the live .db we already snapshotted).
    for src_dir in BACKUP_DIRS:
        if not os.path.isdir(src_dir):
            print(f"Warning: {src_dir} not found. Skipping.")
            continue
        dst_dir = os.path.join(staging_dir, os.path.basename(src_dir))
        shutil.copytree(
            src_dir, dst_dir,
            ignore=shutil.ignore_patterns("*.db", "*.db-wal", "*.db-shm"),
            dirs_exist_ok=True,
        )

    # 3. Zip the staging dir.
    with zipfile.ZipFile(output_filename, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, _, files in os.walk(staging_dir):
            for file in files:
                fp = os.path.join(root, file)
                zipf.write(fp, os.path.relpath(fp, staging_dir))
    print(f"Archive created: {output_filename}")
    return output_filename


def _r2_client():
    return boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=R2_ACCESS_KEY,
        aws_secret_access_key=R2_SECRET_KEY,
        region_name="auto",
    )


def upload_to_r2(file_path: str, object_name: str) -> None:
    _r2_client().upload_file(file_path, R2_BUCKET, object_name)
    print(f"Upload successful: {object_name} -> {R2_BUCKET}")


def prune_old_backups(prefix: str = "uknowtechno_backup_") -> None:
    """Delete R2 objects older than RETENTION_DAYS (keeps the bill flat)."""
    cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=RETENTION_DAYS)
    s3 = _r2_client()
    resp = s3.list_objects_v2(Bucket=R2_BUCKET, Prefix=prefix)
    deleted = 0
    for obj in resp.get("Contents", []):
        if obj["LastModified"] < cutoff:
            s3.delete_object(Bucket=R2_BUCKET, Key=obj["Key"])
            deleted += 1
            print(f"Pruned old backup: {obj['Key']}")
    print(f"Retention pass complete: {deleted} old archive(s) removed.")


def alert_failure(message: str) -> None:
    print(f"BACKUP FAILURE: {message}", file=sys.stderr)
    if ALERT_WEBHOOK_URL:
        try:
            import httpx
            httpx.post(ALERT_WEBHOOK_URL, json={"status": "backup_failed", "detail": message}, timeout=10)
        except Exception as e:
            print(f"(could not send failure alert: {e})", file=sys.stderr)


def main() -> int:
    print("Starting Disaster Recovery Backup...")
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    archive_name = os.path.join(SCRIPT_DIR, f"uknowtechno_backup_{timestamp}.zip")

    staging_dir = tempfile.mkdtemp(prefix="uknow_backup_")
    try:
        create_backup_archive(archive_name, staging_dir)

        if not (R2_BUCKET and R2_ACCESS_KEY and R2_SECRET_KEY):
            print("R2 credentials not configured — archive kept locally, upload skipped.")
            return 0

        upload_to_r2(archive_name, os.path.basename(archive_name))
        prune_old_backups()
        os.remove(archive_name)
        print("Backup process finished successfully.")
        return 0
    except NoCredentialsError:
        alert_failure("R2 credentials not available.")
        return 1
    except Exception as e:
        alert_failure(str(e))
        return 1
    finally:
        shutil.rmtree(staging_dir, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
