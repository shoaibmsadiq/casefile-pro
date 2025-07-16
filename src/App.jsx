import { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  getIdTokenResult,
sendEmailVerification, // Yeh add karein
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  Timestamp,
  collectionGroup, 
  where,           
  orderBy,         
  getDoc,// Yeh add karein
  setDoc,
} from 'firebase/firestore';
import {
    getStorage,
    ref,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject
} from 'firebase/storage';
import {
  getFunctions,
  httpsCallable
} from 'firebase/functions';
import {
  Users, Briefcase, Loader2, FilePlus, Search, Edit, Trash2, X, ChevronDown,
  Archive, Activity, Paperclip, UploadCloud, FileWarning, Calendar as CalendarIcon, 
  User, MapPin, Bell, CircleDollarSign, PlusCircle, FileDown, FileText, CheckCircle2, ListTodo, Clock, Inbox, CalendarDays,
  LogOut, MailCheck, UserPlus, ShieldCheck, Copy, MessageSquare, Send,Phone
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import 'react-toastify/dist/ReactToastify.css';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyC93J87oWxUx6RMsOfs0Xs6CNwbwfMmmBQ",
  authDomain: "casefile-pro.firebaseapp.com",
  projectId: "casefile-pro",
  storageBucket: "casefile-pro.firebasestorage.app",
  messagingSenderId: "387776954987",
  appId: "1:387776954987:web:c1bc983a56efdc3539a72e",
  measurementId: "G-TXG9HN3S89"
};

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);
window.auth = auth; // <<< YAHAN PAR NAYA CODE ADD KAREIN

// --- PDF Generation Utility ---
const generateInvoice = (invoiceData, caseData) => {
  const doc = new jsPDF();
  const grandTotal = invoiceData.totalAmount || 0;
  const currencySymbol = invoiceData.currency || 'PKR';
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text("INVOICE", 14, 22);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text("Your Law Firm Name", 14, 32);
  doc.text("123 Law St, Suite 400", 14, 38);
  doc.text("Your City, State 12345", 14, 44);
  doc.setFontSize(12);
  doc.text("Bill To:", 14, 58);
  doc.setFont('helvetica', 'bold');
  doc.text(invoiceData.clientName || 'N/A', 14, 64);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(invoiceData.clientAddress || '', 14, 70);
  doc.text(invoiceData.clientContact || '', 14, 76);
  doc.text(invoiceData.clientEmail || '', 14, 82);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Invoice #: ${invoiceData.invoiceNumber || 'N/A'}`, 140, 22);
  doc.text(`Invoice Date: ${invoiceData.invoiceDate ? new Date(invoiceData.invoiceDate).toLocaleDateString() : 'N/A'}`, 140, 28);
  doc.text(`Due Date: ${invoiceData.dueDate ? new Date(invoiceData.dueDate).toLocaleDateString() : 'N/A'}`, 140, 34);
  doc.text(`Case: ${caseData?.caseTitle || 'N/A'}`, 140, 40);
  const lineItemsBody = (invoiceData.lineItems || []).map(item => [
    item.description || '',
    item.quantity || 0,
    `${currencySymbol} ${parseFloat(item.unitPrice || 0).toFixed(2)}`,
    `${currencySymbol} ${(parseFloat(item.quantity || 0) * parseFloat(item.unitPrice || 0)).toFixed(2)}`
  ]);
  autoTable(doc, {
    startY: 90,
    head: [['Description', 'Quantity/Hours', 'Unit Price', 'Amount']],
    body: lineItemsBody,
    theme: 'striped',
    headStyles: { fillColor: [22, 160, 133] },
  });
  let finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 90;
  let leftMargin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const rightEdgePadding = 14;
  let rightColumnX = 120;
  let currentY = finalY + 20;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const totalAmountLabel = `Total Amount Due:`;
  doc.text(totalAmountLabel, rightColumnX, currentY);
  const totalAmountValueText = `${currencySymbol} ${grandTotal.toFixed(2)}`;
  const totalAmountValueWidth = doc.getTextWidth(totalAmountValueText);
  const totalAmountValueX = pageWidth - rightEdgePadding - totalAmountValueWidth;
  doc.text(totalAmountValueText, totalAmountValueX, currentY);
  let leftSideY = finalY + 20;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text("Payment Terms:", leftMargin, leftSideY);
  doc.setFont('helvetica', 'normal');
  doc.text(invoiceData.paymentTerms || 'Due on Receipt', leftMargin, leftSideY + 6);
  let notesHeight = 0;
  let notesYEnd = leftSideY + 6;
  if(invoiceData.notesToClient) {
    let notesY = leftSideY + 16;
    doc.setFont('helvetica', 'bold');
    doc.text("Notes:", leftMargin, notesY);
    doc.setFont('helvetica', 'normal');
    const notesMaxWidth = rightColumnX - leftMargin - 10;
    const notesLines = doc.splitTextToSize(invoiceData.notesToClient, notesMaxWidth);
    doc.text(notesLines, leftMargin, notesY + 6);
    const estimatedLineHeight = 4;
    notesHeight = notesLines.length * estimatedLineHeight;
    notesYEnd = notesY + 6 + notesHeight;
  }
  let contentBottomY = Math.max(currentY + 10, notesYEnd + 10);
  let footerY = contentBottomY;
  if (footerY < doc.internal.pageSize.height - 10) {
    footerY = doc.internal.pageSize.height - 10;
  }
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text("Thank you for your business.", 14, footerY);
  doc.save(`Invoice-${invoiceData.invoiceNumber || 'N/A'}.pdf`);
};
// --- Main App Component ---
function App() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEmailVerified, setIsEmailVerified] = useState(false);

  const isClientPortal = window.location.pathname.startsWith('/portal');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        // --- LOG 1 ---
        console.log("Auth state badli. User ID:", user.uid, "| Email:", user.email);
        
        await user.reload();
        setUser(user);
        setIsEmailVerified(user.emailVerified);
        
        try {
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
              // --- LOG 2 ---
              console.log("Admin/member document mila. Role set ho raha hai.");
              const idTokenResult = await getIdTokenResult(user, true);
              setUserRole(idTokenResult.claims.role || 'member');
            } else {
              // --- LOG 3 ---
              console.log("Admin/member document nahi mila, ab client check kar rahe hain.");
              
              // === IMPORTANT FIX ===
              // Pehle 'clientDoc' ko get karna hai, phir 'exists()' check karna hai.
              const clientDocRef = doc(db, "clients", user.uid);
              const clientDoc = await getDoc(clientDocRef); // Yeh line pehle miss thi

              if (clientDoc.exists()) {
                  // --- LOG 4 ---
                  console.log("Client document mil gaya! Role 'client' set ho raha hai.");
                  setUserRole('client');
              } else {
                  // --- LOG 5 ---
                  console.log("Client document bhi nahi mila! Role null set hoga.");
                  setUserRole(null);
              }
            }
        } catch (error) {
            // --- LOG 6 ---
            console.error("User ka role check karte waqt error:", error);
            setUserRole(null);
        }

      } else {
        // --- LOG 7 ---
        console.log("User logout ho gaya hai.");
        setUser(null);
        setUserRole(null);
        setIsEmailVerified(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
}, []);

  if (loading) {
    return <LoadingScreen message="Loading..." />;
  }

  // --- CORRECTED RENDER LOGIC ---
  if (isClientPortal) {
    if (user && userRole === 'client') {
      return <ClientPortal user={user} />;
    } else {
      return <ClientLoginScreen />;
    }
  } else {
    if (user && (userRole === 'admin' || userRole === 'member')) {
      if (isEmailVerified) {
        return <CaseManagementSystem user={user} userRole={userRole} />;
      } else {
        return <VerifyEmailScreen user={user} />;
      }
    } else if (user && userRole === 'client') {
      return <AccessDeniedScreen message="Redirecting to Client Portal..." redirectTo="/portal" />;
    } else {
      return <AuthScreen />;
    }
  }
}

// --- Reusable Components ---
const LoadingScreen = ({ message = "Loading..." }) => (
  <div className="flex flex-col justify-center items-center min-h-screen bg-slate-100 text-slate-700">
    <Loader2 className="w-12 h-12 animate-spin mb-4 text-blue-600" />
    <p className="text-lg">{message}</p>
  </div>
);

const InputField = ({ name, label, value, onChange, type = 'text', required = false, id, disabled = false }) => (
    <div>
        <label htmlFor={id || name} className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
        <input type={type} id={id || name} name={name} value={value} onChange={onChange} required={required} disabled={disabled} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100" />
    </div>
);

const TextAreaField = ({ name, label, value, onChange }) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
        <textarea id={name} name={name} value={value} onChange={onChange} rows="3" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
    </div>
);

const InfoItem = ({ icon: Icon, label, value }) => (
    <div className="flex items-start">
        <Icon className="w-4 h-4 text-slate-400 mt-0.5 mr-3 flex-shrink-0" />
        <div>
            <p className="text-xs text-slate-500">{label}</p>
            <div className="font-medium text-slate-800">{value || 'N/A'}</div>
        </div>
    </div>
);

const CaseStatusBadge = ({ status }) => {
    const statusStyles = {
        'Active': 'bg-green-100 text-green-800',
        'Pending': 'bg-yellow-100 text-yellow-800',
        'Appeal': 'bg-blue-100 text-blue-800',
        'Decided': 'bg-purple-100 text-purple-800',
        'Closed': 'bg-slate-100 text-slate-800',
        'default': 'bg-slate-100 text-slate-800'
    };
    return (<span className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyles[status] || statusStyles['default']}`}>{status}</span>);
};

const CheckboxField = ({ name, label, checked, onChange, disabled = false }) => (
    <div className="flex items-center">
        <input id={name} name={name} type="checkbox" checked={checked} onChange={onChange} disabled={disabled} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:bg-slate-200" />
        <label htmlFor={name} className="ml-2 block text-sm text-slate-900">{label}</label>
    </div>
);
const AccessDeniedScreen = ({ message, redirectTo }) => {
    useEffect(() => {
        if (redirectTo) {
            setTimeout(() => {
                window.location.href = redirectTo;
            }, 3000);
        }
    }, [redirectTo]);

    return (
        <div className="flex flex-col justify-center items-center min-h-screen bg-slate-100 text-slate-700 p-4 text-center">
            <FileWarning className="w-16 h-16 text-red-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-lg">{message}</p>
            {!redirectTo && (
                <button onClick={() => signOut(auth)} className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-lg">
                    Log Out
                </button>
            )}
        </div>
    );
};
const ConfirmDeleteModal = ({ isOpen, onClose, onConfirm }) => {
    if (!isOpen) return null;
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black bg-opacity-60 z-40 flex justify-center items-center p-4" onClick={onClose}>
            <motion.div initial={{ scale: 0.9, y: -20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: -20 }} className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center" onClick={e => e.stopPropagation()}>
                <div className="mx-auto bg-red-100 rounded-full h-12 w-12 flex items-center justify-center mb-4">
                    <FileWarning className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">Are you sure?</h3>
                <p className="text-slate-600 mb-6 text-sm">Do you really want to delete this case file? This action cannot be undone.</p>
                <div className="flex justify-center gap-4">
                    <button onClick={onClose} className="bg-slate-200 text-slate-800 px-6 py-2 rounded-lg hover:bg-slate-300 font-semibold">Cancel</button>
                    <button onClick={onConfirm} className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 font-semibold">Delete</button>
                </div>
            </motion.div>
        </motion.div>
    );
}
function AuthScreen() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await sendEmailVerification(userCredential.user);
                toast.success("Account created! A verification link has been sent to your email.");
            }
        } catch (err) {
            const errorMessage = err.message.replace('Firebase: ', '');
            setError(errorMessage);
            toast.error(errorMessage);
        }
        setLoading(false);
    };

    return (
        <div className="flex justify-center items-center min-h-screen p-4 bg-slate-100">
            <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-2xl">
                <h2 className="text-3xl font-bold text-center text-slate-800 mb-2">CaseFile Pro</h2>
                <p className="text-center text-slate-500 mb-8">Management Portal</p>
                <form onSubmit={handleAuth}>
                    <div className="mb-4">
                        <InputField name="email" label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="mb-6">
                         <InputField name="password" label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                    {error && <p className="text-red-500 text-sm text-center mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
                    <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors flex justify-center items-center text-base disabled:bg-blue-400">
                        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (isLogin ? 'Login' : 'Sign Up')}
                    </button>
                </form>
                <p className="text-center text-sm text-slate-500 mt-6">
                    {isLogin ? "Don't have an account?" : "Already have an account?"}
                    <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="text-blue-600 hover:underline font-semibold ml-1">
                        {isLogin ? 'Sign Up' : 'Login'}
                    </button>
                </p>
            </div>
        </div>
    );
}
// --- Authentication Components ---

function VerifyEmailScreen({ user }) {
    const [isSending, setIsSending] = useState(false);

    const handleResendEmail = async () => {
        setIsSending(true);
        try {
            await sendEmailVerification(user);
            toast.success("Verification email sent again. Please check your inbox (and spam folder).");
        } catch (error) {
            toast.error(error.message);
        }
        setIsSending(false);
    };
const handleLogout = async () => {
        await signOut(auth);
    };
    return (
        <div className="flex justify-center items-center min-h-screen p-4 bg-slate-100">
            <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-2xl text-center">
                <MailCheck className="w-16 h-16 mx-auto text-green-500 mb-4" />
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Verify Your Email</h2>
                <p className="text-slate-600 mb-6">
                    A verification link has been sent to **{user.email}**. Please click the link to activate your account.
                </p>
                <div className="space-y-4">
                    <button onClick={handleResendEmail} disabled={isSending} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors flex justify-center items-center text-base disabled:bg-blue-400">
                        {isSending ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Resend Verification Email'}
                    </button>
                    <button onClick={() => signOut(auth)} className="w-full bg-slate-200 text-slate-700 font-bold py-3 rounded-lg hover:bg-slate-300 transition-colors">
                        Log Out
                    </button>
                </div>
                <p className="text-xs text-slate-400 mt-6">
                    After verifying, please refresh this page or log in again.
                </p>
            </div>
        </div>
    );
}

// --- Client Portal Components ---
function ClientLoginScreen() {
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const email = `${phone}@casefile-portal.local`;
            console.log("Login karne ki koshish:", email); // YEH ADD KAREN
            await signInWithEmailAndPassword(auth, email, password);
            console.log("Firebase Auth Kamyab!"); // YEH ADD KAREN
        } catch (err) {
        console.error("Login mein error aya:", err.code, err.message); // YEH ADD KAREN
        let friendlyError = "Invalid phone number or password.";
        // ...
        setError(friendlyError);
        toast.error(friendlyError);
    }
    setLoading(false);
};
    
    return (
        <div className="flex justify-center items-center min-h-screen p-4 bg-slate-100">
            <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-2xl">
                <h2 className="text-3xl font-bold text-center text-slate-800 mb-2">Client Portal Login</h2>
                <p className="text-center text-slate-500 mb-8">Malik Awan Law Associates</p>
                <form onSubmit={handleLogin} className="space-y-4">
                    <InputField label="Mobile Number (e.g., 923001234567)" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                    <InputField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    {error && <p className="text-red-500 text-sm text-center my-4">{error}</p>}
                    <button type="submit" disabled={loading} className="mt-2 w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors flex justify-center items-center">
                        {loading ? <Loader2 className="animate-spin" /> : 'Login'}
                    </button>
                </form>
            </div>
        </div>
    );
}
function ClientDashboard({ user }) {
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collectionGroup(db, 'cases'), where('clientId', '==', user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const casesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCases(casesData);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching client cases:", err);
            toast.error("Could not load your cases.");
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user.uid]);

    return (
        <div className="bg-slate-50 min-h-screen">
            <header className="bg-white shadow-sm">
                <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <h1 className="text-xl font-bold text-slate-800">Your Case Dashboard</h1>
                    <button onClick={() => signOut(auth)} className="flex items-center gap-2 text-sm text-red-600 hover:text-red-800">
                        <LogOut className="w-4 h-4" /> Log Out
                    </button>
                </div>
            </header>
            <main className="container mx-auto p-6">
                {loading ? (
                    <LoadingScreen message="Loading your cases..." />
                ) : cases.length > 0 ? (
                    <div className="space-y-6">
                        {cases.map(caseItem => (
                            <div key={caseItem.id} className="bg-white p-6 rounded-lg shadow-md">
                                <h2 className="text-2xl font-bold text-slate-800">{caseItem.caseTitle}</h2>
                                <p className="text-sm text-slate-500 mb-4">Case #: {caseItem.caseNumber}</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <InfoItem icon={Activity} label="Status" value={<CaseStatusBadge status={caseItem.caseStatus} />} />
                                    <InfoItem icon={Briefcase} label="Court" value={caseItem.courtName} />
                                    {caseItem.hearingDates && caseItem.hearingDates.length > 0 && (
                                        <InfoItem 
                                            icon={CalendarIcon} 
                                            label="Next Hearing" 
                                            value={new Date(caseItem.hearingDates[0]).toLocaleDateString()} 
                                        />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p>You do not have any cases assigned to you yet.</p>
                )}
            </main>
        </div>
    );
}
// STEP 1: Yeh poora naya function apni App.jsx file mein kahin bhi add kar den,
// maslan ClientPortal function se pehle.
// -----------------------------------------------------------------------------
function ClientCalendarView({ cases }) {
    const localizer = momentLocalizer(moment);

    const events = useMemo(() => {
        // Aapke tamam cases se hearing dates nikal kar unhein calendar events mein tabdeel karen
        return cases.flatMap(c => 
            (c.hearingDates || []).map(date => ({
                id: `${c.id}-${date}`,
                title: `Hearing: ${c.caseTitle}`,
                start: moment(date).startOf('day').toDate(),
                end: moment(date).endOf('day').toDate(),
                allDay: true,
                resource: c, // Case ka reference, agar zaroorat pare
            }))
        );
    }, [cases]);

    // Calendar par events ka style kaisa hoga
    const eventStyleGetter = (event) => ({
        style: {
            backgroundColor: '#3b82f6', // blue-500
            borderRadius: '5px',
            color: 'white',
            border: '0px',
            display: 'block',
        }
    });

    return (
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg h-[80vh]">
            <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                style={{ height: '100%' }}
                eventPropGetter={eventStyleGetter}
            />
        </div>
    );
}


// STEP 2: Apni App.jsx file mein mojooda ClientPortal function ko
// is poore naye code se replace kar den.
// -----------------------------------------------------------------------------
function ClientPortal({ user }) {
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCase, setSelectedCase] = useState(null);
    const [view, setView] = useState('dashboard'); // 'dashboard' ya 'calendar'

    useEffect(() => {
        const q = query(collectionGroup(db, 'cases'), where('clientId', '==', user.uid));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const casesData = snapshot.docs.map(doc => {
                const pathSegments = doc.ref.path.split('/');
                const ownerId = pathSegments[3]; 
                return { id: doc.id, ownerId: ownerId, ...doc.data() };
            });
            setCases(casesData);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user.uid]);

    if (loading) {
        return <LoadingScreen message="Loading Client Portal..." />;
    }
    
    if (selectedCase) {
        return <ClientCaseDetail 
                    caseData={selectedCase} 
                    user={user} 
                    onBack={() => setSelectedCase(null)} 
                />;
    }

    return (
        <div className="bg-slate-50 min-h-screen">
            <header className="bg-white shadow-sm">
                <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <h1 className="text-xl font-bold text-slate-800">Client Portal</h1>
                    <nav className="flex items-center space-x-2">
                        <button onClick={() => setView('dashboard')} className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${view === 'dashboard' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}>
                            <Briefcase className="w-5 h-5" /> My Cases
                        </button>
                        <button onClick={() => setView('calendar')} className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${view === 'calendar' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}>
                            <CalendarIcon className="w-5 h-5" /> Calendar
                        </button>
                        <button onClick={() => signOut(auth)} className="px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 text-red-600 hover:bg-red-100">
                            <LogOut className="w-5 h-5" /> Log Out
                        </button>
                    </nav>
                </div>
            </header>
            <main className="container mx-auto p-6">
                {view === 'dashboard' && (
                    cases.length > 0 ? (
                        <div className="space-y-4">
                            {cases.map(caseItem => (
                                <div 
                                    key={caseItem.id} 
                                    onClick={() => setSelectedCase(caseItem)} 
                                    className="bg-white p-6 rounded-lg shadow-md cursor-pointer hover:shadow-lg transition-shadow"
                                >
                                    <h2 className="text-xl font-bold text-slate-800">{caseItem.caseTitle}</h2>
                                    <p className="text-sm text-slate-500 mb-4">Case #: {caseItem.caseNumber}</p>
                                    <CaseStatusBadge status={caseItem.caseStatus} />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <Inbox className="mx-auto h-12 w-12 text-slate-400" />
                            <h3 className="mt-2 text-sm font-medium text-slate-900">No Cases Found</h3>
                            <p className="mt-1 text-sm text-slate-500">You do not have any cases assigned to you yet.</p>
                        </div>
                    )
                )}
                {view === 'calendar' && <ClientCalendarView cases={cases} />}
            </main>
        </div>
    );
}


function ClientCaseDetail({ caseData, user, onBack }) {
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState("");
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const commentsRef = collection(db, `artifacts/default-app-id/users/${caseData.ownerId}/cases/${caseData.id}/comments`);

    useEffect(() => {
        const q = query(commentsRef, orderBy("createdAt", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setComments(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})));
        }, (error) => {
            console.error("Error fetching comments:", error.message);
        });
        return unsubscribe;
    }, [commentsRef]);

    // *** YEH NAYA AUR THEEK KIYA GAYA FUNCTION HAI ***
    const handleAddComment = async (e) => {
    e.preventDefault();
    if (newComment.trim() === "") return;

    // Create a list of all users who can see this comment
    const participants = [
        caseData.ownerId, // The lawyer who owns the case
        caseData.clientId  // The client
    ];
    // Add any assigned lawyers to the list
    if (caseData.assignedTo && caseData.assignedTo.length > 0) {
        participants.push(...caseData.assignedTo);
    }
    const uniqueParticipants = [...new Set(participants)];

    const newCommentData = {
        text: newComment,
        createdAt: serverTimestamp(),
        author: "Client",
        authorId: user.uid,
        // Store the participants array on the comment document itself
        participants: uniqueParticipants 
    };

    try {
        await addDoc(commentsRef, newCommentData);
        setNewComment("");
    } catch (error) {
        console.error("Error adding comment:", error.message);
        toast.error("Could not send message. Please try again.");
    }
};
    // *** FIX 2: handleFileUpload ko theek kiya gaya hai ***
    const handleFileUpload = async () => {
        if (!file) return;
        setUploading(true);
        const storagePath = `client_uploads/${user.uid}/${caseData.id}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed', 
            (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
            (error) => {
                toast.error("Upload failed: " + error.message);
                setUploading(false);
            },
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                const caseDocRef = doc(db, `artifacts/default-app-id/users/${caseData.ownerId}/cases/${caseData.id}`);
                
                await updateDoc(caseDocRef, {
                    attachments: arrayUnion({ 
                        name: file.name, 
                        url: downloadURL, 
                        storagePath, 
                        uploadedBy: 'client',
                        // arrayUnion ke sath serverTimestamp() kaam nahi karta, isliye Timestamp.now() istemal karen
                        uploadedAt: Timestamp.now() 
                    })
                });
                toast.success("File uploaded successfully!");
                setFile(null);
                setUploadProgress(0);
                setUploading(false);
            }
        );
    };
    return (
        <div className="bg-slate-50 min-h-screen">
            <header className="bg-white shadow-sm sticky top-0 z-10">
                <div className="container mx-auto px-6 py-4">
                    <button onClick={onBack} className="font-semibold text-blue-600 hover:underline">{"< Back to Dashboard"}</button>
                </div>
            </header>
            
            <main className="container mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-2xl font-bold text-slate-800">{caseData.caseTitle}</h2>
                        <p className="text-sm text-slate-500 mb-4">Case #: {caseData.caseNumber}</p>
                        <div className="space-y-3">
                            <InfoItem icon={Activity} label="Status" value={<CaseStatusBadge status={caseData.caseStatus} />} />
                            <InfoItem icon={Briefcase} label="Court" value={caseData.courtName} />
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Paperclip className="w-5 h-5 text-slate-500" /> Case Documents</h3>
                        <ul className="space-y-2">
                            {(caseData.attachments || []).map((att, i) => (
                                <li key={i} className="flex items-center justify-between bg-slate-50 p-2 rounded-md">
                                    <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline truncate">
                                        <FileText className="w-4 h-4" /><span className="truncate">{att.name}</span>
                                    </a>
                                    <span className={`text-xs px-2 py-1 rounded-full ${att.uploadedBy === 'client' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{att.uploadedBy === 'client' ? 'You' : 'Lawyer'}</span>
                                </li>
                            ))}
                            {(!caseData.attachments || caseData.attachments.length === 0) && (<p className="text-sm text-slate-400 text-center py-4">No documents shared yet.</p>)}
                        </ul>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h3 className="text-lg font-bold mb-4">Upload Your Documents</h3>
                        <input type="file" onChange={e => setFile(e.target.files[0])} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                        {uploading && <progress value={uploadProgress} max="100" className="w-full mt-2" />}
                        <button onClick={handleFileUpload} disabled={!file || uploading} className="w-full mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg disabled:bg-slate-300 flex items-center justify-center">{uploading ? <Loader2 className="animate-spin" /> : 'Upload'}</button>
                    </div>
                </div>
                {/* Right Column */}
                <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md flex flex-col">
                     <h3 className="text-lg font-bold mb-4">Case Discussion</h3>
                     <div className="flex-grow space-y-4 max-h-96 overflow-y-auto pr-2 mb-4">
                         {comments.map(comment => (
                             <div key={comment.id} className={`flex ${comment.author === 'Client' ? 'justify-end' : 'justify-start'}`}>
                                 <div className={`p-3 rounded-lg max-w-md ${comment.author === 'Client' ? 'bg-blue-500 text-white' : 'bg-slate-200'}`}>
                                     <p className="text-sm font-semibold mb-1">{comment.author}</p><p className="text-sm">{comment.text}</p>
                                     <p className={`text-xs mt-1 opacity-70 ${comment.author === 'Client' ? 'text-right' : 'text-left'}`}>{comment.createdAt?.toDate().toLocaleTimeString()}</p>
                                 </div>
                             </div>
                         ))}
                     </div>
                     <form onSubmit={handleAddComment} className="mt-auto pt-4 border-t flex gap-2">
                         <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Type a message..." className="flex-grow w-full px-4 py-2 border border-slate-300 rounded-full" />
                         <button type="submit" className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700"><Send className="w-5 h-5" /></button>
                     </form>
                </div>
            </main>
        </div>
    );
}
// --- UPDATED: CaseManagementSystem Component with Logout Button ---
function CaseManagementSystem({ user, userRole }) {
  const [view, setView] = useState('dashboard'); // Default to clients view for admin
  const [searchTerm, setSearchTerm] = useState('');
  const [clients, setClients] = useState([]); // <-- Nayi state add karein

  // Clients ki list fetch karne ke liye naya useEffect add karein
  useEffect(() => {
    if (userRole === 'admin') {
        const unsub = onSnapshot(collection(db, "clients"), (snapshot) => {
            setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsub();
    }
  }, [userRole]);

  // --- ADDED: Logout handler ---
  const handleLogout = async () => {
    try {
        await signOut(auth);
        toast.success("You have been logged out.");
    } catch (error) {
        toast.error("Failed to log out.");
    }
  };

  return (
    <>
      <header className="bg-white shadow-md sticky top-0 z-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-slate-800">CaseFile Pro</h1>
            <nav className="flex items-center space-x-2">
               {/* Dashboard, Cases, etc. buttons yahan rahenge */}
               <button onClick={() => setView('dashboard')} className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${view === 'dashboard' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}>
                   <Activity className="w-5 h-5" />Dashboard
               </button>
               <button onClick={() => setView('cases')} className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${view === 'cases' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}>
                   <Briefcase className="w-5 h-5" />Cases
               </button>
               <button onClick={() => setView('calendar')} className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${view === 'calendar' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}>
                   <CalendarIcon className="w-5 h-5" />Calendar
               </button>
               <button onClick={() => setView('invoices')} className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${view === 'invoices' ? 'bg-green-100 text-green-700' : 'text-slate-600 hover:bg-slate-100'}`}>
                   <FileText className="w-5 h-5" />Invoices
               </button>
              {userRole === 'admin' && (
                 <>
                    <button onClick={() => setView('clients')} className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${view === 'clients' ? 'bg-yellow-100 text-yellow-700' : 'text-slate-600 hover:bg-slate-100'}`}>
                        <UserPlus className="w-5 h-5" />Clients
                    </button>
                    <button onClick={() => setView('admin')} className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${view === 'admin' ? 'bg-purple-100 text-purple-700' : 'text-slate-600 hover:bg-slate-100'}`}>
                        <ShieldCheck className="w-5 h-5" />Lawyers
                    </button>
                 </>
              )}
               <button onClick={handleLogout} className="px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 text-red-600 hover:bg-red-100">
                   <LogOut className="w-5 h-5" />Log Out
               </button>
            </nav>
          </div>
        </div>
      </header>
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        {view === 'dashboard' && <DashboardView user={user} setView={setView} setSearchTerm={setSearchTerm} />}
        {view === 'cases' && <CasesView user={user} userRole={userRole} searchTerm={searchTerm} setSearchTerm={setSearchTerm} clients={clients} />}
        {view === 'calendar' && <CalendarView user={user} />}
        {view === 'invoices' && <InvoicesView user={user} />}
        {view === 'admin' && userRole === 'admin' && <AdminPanel />}
        {view === 'clients' && userRole === 'admin' && <AdminClientManagement clients={clients} />}
      </main>
    </>
  );
}
function AdminClientManagement({ clients = [] }) { // <-- 'clients' ko prop ke taur par receive karein
    const [loading, setLoading] = useState(false); // Loading state ko theek karein
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');
    const [newClientPassword, setNewClientPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAddClient = async (e) => {
        e.preventDefault();
        if (!newClientName || !newClientPhone || !newClientPassword) {
            toast.error("All fields are required.");
            return;
        }
        setIsSubmitting(true);
        const addClient = httpsCallable(functions, 'createClientUser');
        try {
            const result = await addClient({ name: newClientName, phone: newClientPhone, password: newClientPassword });
            toast.success(result.data.result);
            setNewClientName('');
            setNewClientPhone('');
            setNewClientPassword('');
            setIsModalOpen(false);
        } catch (error) {
            console.error("Error creating client:", error);
            toast.error(error.message);
        }
        setIsSubmitting(false);
    };


    return (
        <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-700">Client Management</h2>
                <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                    <UserPlus className="w-5 h-5" /> Add New Client
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Phone Number</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {clients.map(client => (
                            <tr key={client.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{client.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{client.phone}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
             <AnimatePresence>
                {isModalOpen && (
                     <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center p-4">
                        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                            <h2 className="text-xl font-bold text-slate-800 mb-4">Add New Client</h2>
                            <form onSubmit={handleAddClient} className="space-y-4">
                                <InputField label="Client Full Name" value={newClientName} onChange={e => setNewClientName(e.target.value)} required />
                                <InputField label="Client Mobile Number" type="tel" value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} required />
                                <InputField label="Set Password" type="text" value={newClientPassword} onChange={e => setNewClientPassword(e.target.value)} required />
                                <div className="flex justify-end gap-3 pt-4">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200">Cancel</button>
                                    <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center w-32">
                                        {isSubmitting ? <Loader2 className="animate-spin"/> : 'Create Client'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function QRCodeModal({ url, clientName, onClose }) {
    const qrCodeRef = React.useRef(null);

    useEffect(() => {
        const scriptId = 'qrcode-library-script';
        const existingScript = document.getElementById(scriptId);

        const generateQr = () => {
            if (qrCodeRef.current && typeof QRCode !== "undefined") {
                qrCodeRef.current.innerHTML = "";
                new QRCode(qrCodeRef.current, {
                    text: url,
                    width: 256,
                    height: 256,
                    colorDark : "#000000",
                    colorLight : "#ffffff",
                    correctLevel : QRCode.CorrectLevel.H
                });
            }
        };

        if (!existingScript) {
            const script = document.createElement('script');
            script.id = scriptId;
            script.src = "https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js";
            script.async = true;
            script.onload = generateQr;
            document.body.appendChild(script);
        } else {
            generateQr();
        }
    }, [url]);

    const handleCopyLink = () => {
        navigator.clipboard.writeText(url)
            .then(() => toast.success("Link copied to clipboard!"))
            .catch(() => toast.error("Could not copy link."));
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black bg-opacity-60 z-40 flex justify-center items-center p-4" onClick={onClose}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-slate-800 mb-1">Client Login QR Code</h3>
                <p className="text-slate-600 mb-4 text-sm">For: **{clientName}**</p>
                <div ref={qrCodeRef} className="flex justify-center items-center p-4 border rounded-lg mb-4 bg-white">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
                </div>
                <p className="text-xs text-slate-500 mb-4">This QR code is valid for 5 minutes.</p>
                <div className="flex items-center gap-2">
                    <input type="text" readOnly value={url} className="w-full bg-slate-100 px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                    <button onClick={handleCopyLink} className="p-2 bg-slate-200 rounded-lg hover:bg-slate-300" title="Copy Link">
                        <Copy className="w-5 h-5 text-slate-700" />
                    </button>
                </div>
                <button onClick={onClose} className="mt-6 w-full bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-semibold">Done</button>
            </motion.div>
        </motion.div>
    );
}

// --- Invoices View Component ---
function InvoicesView({ user }) {
    const [invoices, setInvoices] = useState([]);
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isInvoiceModalOpen, setInvoiceModalOpen] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState(null);
    
    const userId = user.uid;
    const appId = 'default-app-id';

    useEffect(() => {
        if (!userId) return;
        setLoading(true);
        
        const invoicesCollection = collection(db, `artifacts/${appId}/users/${userId}/invoices`);
        const qInvoices = query(invoicesCollection);
        const unsubInvoices = onSnapshot(qInvoices, (snapshot) => {
            const invoicesData = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                invoiceDate: data.invoiceDate?.toDate ? data.invoiceDate.toDate() : null,
                dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : null,
            };
        });
            setInvoices(invoicesData);
        }, (error) => {
            console.error("Error fetching invoices: ", error);
            toast.error("Could not fetch invoices.");
        });

        const casesCollection = collection(db, `artifacts/${appId}/users/${userId}/cases`);
        const qCases = query(casesCollection);
        const unsubCases = onSnapshot(qCases, (snapshot) => {
            const casesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCases(casesData);
        }, (error) => {
            console.error("Error fetching cases: ", error);
            toast.error("Could not fetch cases for invoicing.");
        });

        setLoading(false);

        return () => {
            unsubInvoices();
            unsubCases();
        };
    }, [userId]);

    const handleCreateInvoice = () => {
        setEditingInvoice(null);
        setInvoiceModalOpen(true);
    };

    const handleEditInvoice = (invoice) => {
        setEditingInvoice(invoice);
        setInvoiceModalOpen(true);
    };

    const handleSaveInvoice = async (invoiceData) => {
        const invoicesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/invoices`);
        try {
            const dataToSave = {
                ...invoiceData,
                invoiceDate: Timestamp.fromDate(new Date(invoiceData.invoiceDate)),
                dueDate: Timestamp.fromDate(new Date(invoiceData.dueDate)),
            };

            if (editingInvoice) {
                const invoiceDocRef = doc(db, `artifacts/${appId}/users/${userId}/invoices`, editingInvoice.id);
                await updateDoc(invoiceDocRef, {
                    ...dataToSave,
                    updatedAt: serverTimestamp(),
                });
                toast.success("Invoice updated successfully!");
            } else {
                await addDoc(invoicesCollectionRef, {
                    ...dataToSave,
                    status: 'Draft',
                    createdAt: serverTimestamp(),
                });
                toast.success("Invoice saved as draft!");
            }
            setInvoiceModalOpen(false);
            setEditingInvoice(null);
        } catch (error) {
            console.error("Error saving invoice: ", error);
            toast.error("Failed to save invoice.");
        }
    };
    const handleGeneratePdf = (invoice) => {
        const relatedCase = cases.find(c => c.id === invoice.caseId);
        if (!relatedCase) {
            toast.error("Associated case data not found for this invoice. Cannot generate PDF.");
            return;
        }
        generateInvoice(invoice, relatedCase);
    };
const handleDeleteInvoice = async (invoiceId) => {
        if (!window.confirm("Are you sure you want to delete this invoice?")) {
            return;
        }
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/invoices`, invoiceId));
            toast.success("Invoice deleted successfully!");
        } catch (error) {
            console.error("Error deleting invoice: ", error);
            toast.error("Failed to delete invoice.");
        }
    };
    const filteredInvoices = useMemo(() => 
        invoices.filter(invoice => 
            invoice.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            invoice.invoiceNumber?.toString().includes(searchTerm.toLowerCase())
        ), 
    [invoices, searchTerm]);

    if (loading) {
        return <LoadingScreen message="Loading invoices..." />;
    }

    return (
        <>
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-700">Invoices</h2>
                    <button onClick={handleCreateInvoice} className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow">
                        <FilePlus className="w-5 h-5" />
                        <span>Create New Invoice</span>
                    </button>
                </div>

                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search by client or invoice #..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    />
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Invoice #</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Client</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Due Date</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {filteredInvoices.length > 0 ? filteredInvoices.map(invoice => (
                                <tr key={invoice.id}>
                                    <td className="px-6 py-4 whitespace-nowrap"><InvoiceStatusBadge status={invoice.status} /></td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{invoice.invoiceNumber}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">{invoice.clientName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{invoice.invoiceDate ? invoice.invoiceDate.toLocaleDateString() : 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{invoice.dueDate ? invoice.dueDate.toLocaleDateString() : 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-slate-800">{invoice.currency} {invoice.totalAmount?.toFixed(2)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                        <button onClick={() => handleGeneratePdf(invoice)} className="p-2 text-slate-500 hover:bg-green-100 hover:text-green-600 rounded-full" title="Download PDF">
                                            <FileDown className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleEditInvoice(invoice)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full" title="Edit Invoice">
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDeleteInvoice(invoice.id)} className="p-2 text-slate-500 hover:bg-red-100 hover:text-red-600 rounded-full" title="Delete Invoice">
    <Trash2 className="w-4 h-4" />
</button>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="7" className="text-center py-12 text-slate-500">No invoices found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <AnimatePresence>
                {isInvoiceModalOpen && (
                    <InvoiceFormModal 
                        isOpen={isInvoiceModalOpen}
                        onClose={() => setInvoiceModalOpen(false)}
                        onSave={handleSaveInvoice}
                        invoiceData={editingInvoice}
                        cases={cases}
                    />
                )}
            </AnimatePresence>
        </>
    );
}

// --- Invoice Form Modal ---
function InvoiceFormModal({ isOpen, onClose, onSave, invoiceData, cases }) {
    const initialLineItem = { description: '', quantity: 1, unitPrice: 0 };
    const [formData, setFormData] = useState({
        caseId: '',
        clientName: '',
        clientAddress: '',
        clientContact: '',
        clientEmail: '',
        invoiceNumber: `INV-${Date.now()}`,
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0],
        lineItems: [initialLineItem],
        currency: 'USD',
        paymentTerms: 'Net 30',
        notesToClient: '',
        internalNotes: '',
        totalAmount: 0,
    });

    useEffect(() => {
        if (invoiceData) {
            setFormData({
                ...invoiceData,
                invoiceDate: invoiceData.invoiceDate ? new Date(invoiceData.invoiceDate).toISOString().split('T')[0] : '',
                dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate).toISOString().split('T')[0] : '',
            });
        }
    }, [invoiceData]);

    useEffect(() => {
        const total = formData.lineItems.reduce((sum, item) => {
            return sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0);
        }, 0);
        setFormData(prev => ({ ...prev, totalAmount: total }));
    }, [formData.lineItems]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCaseChange = (e) => {
        const caseId = e.target.value;
        const selectedCase = cases.find(c => c.id === caseId);
        if (selectedCase) {
            setFormData(prev => ({
                ...prev,
                caseId: caseId,
                clientName: selectedCase.clientName || '',
                clientAddress: selectedCase.clientAddress || '',
                clientContact: selectedCase.clientContact || '',
                clientEmail: selectedCase.clientEmail || '',
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                caseId: '', clientName: '', clientAddress: '', clientContact: '', clientEmail: ''
            }));
        }
    };
    
    const handleLineItemChange = (index, field, value) => {
        const updatedLineItems = [...formData.lineItems];
        updatedLineItems[index][field] = value;
        setFormData(prev => ({ ...prev, lineItems: updatedLineItems }));
    };

    const addLineItem = () => {
        setFormData(prev => ({ ...prev, lineItems: [...prev.lineItems, { ...initialLineItem }] }));
    };

    const removeLineItem = (index) => {
        const updatedLineItems = formData.lineItems.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, lineItems: updatedLineItems }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black bg-opacity-60 z-40 flex justify-center items-center p-4" onClick={onClose}>
            <motion.div initial={{ y: -50 }} animate={{ y: 0 }} exit={{ y: -50 }} className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-800">{invoiceData ? 'Edit Invoice' : 'Create New Invoice'}</h2>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-200"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Case</label>
                            <select name="caseId" value={formData.caseId} onChange={handleCaseChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="">Select a Case</option>
                                {cases.map(c => <option key={c.id} value={c.id}>{c.caseTitle} ({c.clientName})</option>)}
                            </select>
                            {formData.caseId && (
                                <div className="mt-2 p-3 bg-slate-50 rounded-lg text-sm">
                                    <p className="font-semibold">{formData.clientName}</p>
                                    <p>{formData.clientAddress}</p>
                                    <p>{formData.clientContact}</p>
                                    <p>{formData.clientEmail}</p>
                                </div>
                            )}
                        </div>
                        <div className="space-y-4">
                            <InputField label="Invoice Date" name="invoiceDate" type="date" value={formData.invoiceDate} onChange={handleChange} />
                            <InputField label="Due Date" name="dueDate" type="date" value={formData.dueDate} onChange={handleChange} />
                        </div>
                    </div>
                    
                    <div>
                        <h3 className="text-lg font-semibold text-slate-700 mb-2">Items</h3>
                        <div className="space-y-2">
                            {formData.lineItems.map((item, index) => (
                                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                                    <input type="text" placeholder="Description" value={item.description} onChange={e => handleLineItemChange(index, 'description', e.target.value)} className="col-span-6 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                                    <input type="number" placeholder="Qty" value={item.quantity} onChange={e => handleLineItemChange(index, 'quantity', e.target.value)} className="col-span-2 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                                    <input type="number" placeholder="Price" value={item.unitPrice} onChange={e => handleLineItemChange(index, 'unitPrice', e.target.value)} className="col-span-3 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                                    <button type="button" onClick={() => removeLineItem(index)} className="col-span-1 p-2 text-red-500 hover:bg-red-100 rounded-full"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            ))}
                        </div>
                        <button type="button" onClick={addLineItem} className="mt-2 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-semibold">
                            <PlusCircle className="w-4 h-4" /> Add Item
                        </button>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Currency</label>
                            <select name="currency" value={formData.currency} onChange={handleChange} className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option>USD</option>
                                <option>PKR</option>
                                <option>EUR</option>
                                <option>GBP</option>
                            </select>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-slate-500">Total Amount</p>
                            <p className="text-2xl font-bold text-slate-800">{formData.currency} {formData.totalAmount.toFixed(2)}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Payment Terms</label>
                            <select name="paymentTerms" value={formData.paymentTerms} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                                <option>Net 15</option>
                                <option>Net 30</option>
                                <option>Net 60</option>
                                <option>Due on Receipt</option>
                            </select>
                        </div>
                        <TextAreaField label="Notes for Client" name="notesToClient" value={formData.notesToClient} onChange={handleChange} />
                        <div className="md:col-span-2">
                             <TextAreaField label="Internal Notes (not visible to client)" name="internalNotes" value={formData.internalNotes} onChange={handleChange} />
                        </div>
                    </div>
                    
                    <div className="pt-6 border-t flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200">Cancel</button>
                        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                            {invoiceData ? 'Save Changes' : 'Save as Draft'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
}

const InvoiceStatusBadge = ({ status }) => {
    const statusStyles = {
        'Paid': 'bg-green-100 text-green-800',
        'Draft': 'bg-yellow-100 text-yellow-800',
        'Sent': 'bg-blue-100 text-blue-800',
        'Overdue': 'bg-red-100 text-red-800',
        'default': 'bg-slate-100 text-slate-800'
    };
    return (<span className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyles[status] || statusStyles['default']}`}>{status}</span>);
};



// --- CasesView Component (Updated) ---
// Is poore function ko apni App.jsx file ke CasesView function se replace karein.
// ----------------------------------------------------------------------------------
function CasesView({ user, userRole, searchTerm, setSearchTerm, clients }) { // <-- 'clients' add karein
  const [cases, setCases] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All');
  const [deletingCaseId, setDeletingCaseId] = useState(null);

  const userId = user.uid;
  const appId = 'default-app-id';

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribes = [];
    
    let ownerLoaded = false;
    let assignedLoaded = false;
    let usersLoaded = userRole !== 'admin';

    const checkLoadingStatus = () => {
        if (ownerLoaded && assignedLoaded && usersLoaded) {
            setLoading(false);
        }
    }

    if (userRole === 'admin') {
        const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
            setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            usersLoaded = true;
            checkLoadingStatus();
        }, (error) => {
            console.error("Error fetching user list for admin:", error);
            toast.error("Could not load user list.");
            usersLoaded = true;
            checkLoadingStatus();
        });
        unsubscribes.push(unsubUsers);
    }

    let ownerCases = [];
    let assignedCases = [];

    const updateCombinedCases = () => {
        const combined = [...ownerCases, ...assignedCases];
        const uniqueCasesMap = new Map();
        combined.forEach(caseItem => {
            if (!uniqueCasesMap.has(caseItem.id)) {
                uniqueCasesMap.set(caseItem.id, caseItem);
            }
        });
        setCases(Array.from(uniqueCasesMap.values()));
    };

    const ownerCasesRef = collection(db, `artifacts/${appId}/users/${userId}/cases`);
    const unsubOwner = onSnapshot(ownerCasesRef, (snapshot) => {
      ownerCases = snapshot.docs.map(doc => ({ id: doc.id, ownerId: userId, ...doc.data() }));
      ownerLoaded = true;
      updateCombinedCases();
      checkLoadingStatus();
    }, (error) => {
      console.error("Error fetching owner cases:", error);
      ownerLoaded = true;
      checkLoadingStatus();
    });
    unsubscribes.push(unsubOwner);

    // FINAL FIX: Removed the orderBy clause to prevent index-related permission errors.
    // The query will now work reliably without a complex composite index.
    const assignedCasesQuery = query(
        collectionGroup(db, 'cases'), 
        where('assignedTo', 'array-contains', userId)
    );

    const unsubAssigned = onSnapshot(assignedCasesQuery, (snapshot) => {
      const pathSegmentsIndex = 3;
      assignedCases = snapshot.docs.map(doc => ({ id: doc.id, ownerId: doc.ref.path.split('/')[pathSegmentsIndex], ...doc.data() }));
      assignedLoaded = true;
      updateCombinedCases();
      checkLoadingStatus();
    }, (error) => {
      console.error("Error fetching assigned cases:", error);
      toast.error("Error fetching assigned cases: " + error.message);
      assignedLoaded = true;
      checkLoadingStatus();
    });
    unsubscribes.push(unsubAssigned);

    return () => unsubscribes.forEach(unsub => unsub());
  },[userId, userRole]); 

  const handleAddCase = () => { setEditingCase(null); setIsModalOpen(true); };
  const handleEditCase = (caseData) => { setEditingCase(caseData); setIsModalOpen(true); };
  const handleInitiateDelete = (caseId) => { setDeletingCaseId(caseId); };

  const confirmDelete = async () => {
    if (!deletingCaseId) return;
    try {
      const caseToDelete = cases.find(c => c.id === deletingCaseId);
      if (caseToDelete?.attachments) {
        for (const attachment of caseToDelete.attachments) {
          await deleteObject(ref(storage, attachment.storagePath));
        }
      }
      await deleteDoc(doc(db, `artifacts/${appId}/users/${caseToDelete.ownerId}/cases`, deletingCaseId));
      toast.success('Case file and all attachments deleted!');
    } catch (error) {
      console.error("Error deleting case: ", error);
      toast.error('Failed to delete case file.');
    }
    setDeletingCaseId(null);
  };

  const handleSaveCase = async (caseData, fileToUpload, setUploadProgress) => {
    const dataToSave = {
        ...caseData,
        hourlyRate: parseFloat(caseData.hourlyRate) || 0,
        updatedAt: serverTimestamp(),
        // Ensure createdAt is always present on new cases
        createdAt: caseData.createdAt || serverTimestamp(),
    };

    try {
      if (editingCase) {
        const caseDocRef = doc(db, `artifacts/${appId}/users/${editingCase.ownerId}/cases`, editingCase.id);
        await updateDoc(caseDocRef, dataToSave);
        if (fileToUpload) {
          const storagePath = `artifacts/${appId}/users/${editingCase.ownerId}/${editingCase.id}/${Date.now()}_${fileToUpload.name}`;
          const downloadURL = await uploadFile(fileToUpload, storagePath, setUploadProgress);
          await updateDoc(caseDocRef, { attachments: arrayUnion({ name: fileToUpload.name, url: downloadURL, storagePath }) });
        }
        toast.success('Case file updated!');
      } else {
        const newCaseData = { ...dataToSave, attachments: [], expenses: [], timeLogs: [], ownerId: userId };
        const casesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/cases`);
        const newCaseRef = await addDoc(casesCollectionRef, newCaseData);
        if (fileToUpload) {
          const storagePath = `artifacts/${appId}/users/${userId}/${newCaseRef.id}/${Date.now()}_${fileToUpload.name}`;
          const downloadURL = await uploadFile(fileToUpload, storagePath, setUploadProgress);
          await updateDoc(newCaseRef, { attachments: arrayUnion({ name: fileToUpload.name, url: downloadURL, storagePath }) });
        }
        toast.success('Case file added!');
      }
      setIsModalOpen(false);
      setEditingCase(null);
    } catch (error) {
      console.error("Error saving document: ", error);
      toast.error('Failed to save case file.');
    }
  };

  const uploadFile = (file, storagePath, setProgress) => {
    return new Promise((resolve, reject) => {
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file);
      uploadTask.on('state_changed',
        (snapshot) => setProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        (error) => reject(error),
        async () => resolve(await getDownloadURL(uploadTask.snapshot.ref))
      );
    });
  };

  const handleDeleteAttachment = async (caseId, ownerId, attachment) => {
    if (!window.confirm(`Are you sure you want to delete the file: ${attachment.name}?`)) return;
    try {
      await deleteObject(ref(storage, attachment.storagePath));
      await updateDoc(doc(db, `artifacts/${appId}/users/${ownerId}/cases`, caseId), { attachments: arrayRemove(attachment) });
      toast.success("Attachment deleted.");
    } catch (error) {
      console.error("Error deleting attachment:", error);
      toast.error("Failed to delete attachment.");
    }
  };

  const filteredCases = useMemo(() => cases.filter(c =>
    (activeFilter === 'All' || c.tags?.includes(activeFilter)) &&
    (searchTerm === '' ||
      c.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.caseTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.caseNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.courtName?.toLowerCase().includes(searchTerm.toLowerCase()))
  ), [cases, searchTerm, activeFilter]);

  const allTags = useMemo(() => ['All', ...Array.from(new Set(cases.flatMap(c => c.tags || [])))], [cases]);

  if (loading) {
      return <LoadingScreen message="Loading cases..." />;
  }

  return (
    <>
      <div className="bg-white p-4 rounded-xl shadow-lg mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-auto sm:flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input type="text" placeholder="Search by client, title, case no..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-48">
            <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} className="w-full appearance-none bg-white px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              {allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
          </div>
          <button onClick={handleAddCase} className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow">
            <FilePlus className="w-5 h-5" />
            <span className="hidden sm:inline">Add Case</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {filteredCases.length > 0 ? filteredCases.map(c => {
            const assignedEmails = (userRole === 'admin' && allUsers.length > 0 && c.assignedTo)
              ? c.assignedTo.map(uid => allUsers.find(u => u.id === uid)?.email || 'Unknown').join(', ')
              : (c.assignedTo && c.assignedTo.length > 0 ? `${c.assignedTo.length} lawyer(s) assigned` : 'N/A');

            return (
            <motion.div key={c.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-xl shadow-lg p-6 flex flex-col">
              <div className="flex-grow">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg text-slate-800 pr-2">{c.caseTitle}</h3>
                  <CaseStatusBadge status={c.caseStatus} />
                </div>
                <p className="text-sm text-slate-500 mb-4">Case #: {c.caseNumber}</p>
                <div className="space-y-3 text-sm text-slate-600 mb-4">
                  <InfoItem icon={User} label="Client" value={c.clientName} />
                  <InfoItem icon={CalendarIcon} label="Date Filed" value={c.caseFiledOn ? new Date(c.caseFiledOn).toLocaleDateString() : 'N/A'} />
                  <InfoItem icon={Users} label="Opposing Party" value={c.opposingParty} />
                  <InfoItem icon={Briefcase} label="Court" value={c.courtName} />
                  <InfoItem icon={MapPin} label="File Location" value={c.fileLocation} />
                  <InfoItem icon={Users} label="Assigned To" value={assignedEmails} />
                </div>
                <div className="mb-4">
                  <h4 className="font-semibold text-xs text-slate-500 mb-2">TAGS</h4>
                  <div className="flex flex-wrap gap-2">{c.tags?.map(tag => <span key={tag} className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded-full">{tag}</span>)}</div>
                </div>
                <div className="mb-4">
                  <h4 className="font-semibold text-xs text-slate-500 mb-2">NOTES</h4>
                  <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-md whitespace-pre-wrap">{c.notes}</p>
                </div>
                {c.decisionSummary && <div className="mb-4"><h4 className="font-semibold text-xs text-slate-500 mb-2">DECISION SUMMARY</h4><p className="text-sm text-slate-700 bg-amber-50 p-3 rounded-md whitespace-pre-wrap">{c.decisionSummary}</p></div>}
                {c.attachments && c.attachments.length > 0 && <div className="mb-4"><h4 className="font-semibold text-xs text-slate-500 mb-2">ATTACHMENTS</h4><ul className="space-y-2">{c.attachments.map((att, i) => <li key={i} className="flex items-center justify-between bg-slate-50 p-2 rounded-md"><a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline truncate"><Paperclip className="w-4 h-4" /><span className="truncate">{att.name}</span></a><button onClick={() => handleDeleteAttachment(c.id, c.ownerId, att)} className="p-1 text-slate-400 hover:text-red-600 flex-shrink-0"><X className="w-3 h-3" /></button></li>)}</ul></div>}
                <Tasks caseId={c.id} caseTitle={c.caseTitle} caseOwnerId={c.ownerId} loggedInUserId={userId} appId={appId} />
              </div>
              <div className="flex justify-end space-x-2 mt-4">
                <button onClick={() => handleEditCase(c)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full"><Edit className="w-4 h-4" /></button>
                <button onClick={() => handleInitiateDelete(c.id)} className="p-2 text-slate-500 hover:bg-red-100 hover:text-red-600 rounded-full"><Trash2 className="w-4 h-4" /></button>
              </div>
            </motion.div>
          )}) : <div className="col-span-full text-center py-12"><p className="text-slate-500">No case files found. Click 'Add Case' to get started!</p></div>}
        </AnimatePresence>
      </div>

      <AnimatePresence>{isModalOpen && <CaseFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveCase} caseData={editingCase} userRole={userRole} allUsers={allUsers} clients={clients} />}</AnimatePresence>
      <AnimatePresence>{deletingCaseId && <ConfirmDeleteModal isOpen={!!deletingCaseId} onClose={() => setDeletingCaseId(null)} onConfirm={confirmDelete} />}</AnimatePresence>
    </>
  );
}

function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingEmail, setProcessingEmail] = useState(null);

  useEffect(() => {
    const usersCollection = collection(db, 'users');
    const q = query(usersCollection);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users: ", error);
      toast.error("Could not fetch user list.");
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleMakeAdmin = async (email) => {
    if (!window.confirm(`Are you sure you want to make ${email} an admin?`)) return;
    setProcessingEmail(email);
    try {
      const grantAdminRole = httpsCallable(functions, 'grantAdminRole');
      const result = await grantAdminRole({ email: email });
      toast.success(result.data.result);
    } catch (error) {
      console.error("Error granting admin role:", error);
      toast.error(error.message);
    }
    setProcessingEmail(null);
  };

  if (loading) return <LoadingScreen message="Loading users..." />;

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold text-slate-700 mb-4">User Management</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">User Email</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Role</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{user.email}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  {user.role === 'admin' ? (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">Admin</span>
                  ) : (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Member</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {user.role !== 'admin' && (
                    <button onClick={() => handleMakeAdmin(user.email)} disabled={processingEmail === user.email} className="text-indigo-600 hover:text-indigo-900 disabled:text-slate-400 disabled:cursor-wait flex items-center">
                      {processingEmail === user.email && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Make Admin
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CalendarView({ user }) {
  const [cases, setCases] = useState([]);
  const [customEvents, setCustomEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEventModalOpen, setEventModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  
  const userId = user.uid;

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    const casesCollection = collection(db, `artifacts/default-app-id/users/${userId}/cases`);
    const qCases = query(casesCollection);
    const unsubCases = onSnapshot(qCases, (snapshot) => {
      setCases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const eventsCollection = collection(db, `users/${userId}/events`);
    const qEvents = query(eventsCollection);
    const unsubEvents = onSnapshot(qEvents, (snapshot) => {
        setCustomEvents(snapshot.docs.map(doc => ({...doc.data(), id: doc.id, start: doc.data().start.toDate(), end: doc.data().end.toDate() })));
        setLoading(false);
    });

    return () => {
        unsubCases();
        unsubEvents();
    };
  }, [userId]);

  const allEvents = useMemo(() => {
    const hearingEvents = cases.flatMap(c => 
      (c.hearingDates || []).map(date => ({
        id: `${c.id}-${date}`,
        title: `Hearing: ${c.caseTitle}`,
        start: moment(date).startOf('day').toDate(),
        end: moment(date).startOf('day').toDate(),
        allDay: true,
        isHearing: true,
      }))
    );
    const formattedCustomEvents = customEvents.map(e => ({...e, isHearing: false}));
    return [...hearingEvents, ...formattedCustomEvents];
  }, [cases, customEvents]);
  
  const handleSelectSlot = useCallback(({ start, end }) => {
    setSelectedSlot({ start, end });
    setSelectedEvent(null);
    setEventModalOpen(true);
  }, []);

  const handleSelectEvent = useCallback((event) => {
    if (event.isHearing) {
        toast.info("Case hearings cannot be edited from the calendar.");
        return;
    }
    setSelectedSlot(null);
    setSelectedEvent(event);
    setEventModalOpen(true);
  }, []);

  const handleSaveEvent = async (eventData) => {
    const eventsCollectionRef = collection(db, `users/${userId}/events`);
    const { id, ...dataToSave } = eventData;
    dataToSave.start = Timestamp.fromDate(new Date(dataToSave.start));
    dataToSave.end = Timestamp.fromDate(new Date(dataToSave.end));

    try {
        if (id) {
            await updateDoc(doc(db, `users/${userId}/events`, id), dataToSave);
            toast.success("Appointment updated!");
        } else {
            await addDoc(eventsCollectionRef, dataToSave);
            toast.success("Appointment added!");
        }
        setEventModalOpen(false);
    } catch (error) {
        console.error("Error saving event: ", error);
        toast.error("Failed to save appointment.");
    }
  };

  const handleDeleteEvent = async (eventId) => {
      if (!eventId || !window.confirm("Are you sure you want to delete this appointment?")) return;
      try {
          await deleteDoc(doc(db, `users/${userId}/events`, eventId));
          toast.success("Appointment deleted.");
          setEventModalOpen(false);
      } catch (error) {
          console.error("Error deleting event: ", error);
          toast.error("Failed to delete appointment.");
      }
  };

  const eventStyleGetter = (event) => ({
    style: {
      backgroundColor: event.isHearing ? '#3b82f6' : (event.completed ? '#a78bfa' : '#8b5cf6'),
      borderRadius: '5px',
      opacity: 0.8,
      color: 'white',
      border: '0px',
      display: 'block',
      textDecoration: event.completed ? 'line-through' : 'none',
    }
  });

  if (loading) {
    return <LoadingScreen message="Loading calendar events..." />;
  }

  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg h-[80vh]">
      <Calendar
        localizer={localizer}
        events={allEvents}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '100%' }}
        selectable
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        eventPropGetter={eventStyleGetter}
      />
      <AnimatePresence>
        {isEventModalOpen && (
            <EventModal 
                isOpen={isEventModalOpen} 
                onClose={() => setEventModalOpen(false)}
                onSave={handleSaveEvent}
                onDelete={handleDeleteEvent}
                eventData={selectedEvent}
                slotInfo={selectedSlot}
            />
        )}
      </AnimatePresence>
    </div>
  );
}

function EventModal({ isOpen, onClose, onSave, onDelete, eventData, slotInfo }) {
    const [formData, setFormData] = useState({
        title: '',
        note: '',
        start: '',
        end: '',
        completed: false,
        notify: false,
        notifyEmail: '',
        notifyWhatsApp: '',
    });

    useEffect(() => {
        const getInitialData = () => {
            if (eventData) {
                return {
                    title: eventData.title || '',
                    note: eventData.note || '',
                    start: moment(eventData.start).format('YYYY-MM-DDTHH:mm'),
                    end: moment(eventData.end).format('YYYY-MM-DDTHH:mm'),
                    completed: eventData.completed || false,
                    notify: eventData.notify || false,
                    notifyEmail: eventData.notifyEmail || '',
                    notifyWhatsApp: eventData.notifyWhatsApp || '',
                };
            }
            if (slotInfo) {
                return {
                    title: '',
                    note: '',
                    start: moment(slotInfo.start).format('YYYY-MM-DDTHH:mm'),
                    end: moment(slotInfo.end).format('YYYY-MM-DDTHH:mm'),
                    completed: false,
                    notify: false,
                    notifyEmail: '',
                    notifyWhatsApp: '',
                };
            }
            return {};
        };
        setFormData(getInitialData());
    }, [eventData, slotInfo]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({ id: eventData?.id, ...formData });
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
                <h2 className="text-xl font-bold text-slate-800 mb-4">{eventData ? 'Edit Appointment' : 'Add Appointment'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <InputField label="Title" name="title" value={formData.title} onChange={handleChange} required />
                    <TextAreaField label="Note" name="note" value={formData.note} onChange={handleChange} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputField label="Start Time" name="start" type="datetime-local" value={formData.start} onChange={handleChange} required />
                        <InputField label="End Time" name="end" type="datetime-local" value={formData.end} onChange={handleChange} required />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputField label="Email to Notify" name="notifyEmail" type="email" value={formData.notifyEmail} onChange={handleChange} />
                        <InputField label="WhatsApp to Notify" name="notifyWhatsApp" value={formData.notifyWhatsApp} onChange={handleChange} />
                    </div>
                    <div className="flex items-center justify-between">
                        <CheckboxField label="Completed" name="completed" checked={formData.completed} onChange={handleChange} />
                        <CheckboxField label="Notify" name="notify" checked={formData.notify} onChange={handleChange} />
                    </div>
                    <div className="flex justify-between items-center pt-4">
                        <div>
                            {eventData && (
                                <button type="button" onClick={() => onDelete(eventData.id)} className="text-red-600 hover:text-red-800 font-semibold">Delete</button>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button type="button" onClick={onClose} className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200">Cancel</button>
                            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Save</button>
                        </div>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
}


// --- Main Dashboard View Component ---
function DashboardView({ user, setView, setSearchTerm }) {
    const [cases, setCases] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const userId = user.uid;

    useEffect(() => {
        if (!userId) return;
        setLoading(true);
        let casesLoaded = false, tasksLoaded = false, eventsLoaded = false;
        
        const checkLoading = () => {
            if (casesLoaded && tasksLoaded && eventsLoaded) {
                setLoading(false);
            }
        };

        const qCases = query(collection(db, `artifacts/default-app-id/users/${userId}/cases`), orderBy("updatedAt", "desc"));
        const unsubCases = onSnapshot(qCases, (snapshot) => {
            setCases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), updatedAt: doc.data().updatedAt?.toDate() })));
            casesLoaded = true; checkLoading();
        }, (err) => { console.error("Error fetching cases:", err); toast.error("Could not load cases."); });

        const qTasks = query(collectionGroup(db, 'tasks'), where('assignedTo', '==', userId));
        const unsubTasks = onSnapshot(qTasks, (snapshot) => {
            setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), dueDate: doc.data().dueDate?.toDate() })));
            tasksLoaded = true; checkLoading();
        }, (err) => { console.error("Error fetching tasks:", err); toast.error("Could not load tasks."); });
        
        const qEvents = query(collection(db, `users/${userId}/events`), where('start', '>=', Timestamp.now()), orderBy('start', 'asc'));
        const unsubEvents = onSnapshot(qEvents, (snapshot) => {
            setEvents(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, start: doc.data().start.toDate(), end: doc.data().end.toDate() })));
            eventsLoaded = true; checkLoading();
        }, (err) => { console.error("Error fetching events:", err); toast.error("Could not load events."); });

        return () => { unsubCases(); unsubTasks(); unsubEvents(); };
    }, [userId]);

    if (loading) {
        return <LoadingScreen message="Loading dashboard..." />;
    }

    return (
        <div className="space-y-8">
            <MyTasksSummary tasks={tasks} setView={setView} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <TasksDueThisWeek tasks={tasks} setView={setView} />
                </div>
                <div className="lg:col-span-1">
                    <UpcomingEvents cases={cases} events={events} setView={setView} />
                </div>
            </div>
            {/* NEW SECTION FOR CASE DISTRIBUTION AND RECENTLY COMPLETED CASES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <CaseDistributionChart cases={cases} setView={setView} setSearchTerm={setSearchTerm} />
                 <RecentlyCompletedCases cases={cases} setView={setView} setSearchTerm={setSearchTerm} />
            </div>
        </div>
    );
}

// --- MODIFIED: Dashboard Widgets now accept `setView` for navigation ---

const MyTasksSummary = ({ tasks, setView }) => {
    const summary = useMemo(() => {
        const now = moment().startOf('day');
        let overdue = 0, dueToday = 0, pending = 0;
        tasks.forEach(task => {
            if (task.completed) return;
            const dueDate = task.dueDate ? moment(task.dueDate).startOf('day') : null;
            if (dueDate) {
                if (dueDate.isBefore(now)) overdue++;
                else if (dueDate.isSame(now)) dueToday++;
                else pending++;
            } else {
                pending++;
            }
        });
        return { overdue, dueToday, pending };
    }, [tasks]);

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg">
            <h2 className="text-xl font-bold text-slate-700 mb-4">My Task Summary</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button onClick={() => setView('cases')} className="transition-transform duration-200 hover:scale-105"><StatCard iconName="Clock" title="Overdue" value={summary.overdue} color="red" /></button>
                <button onClick={() => setView('cases')} className="transition-transform duration-200 hover:scale-105"><StatCard iconName="ListTodo" title="Due Today" value={summary.dueToday} color="orange" /></button>
                <button onClick={() => setView('cases')} className="transition-transform duration-200 hover:scale-105"><StatCard iconName="Inbox" title="Pending" value={summary.pending} color="blue" /></button>
            </div>
        </div>
    );
};

const TasksDueThisWeek = ({ tasks, setView }) => {
    const weeklyData = useMemo(() => {
        const week = Array(7).fill(0).map((_, i) => ({ day: moment().add(i, 'days').format('ddd'), tasks: 0 }));
        tasks.forEach(task => {
            if (task.completed || !task.dueDate) return;
            const now = moment().startOf('day');
            const sevenDaysFromNow = moment().add(6, 'days').endOf('day');
            const dueDate = moment(task.dueDate);
            if (dueDate.isBetween(now, sevenDaysFromNow, undefined, '[]')) {
                const dayIndex = dueDate.diff(now, 'days');
                if (dayIndex >= 0 && dayIndex < 7) {
                    week[dayIndex].tasks++;
                }
            }
        });
        return week;
    }, [tasks]);

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg h-full">
            <h3 onClick={() => setView('calendar')} className="font-bold text-slate-800 text-lg mb-4 cursor-pointer hover:text-blue-600 transition-colors">Tasks Due This Week</h3>
            <ResponsiveContainer width="100%" height={250}>
                <BarChart data={weeklyData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="tasks" fill="#8884d8" name="Tasks" />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};


const UpcomingEvents = ({ cases, events, setView }) => {
    const upcomingEvents = useMemo(() => {
        const now = new Date();
        const hearingEvents = cases.flatMap(c => 
            (c.hearingDates || [])
                .map(dateStr => new Date(dateStr))
                .filter(date => date >= now)
                .map(date => ({ id: `${c.id}-${date.toISOString()}`, title: `Hearing: ${c.caseTitle}`, start: date, isHearing: true }))
        );
        const customEvents = events
            .filter(e => e.start >= now)
            .map(e => ({ ...e, isHearing: false }));
        
        return [...hearingEvents, ...customEvents]
            .sort((a, b) => a.start - b.start)
            .slice(0, 7);
    }, [cases, events]);

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg h-full">
             <h3 className="font-bold text-slate-800 text-lg mb-4">Upcoming Events & Hearings</h3>
             {upcomingEvents.length > 0 ? (
                <ul className="space-y-2">
                    {upcomingEvents.map(event => (
                        <li key={event.id} onClick={() => setView('calendar')} className="flex items-start gap-3 p-2 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                            <div className="p-2 bg-slate-100 rounded-lg mt-1">
                                {event.isHearing ? <Briefcase className="w-4 h-4 text-blue-600"/> : <CalendarIcon className="w-4 h-4 text-indigo-600"/>}
                            </div>
                            <div className="flex-grow">
                                <p className="text-sm font-medium text-slate-800">{event.title}</p>
                                <p className="text-xs text-slate-500">{moment(event.start).format('ddd, MMM D, YYYY @ h:mm A')}</p>
                            </div>
                        </li>
                    ))}
                </ul>
             ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
                    <CalendarDays className="w-10 h-10 mb-2"/>
                    <p className="text-sm text-slate-500">No upcoming events.</p>
                </div>
             )}
        </div>
    );
};

const RecentlyCompletedCases = ({ cases, setView, setSearchTerm }) => {
    const completedCases = useMemo(() => {
        return cases
            .filter(c => ['Decided', 'Closed'].includes(c.caseStatus))
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)) 
            .slice(0, 5);
    }, [cases]);

    const handleCaseClick = (caseItem) => {
        setSearchTerm(caseItem.caseTitle); // Set the search term to the case title
        setView('cases'); // Switch to the cases view
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg h-full">
             <h3 className="font-bold text-slate-800 text-lg mb-4">Recently Completed Cases</h3>
             {completedCases.length > 0 ? (
                <ul className="space-y-2">
                    {completedCases.map(c => (
                        <li key={c.id} onClick={() => handleCaseClick(c)} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0"/>
                            <div className="flex-grow">
                                <p className="text-sm font-medium text-slate-700">{c.caseTitle}</p>
                                <p className="text-xs text-slate-500">Completed on: {c.updatedAt ? c.updatedAt.toLocaleDateString() : 'N/A'}</p>
                            </div>
                        </li>
                    ))}
                </ul>
             ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
                    <Archive className="w-10 h-10 mb-2"/>
                    <p className="text-sm text-slate-500">No cases completed recently.</p>
                </div>
             )}
        </div>
    );
};
// --- NEW COMPONENT: CaseDistributionChart ---
const CaseDistributionChart = ({ cases, setView, setSearchTerm }) => {
    const data = useMemo(() => {
        const counts = cases.reduce((acc, caseItem) => {
            (caseItem.tags || []).forEach(tag => {
                acc[tag] = (acc[tag] || 0) + 1;
            });
            return acc;
        }, {});

        const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F', '#FFBB28', '#FF8042']; // Define a set of colors

        return Object.entries(counts).map(([tag, value], index) => ({
            name: tag,
            value: value,
            color: colors[index % colors.length] // Cycle through colors
        }));
    }, [cases]);

    const onPieSliceClick = useCallback((dataEntry) => {
        // When a slice is clicked, set the search term to the tag and navigate to cases view
        setSearchTerm(dataEntry.name);
        setView('cases');
    }, [setSearchTerm, setView]);

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg h-full">
            <h3 className="font-bold text-slate-800 text-lg mb-4">Case Distribution by Type</h3>
            {data.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            nameKey="name"
                            onClick={onPieSliceClick} // Make slices clickable
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
                    <Briefcase className="w-10 h-10 mb-2"/>
                    <p className="text-sm text-slate-500">No cases with tags to display distribution.</p>
                </div>
            )}
        </div>
    );
};

const iconMap = {
    Briefcase,
    Activity,
    Archive,
    Calendar: CalendarIcon,
    Clock,
    ListTodo,
    Inbox
};

const StatCard = ({ iconName, title, value, color }) => {
    const colors = {
        blue: 'bg-blue-100 text-blue-600',
        green: 'bg-green-100 text-green-600',
        orange: 'bg-orange-100 text-orange-600',
        purple: 'bg-purple-100 text-purple-600',
        red: 'bg-red-100 text-red-600',
    };
    const Icon = iconMap[iconName];
    if (!Icon) return null;

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg flex items-center space-x-4 w-full text-left">
            <div className={`p-3 rounded-full ${colors[color] || 'bg-slate-100'}`}>
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-sm text-slate-500">{title}</p>
                <p className="text-2xl font-bold text-slate-800">{value}</p>
            </div>
        </div>
    );
};

// ----------------------------------------------------------------------------------
// --- CaseFormModal Component (Updated) ---
// Is poore function ko apni App.jsx file ke CaseFormModal function se replace karein.
// ----------------------------------------------------------------------------------
function CaseFormModal({ isOpen, onClose, onSave, caseData, userRole, allUsers, clients = [] }) { // <-- 'clients' ko prop ke taur par receive karein
    const initialFormState = { clientName: '', clientId: '', clientAddress: '', clientContact: '', clientEmail: '', caseTitle: '', courtName: '', caseNumber: '', hearingDates: [], opposingParty: '', fileLocation: '', tags: [], notes: '', attachments: [], caseStatus: 'Active', caseFiledOn: '', decisionSummary: '', hourlyRate: 0, expenses: [], assignedTo: [], allowAssignedToEdit: false };
    const [formData, setFormData] = useState(initialFormState);
    const [newDate, setNewDate] = useState('');
    const [newTag, setNewTag] = useState('');
    const [newExpense, setNewExpense] = useState({ description: '', amount: '' });
    const [fileToUpload, setFileToUpload] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [loading, setLoading] = useState(false);

    // DEBUGGING: Yeh line aapko console mein user ka role batayegi.
    console.log("CaseFormModal loaded. Current user role is:", userRole);

    useEffect(() => {
        if (caseData) {
            setFormData({ ...initialFormState, ...caseData });
        } else {
            setFormData(initialFormState);
        }
        setFileToUpload(null);
        setUploadProgress(0);
    }, [caseData, isOpen]);

    const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleFileChange = (e) => { if (e.target.files[0]) setFileToUpload(e.target.files[0]); };
    const handleAddDate = () => { if (newDate && !formData.hearingDates.includes(newDate)) { setFormData(prev => ({ ...prev, hearingDates: [...prev.hearingDates, newDate].sort() })); setNewDate(''); } };
    const handleRemoveDate = (dateToRemove) => setFormData(prev => ({ ...prev, hearingDates: prev.hearingDates.filter(d => d !== dateToRemove) }));
    const handleAddTag = () => { if (newTag && !formData.tags.includes(newTag.trim())) { setFormData(prev => ({ ...prev, tags: [...prev.tags, newTag.trim()] })); setNewTag(''); } };
    const handleRemoveTag = (tagToRemove) => setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tagToRemove) }));
    
    const handleAddExpense = () => {
        if (newExpense.description && newExpense.amount) {
            const amount = parseFloat(newExpense.amount);
            if (!isNaN(amount)) {
                setFormData(prev => ({ ...prev, expenses: [...(prev.expenses || []), { ...newExpense, amount }] }));
                setNewExpense({ description: '', amount: '' });
            } else {
                toast.error("Please enter a valid amount for the expense.");
            }
        }
    };

    const handleRemoveExpense = (indexToRemove) => {
        setFormData(prev => ({
            ...prev,
            expenses: prev.expenses.filter((_, index) => index !== indexToRemove)
        }));
    };

    const handleSubmit = async (e) => { e.preventDefault(); setLoading(true); await onSave(formData, fileToUpload, setUploadProgress); setLoading(false); };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black bg-opacity-50 z-30 flex justify-center items-center p-4" onClick={onClose}>
            <motion.div initial={{ scale: 0.9, y: -20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: -20 }} className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-800">{caseData ? 'Edit Case File' : 'Add New Case File'}</h2>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-200"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-slate-700 border-b pb-2">Client Information</h3>
                    {userRole === 'admin' ? (
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Assign to Client</label>
                            <select 
                                name="clientId" 
                                value={formData.clientId || ''} 
                                onChange={(e) => {
                                    const selectedClient = clients.find(c => c.id === e.target.value);
                                    setFormData(prev => ({
                                        ...prev,
                                        clientId: selectedClient ? selectedClient.id : '',
                                        clientName: selectedClient ? selectedClient.name : '',
                                        clientEmail: selectedClient ? selectedClient.email : ''
                                    }));
                                }}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            >
                                <option value="">Select an existing client</option>
                                {clients.map(client => ( 
                                    <option key={client.id} value={client.id}>{client.name} ({client.email})</option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <InputField name="clientName" label="Client Name" value={formData.clientName} onChange={handleChange} required />
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputField name="clientEmail" label="Client Email" type="email" value={formData.clientEmail} onChange={handleChange} disabled={userRole === 'admin' && !!formData.clientId} />
                        <InputField name="clientContact" label="Client Contact Number" value={formData.clientContact} onChange={handleChange} />
                    </div>
                    <TextAreaField name="clientAddress" label="Client Address" value={formData.clientAddress} onChange={handleChange} />

                    <h3 className="text-lg font-semibold text-slate-700 border-b pb-2 pt-4">Case Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputField name="caseTitle" label="Case Title" value={formData.caseTitle} onChange={handleChange} required />
                        <InputField name="caseNumber" label="Case Number" value={formData.caseNumber} onChange={handleChange} required />
                        <InputField name="courtName" label="Court Name / Type" value={formData.courtName} onChange={handleChange} required />
                        <InputField name="opposingParty" label="Opposing Party" value={formData.opposingParty} onChange={handleChange} />
                        <InputField name="fileLocation" label="Physical File Location" value={formData.fileLocation} onChange={handleChange} />
                        <InputField name="caseFiledOn" label="Date Case Filed" type="date" value={formData.caseFiledOn} onChange={handleChange} />
                        <InputField name="hourlyRate" label="Hourly Rate ($)" type="number" value={formData.hourlyRate} onChange={handleChange} />
                        <div>
                            <label htmlFor="caseStatus" className="block text-sm font-medium text-slate-600 mb-1">Case Status</label>
                            <select id="caseStatus" name="caseStatus" value={formData.caseStatus} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option>Active</option><option>Pending</option><option>Appeal</option><option>Decided</option><option>Closed</option>
                            </select>
                        </div>
                    </div>
                    
                    {/* Other sections like Expenses, Hearing Dates, Tags remain the same */}
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Expenses</label>
                        <div className="space-y-2">
                            {formData.expenses?.map((expense, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <span className="flex-grow text-sm p-2 bg-slate-50 rounded-md">{expense.description}: ${parseFloat(expense.amount || 0).toFixed(2)}</span>
                                    <button type="button" onClick={() => handleRemoveExpense(index)} className="p-1 text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2 mt-2">
                            <input type="text" placeholder="Expense Description" value={newExpense.description} onChange={(e) => setNewExpense({...newExpense, description: e.target.value})} className="w-2/3 px-3 py-2 border border-slate-300 rounded-lg" />
                            <input type="number" placeholder="Amount" value={newExpense.amount} onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})} className="w-1/3 px-3 py-2 border border-slate-300 rounded-lg" />
                            <button type="button" onClick={handleAddExpense} className="bg-slate-200 text-slate-800 px-4 rounded-lg hover:bg-slate-300">Add</button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Hearing Dates</label>
                        <div className="flex gap-2 mb-2">
                            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="flex-grow w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <button type="button" onClick={handleAddDate} className="bg-slate-200 text-slate-800 px-4 rounded-lg hover:bg-slate-300">Add</button>
                        </div>
                        <div className="flex flex-wrap gap-2">{formData.hearingDates.map(date => <span key={date} className="flex items-center gap-2 bg-slate-100 text-slate-700 text-sm px-2 py-1 rounded-full">{new Date(date).toLocaleDateString()}<button type="button" onClick={() => handleRemoveDate(date)}><X className="w-3 h-3" /></button></span>)}</div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Tags (e.g., Civil, Criminal)</label>
                        <div className="flex gap-2 mb-2">
                            <input type="text" placeholder="Add a tag..." value={newTag} onChange={e => setNewTag(e.target.value)} className="flex-grow w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <button type="button" onClick={handleAddTag} className="bg-slate-200 text-slate-800 px-4 rounded-lg hover:bg-slate-300">Add</button>
                        </div>
                        <div className="flex flex-wrap gap-2">{formData.tags.map(tag => <span key={tag} className="flex items-center gap-2 bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded-full">{tag}<button type="button" onClick={() => handleRemoveTag(tag)}><X className="w-3 h-3" /></button></span>)}</div>
                    </div>

                    {/* UPDATED Assigned Lawyers Section */}
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Assigned Lawyers</label>
                        {userRole === 'admin' ? (
                            (allUsers && allUsers.length > 0) ? (
                                <>
                                <select
                                    name="assignedTo"
                                    multiple
                                    value={formData.assignedTo} // This is an array of UIDs
                                    onChange={(e) => {
                                        const selectedUIDs = Array.from(e.target.selectedOptions).map(opt => opt.value);
                                        setFormData(prev => ({ ...prev, assignedTo: selectedUIDs }));
                                    }}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-32"
                                >
                                    {allUsers.map(user => (
                                        <option key={user.id} value={user.id}>
                                            {user.email} {user.role === 'admin' ? '(Admin)' : ''}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-slate-500 mt-1">Hold CTRL/CMD to select multiple.</p>
                                </>
                            ) : <p className="text-sm text-slate-500">Loading user list...</p>
                        ) : (
                            <div className="p-3 bg-slate-100 rounded-lg text-sm text-slate-700">
                                {formData.assignedTo && formData.assignedTo.length > 0 
                                    ? `Assigned to ${formData.assignedTo.length} lawyer(s). (Only admins can change this)`
                                    : "Not assigned."
                                }
                            </div>
                        )}
                    </div>
                    
                    <div className="mb-4">
                        <CheckboxField
                            name="allowAssignedToEdit"
                            label="Allow assigned lawyers to edit this case"
                            checked={formData.allowAssignedToEdit}
                            onChange={(e) => setFormData(prev => ({ ...prev, allowAssignedToEdit: e.target.checked }))}
                            disabled={userRole !== 'admin'} // Non-admins cannot change this
                        />
                        <p className="text-xs text-slate-500 mt-1">If checked, lawyers assigned to this case can make changes.</p>
                    </div>
                    {/* Notes, Decision Summary, and Attach File sections remain the same */}
                    <div>
                        <label htmlFor="notes" className="block text-sm font-medium text-slate-600 mb-1">Notes / Updates</label>
                        <textarea id="notes" name="notes" rows="4" value={formData.notes} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
                    </div>
                    <div>
                        <label htmlFor="decisionSummary" className="block text-sm font-medium text-slate-600 mb-1">Decision Summary / Judgment</label>
                        <textarea id="decisionSummary" name="decisionSummary" rows="4" value={formData.decisionSummary} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Attach File</label>
                        <div className="mt-2 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-md">
                            <div className="space-y-1 text-center">
                                <UploadCloud className="mx-auto h-12 w-12 text-slate-400" />
                                <div className="flex text-sm text-slate-600">
                                    <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                                        <span>Upload a file</span>
                                        <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} />
                                    </label>
                                    <p className="pl-1">or drag and drop</p>
                                </div>
                                {fileToUpload ? <p className="text-sm text-slate-500">{fileToUpload.name}</p> : <p className="text-xs text-slate-500">PDF, PNG, JPG, DOCX up to 10MB</p>}
                            </div>
                        </div>
                        {uploadProgress > 0 && <div className="w-full bg-slate-200 rounded-full h-2.5 mt-2"><div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div></div>}
                    </div>
                    <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="bg-white text-slate-700 px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50">Cancel</button>
                        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center w-28">
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Case'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
}

// Is poore function ko App.jsx mein mojood Tasks function se replace karein
function Tasks({ caseId, caseTitle, caseOwnerId, loggedInUserId, appId }) {
    const [tasks, setTasks] = useState([]);
    const [newTask, setNewTask] = useState({ title: '', dueDate: '', notify: false });
    
    // Path banane ke liye caseOwnerId ka istemal karein
    const tasksCollectionRef = collection(db, `artifacts/${appId}/users/${caseOwnerId}/cases/${caseId}/tasks`);

    useEffect(() => {
        const q = query(tasksCollectionRef);
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const tasksData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, dueDate: doc.data().dueDate?.toDate() }));
            setTasks(tasksData);
        }, (error) => {
            // Ab yeh error nahi aana chahiye, lekin error handling zaroori hai
            console.error(`Error fetching tasks for case ${caseId}:`, error);
            toast.error(`Could not load tasks for "${caseTitle}".`);
        });
        return () => unsubscribe();
    }, [caseId, caseOwnerId, appId, caseTitle]);

    const handleAddTask = async (e) => {
        e.preventDefault();
        if (!newTask.title) {
            toast.error("Task title is required.");
            return;
        }
        try {
            await addDoc(tasksCollectionRef, {
                ...newTask,
                // Task assign karne ke liye loggedInUserId ka istemal karein
                assignedTo: loggedInUserId, 
                caseTitle: caseTitle, 
                dueDate: newTask.dueDate ? Timestamp.fromDate(new Date(newTask.dueDate)) : null,
                completed: false,
                createdAt: serverTimestamp(),
            });
            setNewTask({ title: '', dueDate: '', notify: false });
            toast.success("Task added successfully!");
        } catch (error) {
            console.error("Error adding task: ", error);
            toast.error("Failed to add task.");
        }
    };

    const toggleTaskCompletion = async (task) => {
        const taskDocRef = doc(db, `artifacts/${appId}/users/${caseOwnerId}/cases/${caseId}/tasks`, task.id);
        try {
            await updateDoc(taskDocRef, { completed: !task.completed });
        } catch (error) {
            console.error("Error updating task: ", error);
            toast.error("Failed to update task.");
        }
    };
    
    const handleDeleteTask = async (taskId) => {
        if (!window.confirm("Are you sure you want to delete this task?")) return;
        const taskDocRef = doc(db, `artifacts/${appId}/users/${caseOwnerId}/cases/${caseId}/tasks`, taskId);
        try {
            await deleteDoc(taskDocRef);
            toast.success("Task deleted.");
        } catch (error) {
            console.error("Error deleting task: ", error);
            toast.error("Failed to delete task.");
        }
    };

    return (
        <div className="mt-4 pt-4 border-t border-slate-200">
            <h4 className="font-semibold text-xs text-slate-500 mb-2">TASKS</h4>
            <ul className="space-y-2 mb-4">
                {tasks.map(task => (
                    <li key={task.id} className="flex items-center justify-between bg-slate-50 p-2 rounded-md">
                        <div className="flex items-center gap-3">
                            <input type="checkbox" checked={task.completed} onChange={() => toggleTaskCompletion(task)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                            <span className={`text-sm ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.title}</span>
                        </div>
                         <div className="flex items-center gap-2">
                            {task.notify && <Bell className="w-4 h-4 text-amber-500" />}
                            {task.dueDate && <span className="text-xs text-slate-500">{task.dueDate.toLocaleDateString()}</span>}
                            <button onClick={() => handleDeleteTask(task.id)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                        </div>
                    </li>
                ))}
            </ul>
            <form onSubmit={handleAddTask} className="flex flex-col gap-2">
                <input
                    type="text"
                    placeholder="Add a new task..."
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <div className="flex gap-2">
                    <input
                        type="date"
                        value={newTask.dueDate}
                        onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                    <div className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg">
                        <label htmlFor={`notify-${caseId}`} className="text-sm text-slate-600">Notify</label>
                        <input
                            id={`notify-${caseId}`}
                            type="checkbox"
                            checked={newTask.notify}
                            onChange={(e) => setNewTask({ ...newTask, notify: e.target.checked })}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                    </div>
                </div>
                <button type="submit" className="bg-slate-200 text-slate-800 px-4 py-2 rounded-lg hover:bg-slate-300 text-sm">Add Task</button>
            </form>
        </div>
    );
}

export default App;