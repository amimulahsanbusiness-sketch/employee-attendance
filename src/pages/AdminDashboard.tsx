import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { format } from 'date-fns';
import { Users, FileText, Download, Calendar, Settings as SettingsIcon, Save, CheckCircle, Smartphone, RefreshCw, Trash2, BarChart3, ArrowLeft, User as UserIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'roster' | 'reports' | 'settings' | 'users'>('roster');
  const [roster, setRoster] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [settings, setSettings] = useState({ office_ssid: '', office_ip: '' });
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [loading, setLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '' });
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);

  const fetchRoster = async () => {
    try {
      const res = await fetch('/api/admin/roster');
      const data = await res.json();
      setRoster(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAnalytics = async (userId: number) => {
    try {
      const res = await fetch(`/api/admin/employee-analytics?userId=${userId}`);
      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user and all their attendance records? This action cannot be undone.')) return;
    setDeleteError('');
    try {
      const res = await fetch('/api/admin/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        fetchUsers();
        fetchRoster();
      } else {
        const data = await res.json();
        setDeleteError(data.error || 'Failed to delete user');
      }
    } catch (err: any) {
      setDeleteError(err.message);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreateSuccess(false);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newUser, role: 'employee' }),
      });
      const data = await res.json();
      if (res.ok) {
        setCreateSuccess(true);
        setNewUser({ name: '', email: '', password: '' });
        setShowCreateForm(false);
        fetchUsers();
      } else {
        setCreateError(data.error || 'Failed to create user');
      }
    } catch (err: any) {
      setCreateError(err.message);
    }
  };

  const handleResetDevice = async (userId: number) => {
    if (!confirm('Are you sure you want to reset this user\'s device binding? They will be able to log in from a new device.')) return;
    try {
      const res = await fetch('/api/admin/reset-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        fetchRoster();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchReports = async (month: string) => {
    try {
      const res = await fetch(`/api/admin/reports?month=${month}`);
      const data = await res.json();
      setReports(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    setLoading(true);
    if (activeTab === 'roster') {
      fetchRoster().then(() => setLoading(false));
    } else if (activeTab === 'reports') {
      fetchReports(selectedMonth).then(() => setLoading(false));
    } else if (activeTab === 'settings') {
      fetchSettings().then(() => setLoading(false));
    } else if (activeTab === 'users') {
      fetchUsers().then(() => setLoading(false));
    }
  }, [activeTab, selectedMonth]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const calculateTotalHours = (record: any) => {
    if (!record.check_in || !record.check_out) return '0h 0m';
    const start = new Date(record.check_in).getTime();
    const end = new Date(record.check_out).getTime();
    let totalMs = end - start;

    // Subtract break times
    if (record.breaks && Array.isArray(record.breaks)) {
      record.breaks.forEach((b: any) => {
        if (b.start && b.end) {
          totalMs -= new Date(b.end).getTime() - new Date(b.start).getTime();
        }
      });
    }

    const hours = Math.floor(totalMs / (1000 * 60 * 60));
    const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const statusColors: Record<string, string> = {
    'Not Checked In': 'bg-slate-100 text-slate-600',
    'Checked In': 'bg-emerald-100 text-emerald-700',
    'On Break': 'bg-amber-100 text-amber-700',
    'Checked Out': 'bg-indigo-100 text-indigo-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 p-1">
        <button
          onClick={() => setActiveTab('roster')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'roster' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" />
          {t('roster')}
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'reports' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-4 h-4" />
          {t('reports')}
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'users' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <UserIcon className="w-4 h-4" />
          Users
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'settings' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <SettingsIcon className="w-4 h-4" />
          Settings
        </button>
      </div>

      {activeTab === 'roster' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900 mb-6 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            {t('roster')} - {format(new Date(), 'MMM d, yyyy')}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-sm text-slate-500">
                  <th className="pb-3 font-medium">{t('name')}</th>
                  <th className="pb-3 font-medium">Device ID</th>
                  <th className="pb-3 font-medium">{t('checkIn')}</th>
                  <th className="pb-3 font-medium">{t('status')}</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roster.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 text-sm">
                      {t('noRecords')}
                    </td>
                  </tr>
                ) : (
                  roster.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="py-4 text-sm font-medium text-slate-900">
                        <div>{item.name}</div>
                        <div className="text-xs text-slate-500 font-normal">{item.email}</div>
                      </td>
                      <td className="py-4 text-sm text-slate-500 font-mono text-xs">
                        {item.device_id ? (
                          <div className="flex items-center gap-1">
                            <Smartphone className="w-3 h-3" />
                            {item.device_id.substring(0, 12)}...
                          </div>
                        ) : (
                          <span className="text-slate-300 italic">Not bound</span>
                        )}
                      </td>
                      <td className="py-4 text-sm text-slate-600">
                        {item.check_in ? format(new Date(item.check_in), 'hh:mm a') : '-'}
                      </td>
                      <td className="py-4 text-sm">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${statusColors[item.status]}`}>
                          {t(item.status.replace(/ /g, '').replace(/^./, (str: string) => str.toLowerCase()) || 'notCheckedIn')}
                        </span>
                      </td>
                      <td className="py-4 text-sm text-right">
                        {item.device_id && (
                          <button
                            onClick={() => handleResetDevice(item.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Reset Device Binding"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              {t('reports')}
            </h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                <Download className="w-4 h-4" />
                {t('generateReport')}
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-sm text-slate-500">
                  <th className="pb-3 font-medium">{t('date')}</th>
                  <th className="pb-3 font-medium">{t('name')}</th>
                  <th className="pb-3 font-medium">{t('checkIn')}</th>
                  <th className="pb-3 font-medium">{t('checkOut')}</th>
                  <th className="pb-3 font-medium">{t('totalHours')}</th>
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 text-sm">
                      {t('noRecords')}
                    </td>
                  </tr>
                ) : (
                  reports.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="py-4 text-sm text-slate-900">{item.date}</td>
                      <td className="py-4 text-sm font-medium text-slate-900">{item.name}</td>
                      <td className="py-4 text-sm text-slate-600">
                        {item.check_in ? format(new Date(item.check_in), 'hh:mm a') : '-'}
                      </td>
                      <td className="py-4 text-sm text-slate-600">
                        {item.check_out ? format(new Date(item.check_out), 'hh:mm a') : '-'}
                      </td>
                      <td className="py-4 text-sm font-medium text-indigo-600">
                        {calculateTotalHours(item)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-6">
          {selectedEmployee ? (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <button
                onClick={() => setSelectedEmployee(null)}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Users
              </button>
              
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{selectedEmployee.name}</h2>
                  <p className="text-slate-500">{selectedEmployee.email}</p>
                </div>
                <div className="grid grid-cols-3 gap-4 w-full md:w-auto">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Total Hours</p>
                    <p className="text-xl font-bold text-indigo-600">{analytics?.totalHours || 0}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Days Worked</p>
                    <p className="text-xl font-bold text-emerald-600">{analytics?.daysWorked || 0}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Avg Check-In</p>
                    <p className="text-xl font-bold text-amber-600">{analytics?.avgCheckIn || '--:--'}</p>
                  </div>
                </div>
              </div>

              <div className="h-[300px] w-full mt-8">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Daily Work Hours (Last 30 Days)</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics?.history || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      tickFormatter={(val) => format(new Date(val), 'MMM d')}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      cursor={{ fill: '#f8fafc' }}
                    />
                    <Bar dataKey="hours" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-indigo-500" />
                  Employee Management
                </h2>
                <button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  {showCreateForm ? 'Cancel' : 'Add Employee'}
                </button>
              </div>

              {deleteError && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
                  {deleteError}
                </div>
              )}

              {showCreateForm && (
                <form onSubmit={handleCreateUser} className="mb-8 p-6 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Create New Employee</h3>
                  {createError && <p className="text-xs text-red-600">{createError}</p>}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input
                      type="text"
                      placeholder="Full Name"
                      required
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <input
                      type="email"
                      placeholder="Email Address"
                      required
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      required
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
                  >
                    Create Employee
                  </button>
                </form>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-sm text-slate-500">
                      <th className="pb-3 font-medium">Name</th>
                      <th className="pb-3 font-medium">Email</th>
                      <th className="pb-3 font-medium">Role</th>
                      <th className="pb-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.filter(u => u.role === 'employee').map((u) => (
                      <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <td className="py-4 text-sm font-medium text-slate-900">{u.name}</td>
                        <td className="py-4 text-sm text-slate-500">{u.email}</td>
                        <td className="py-4 text-sm">
                          <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium uppercase">
                            {u.role}
                          </span>
                        </td>
                        <td className="py-4 text-sm text-right space-x-2">
                          <button
                            onClick={() => {
                              setSelectedEmployee(u);
                              fetchAnalytics(u.id);
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="View Analytics"
                          >
                            <BarChart3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
      {activeTab === 'settings' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900 mb-6 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-indigo-500" />
            Office Wi-Fi Settings
          </h2>
          
          <form onSubmit={handleSaveSettings} className="max-w-md space-y-6">
            {saveSuccess && (
              <div className="bg-emerald-50 text-emerald-600 p-4 rounded-xl flex items-center gap-2 text-sm">
                <CheckCircle className="w-5 h-5" />
                Settings saved successfully!
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Office Wi-Fi SSID</label>
              <input
                type="text"
                value={settings.office_ssid}
                onChange={(e) => setSettings({ ...settings, office_ssid: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="e.g. OfficeNetwork_5G"
              />
              <p className="text-xs text-slate-500 mt-1">The name of the Wi-Fi network employees should be connected to.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Office Public IP Address</label>
              <input
                type="text"
                value={settings.office_ip}
                onChange={(e) => setSettings({ ...settings, office_ip: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="e.g. 203.0.113.1"
              />
              <p className="text-xs text-slate-500 mt-1">The public IP address of the office network. Use 0.0.0.0 to allow any IP.</p>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-xl transition-colors shadow-sm"
            >
              <Save className="w-4 h-4" />
              Save Settings
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
