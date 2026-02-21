import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { format } from 'date-fns';
import { Wifi, WifiOff, Clock, Calendar, CheckCircle2, Coffee, LogOut, Smartphone } from 'lucide-react';
import { motion } from 'motion/react';
import { getDeviceId } from '../utils/device';

export const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const [record, setRecord] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isWifiConnected, setIsWifiConnected] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchToday = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/attendance/today?userId=${user.id}`);
      const data = await res.json();
      setRecord(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHistory = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/attendance/history?userId=${user.id}`);
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error(err);
    }
  };

  const validateConnection = async () => {
    try {
      const res = await fetch('/api/attendance/validate-connection');
      const data = await res.json();
      setConnectionInfo(data);
      // For the demo, we'll still allow the manual toggle, 
      // but we'll default it based on the real IP check if it matches.
      if (data.isValid) {
        setIsWifiConnected(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    Promise.all([fetchToday(), fetchHistory(), validateConnection()]).then(() => setLoading(false));
  }, [user]);

  // Setup local notifications
  useEffect(() => {
    if ('Notification' in window) {
      Notification.requestPermission();
    }

    const checkTimeForNotifications = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      
      // 9:00 AM Reminder
      if (hours === 9 && minutes === 0 && Notification.permission === 'granted') {
        new Notification('Attendance Reminder', { body: 'Good morning! Please remember to check in.' });
      }
      // 5:00 PM Reminder
      if (hours === 17 && minutes === 0 && Notification.permission === 'granted') {
        new Notification('Attendance Reminder', { body: 'Good evening! Please remember to check out.' });
      }
    };

    const interval = setInterval(checkTimeForNotifications, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (action: string) => {
    if (!user) return;
    setError('');
    try {
      const res = await fetch('/api/attendance/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, action, deviceId: getDeviceId() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Action failed');
      }
      setRecord(data);
      fetchHistory(); // Refresh history
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  const statusColors: Record<string, string> = {
    'Not Checked In': 'bg-slate-100 text-slate-600',
    'Checked In': 'bg-emerald-100 text-emerald-700',
    'On Break': 'bg-amber-100 text-amber-700',
    'Checked Out': 'bg-indigo-100 text-indigo-700',
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100">
          {error}
        </div>
      )}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{t('status')}</h2>
            <p className="text-sm text-slate-500">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 ${statusColors[record?.status || 'Not Checked In']}`}>
              <span className="relative flex h-2.5 w-2.5">
                {record?.status === 'Checked In' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${record?.status === 'Checked In' ? 'bg-emerald-500' : 'bg-current'}`}></span>
              </span>
              {t(record?.status.replace(/ /g, '').replace(/^./, (str: string) => str.toLowerCase()) || 'notCheckedIn')}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
              <Smartphone className="w-3 h-3" />
              {getDeviceId()}
            </div>
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl mb-6 flex flex-col gap-4 border border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isWifiConnected ? <Wifi className="text-emerald-500" /> : <WifiOff className="text-slate-400" />}
              <div>
                <p className="text-sm font-medium text-slate-900">{connectionInfo?.officeSsid || 'Office Wi-Fi'}</p>
                <p className="text-xs text-slate-500">{isWifiConnected ? 'Connected' : 'Not connected'}</p>
              </div>
            </div>
            <button
              onClick={() => setIsWifiConnected(!isWifiConnected)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isWifiConnected ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}
            >
              {t('simulateWifi')}
            </button>
          </div>
          
          {connectionInfo && (
            <div className="pt-3 border-t border-slate-200 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Your IP</p>
                <p className="text-xs font-mono text-slate-600">{connectionInfo.clientIp}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Office IP</p>
                <p className="text-xs font-mono text-slate-600">{connectionInfo.officeIp}</p>
              </div>
            </div>
          )}
        </div>

        {!isWifiConnected && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 flex items-center gap-2">
            <WifiOff className="w-4 h-4" />
            {t('officeWifiRequired')}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <button
            disabled={!isWifiConnected || record?.status !== 'Not Checked In'}
            onClick={() => handleAction('check_in')}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-emerald-200"
          >
            <CheckCircle2 className="w-6 h-6" />
            <span className="font-medium">{t('checkIn')}</span>
          </button>
          
          <button
            disabled={!isWifiConnected || record?.status !== 'Checked In'}
            onClick={() => handleAction('start_break')}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-amber-200"
          >
            <Coffee className="w-6 h-6" />
            <span className="font-medium">{t('startBreak')}</span>
          </button>

          <button
            disabled={!isWifiConnected || record?.status !== 'On Break'}
            onClick={() => handleAction('end_break')}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-blue-200"
          >
            <Clock className="w-6 h-6" />
            <span className="font-medium">{t('endBreak')}</span>
          </button>

          <button
            disabled={!isWifiConnected || (record?.status !== 'Checked In' && record?.status !== 'On Break')}
            onClick={() => handleAction('check_out')}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-indigo-200"
          >
            <LogOut className="w-6 h-6" />
            <span className="font-medium">{t('checkOut')}</span>
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-500" />
          {t('history')}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-sm text-slate-500">
                <th className="pb-3 font-medium">{t('date')}</th>
                <th className="pb-3 font-medium">{t('checkIn')}</th>
                <th className="pb-3 font-medium">{t('checkOut')}</th>
                <th className="pb-3 font-medium">{t('status')}</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-slate-500 text-sm">
                    {t('noRecords')}
                  </td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="py-3 text-sm text-slate-900">{item.date}</td>
                    <td className="py-3 text-sm text-slate-600">
                      {item.check_in ? format(new Date(item.check_in), 'hh:mm a') : '-'}
                    </td>
                    <td className="py-3 text-sm text-slate-600">
                      {item.check_out ? format(new Date(item.check_out), 'hh:mm a') : '-'}
                    </td>
                    <td className="py-3 text-sm">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${statusColors[item.status]}`}>
                        {t(item.status.replace(/ /g, '').replace(/^./, (str: string) => str.toLowerCase()) || 'notCheckedIn')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
