const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "database", "coachswim.db");

const db = new Database(dbPath);

// Aktifkan foreign key supaya constraint seperti ON DELETE SET NULL berlaku
db.prepare("PRAGMA foreign_keys = ON").run();

console.log("Berhasil konek ke SQLite (better-sqlite3) dengan foreign keys aktif");

module.exports = db;