# Database Backup & Migration

These scripts work with your MongoDB connection in `MONGODB_URI`.

## Prerequisite

Preferred (faster for very large backups): install **MongoDB Database Tools** in PATH:

- `mongodump`
- `mongorestore`

If they are not installed, scripts automatically fall back to built-in Node.js mode.

## 1) Backup current database

From `zaitoon-api` folder:

```bash
npm run db:backup
```

Optional:

```bash
node scripts/backupDatabase.js --out ./backups --gzip true
node scripts/backupDatabase.js --uri "mongodb+srv://..." --out ./backups
```

Backups are created under:

- `./backups/mongo-backup-YYYY-MM-DD_HH-mm-ss`

When tools are missing, backup is saved as `.ndjson` files plus `backup.manifest.json`.

## 2) Migrate current DB to another MongoDB

```bash
npm run db:migrate -- --target-uri "mongodb+srv://TARGET_USER:TARGET_PASS@cluster.mongodb.net/targetDb" --drop
```

Notes:

- Source defaults to `MONGODB_URI`
- `--drop` clears target collections before import

You can also provide source explicitly:

```bash
node scripts/migrateDatabase.js --source-uri "mongodb+srv://SOURCE..." --target-uri "mongodb+srv://TARGET..." --drop
```

## 3) Restore from a backup folder

```bash
node scripts/migrateDatabase.js --backup-dir "./backups/mongo-backup-2026-02-24_20-10-00" --target-uri "mongodb+srv://TARGET..." --drop
```

## Safety tips

- Run first **without** `--drop` if you want to avoid deleting target data.
- Verify target database name inside `--target-uri` before running.
- Keep backup folders in secure storage.
