const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");
const mongoose = require("mongoose");

require("dotenv").config();

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }

  return args;
}

function maskMongoUri(uri) {
  if (!uri) return "";
  return uri.replace(/(mongodb(?:\+srv)?:\/\/)([^:@/]+):([^@/]+)@/i, "$1$2:****@");
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
    });

    child.on("error", (error) => reject(error));

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

async function dropAllCollections(connection) {
  const collections = await connection.db.listCollections({}, { nameOnly: true }).toArray();
  for (const item of collections) {
    await connection.collection(item.name).deleteMany({});
  }
}

async function insertNdjsonFile({ collection, filePath }) {
  const readStream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: readStream, crlfDelay: Infinity });
  let batch = [];
  let inserted = 0;

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    batch.push(JSON.parse(trimmed));
    if (batch.length >= 1000) {
      await collection.insertMany(batch, { ordered: false });
      inserted += batch.length;
      batch = [];
    }
  }

  if (batch.length > 0) {
    await collection.insertMany(batch, { ordered: false });
    inserted += batch.length;
  }

  return inserted;
}

async function restoreFromNativeBackup({ backupDir, targetUri, drop }) {
  const manifestPath = path.join(backupDir, "backup.manifest.json");
  const manifestRaw = fs.readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(manifestRaw);
  const connection = await mongoose.createConnection(targetUri).asPromise();

  try {
    if (drop) {
      await dropAllCollections(connection);
    }

    for (const item of manifest.collections || []) {
      const filePath = path.join(backupDir, item.file);
      if (!fs.existsSync(filePath)) continue;
      const inserted = await insertNdjsonFile({
        collection: connection.collection(item.collection),
        filePath,
      });
      console.log(`Restored ${inserted} documents into ${item.collection}`);
    }
  } finally {
    await connection.close();
  }
}

async function copyCollectionDocuments({ sourceCollection, targetCollection }) {
  const cursor = sourceCollection.find({});
  let batch = [];
  let copied = 0;

  for await (const doc of cursor) {
    batch.push(doc);
    if (batch.length >= 1000) {
      await targetCollection.insertMany(batch, { ordered: false });
      copied += batch.length;
      batch = [];
    }
  }

  if (batch.length > 0) {
    await targetCollection.insertMany(batch, { ordered: false });
    copied += batch.length;
  }

  return copied;
}

async function migrateNativeSourceToTarget({ sourceUri, targetUri, drop }) {
  const sourceConnection = await mongoose.createConnection(sourceUri).asPromise();
  const targetConnection = await mongoose.createConnection(targetUri).asPromise();

  try {
    if (drop) {
      await dropAllCollections(targetConnection);
    }

    const collections = await sourceConnection.db.listCollections({}, { nameOnly: true }).toArray();

    for (const item of collections) {
      const name = item.name;
      const copied = await copyCollectionDocuments({
        sourceCollection: sourceConnection.collection(name),
        targetCollection: targetConnection.collection(name),
      });
      console.log(`Migrated ${copied} documents for ${name}`);
    }
  } finally {
    await sourceConnection.close();
    await targetConnection.close();
  }
}

async function restoreFromBackup({ backupDir, targetUri, drop, gzip }) {
  const manifestPath = path.join(backupDir, "backup.manifest.json");
  if (fs.existsSync(manifestPath)) {
    console.log("Detected native backup format. Using built-in restore mode...");
    await restoreFromNativeBackup({ backupDir, targetUri, drop });
    return;
  }

  const restoreArgs = [`--uri=${targetUri}`, backupDir];
  if (drop) restoreArgs.push("--drop");
  if (gzip) restoreArgs.push("--gzip");

  console.log("Starting restore/migration from backup folder...");
  console.log(`Backup folder: ${backupDir}`);
  console.log(`Target: ${maskMongoUri(targetUri)}`);
  console.log(`Drop existing target collections: ${drop ? "YES" : "NO"}`);

  try {
    await runCommand("mongorestore", restoreArgs);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        "mongorestore was not found and this backup is not in native format. Install MongoDB Database Tools or restore from a native backup folder."
      );
    }
    throw error;
  }
}

async function migrateSourceToTarget({ sourceUri, targetUri, drop, gzip }) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zaitoon-mongo-migrate-"));

  try {
    console.log("Creating temporary dump from source database...");
    console.log(`Source: ${maskMongoUri(sourceUri)}`);

    const dumpArgs = [`--uri=${sourceUri}`, `--out=${tempDir}`];
    if (gzip) dumpArgs.push("--gzip");

    await runCommand("mongodump", dumpArgs);

    const restoreArgs = [`--uri=${targetUri}`, tempDir];
    if (drop) restoreArgs.push("--drop");
    if (gzip) restoreArgs.push("--gzip");

    console.log("Restoring temporary dump into target database...");
    console.log(`Target: ${maskMongoUri(targetUri)}`);
    console.log(`Drop existing target collections: ${drop ? "YES" : "NO"}`);

    await runCommand("mongorestore", restoreArgs);
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log("mongodump/mongorestore not found. Falling back to native Node.js migration mode...");
      await migrateNativeSourceToTarget({ sourceUri, targetUri, drop });
      return;
    }
    throw error;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function printUsage() {
  console.log("Usage:");
  console.log("  node scripts/migrateDatabase.js --target-uri <mongodb-uri> [--source-uri <mongodb-uri>] [--drop] [--gzip true|false]");
  console.log("  node scripts/migrateDatabase.js --backup-dir <path> --target-uri <mongodb-uri> [--drop] [--gzip true|false]");
  console.log("");
  console.log("Notes:");
  console.log("  - If --source-uri is not provided, MONGODB_URI is used.");
  console.log("  - --drop deletes target collections before restore; use carefully.");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.h) {
    printUsage();
    return;
  }

  const targetUri = args["target-uri"];
  if (!targetUri) {
    throw new Error("Missing target URI. Pass --target-uri <mongodb-uri>");
  }

  const drop = Boolean(args.drop);
  const gzip = args.gzip !== "false";
  const backupDir = args["backup-dir"] ? path.resolve(args["backup-dir"]) : null;

  if (backupDir) {
    if (!fs.existsSync(backupDir)) {
      throw new Error(`Backup directory not found: ${backupDir}`);
    }

    await restoreFromBackup({
      backupDir,
      targetUri,
      drop,
      gzip,
    });
    console.log("Restore/migration completed successfully.");
    return;
  }

  const sourceUri = args["source-uri"] || process.env.MONGODB_URI;
  if (!sourceUri) {
    throw new Error("Missing source URI. Set MONGODB_URI or pass --source-uri <mongodb-uri>");
  }

  await migrateSourceToTarget({
    sourceUri,
    targetUri,
    drop,
    gzip,
  });

  console.log("Migration completed successfully.");
}

main().catch((error) => {
  console.error(`Migration failed: ${error.message}`);
  process.exit(1);
});
