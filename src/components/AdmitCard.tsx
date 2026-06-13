import React, { useEffect, useState } from 'react';
import { fetchDriveFileBlobUrl } from '../googleApi';
import { STREAMS, CENTERS } from '../types';
import { Printer, Calendar, MapPin, User, FileText, CheckCircle, Smartphone, AlertTriangle, ArrowLeft } from 'lucide-react';

interface AdmitCardProps {
  registration: {
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
    fileId: string;
    transactionId: string;
    regTime: string;
  };
  accessToken: string;
  onBack?: () => void;
}

export default function AdmitCard({ registration, accessToken, onBack }: AdmitCardProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(true);
  const [photoError, setPhotoError] = useState(false);

  // Find stream details
  const streamInfo = STREAMS.find(s => s.id === registration.stream) || STREAMS[0];
  // Assign a deterministic exam center and roll number based on registration ID
  const rollNumber = `R-${registration.regId.split('-')[2] || '98734'}`;
  
  // Deterministic center selection
  const centerIndex = registration.regId ? Math.abs(registration.regId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % CENTERS.length : 0;
  const centerInfo = CENTERS[centerIndex];

  useEffect(() => {
    let active = true;
    async function loadPhoto() {
      if (!registration.fileId) {
        setIsLoadingPhoto(false);
        return;
      }
      setIsLoadingPhoto(true);
      try {
        const url = await fetchDriveFileBlobUrl(accessToken, registration.fileId);
        if (active) {
          setPhotoUrl(url);
          setPhotoError(false);
        }
      } catch (err) {
        console.error('Error fetching file from Drive:', err);
        if (active) {
          setPhotoError(true);
        }
      } finally {
        if (active) {
          setIsLoadingPhoto(false);
        }
      }
    }

    loadPhoto();
    return () => {
      active = false;
      // Cleanup Object URL if exists
      if (photoUrl) {
        URL.revokeObjectURL(photoUrl);
      }
    };
  }, [registration.fileId, accessToken]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 px-4 py-8">
      {/* Control Buttons (Hidden when printing via index.css no-print utility) */}
      <div className="flex justify-between items-center no-print bg-[#14161C] p-4 rounded-xl shadow-md border border-slate-800">
        {onBack ? (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-white font-medium py-2 px-3 rounded-lg hover:bg-slate-800/60 transition-all cursor-pointer bg-[#1C1F26]"
            id="admit-back-btn"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Registration Dashboard</span>
          </button>
        ) : (
          <div />
        )}
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-emerald-500 text-black hover:bg-emerald-400 font-bold py-2.5 px-5 rounded-lg shadow-md transition-all cursor-pointer"
          id="admit-print-btn"
        >
          <Printer className="w-4 h-4 text-black" />
          <span>Print Admit Card / Save PDF</span>
        </button>
      </div>

      {/* Success Banner (Hidden when printing) */}
      <div className="no-print bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl flex items-start gap-3">
        <CheckCircle className="w-5 h-5 text-emerald-450 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-emerald-300">Registration Confirmed Successfully!</h4>
          <p className="text-sm text-emerald-400/80 mt-0.5">
            Your application data has been stored in Google Sheets and passport photo uploaded to Google Drive.
            Your digital Admit Card has been compiled. You can save/print it below.
          </p>
        </div>
      </div>

      {/* Official Admit Card Printable Container */}
      <div className="bg-[#14161C] border-2 border-slate-800 print:bg-white print:text-black print:border-slate-900 p-6 md:p-8 rounded-lg shadow-xl print-container relative font-sans text-slate-200">
        {/* Formal Watermark Accent */}
        <div className="absolute inset-0 border border-slate-800 print:border-slate-200 m-2 pointer-events-none" />

        {/* Header Block */}
        <div className="text-center pb-6 border-b-2 border-slate-800 print:border-slate-900 relative">
          <p className="text-xs font-semibold tracking-wider text-emerald-400 print:text-slate-800 uppercase">DEENI TA'LEEMI BOARD, MANIPUR</p>
          <h2 className="text-lg md:text-xl font-black tracking-tight text-white print:text-slate-900 mt-1 uppercase">Deeniyat Primary Course Leaving Certificate Examination 2026-27</h2>
          <p className="text-[11px] text-slate-400 print:text-slate-600 mt-0.5 font-sans font-medium">Head Office - Babupara Jama Masjid, Imphal - 795001</p>
          <p className="text-xs font-semibold bg-emerald-500 text-black print:bg-slate-900 print:text-white inline-block px-3 py-1 mt-3 uppercase rounded-sm">
            E-Admit Card (Provisional)
          </p>
        </div>

        {/* Content Body */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-6">
          
          {/* Main Candidate Info Fields (Columns 1, 2, 3) */}
          <div className="md:col-span-3 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 print:text-slate-500 uppercase tracking-wider">Registration Number</p>
                <p className="font-mono font-bold text-base text-white print:text-slate-900">{registration.regId}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-404 print:text-slate-500 uppercase tracking-wider">Examination Roll Number</p>
                <p className="font-mono font-bold text-base text-emerald-400 print:text-teal-700">{rollNumber}</p>
              </div>
            </div>

            <hr className="border-slate-800 print:border-slate-200" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 print:text-slate-500 uppercase tracking-wider">Student Name</p>
                <p className="font-bold text-white print:text-slate-900 text-base">{registration.name}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 print:text-slate-500 uppercase tracking-wider">Date of Birth</p>
                <p className="font-medium text-slate-200 print:text-slate-900">{registration.dob}</p>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 print:text-slate-500 uppercase tracking-wider">Father's Name</p>
                <p className="font-medium text-slate-205 print:text-slate-700">{registration.fatherName || 'Not Provided'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 print:text-slate-500 uppercase tracking-wider">Mother's Name</p>
                <p className="font-medium text-slate-205 print:text-slate-700">{registration.motherName || 'Not Provided'}</p>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 print:text-slate-500 uppercase tracking-wider">Selected Maktab</p>
                <p className="font-medium text-slate-205 print:text-slate-700">{registration.maktab || 'Not Provided'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 print:text-slate-500 uppercase tracking-wider">Contact Number</p>
                <p className="font-medium text-slate-205 print:text-slate-700">{registration.phone}</p>
              </div>

              <div className="md:col-span-2">
                <p className="text-[10px] font-bold text-slate-400 print:text-slate-500 uppercase tracking-wider">Detailed Address</p>
                <p className="font-medium text-slate-205 print:text-slate-700 break-words">{registration.address || 'Not Provided'}</p>
              </div>

              <div className="md:col-span-2">
                <p className="text-[10px] font-bold text-slate-400 print:text-slate-500 uppercase tracking-wider">Student Category / Waiver Wave</p>
                <p className="font-medium text-slate-205 print:text-slate-700">{registration.category}</p>
              </div>
            </div>
          </div>

          {/* Passport Photo Display (Column 4) */}
          <div className="md:col-span-1 flex flex-col items-center justify-start border border-slate-800 print:border-slate-300 p-2 bg-[#1C1F26] print:bg-slate-50/50 rounded-md">
            <div className="w-32 h-40 bg-[#0F1116] print:bg-slate-100 border-2 border-slate-705 print:border-slate-400 border-dashed rounded relative overflow-hidden flex items-center justify-center">
              {isLoadingPhoto ? (
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="w-5 h-5 border-2 border-emerald-400 print:border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-[9px] text-slate-400 print:text-slate-500 uppercase">Loading...</span>
                </div>
              ) : photoError ? (
                <div className="text-center p-2">
                  <User className="w-10 h-10 mx-auto text-slate-500 print:text-slate-300" />
                  <span className="text-[9px] text-rose-450 print:text-rose-500 font-semibold block mt-1 leading-tight">Syncing photo...</span>
                </div>
              ) : photoUrl ? (
                <img
                   src={photoUrl}
                   alt="Candidate passport photo"
                   className="w-full h-full object-cover"
                   referrerPolicy="no-referrer"
                />
              ) : (
                <div className="text-center p-2">
                  <User className="w-10 h-10 mx-auto text-slate-500 print:text-slate-300" />
                  <span className="text-[9px] text-slate-400 uppercase">No Photo Provided</span>
                </div>
              )}
            </div>
            <p className="text-[9px] font-bold text-slate-400 print:text-slate-500 mt-2 text-center uppercase tracking-wider">Uploaded Passport Photo</p>
          </div>
        </div>

        {/* Paper & Stream Information (Wide Table) */}
        <div className="mt-8 border-2 border-slate-800 print:border-slate-900 rounded overflow-hidden">
          <div className="bg-[#0F1116] print:bg-slate-900 text-white font-bold text-xs p-2.5 grid grid-cols-12 gap-2 uppercase tracking-wide">
            <div className="col-span-3">Subject / Paper</div>
            <div className="col-span-2 text-center">Paper Code</div>
            <div className="col-span-3 text-center">Date</div>
            <div className="col-span-4 text-center">Examination Timings</div>
          </div>
          <div className="p-3 grid grid-cols-12 gap-2 text-sm border-b border-slate-805 print:border-slate-205 bg-[#1C1F26] print:bg-white text-slate-200 print:text-slate-950">
            <div className="col-span-3 font-semibold text-white print:text-slate-900">{streamInfo.name}</div>
            <div className="col-span-2 text-center font-mono font-medium text-slate-400 print:text-slate-700">{streamInfo.code}</div>
            <div className="col-span-3 text-center text-slate-300 print:text-slate-700">{streamInfo.date}</div>
            <div className="col-span-4 text-center font-bold text-emerald-400 print:text-teal-800">{streamInfo.time}</div>
          </div>
        </div>

        {/* Center Venue Block */}
        <div className="mt-6 p-4 bg-[#1C1F26] print:bg-slate-50 border border-slate-800 print:border-slate-200 rounded">
          <div className="flex gap-2 items-start">
            <MapPin className="w-5 h-5 text-emerald-450 print:text-slate-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold text-slate-400 print:text-slate-500 uppercase tracking-wider">Allotted Examination Venue Center</p>
              <p className="font-bold text-white print:text-slate-900 text-sm mt-0.5">{centerInfo.name}</p>
              <p className="text-[11px] text-[#A0AEC0] print:text-slate-500 mt-1">Please ensure you verify this center at least 1 day prior to the scheduling window.</p>
            </div>
          </div>
        </div>

        {/* Barcode / Payment Verification Segment */}
        <div className="mt-8 flex flex-col md:flex-row justify-between items-center gap-6 pt-6 border-t border-slate-800 print:border-slate-200">
          <div className="flex flex-col text-center md:text-left gap-1">
            <div className="text-xs text-slate-404 print:text-slate-500">
              Payment Confirmed via Transaction ID: <span className="font-mono font-semibold text-white print:text-slate-900">{registration.transactionId}</span>
            </div>
            <div className="text-xs text-slate-404 print:text-slate-500">
              Registered timestamp: <span className="font-medium text-slate-300 print:text-slate-700">{new Date(registration.regTime).toLocaleString()}</span>
            </div>
          </div>

          {/* Mock Barcode */}
          <div className="flex flex-col items-center">
            <div className="flex justify-center items-center h-10 w-48 bg-[#1C1F26] print:bg-slate-100 border border-slate-800 print:border-slate-300 relative px-1 font-mono tracking-[4px] text-xs text-slate-200 print:text-black select-none">
              ||||| | |||| | ||| | || | |||| ||
            </div>
            <p className="text-[9px] text-[#A0AEC0] print:text-slate-500 mt-1 font-mono">{registration.regId}</p>
          </div>
        </div>

        {/* Formal Instructions Footer */}
        <div className="mt-8 border-t-2 border-slate-850 print:border-slate-900 pt-6 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-300 print:text-slate-800">★ Important Examination Directives for Maktab Students:</h4>
          <ol className="text-[11px] text-slate-400 print:text-slate-600 space-y-1 list-decimal pl-4 leading-relaxed">
            <li>Students must carry a hard printed copy of this E-Admit Card to their designated examination center.</li>
            <li>Please report at the exam center at least 30 minutes before the scheduled commencement of the paper.</li>
            <li>No textbooks, notebook guides, mobile phones or written help sheets are permitted inside the examination hall.</li>
            <li>Students are required to bring standard writing instruments (pens, pencils, and erasers). All paper sheets will be provided by the center.</li>
            <li>This admit card is provisional and issued based on verification from the registered local Maktab management.</li>
          </ol>
        </div>

        {/* Official Authority Signature Area */}
        <div className="mt-8 flex justify-end">
          <div className="text-center w-48">
            <div className="h-10 border-b border-slate-800 print:border-slate-400 flex items-center justify-center font-serif italic text-sm text-slate-400 print:text-slate-500 select-none font-semibold">
              M. S. Khan (Registrar)
            </div>
            <p className="text-[9px] text-slate-400 print:text-slate-500 uppercase mt-1 tracking-wider font-semibold">Controller of Board Examinations</p>
          </div>
        </div>
      </div>
    </div>
  );
}
