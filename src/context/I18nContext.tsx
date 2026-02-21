import React, { createContext, useContext, useState } from 'react';

type Language = 'en' | 'bn';

type Translations = {
  [key in Language]: {
    [key: string]: string;
  };
};

const translations: Translations = {
  en: {
    login: 'Login',
    email: 'Email',
    emailOrName: 'Email or Name',
    password: 'Password',
    employeeDashboard: 'Employee Dashboard',
    adminDashboard: 'Admin Dashboard',
    checkIn: 'Check In',
    checkOut: 'Check Out',
    startBreak: 'Start Break',
    endBreak: 'End Break',
    status: 'Status',
    history: 'Monthly History',
    roster: 'Live Roster',
    reports: 'Reports',
    logout: 'Logout',
    notCheckedIn: 'Not Checked In',
    checkedIn: 'Checked In',
    onBreak: 'On Break',
    checkedOut: 'Checked Out',
    officeWifiRequired: 'Must be connected to Office Wi-Fi to check in.',
    simulateWifi: 'Simulate Office Wi-Fi Connection',
    date: 'Date',
    totalHours: 'Total Hours',
    name: 'Name',
    role: 'Role',
    generateReport: 'Generate Report',
    welcome: 'Welcome',
    noRecords: 'No records found.',
    createAccount: 'Create Account',
    joinSystem: 'Join our employee attendance system',
    fullName: 'Full Name',
    signUp: 'Sign Up',
    alreadyHaveAccount: 'Already have an account?',
  },
  bn: {
    login: 'লগইন',
    email: 'ইমেইল',
    emailOrName: 'ইমেইল বা নাম',
    password: 'পাসওয়ার্ড',
    employeeDashboard: 'কর্মচারী ড্যাশবোর্ড',
    adminDashboard: 'অ্যাডমিন ড্যাশবোর্ড',
    checkIn: 'চেক ইন',
    checkOut: 'চেক আউট',
    startBreak: 'বিরতি শুরু',
    endBreak: 'বিরতি শেষ',
    status: 'অবস্থা',
    history: 'মাসিক ইতিহাস',
    roster: 'লাইভ রোস্টার',
    reports: 'রিপোর্ট',
    logout: 'লগআউট',
    notCheckedIn: 'চেক ইন করা হয়নি',
    checkedIn: 'চেক ইন করা হয়েছে',
    onBreak: 'বিরতিতে',
    checkedOut: 'চেক আউট করা হয়েছে',
    officeWifiRequired: 'চেক ইন করতে অফিস ওয়াই-ফাই এর সাথে সংযুক্ত থাকতে হবে।',
    simulateWifi: 'অফিস ওয়াই-ফাই সংযোগ অনুকরণ করুন',
    date: 'তারিখ',
    totalHours: 'মোট ঘন্টা',
    name: 'নাম',
    role: 'ভূমিকা',
    generateReport: 'রিপোর্ট তৈরি করুন',
    welcome: 'স্বাগতম',
    noRecords: 'কোনো রেকর্ড পাওয়া যায়নি।',
    createAccount: 'অ্যাকাউন্ট তৈরি করুন',
    joinSystem: 'আমাদের কর্মচারী উপস্থিতি সিস্টেমে যোগ দিন',
    fullName: 'পুরো নাম',
    signUp: 'সাইন আপ',
    alreadyHaveAccount: 'ইতিমধ্যে একটি অ্যাকাউন্ট আছে?',
  },
};

type I18nContextType = {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('lang') as Language) || 'en';
  });

  const handleSetLang = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('lang', newLang);
  };

  const t = (key: string) => {
    return translations[lang][key] || key;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang: handleSetLang, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
