import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import db, { getQuery, runQuery, allQuery } from './src/db/index';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // API Routes
  app.post('/api/auth/login', async (req, res) => {
    const { email, password, deviceId } = req.body;
    console.log(`Login attempt: ${email} from device ${deviceId}`);

    try {
      // Support login by email OR name
      const user = await getQuery('SELECT * FROM users WHERE (email = ? OR name = ?) AND password = ?', [email, email, password]);

      if (user) {
        console.log(`User found: ${user.email} (Role: ${user.role})`);
        if (user.role === 'employee') {
          if (!user.device_id) {
            if (deviceId) {
              console.log(`Binding device ${deviceId} to user ${user.email}`);
              await runQuery('UPDATE users SET device_id = ? WHERE id = ?', [deviceId, user.id]);
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
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/signup', async (req, res) => {
    const { email, password, name, role, deviceId } = req.body;
    try {
      const result = await runQuery('INSERT INTO users (email, password, name, role, device_id) VALUES (?, ?, ?, ?, ?)', [email, password, name, role || 'employee', deviceId]);
      const user = await getQuery('SELECT * FROM users WHERE id = ?', [result.lastID]);
      res.json({ user });
    } catch (err: any) {
      if (err.message.includes('UNIQUE constraint failed')) {
        res.status(400).json({ error: 'Email already exists' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  app.post('/api/auth/profile', async (req, res) => {
    const { id, name, email, password } = req.body;
    try {
      if (password) {
        await runQuery('UPDATE users SET name = ?, email = ?, password = ? WHERE id = ?', [name, email, password, id]);
      } else {
        await runQuery('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, id]);
      }
      const user = await getQuery('SELECT * FROM users WHERE id = ?', [id]);
      res.json({ user });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/attendance/today', async (req, res) => {
    const userId = req.query.userId;
    const date = new Date().toISOString().split('T')[0];
    try {
      let record = await getQuery('SELECT * FROM attendance WHERE user_id = ? AND date = ?', [userId, date]);

      if (!record) {
        // Create empty record for today
        const result = await runQuery('INSERT INTO attendance (user_id, date, status) VALUES (?, ?, ?)', [userId, date, 'Not Checked In']);
        record = await getQuery('SELECT * FROM attendance WHERE id = ?', [result.lastID]);
      }

      if (record.breaks) {
        record.breaks = JSON.parse(record.breaks);
      }
      res.json(record);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/attendance/action', async (req, res) => {
    const { userId, action, deviceId } = req.body; // action: 'check_in', 'check_out', 'start_break', 'end_break'
    const date = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    try {
      const user = await getQuery('SELECT * FROM users WHERE id = ?', [userId]);
      if (user && user.role === 'employee' && user.device_id && user.device_id !== deviceId) {
        return res.status(403).json({ error: 'Device mismatch. Action denied.' });
      }

      let record = await getQuery('SELECT * FROM attendance WHERE user_id = ? AND date = ?', [userId, date]);
      if (!record) {
        await runQuery('INSERT INTO attendance (user_id, date, status) VALUES (?, ?, ?)', [userId, date, 'Not Checked In']);
        record = await getQuery('SELECT * FROM attendance WHERE user_id = ? AND date = ?', [userId, date]);
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
        await runQuery(updateQuery, params);
      }

      const updated = await getQuery('SELECT * FROM attendance WHERE id = ?', [record.id]);
      updated.breaks = JSON.parse(updated.breaks);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/attendance/history', async (req, res) => {
    const userId = req.query.userId;
    try {
      const records = await allQuery('SELECT * FROM attendance WHERE user_id = ? ORDER BY date DESC', [userId]);
      records.forEach(r => r.breaks = JSON.parse(r.breaks || '[]'));
      res.json(records);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/roster', async (req, res) => {
    const date = new Date().toISOString().split('T')[0];
    try {
      const records = await allQuery(`
        SELECT a.*, u.name, u.email, u.device_id
        FROM attendance a 
        JOIN users u ON a.user_id = u.id 
        WHERE a.date = ?
      `, [date]);
      records.forEach(r => r.breaks = JSON.parse(r.breaks || '[]'));
      res.json(records);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/users', async (req, res) => {
    try {
      const users = await allQuery('SELECT id, name, email, role FROM users');
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/reports', async (req, res) => {
    const month = req.query.month; // e.g. '2023-10'
    try {
      const records = await allQuery(`
        SELECT a.*, u.name 
        FROM attendance a 
        JOIN users u ON a.user_id = u.id 
        WHERE a.date LIKE ?
      `, [`${month}%`]);
      records.forEach(r => r.breaks = JSON.parse(r.breaks || '[]'));
      res.json(records);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/settings', async (req, res) => {
    try {
      const settings = await allQuery('SELECT * FROM settings');
      const config: any = {};
      settings.forEach((s: any) => config[s.key] = s.value);
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/settings', async (req, res) => {
    const { office_ssid, office_ip } = req.body;
    try {
      await runQuery('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['office_ssid', office_ssid]);
      await runQuery('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['office_ip', office_ip]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/reset-device', async (req, res) => {
    const { userId } = req.body;
    try {
      await runQuery('UPDATE users SET device_id = NULL WHERE id = ?', [userId]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/users/delete', async (req, res) => {
    const { userId } = req.body;
    try {
      await runQuery('DELETE FROM attendance WHERE user_id = ?', [userId]);
      await runQuery('DELETE FROM users WHERE id = ?', [userId]);
      res.json({ success: true });
    } catch (err: any) {
      console.error(`Error deleting user ${userId}:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/employee-analytics', async (req, res) => {
    const { userId } = req.query;
    try {
      const records = await allQuery('SELECT * FROM attendance WHERE user_id = ? ORDER BY date DESC', [userId]);

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
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/attendance/validate-connection', async (req, res) => {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    try {
      const officeIp = await getQuery('SELECT value FROM settings WHERE key = ?', ['office_ip']);
      const officeSsid = await getQuery('SELECT value FROM settings WHERE key = ?', ['office_ssid']);

      res.json({
        clientIp,
        officeIp: officeIp?.value,
        officeSsid: officeSsid?.value,
        isValid: clientIp === officeIp?.value || officeIp?.value === '0.0.0.0' // 0.0.0.0 could mean "allow all"
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve('dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve('dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
