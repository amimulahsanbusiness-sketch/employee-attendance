import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'attendance.db');
const db = new Database(dbPath);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    device_id TEXT
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    check_in TEXT,
    check_out TEXT,
    breaks TEXT DEFAULT '[]',
    status TEXT DEFAULT 'Not Checked In',
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Migration: Add device_id column if it doesn't exist (for existing databases)
try {
  db.prepare('SELECT device_id FROM users LIMIT 1').get();
} catch (e) {
  db.exec('ALTER TABLE users ADD COLUMN device_id TEXT');
}

// Seed initial settings if empty
const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number };
if (settingsCount.count === 0) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('office_ssid', 'OfficeNetwork_5G');
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('office_ip', '127.0.0.1'); // Default for local testing
}

// Seed initial users if empty
const count = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
if (count.count === 0) {
  const insertUser = db.prepare('INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)');
  insertUser.run('admin@company.com', 'password', 'Admin User', 'admin');
  insertUser.run('employee@company.com', 'password', 'John Doe', 'employee');
}

export default db;
