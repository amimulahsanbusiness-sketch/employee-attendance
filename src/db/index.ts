import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'attendance.db');
const db = new sqlite3.Database(dbPath);

// Helper function to run practical queries (sqlite3 is async using callbacks)
export const runQuery = (query: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

export const getQuery = (query: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      resolve(row);
    });
  });
};

export const allQuery = (query: string, params: any[] = []): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      resolve(rows);
    });
  });
};

// Initialize schema
db.serialize(async () => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      device_id TEXT
    );
  `);

  db.run(`
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
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Migration: Add device_id column if it doesn't exist (for existing databases)
  db.get('SELECT device_id FROM users LIMIT 1', (err) => {
    if (err) {
      db.run('ALTER TABLE users ADD COLUMN device_id TEXT');
    }
  });

  // Seed initial settings if empty
  db.get('SELECT COUNT(*) as count FROM settings', (err, row: any) => {
    if (row && row.count === 0) {
      db.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['office_ssid', 'OfficeNetwork_5G']);
      db.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['office_ip', '127.0.0.1']);
    }
  });

  // Seed initial users if empty
  db.get('SELECT COUNT(*) as count FROM users', (err, row: any) => {
    if (row && row.count === 0) {
      const insertUser = db.prepare('INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)');
      insertUser.run(['admin@company.com', 'password', 'Admin User', 'admin']);
      insertUser.run(['employee@company.com', 'password', 'John Doe', 'employee']);
      insertUser.finalize();
    }
  });
});

export default db;
