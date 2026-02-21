import express from 'express';
import { createServer as createViteServer } from 'vite';
import db from './src/db/index';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // API Routes
  app.post('/api/auth/login', (req, res) => {
    const { email, password, deviceId } = req.body;
    console.log(`Login attempt: ${email} from device ${deviceId}`);

    // Support login by email OR name
    const user = db.prepare('SELECT * FROM users WHERE (email = ? OR name = ?) AND password = ?').get(email, email, password) as any;

    if (user) {
      console.log(`User found: ${user.email} (Role: ${user.role})`);
      if (user.role === 'employee') {
        if (!user.device_id) {
          if (deviceId) {
            console.log(`Binding device ${deviceId} to user ${user.email}`);
            db.prepare('UPDATE users SET device_id = ? WHERE id = ?').run(deviceId, user.id);
            user.device_id = deviceId;
          }
        } else if (deviceId && user.device_id !== deviceId) {
          console.log(`Device mismatch for ${user.email}: expected ${user.device_id}, got ${deviceId}`);
          return res.status(403).json({ error: 'Device mismatch. This account is bound to another device.' });
        }
      }
      res.json({ user });
    } else {
      console.log(`Invalid credentials for ${email}`);
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });

  app.post('/api/auth/signup', (req, res) => {
    const { email, password, name, role, deviceId } = req.body;
    try {
      const result = db.prepare('INSERT INTO users (email, password, name, role, device_id) VALUES (?, ?, ?, ?, ?)').run(email, password, name, role || 'employee', deviceId);
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
      res.json({ user });
    } catch (err: any) {
      if (err.message.includes('UNIQUE constraint failed')) {
        res.status(400).json({ error: 'Email already exists' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  app.post('/api/auth/profile', (req, res) => {
    const { id, name, email, password } = req.body;
    try {
      if (password) {
        db.prepare('UPDATE users SET name = ?, email = ?, password = ? WHERE id = ?').run(name, email, password, id);
      } else {
        db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(name, email, id);
      }
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      res.json({ user });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/attendance/today', (req, res) => {
    const userId = req.query.userId;
    const date = new Date().toISOString().split('T')[0];
    let record = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(userId, date);

    if (!record) {
      // Create empty record for today
      const result = db.prepare('INSERT INTO attendance (user_id, date, status) VALUES (?, ?, ?)').run(userId, date, 'Not Checked In');
      record = db.prepare('SELECT * FROM attendance WHERE id = ?').get(result.lastInsertRowid);
    }

    if (record.breaks) {
      record.breaks = JSON.parse(record.breaks);
    }
    res.json(record);
  });

  app.post('/api/attendance/action', (req, res) => {
    const { userId, action, deviceId } = req.body; // action: 'check_in', 'check_out', 'start_break', 'end_break'
    const date = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (user && user.role === 'employee' && user.device_id && user.device_id !== deviceId) {
      return res.status(403).json({ error: 'Device mismatch. Action denied.' });
    }

    let record = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(userId, date);
    if (!record) {
      db.prepare('INSERT INTO attendance (user_id, date, status) VALUES (?, ?, ?)').run(userId, date, 'Not Checked In');
      record = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(userId, date);
    }

    let breaks = JSON.parse(record.breaks || '[]');
    let newStatus = record.status;
    let updateQuery = '';
    let params: any[] = [];

    if (action === 'check_in') {
      newStatus = 'Checked In';
      updateQuery = 'UPDATE attendance SET check_in = ?, status = ? WHERE id = ?';
      params = [now, newStatus, record.id];
    } else if (action === 'check_out') {
      newStatus = 'Checked Out';
      updateQuery = 'UPDATE attendance SET check_out = ?, status = ? WHERE id = ?';
      params = [now, newStatus, record.id];
    } else if (action === 'start_break') {
      newStatus = 'On Break';
      breaks.push({ start: now, end: null });
      updateQuery = 'UPDATE attendance SET breaks = ?, status = ? WHERE id = ?';
      params = [JSON.stringify(breaks), newStatus, record.id];
    } else if (action === 'end_break') {
      newStatus = 'Checked In';
      if (breaks.length > 0) {
        breaks[breaks.length - 1].end = now;
      }
      updateQuery = 'UPDATE attendance SET breaks = ?, status = ? WHERE id = ?';
      params = [JSON.stringify(breaks), newStatus, record.id];
    }

    if (updateQuery) {
      db.prepare(updateQuery).run(...params);
    }

    const updated = db.prepare('SELECT * FROM attendance WHERE id = ?').get(record.id);
    updated.breaks = JSON.parse(updated.breaks);
    res.json(updated);
  });

  app.get('/api/attendance/history', (req, res) => {
    const userId = req.query.userId;
    const records = db.prepare('SELECT * FROM attendance WHERE user_id = ? ORDER BY date DESC').all(userId);
    records.forEach(r => r.breaks = JSON.parse(r.breaks || '[]'));
    res.json(records);
  });

  app.get('/api/admin/roster', (req, res) => {
    const date = new Date().toISOString().split('T')[0];
    const records = db.prepare(`
      SELECT a.*, u.name, u.email, u.device_id
      FROM attendance a 
      JOIN users u ON a.user_id = u.id 
      WHERE a.date = ?
    `).all(date);
    records.forEach(r => r.breaks = JSON.parse(r.breaks || '[]'));
    res.json(records);
  });

  app.get('/api/admin/users', (req, res) => {
    const users = db.prepare('SELECT id, name, email, role FROM users').all();
    res.json(users);
  });

  app.get('/api/admin/reports', (req, res) => {
    const month = req.query.month; // e.g. '2023-10'
    const records = db.prepare(`
      SELECT a.*, u.name 
      FROM attendance a 
      JOIN users u ON a.user_id = u.id 
      WHERE a.date LIKE ?
    `).all(`${month}%`);
    records.forEach(r => r.breaks = JSON.parse(r.breaks || '[]'));
    res.json(records);
  });

  app.get('/api/admin/settings', (req, res) => {
    const settings = db.prepare('SELECT * FROM settings').all();
    const config: any = {};
    settings.forEach((s: any) => config[s.key] = s.value);
    res.json(config);
  });

  app.post('/api/admin/settings', (req, res) => {
    const { office_ssid, office_ip } = req.body;
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('office_ssid', office_ssid);
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('office_ip', office_ip);
    res.json({ success: true });
  });

  app.post('/api/admin/reset-device', (req, res) => {
    const { userId } = req.body;
    db.prepare('UPDATE users SET device_id = NULL WHERE id = ?').run(userId);
    res.json({ success: true });
  });

  app.post('/api/admin/users/delete', (req, res) => {
    const { userId } = req.body;
    try {
      db.prepare('DELETE FROM attendance WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM users WHERE id = ?').run(userId);
      res.json({ success: true });
    } catch (err: any) {
      console.error(`Error deleting user ${userId}:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/employee-analytics', (req, res) => {
    const { userId } = req.query;
    const records = db.prepare('SELECT * FROM attendance WHERE user_id = ? ORDER BY date DESC').all(userId) as any[];

    // Calculate stats
    let totalMs = 0;
    let daysWorked = 0;
    const checkInTimes: number[] = [];

    records.forEach(r => {
      if (r.check_in && r.check_out) {
        daysWorked++;
        const start = new Date(r.check_in).getTime();
        const end = new Date(r.check_out).getTime();
        let duration = end - start;

        const breaks = JSON.parse(r.breaks || '[]');
        breaks.forEach((b: any) => {
          if (b.start && b.end) {
            duration -= (new Date(b.end).getTime() - new Date(b.start).getTime());
          }
        });
        totalMs += duration;

        const checkInDate = new Date(r.check_in);
        checkInTimes.push(checkInDate.getHours() * 60 + checkInDate.getMinutes());
      }
    });

    const avgCheckInMinutes = checkInTimes.length > 0 ? checkInTimes.reduce((a, b) => a + b, 0) / checkInTimes.length : 0;
    const avgCheckInHours = Math.floor(avgCheckInMinutes / 60);
    const avgCheckInMins = Math.floor(avgCheckInMinutes % 60);

    res.json({
      totalHours: Math.floor(totalMs / (1000 * 60 * 60)),
      daysWorked,
      avgCheckIn: `${avgCheckInHours.toString().padStart(2, '0')}:${avgCheckInMins.toString().padStart(2, '0')}`,
      history: records.slice(0, 30).map(r => ({
        date: r.date,
        hours: r.check_in && r.check_out ? (new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / (1000 * 60 * 60) : 0
      })).reverse()
    });
  });

  app.get('/api/attendance/validate-connection', (req, res) => {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const officeIp = db.prepare('SELECT value FROM settings WHERE key = ?').get('office_ip') as any;
    const officeSsid = db.prepare('SELECT value FROM settings WHERE key = ?').get('office_ssid') as any;

    // In a real scenario, we'd compare clientIp with officeIp.value
    // For the demo, we'll return the client's IP so the UI can show it.
    res.json({
      clientIp,
      officeIp: officeIp?.value,
      officeSsid: officeSsid?.value,
      isValid: clientIp === officeIp?.value || officeIp?.value === '0.0.0.0' // 0.0.0.0 could mean "allow all"
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
