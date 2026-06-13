import React, { useState } from 'react';
import { CandidateInfo, PaymentInfo, STREAMS, CATEGORIES, CENTERS, MAKTABS } from '../types';
import { findOrCreateFolder, findOrCreateSpreadsheet, uploadPhotoToDrive, appendRegistration } from '../googleApi';
import { User, Phone, Mail, Calendar, Briefcase, MapPin, Upload, X, Shield, Landmark, ArrowRight, CreditCard, RefreshCw, Layers, CheckCircle2, CloudLightning, Home, Landmark as MosqueIcon, FileCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface RegistrationFormProps {
  accessToken: string;
  onSuccess: (record: any) => void;
  userEmail: string;
}

type Step = 'details' | 'photo' | 'payment' | 'sync';

export default function RegistrationForm({ accessToken, onSuccess, userEmail }: RegistrationFormProps) {
  // Candidate Information State
  const [candidate, setCandidate] = useState<CandidateInfo>({
    name: '',
    email: userEmail || '',
    phone: '',
    dob: '',
    category: 'General',
    stream: 'class-1',
    examCenter: 'center-1',
    fatherName: '',
    motherName: '',
    address: '',
    maktab: 'maktab-1',
    acceptedTerms: false,
  });

  // Photo State
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Payment State
  const [payment, setPayment] = useState<PaymentInfo>({
    method: 'upi',
    amount: 200, // Matching default fee
    status: 'PENDING',
    transactionId: '',
  });

  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [cardDetails, setCardDetails] = useState({ number: '', name: '', expiry: '', cvv: '' });
  const [upiId, setUpiId] = useState('');

  // Sync / App State
  const [currentStep, setCurrentStep] = useState<Step>('details');
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [syncProgress, setSyncProgress] = useState(0); // 0 to 100
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMess, setErrorMess] = useState<string | null>(null);

  // Validation states
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Computed Values
  const selectedCategoryObj = CATEGORIES.find(c => c.id === candidate.category) || CATEGORIES[0];
  const feeAmount = selectedCategoryObj.fee;

  // File drop/upload handlers
  const handleFileChange = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (JPEG/PNG)');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Photo must be less than 2MB');
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  // Step 1 Validation
  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (!candidate.name.trim()) errs.name = 'Student Name is required';
    if (!candidate.fatherName.trim()) errs.fatherName = "Father's Name is required";
    if (!candidate.motherName.trim()) errs.motherName = "Mother's Name is required";
    if (!candidate.email.trim() || !/\S+@\S+\.\S+/.test(candidate.email)) errs.email = 'Valid email is required';
    if (!candidate.phone.trim() || !/^\d{10,12}$/.test(candidate.phone)) errs.phone = 'Valid 10-12 digit phone number';
    if (!candidate.dob) errs.dob = 'Date of birth is required';
    if (!candidate.address.trim()) errs.address = 'Detailed address is required';
    if (!candidate.maktab) errs.maktab = 'Please select your Maktab from dropdown';
    if (!candidate.acceptedTerms) errs.acceptedTerms = 'You must accept the terms & conditions';
    
    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const goToPhoto = () => {
    if (validateForm()) {
      setCurrentStep('photo');
    }
  };

  const goToPayment = () => {
    if (!photoFile) {
      alert('Please upload your passport size photo before moving forward.');
      return;
    }
    setPayment(p => ({ ...p, amount: feeAmount }));
    // If fee is 0, skip fake payment gateway screen and trigger sync immediately as Waived.
    if (feeAmount === 0) {
      setCurrentStep('sync');
      triggerSyncToWorkspace('WAIVED-000000');
    } else {
      setCurrentStep('payment');
    }
  };

  // Mock secure processing
  const processMockPayment = () => {
    if (payment.method === 'card') {
      if (!cardDetails.number || !cardDetails.name || !cardDetails.expiry || !cardDetails.cvv) {
        alert('Please fill out all card details to proceed with the payment.');
        return;
      }
    } else {
      if (!upiId || !upiId.includes('@')) {
        alert('Please enter a valid UPI ID (e.g. resident@ybl)');
        return;
      }
    }

    setPaymentProcessing(true);
    setTimeout(() => {
      const generatedTx = `TXN-${Math.floor(100000 + Math.random() * 900000)}`;
      setPayment(p => ({
        ...p,
        status: 'SUCCESS',
        transactionId: generatedTx,
      }));
      setPaymentProcessing(false);
      
      // Advance to actual Drive / Sheets synchronization step
      setCurrentStep('sync');
      triggerSyncToWorkspace(generatedTx);
    }, 2000);
  };

  // Step 4: Write to Drive Folder & Sheets spreadsheet
  const triggerSyncToWorkspace = async (txnId: string) => {
    setIsSyncing(true);
    setSyncProgress(10);
    setErrorMess(null);
    setSyncLogs(['Initiating dynamic workspace sync with Google Services...', 'Capturing access tokens...']);

    try {
      // 1. Find or create Drive Folder
      setSyncLogs(prev => [...prev, 'Creating/Checking folder "DTB Manipur registration files" on Google Drive...']);
      setSyncProgress(30);
      const folderId = await findOrCreateFolder(accessToken, 'DTB Manipur registration files');
      setSyncLogs(prev => [...prev, `Google Drive folder locked. ID: ${folderId.substring(0, 8)}...`]);

      // 2. Find or create Spreadsheet
      setSyncLogs(prev => [...prev, 'Searching/Creating spreadsheet "DTB Manipur Registrations" in Drive...']);
      setSyncProgress(50);
      const spreadsheetId = await findOrCreateSpreadsheet(accessToken, 'DTB Manipur Registrations');
      setSyncLogs(prev => [...prev, `Target spreadsheet synchronized. Spreadsheet ID: ${spreadsheetId.substring(0, 8)}...`]);

      // 3. Upload File
      setSyncLogs(prev => [...prev, 'Uploading student passport photo to Google Drive...']);
      setSyncProgress(70);
      const sanitizedName = candidate.name.replace(/\s+/g, '_').toLowerCase();
      const uniqueFileName = `${sanitizedName}_photo_${Date.now()}.png`;
      const uploadedFileId = await uploadPhotoToDrive(accessToken, folderId, uniqueFileName, photoFile!);
      setSyncLogs(prev => [...prev, `Passport photo successfully uploaded! File ID: ${uploadedFileId.substring(0, 8)}...`]);

      // 4. Append row to Sheet
      setSyncLogs(prev => [...prev, 'Writing student registration info to Google Sheets database...']);
      setSyncProgress(90);
      const registrationCode = `DTB-2026-${Math.floor(10000 + Math.random() * 90000)}`;
      const timestamp = new Date().toISOString();

      await appendRegistration(accessToken, spreadsheetId, {
        regId: registrationCode,
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        dob: candidate.dob,
        category: candidate.category,
        stream: candidate.stream,
        examCenter: candidate.examCenter,
        fatherName: candidate.fatherName,
        motherName: candidate.motherName,
        address: candidate.address,
        maktab: candidate.maktab,
        paymentStatus: feeAmount === 0 ? 'WAIVED' : 'SUCCESS',
        paymentAmount: feeAmount.toString(),
        transactionId: txnId,
        fileName: uniqueFileName,
        fileId: uploadedFileId,
        regTime: timestamp,
      });

      setSyncLogs(prev => [...prev, 'Row appended successfully!', 'Dynamic Admit Card generated!', 'Workspace Sync Complete! 🎉']);
      setSyncProgress(100);
      setIsSyncing(false);

      // Transition to final view after 1s delay
      setTimeout(() => {
        onSuccess({
          regId: registrationCode,
          name: candidate.name,
          email: candidate.email,
          phone: candidate.phone,
          dob: candidate.dob,
          category: candidate.category,
          stream: candidate.stream,
          examCenter: candidate.examCenter,
          fatherName: candidate.fatherName,
          motherName: candidate.motherName,
          address: candidate.address,
          maktab: candidate.maktab,
          fileId: uploadedFileId,
          transactionId: txnId,
          regTime: timestamp,
          spreadsheetId
        });
      }, 1200);

    } catch (err: any) {
      console.error(err);
      setErrorMess(err.message || 'An unexpected error occurred while saving your data. Please check your internet connection or Google Auth permissions.');
      setIsSyncing(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-[#14161C] rounded-2xl shadow-xl border border-slate-800 overflow-hidden" id="exam-registration-component">
      {/* Visual Stepper Indicators */}
      <div className="bg-[#0F1116] border-b border-slate-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-1.5">
          <Layers className="w-5 h-5 text-emerald-400" />
          <h3 className="font-bold text-white font-sans tracking-tight">Registration Form</h3>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
          <span className={`px-2 py-1 rounded ${currentStep === 'details' ? 'bg-emerald-500 text-black' : 'bg-[#1C1F26] text-slate-400'}`}>1. Profile</span>
          <ArrowRight className="w-3 h-3 text-slate-600" />
          <span className={`px-2 py-1 rounded ${currentStep === 'photo' ? 'bg-emerald-500 text-black' : 'bg-[#1C1F26] text-slate-400'}`}>2. Photo</span>
          <ArrowRight className="w-3 h-3 text-slate-600" />
          <span className={`px-2 py-1 rounded ${currentStep === 'payment' ? 'bg-emerald-500 text-black' : 'bg-[#1C1F26] text-slate-400'}`}>3. Gate</span>
          <ArrowRight className="w-3 h-3 text-slate-600" />
          <span className={`px-2 py-1 rounded ${currentStep === 'sync' ? 'bg-emerald-500 text-black' : 'bg-[#1C1F26] text-slate-400'}`}>4. Sync</span>
        </div>
      </div>

      <div className="p-6 md:p-8">
        <AnimatePresence mode="wait">
                  {/* Step 1: Candidate Details */}
          {currentStep === 'details' && (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h4 className="text-lg font-bold text-white">Student Demographics</h4>
                <p className="text-xs text-slate-400">Provide official details as required for DTB Board enrollment.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Student Name */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-400" /> Student Name
                  </label>
                  <input
                    type="text"
                    value={candidate.name}
                    onChange={e => setCandidate({ ...candidate, name: e.target.value })}
                    placeholder="Enter Student Name"
                    className={`w-full bg-[#1C1F26] border rounded-lg px-3 py-2 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none ${validationErrors.name ? 'border-rose-500 focus:ring-1 focus:ring-rose-500 focus:border-rose-500' : 'border-slate-700 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500'}`}
                    id="input-name"
                  />
                  {validationErrors.name && <span className="text-[10px] text-rose-450">{validationErrors.name}</span>}
                </div>

                {/* Father Name */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-400" /> Father's Name
                  </label>
                  <input
                    type="text"
                    value={candidate.fatherName}
                    onChange={e => setCandidate({ ...candidate, fatherName: e.target.value })}
                    placeholder="Enter Father's Name"
                    className={`w-full bg-[#1C1F26] border rounded-lg px-3 py-2 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none ${validationErrors.fatherName ? 'border-rose-500 focus:ring-1 focus:ring-rose-500 focus:border-rose-500' : 'border-slate-700 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500'}`}
                    id="input-father-name"
                  />
                  {validationErrors.fatherName && <span className="text-[10px] text-rose-450">{validationErrors.fatherName}</span>}
                </div>

                {/* Mother Name */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-400" /> Mother's Name
                  </label>
                  <input
                    type="text"
                    value={candidate.motherName}
                    onChange={e => setCandidate({ ...candidate, motherName: e.target.value })}
                    placeholder="Enter Mother's Name"
                    className={`w-full bg-[#1C1F26] border rounded-lg px-3 py-2 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none ${validationErrors.motherName ? 'border-rose-500 focus:ring-1 focus:ring-rose-500 focus:border-rose-500' : 'border-slate-700 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500'}`}
                    id="input-mother-name"
                  />
                  {validationErrors.motherName && <span className="text-[10px] text-rose-450">{validationErrors.motherName}</span>}
                </div>

                {/* Date of Birth */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" /> Date of Birth
                  </label>
                  <input
                    type="date"
                    value={candidate.dob}
                    onChange={e => setCandidate({ ...candidate, dob: e.target.value })}
                    className={`w-full bg-[#1C1F26] border rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none ${validationErrors.dob ? 'border-rose-500 focus:ring-1 focus:ring-rose-500 focus:border-rose-500' : 'border-slate-700 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500'}`}
                    id="input-dob"
                  />
                  {validationErrors.dob && <span className="text-[10px] text-rose-455">{validationErrors.dob}</span>}
                </div>

                {/* Mobile Number */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-500" /> Mobile Number
                  </label>
                  <input
                    type="tel"
                    value={candidate.phone}
                    onChange={e => setCandidate({ ...candidate, phone: e.target.value })}
                    placeholder="10-12 digit mobile number"
                    className={`w-full bg-[#1C1F26] border rounded-lg px-3 py-2 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none ${validationErrors.phone ? 'border-rose-500 focus:ring-1 focus:ring-rose-500 focus:border-rose-500' : 'border-slate-700 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500'}`}
                    id="input-phone"
                  />
                  {validationErrors.phone && <span className="text-[10px] text-rose-455">{validationErrors.phone}</span>}
                </div>

                {/* Email */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-500" /> Email Address
                  </label>
                  <input
                    type="email"
                    value={candidate.email}
                    onChange={e => setCandidate({ ...candidate, email: e.target.value })}
                    placeholder="e.g. name@domain.com"
                    className={`w-full bg-[#1C1F26] border rounded-lg px-3 py-2 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none ${validationErrors.email ? 'border-rose-500 focus:ring-1 focus:ring-rose-500 focus:border-rose-500' : 'border-slate-700 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500'}`}
                    id="input-email"
                  />
                  {validationErrors.email && <span className="text-[10px] text-rose-455">{validationErrors.email}</span>}
                </div>

                {/* Select Maktab Dropdown */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
                    <MosqueIcon className="w-3.5 h-3.5 text-emerald-400" /> Select Maktab
                  </label>
                  <select
                    value={candidate.maktab}
                    onChange={e => setCandidate({ ...candidate, maktab: e.target.value })}
                    className="w-full bg-[#1C1F26] border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    id="select-maktab"
                  >
                    {MAKTABS.map(m => (
                      <option key={m.id} value={m.name} className="bg-[#1C1F26] text-slate-300">
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Class Course */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-500" /> Course / Class exam
                  </label>
                  <select
                    value={candidate.stream}
                    onChange={e => setCandidate({ ...candidate, stream: e.target.value })}
                    className="w-full bg-[#1C1F26] border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    id="select-stream"
                  >
                    {STREAMS.map(stream => (
                      <option key={stream.id} value={stream.id} className="bg-[#1C1F26] text-slate-300">
                        {stream.name} ({stream.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category Option */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-slate-500" /> Student Category
                  </label>
                  <select
                    value={candidate.category}
                    onChange={e => setCandidate({ ...candidate, category: e.target.value })}
                    className="w-full bg-[#1C1F26] border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    id="select-category"
                  >
                    {CATEGORIES.map(category => (
                      <option key={category.id} value={category.id} className="bg-[#1C1F26] text-slate-300">
                        {category.name} (Fee: ₹{category.fee})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Exam Center Venue */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" /> Preferred Exam Center
                  </label>
                  <select
                    value={candidate.examCenter}
                    onChange={e => setCandidate({ ...candidate, examCenter: e.target.value })}
                    className="w-full bg-[#1C1F26] border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    id="select-center"
                  >
                    {CENTERS.map(center => (
                      <option key={center.id} value={center.id} className="bg-[#1C1F26] text-slate-300">
                        {center.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Address Box */}
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
                    <Home className="w-3.5 h-3.5 text-slate-500" /> Address Details
                  </label>
                  <textarea
                    rows={2}
                    value={candidate.address}
                    onChange={e => setCandidate({ ...candidate, address: e.target.value })}
                    placeholder="Enter permanent or current residential address (Street, Village/Town, District, Pin Code)"
                    className={`w-full bg-[#1C1F26] border rounded-lg px-3 py-2 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none ${validationErrors.address ? 'border-rose-500 focus:ring-1 focus:ring-rose-500 focus:border-rose-500' : 'border-slate-700 focus:ring-1 focus:ring-emerald-500'}`}
                    id="input-address"
                  />
                  {validationErrors.address && <span className="text-[10px] text-rose-455">{validationErrors.address}</span>}
                </div>

                {/* Terms Acceptance checkmark */}
                <div className="flex flex-col gap-1 md:col-span-2 mt-2 bg-[#1C1F26] border border-slate-800 p-3.5 rounded-lg">
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs select-none">
                    <input
                      type="checkbox"
                      checked={candidate.acceptedTerms}
                      onChange={e => setCandidate({ ...candidate, acceptedTerms: e.target.checked })}
                      className="w-4.5 h-4.5 rounded text-emerald-500 bg-[#14161C] border-slate-700 mt-0.5 focus:ring-emerald-500 focus:ring-1 cursor-pointer"
                      id="input-terms"
                    />
                    <span className="text-slate-300 font-normal leading-relaxed">
                      I hereby accept all terms & conditions and declare that all details supplied for enrollment under <strong className="text-white hover:underline">Deeni Ta'leemi Board, Manipur</strong> are correct and authentic.
                    </span>
                  </label>
                  {validationErrors.acceptedTerms && <span className="text-[10px] text-rose-455 mt-1">{validationErrors.acceptedTerms}</span>}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={goToPhoto}
                  className="flex items-center gap-2 bg-emerald-500 text-black hover:bg-emerald-400 font-bold py-2.5 px-6 rounded-lg shadow-md cursor-pointer transition-colors"
                  id="submit-step-1"
                >
                  <span>Upload passport photo</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Photo Upload */}
          {currentStep === 'photo' && (
            <motion.div
              key="photo"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h4 className="text-lg font-bold text-white">Upload Formal Passport Photo</h4>
                <p className="text-xs text-slate-400">
                  Your photo must be clear, high-contrast, facing front with a light solid background (Max 2MB).
                </p>
              </div>

              {/* Large Interactive Upload Area */}
              {!photoPreview ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-3 transition-colors bg-[#1C1F26] ${
                    isDragging ? 'border-emerald-500 bg-[#252a33]' : 'border-slate-700 hover:border-emerald-500/50'
                  }`}
                >
                  <div className="w-12 h-12 bg-[#14161C] border border-slate-800 rounded-xl flex items-center justify-center text-emerald-400">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Drag & Drop your passport photo</p>
                    <p className="text-xs text-slate-500 mt-1">Acceptable formats: JPEG, JPG, PNG (Max size: 2MB)</p>
                  </div>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      id="input-photo-file"
                    />
                    <button className="bg-[#14161C] hover:bg-[#252a33] border border-slate-700 text-slate-305 text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer">
                      Browse Files
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative w-44 h-52 bg-[#1C1F26] border-2 border-slate-700 rounded-lg overflow-hidden shadow-md flex items-center justify-center group">
                    <img src={photoPreview} alt="Passport preview" className="w-full h-full object-cover" />
                    <button
                      onClick={removePhoto}
                      className="absolute top-2 right-2 bg-rose-600 hover:bg-rose-750 text-white p-1 rounded-full shadow-md transition-colors cursor-pointer"
                      title="Remove image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-slate-300">{photoFile?.name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{(photoFile!.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
              )}

              {/* Info Frame */}
              <div className="p-3 bg-[#1C1F26] border border-slate-800 rounded-xl flex items-start gap-2.5 text-xs text-slate-400">
                <Shield className="w-4 h-4 text-emerald-450 mt-0.5 shrink-0" />
                <span>
                  This photo will be locked on your provisional E-Admit Card and cross-verified during lab biometrics.
                </span>
              </div>

              {/* Navigation Actions */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                <button
                  onClick={() => setCurrentStep('details')}
                  className="text-slate-400 hover:text-white font-semibold text-sm py-2 bg-[#1C1F26] px-4 rounded-lg cursor-pointer hover:bg-[#252a33] transition-colors"
                  id="photo-back-btn"
                >
                  Go Back
                </button>
                <button
                  onClick={goToPayment}
                  disabled={!photoFile}
                  className={`flex items-center gap-2 font-bold py-2.5 px-6 rounded-lg shadow-md cursor-pointer transition-colors ${
                    photoFile ? 'bg-emerald-500 text-black hover:bg-emerald-400' : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  }`}
                  id="photo-next-btn"
                >
                  <span>Proceed to Payment</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Payment */}
          {currentStep === 'payment' && (
            <motion.div
              key="payment"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h4 className="text-lg font-bold text-white">Application Fee Processing</h4>
                <p className="text-xs text-slate-400 font-normal">
                  Dynamic invoice generated matching your criteria category: <span className="text-white font-bold underline capitalize">{selectedCategoryObj.name}</span>
                </p>
              </div>

              {/* Fee Bill Board */}
              <div className="bg-[#1C1F26] text-white border border-slate-800 rounded-2xl p-5 flex justify-between items-center relative overflow-hidden">
                <div className="space-y-1 z-10">
                  <p className="text-xs text-slate-400 tracking-wider font-semibold uppercase">Total Outstanding Fee</p>
                  <p className="text-3xl font-extrabold tracking-tight text-emerald-400">₹{feeAmount}</p>
                </div>
                <div className="z-10 text-right space-y-1">
                  <p className="text-xs text-slate-405 uppercase tracking-widest font-semibold font-mono">Status</p>
                  <span className="inline-block bg-amber-500/10 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-500/25">
                    Awaiting Payment
                  </span>
                </div>
                {/* Background ambient bubble */}
                <span className="absolute -right-10 -bottom-10 w-28 h-28 bg-white/5 rounded-full blur-xl" />
              </div>

              {/* Mode Selections */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPayment(p => ({ ...p, method: 'card' }))}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                    payment.method === 'card' ? 'border-emerald-500 bg-[#1C1F26] shadow-md' : 'border-slate-800 hover:border-slate-700 bg-[#14161C] text-slate-400'
                  }`}
                >
                  <CreditCard className={`w-5 h-5 ${payment.method === 'card' ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <span className="text-xs font-bold">Credit / Debit Card</span>
                </button>
                <button
                  onClick={() => setPayment(p => ({ ...p, method: 'upi' }))}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                    payment.method === 'upi' ? 'border-emerald-500 bg-[#1C1F26] shadow-md' : 'border-slate-800 hover:border-slate-700 bg-[#14161C] text-slate-400'
                  }`}
                >
                  <Landmark className={`w-5 h-5 ${payment.method === 'upi' ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <span className="text-xs font-bold">UPI Instant Pay</span>
                </button>
              </div>

              {/* Method Forms */}
              {payment.method === 'card' ? (
                <div className="space-y-3.5 bg-[#1C1F26] p-4 rounded-xl border border-slate-800">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-405 uppercase tracking-wider">Card Number</label>
                    <input
                      type="text"
                      maxLength={16}
                      value={cardDetails.number}
                      onChange={e => setCardDetails({ ...cardDetails, number: e.target.value.replace(/\D/g, '') })}
                      placeholder="XXXX XXXX XXXX XXXX"
                      className="bg-[#14161C] border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      id="card-num"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-405 uppercase tracking-wider">Card Holder Name</label>
                    <input
                      type="text"
                      value={cardDetails.name}
                      onChange={e => setCardDetails({ ...cardDetails, name: e.target.value })}
                      placeholder="e.g. JOHN DOE"
                      className="bg-[#14161C] border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 uppercase"
                      id="card-name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-405 uppercase tracking-wider">Expiry Date</label>
                      <input
                        type="text"
                        maxLength={5}
                        placeholder="MM/YY"
                        value={cardDetails.expiry}
                        onChange={e => setCardDetails({ ...cardDetails, expiry: e.target.value })}
                        className="bg-[#14161C] border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm placeholder:text-slate-605 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                        id="card-expiry"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-405 uppercase tracking-wider">CVV Code</label>
                      <input
                        type="password"
                        maxLength={3}
                        placeholder="***"
                        value={cardDetails.cvv}
                        onChange={e => setCardDetails({ ...cardDetails, cvv: e.target.value.replace(/\D/g, '') })}
                        className="bg-[#14161C] border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm placeholder:text-slate-605 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                        id="card-cvv"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#1C1F26] p-5 rounded-xl border border-slate-800 flex flex-col items-center gap-4">
                  {/* Dynamic mock payment QR Code */}
                  <div className="bg-[#14161C] p-3 border border-slate-805 rounded-lg shadow-md">
                    <div className="w-36 h-36 border border-slate-800 flex items-center justify-center bg-[#1C1F26] select-none relative">
                      {/* Drawing a cute mock QR visual */}
                      <div className="absolute inset-2 border-2 border-emerald-500 border-dashed rounded opacity-35 animate-pulse" />
                      <div className="grid grid-cols-4 gap-1.5 p-2 w-full h-full">
                        <div className="bg-emerald-500 rounded-sm"></div>
                        <div className="bg-emerald-500 rounded-sm"></div>
                        <div className="bg-emerald-500 rounded-sm"></div>
                        <div className="bg-[#14161C] rounded-sm"></div>
                        <div className="bg-emerald-500 rounded-sm"></div>
                        <div className="bg-[#1C1F26] rounded-sm"></div>
                        <div className="bg-emerald-500 rounded-sm"></div>
                        <div className="bg-emerald-500 rounded-sm"></div>
                        <div className="bg-[#14161C] rounded-sm"></div>
                        <div className="bg-emerald-500 rounded-sm"></div>
                        <div className="bg-[#1C1F26] rounded-sm"></div>
                        <div className="bg-emerald-500 rounded-sm"></div>
                        <div className="bg-emerald-500 rounded-sm"></div>
                        <div className="bg-[#14161C] rounded-sm"></div>
                        <div className="bg-emerald-500 rounded-sm"></div>
                        <div className="bg-emerald-500 rounded-sm"></div>
                      </div>
                    </div>
                  </div>
                  <div className="w-full flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-405 uppercase tracking-wider">Enter UPI Address</label>
                    <input
                      type="text"
                      placeholder="e.g. john@ybl"
                      value={upiId}
                      onChange={e => setUpiId(e.target.value)}
                      className="bg-[#14161C] border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 w-full"
                      id="upi-address"
                    />
                  </div>
                </div>
              )}

              {/* Interactive payment validation trigger */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCurrentStep('photo')}
                  className="text-slate-405 hover:text-white font-semibold text-sm py-2 bg-[#1C1F26] px-4 rounded-lg cursor-pointer hover:bg-[#252a33] transition-colors"
                  id="pay-back-btn"
                >
                  Go Back
                </button>
                <button
                  onClick={processMockPayment}
                  disabled={paymentProcessing}
                  className="flex items-center gap-2 bg-emerald-500 text-black hover:bg-emerald-400 font-bold py-2.5 px-6 rounded-lg shadow-md cursor-pointer transition-all disabled:opacity-55"
                  id="pay-confirm-btn"
                >
                  {paymentProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Validating Secure Gateway...</span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 text-black" />
                      <span>Authorize Payment - ₹{feeAmount}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 4: Workspace Synchronization log board */}
          {currentStep === 'sync' && (
            <motion.div
              key="sync"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6 py-6"
            >
              <div className="text-center space-y-2">
                <h4 className="text-lg font-bold text-white flex items-center justify-center gap-1.5">
                  <CloudLightning className="w-5 h-5 text-emerald-400 animate-bounce" />
                  <span>Google Workspace Core Sync</span>
                </h4>
                <p className="text-xs text-slate-400">
                  Securing storage files, updating cloud registries...
                </p>
              </div>

              {/* Progress Indicator */}
              <div className="space-y-2">
                <div className="w-full h-2.5 bg-[#1C1F26] rounded-full overflow-hidden border border-slate-805">
                  <div
                    className="h-full bg-[#10b981] transition-all duration-300 rounded-full"
                    style={{ width: `${syncProgress}%` }}
                  />
                </div>
                <p className="text-right text-[10px] font-bold text-slate-400 font-mono">{syncProgress}% Complete</p>
              </div>

              {/* Logs Container */}
              <div className="bg-[#0F1116] text-[#A0AEC0] font-mono text-[11px] p-4 rounded-xl space-y-1.5 max-h-52 overflow-y-auto shadow-inner border border-slate-800">
                {syncLogs.map((log, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="text-[#4A5568] select-none">&gt;</span>
                    <span className={log.includes('Complete') || log.includes('successfully') ? 'text-emerald-400 font-bold' : log.includes('Folder') || log.includes('database') ? 'text-teal-400' : ''}>
                      {log}
                    </span>
                  </div>
                ))}
              </div>

              {/* Error Box */}
              {errorMess && (
                <div className="p-4 bg-rose-950/20 border border-rose-800/80 rounded-xl space-y-2 text-rose-200">
                  <p className="text-xs text-rose-450 font-medium">{errorMess}</p>
                  <button
                    onClick={() => triggerSyncToWorkspace(payment.transactionId)}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs py-1.5 px-3 rounded-lg transition-colors cursor-pointer"
                    id="retry-sync-btn"
                  >
                    Retry Workspace Sync
                  </button>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
