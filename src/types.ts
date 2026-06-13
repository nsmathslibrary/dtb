export interface CandidateInfo {
  name: string;
  email: string;
  phone: string;
  dob: string;
  category: string;
  stream: string;
  examCenter: string;
  fatherName: string;
  motherName: string;
  address: string;
  maktab: string;
  acceptedTerms: boolean;
}

export interface PaymentInfo {
  cardNumber?: string;
  cardName?: string;
  expiry?: string;
  cvv?: string;
  upiId?: string;
  method: 'card' | 'upi' | 'netbanking';
  amount: number;
  transactionId: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
}

export interface RegistrationRecord {
  regId: string;
  name: string;
  email: string;
  phone: string;
  dob: string;
  category: string;
  stream: string;
  examCenter: string;
  fatherName: string;
  motherName: string;
  address: string;
  maktab: string;
  paymentStatus: string;
  paymentAmount: string;
  transactionId: string;
  fileName: string;
  fileId: string;
  regTime: string;
}

export const STREAMS = [
  { id: 'class-1', name: 'Class I (Primary Diniyat)', code: 'DTB-C1', date: 'July 15, 2026', time: '09:00 AM - 12:00 PM' },
  { id: 'class-2', name: 'Class II (Primary Diniyat)', code: 'DTB-C2', date: 'July 15, 2026', time: '02:00 PM - 05:00 PM' },
  { id: 'class-3', name: 'Class III (Primary Diniyat)', code: 'DTB-C3', date: 'July 16, 2026', time: '09:00 AM - 12:00 PM' },
  { id: 'class-4', name: 'Class IV (Primary Diniyat)', code: 'DTB-C4', date: 'July 16, 2026', time: '02:00 PM - 05:00 PM' },
  { id: 'class-5', name: 'Class V (Diniyat Secondary)', code: 'DTB-C5', date: 'July 17, 2026', time: '09:00 AM - 12:00 PM' },
  { id: 'hifz', name: 'Hifzil Quran (Memorization)', code: 'DTB-HQ', date: 'July 17, 2026', time: '02:00 PM - 05:00 PM' },
];

export const CATEGORIES = [
  { id: 'General', name: 'General Student', fee: 200 },
  { id: 'Orphan', name: 'Orphan Student (Waived)', fee: 0 },
  { id: 'Destitute', name: 'Zakat Eligible / Destitute', fee: 50 },
  { id: 'Subsidized', name: 'Madrasa Subsidized Student', fee: 100 },
];

export const CENTERS = [
  { id: 'center-1', name: 'Babupara Jama Masjid Assessment Hall, Imphal' },
  { id: 'center-2', name: 'Lilong Haoreibi Central Madrasa Campus, Thoubal' },
  { id: 'center-3', name: 'Imphal East Markaz Venue, Khabeisoi' },
  { id: 'center-4', name: 'Yairipok Integrated Islamic Complex, Thoubal' },
];

export const MAKTABS = [
  { id: 'maktab-1', name: 'Babupara Primary Maktab, Imphal' },
  { id: 'maktab-2', name: 'Lilong Haoreibi Islamic Maktab, Thoubal' },
  { id: 'maktab-3', name: 'Khabeisoi Markaz Maktab, Imphal East' },
  { id: 'maktab-4', name: 'Yairipok Ningthounai Maktab, Thoubal' },
  { id: 'maktab-5', name: 'Sajiwa Maktab, Imphal East' },
  { id: 'maktab-6', name: 'Mayang Imphal Central Maktab, Imphal West' },
  { id: 'maktab-other', name: 'Other Maktab / Custom Madrasa' },
];
