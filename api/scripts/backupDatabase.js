const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

require("dotenv").config();

function formatTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(
    date.getHours()
  )}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function maskMongoUri(uri) {
  if (!uri) return "";
  return uri.replace(/(mongodb(?:\+srv)?:\/\/)([^:@/]+):([^@/]+)@/i, "$1$2:****@");
}

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

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

async function writeCollectionNdjson({ collection, filePath }) {
  return new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(filePath, { encoding: "utf8" });
    let count = 0;

    writeStream.on("error", reject);

    (async () => {
      try {
        const cursor = collection.find({});
        for await (const doc of cursor) {
          writeStream.write(`${JSON.stringify(doc)}\n`);
          count += 1;
        }
        writeStream.end(() => resolve(count));
      } catch (error) {
        reject(error);
      }
    })();
  });
}

async function runNativeBackup({ mongoUri, backupDir }) {
  const connection = await mongoose.createConnection(mongoUri).asPromise();

  try {
    const collections = await connection.db.listCollections({}, { nameOnly: true }).toArray();
    const manifest = [];

    for (const item of collections) {
      const name = item.name;
      const outFile = path.join(backupDir, `${name}.ndjson`);
      const documentCount = await writeCollectionNdjson({
        collection: connection.collection(name),
        filePath: outFile,
      });

      manifest.push({
        collection: name,
        file: `${name}.ndjson`,
        documents: documentCount,
      });
    }

    fs.writeFileSync(
      path.join(backupDir, "backup.manifest.json"),
      `${JSON.stringify({ format: "ndjson", collections: manifest }, null, 2)}\n`,
      "utf8"
    );
  } finally {
    await connection.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mongoUri = args.uri || process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("Missing MongoDB URI. Set MONGODB_URI or pass --uri <mongo-uri>");
  }

  const timestamp = formatTimestamp();
  const backupRoot = args.out || path.resolve(process.cwd(), "backups");
  const backupDir = path.resolve(backupRoot, `mongo-backup-${timestamp}`);

  fs.mkdirSync(backupDir, { recursive: true });

  const dumpArgs = [`--uri=${mongoUri}`, `--out=${backupDir}`];
  if (args.gzip !== "false") {
    dumpArgs.push("--gzip");
  }

  const metadata = {
    createdAt: new Date().toISOString(),
    sourceUri: maskMongoUri(mongoUri),
    backupDirectory: backupDir,
    gzip: args.gzip !== "false",
    mode: "mongodump",
  };

  fs.writeFileSync(path.join(backupDir, "backup.metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

  console.log("Starting MongoDB backup...");
  console.log(`Source: ${maskMongoUri(mongoUri)}`);
  console.log(`Backup directory: ${backupDir}`);

  try {
    await runCommand("mongodump", dumpArgs);
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log("mongodump not found. Falling back to native Node.js backup mode...");
      await runNativeBackup({ mongoUri, backupDir });
      metadata.mode = "native-ndjson";
      fs.writeFileSync(path.join(backupDir, "backup.metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
      console.log("Backup completed successfully (native mode).");
      return;
    }
    throw error;
  }

  console.log("Backup completed successfully.");
}

main().catch((error) => {
  console.error(`Backup failed: ${error.message}`);
  process.exit(1);
});
