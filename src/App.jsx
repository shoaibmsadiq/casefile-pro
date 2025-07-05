// Welcome to your Case File Management App!
// FINAL VERSION: This version uses standard npm imports for all libraries,
// which will work correctly with the updated package.json and vite.config.js.

// -----------------------------------------------------------------------------
// 1. DEPENDENCIES
// -----------------------------------------------------------------------------
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut,
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
    arrayUnion,
    arrayRemove,
    setDoc,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import {
    getStorage,
    ref,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject
} from 'firebase/storage';
import { 
    getMessaging, 
    getToken, 
    onMessage 
} from "firebase/messaging";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { LayoutDashboard, ShieldCheck, ShieldX, Archive, Activity, AreaChart, FileText, BarChart2, Bell, BellOff, Paperclip, UploadCloud, FileWarning, FilePlus, Search, Edit, Trash2, X, Calendar as CalendarIcon, Briefcase, User, Users, MapPin, Tag, ChevronDown, LogOut, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { ToastContainer, toast } from 'react-toastify';
// Standard package imports, which will work after `npm install` is run.
import moment from 'moment';
import { Calendar, momentLocalizer } from 'react-big-calendar';


// -----------------------------------------------------------------------------
// 2. FIREBASE CONFIGURATION AND INITIALIZATION
// -----------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyC93J87oWxUx6RMsOfs0Xs6CNwbwfMmmBQ",
  authDomain: "casefile-pro.firebaseapp.com",
  projectId: "casefile-pro",
  storageBucket: "casefile-pro.firebasestorage.app",
  messagingSenderId: "387776954987",
  appId: "1:387776954987:web:c1bc983a56efdc3539a72e",
  measurementId: "G-TXG9HN3S89"
};

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const fbConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : firebaseConfig;

const app = initializeApp(fbConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const messaging = getMessaging(app);
const localizer = momentLocalizer(moment); // Setup for react-big-calendar

// -----------------------------------------------------------------------------
// 3. REACT APP STARTS HERE
// -----------------------------------------------------------------------------

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const toastifyLink = document.createElement('link');
        toastifyLink.rel = 'stylesheet';
        toastifyLink.href = 'https://cdn.jsdelivr.net/npm/react-toastify@9.1.3/dist/ReactToastify.min.css';
        document.head.appendChild(toastifyLink);

        const calendarLink = document.createElement('link');
        calendarLink.rel = 'stylesheet';
        calendarLink.href = 'https://cdn.jsdelivr.net/npm/react-big-calendar@1.8.2/lib/css/react-big-calendar.css';
        document.head.appendChild(calendarLink);

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user ? user : null);
            setLoading(false);
        });

        try {
            onMessage(messaging, (payload) => {
                console.log('Message received. ', payload);
                toast.info(`${payload.notification.title}: ${payload.notification.body}`);
            });
        } catch(e) {
            console.error("Foreground messaging not supported in this environment.", e);
        }

        return () => {
            document.head.removeChild(toastifyLink);
            document.head.removeChild(calendarLink);
            unsubscribe();
        };
    }, []);

    if (loading) return <LoadingScreen message="Checking authentication..." />;

    return (
        <div className="bg-slate-100 min-h-screen font-sans">
            {user ? <CaseManagementSystem user={user} /> : <AuthScreen />}
            <ToastContainer position="bottom-right" autoClose={5000} hideProgressBar={false} />
        </div>
    );
}

function LoadingScreen({ message = "Loading..." }) {
    return (<div className="flex flex-col justify-center items-center min-h-screen bg-slate-100 text-slate-700"><Loader2 className="w-12 h-12 animate-spin mb-4" /><p className="text-lg">{message}</p></div>);
}

function AuthScreen() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const handleAuth = async (e) => { e.preventDefault(); setLoading(true); setError(''); try { if (isLogin) { await signInWithEmailAndPassword(auth, email, password); toast.success("Logged in successfully!"); } else { await createUserWithEmailAndPassword(auth, email, password); toast.success("Account created successfully! You are now logged in."); } } catch (err) { setError(err.message.replace('Firebase: ', '')); } setLoading(false); };
    return (<div className="flex justify-center items-center min-h-screen p-4 bg-slate-100"><div className="w-full max-w-md bg-white p-8 rounded-xl shadow-2xl"><h2 className="text-3xl font-bold text-center text-slate-800 mb-2">Malik Awan Law Associates</h2><p className="text-center text-slate-500 mb-8">Case File Management Portal</p><form onSubmit={handleAuth}><div className="mb-4"><InputField type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} label="Email Address" required /></div><div className="mb-6"><InputField type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} label="Password" required /></div>{error && <p className="text-red-500 text-sm text-center mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}<button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors flex justify-center items-center text-base">{loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (isLogin ? 'Login' : 'Sign Up & Login')}</button></form><p className="text-center text-sm text-slate-500 mt-6">{isLogin ? "Team mein naye hain?" : "Pehle se account hai?"}<button onClick={() => {setIsLogin(!isLogin); setError('');}} className="text-blue-600 hover:underline font-semibold ml-1">{isLogin ? 'Naya Account Banayein' : 'Login Karein'}</button></p></div></div>);
}

// --- Main Application Component after Login ---
function CaseManagementSystem({ user }) {
    const [view, setView] = useState('dashboard'); // 'dashboard' or 'calendar'
    const [cases, setCases] = useState([]);
    const [events, setEvents] = useState([]); // For custom calendar events
    const [loading, setLoading] = useState(true);
    const [notificationPermission, setNotificationPermission] = useState(Notification.permission);
    
    const userId = auth.currentUser?.uid;

    // Fetch Cases
    useEffect(() => {
        if (!userId) return;
        setLoading(true);
        const casesCollection = collection(db, `artifacts/${appId}/users/${userId}/cases`);
        const q = query(casesCollection);
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const casesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate() }));
            setCases(casesData);
            setLoading(false);
        }, (error) => { console.error("Error fetching cases: ", error); setLoading(false); });
        return () => unsubscribe();
    }, [userId]);

    // Fetch Custom Events
    useEffect(() => {
        if (!userId) return;
        const eventsCollection = collection(db, `artifacts/${appId}/users/${userId}/events`);
        const q = query(eventsCollection);
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const eventsData = snapshot.docs.map(doc => {
                const data = doc.data();
                return { ...data, id: doc.id, start: data.start.toDate(), end: data.end.toDate() };
            });
            setEvents(eventsData);
        }, (error) => console.error("Error fetching custom events: ", error));
        return () => unsubscribe();
    }, [userId]);

    const handleRequestNotificationPermission = async () => {
        try {
            const permission = await Notification.requestPermission();
            setNotificationPermission(permission);
            if (permission === 'granted') {
                toast.success("Notifications enabled!");
                const currentToken = await getToken(messaging, { vapidKey: 'YOUR_VAPID_KEY_FROM_FIREBASE_SETTINGS' });
                if (currentToken) {
                    const tokenDocRef = doc(db, `artifacts/${appId}/users/${userId}/fcmTokens`, currentToken);
                    await setDoc(tokenDocRef, { token: currentToken, createdAt: new Date() });
                } else { toast.warn("Could not get notification token."); }
            } else { toast.warn("Notifications permission denied."); }
        } catch (error) { console.error('An error occurred while retrieving token. ', error); toast.error("An error occurred while enabling notifications."); }
    };

    const handleLogout = async () => { try { await signOut(auth); toast.info("You have been logged out."); } catch (error) { console.error("Error signing out: ", error); toast.error("Failed to sign out."); } };

    return (
        <>
            <header className="bg-white shadow-md sticky top-0 z-20">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4">
                        <h1 className="text-2xl font-bold text-slate-800">CaseFile Pro</h1>
                        <nav className="flex items-center gap-2 sm:gap-4 bg-slate-100 p-1 rounded-full">
                            <NavButton icon={LayoutDashboard} label="Dashboard" isActive={view === 'dashboard'} onClick={() => setView('dashboard')} />
                            <NavButton icon={CalendarIcon} label="Calendar" isActive={view === 'calendar'} onClick={() => setView('calendar')} />
                        </nav>
                        <div className="flex items-center space-x-2 sm:space-x-4">
                            <button onClick={handleRequestNotificationPermission} className={`p-2 rounded-full transition-colors ${notificationPermission === 'granted' ? 'text-green-600 bg-green-100' : 'text-slate-600 hover:bg-slate-200'}`} title={notificationPermission === 'granted' ? 'Notifications enabled' : 'Enable notifications'}>
                                {notificationPermission === 'granted' ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                            </button>
                            <p className="text-sm text-slate-600 hidden sm:block">{user.email}</p>
                            <button onClick={handleLogout} className="p-2 rounded-full text-slate-600 hover:bg-slate-200 transition-colors"><LogOut className="w-5 h-5" /></button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                {loading ? <LoadingScreen message="Loading data..." /> : (
                    <AnimatePresence mode="wait">
                        <motion.div key={view} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                            {view === 'dashboard' && <DashboardAndCasesView cases={cases} />}
                            {view === 'calendar' && <CalendarView cases={cases} customEvents={events} />}
                        </motion.div>
                    </AnimatePresence>
                )}
            </main>
        </>
    );
}

const NavButton = ({ icon: Icon, label, isActive, onClick }) => ( <button onClick={onClick} className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full text-sm font-semibold transition-colors ${ isActive ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:bg-slate-200' }`}><Icon className="w-5 h-5" /><span className="hidden sm:inline">{label}</span></button> );

function DashboardAndCasesView({ cases }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCase, setEditingCase] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState('All');
    const [deletingCaseId, setDeletingCaseId] = useState(null);
    const userId = auth.currentUser?.uid;

    const handleAddCase = () => { setEditingCase(null); setIsModalOpen(true); };
    const handleEditCase = (caseData) => { setEditingCase(caseData); setIsModalOpen(true); };
    const handleInitiateDelete = (caseId) => setDeletingCaseId(caseId);

    const confirmDelete = async () => {
        if (!deletingCaseId) return;
        try {
            const caseToDelete = cases.find(c => c.id === deletingCaseId);
            if (caseToDelete && caseToDelete.attachments) {
                for (const attachment of caseToDelete.attachments) await deleteObject(ref(storage, attachment.storagePath));
            }
            await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/cases`, deletingCaseId));
            toast.success('Case file and all attachments deleted!');
        } catch (error) { console.error("Error deleting case: ", error); toast.error('Failed to delete case file.'); }
        setDeletingCaseId(null);
    };

    const handleSaveCase = async (caseData, fileToUpload, setUploadProgress) => {
        const casesCollection = collection(db, `artifacts/${appId}/users/${userId}/cases`);
        try {
            if (editingCase) {
                const caseDocRef = doc(db, `artifacts/${appId}/users/${userId}/cases`, editingCase.id);
                await updateDoc(caseDocRef, caseData);
                if (fileToUpload) {
                    const storagePath = `artifacts/${appId}/users/${userId}/${editingCase.id}/${Date.now()}_${fileToUpload.name}`;
                    const downloadURL = await uploadFile(fileToUpload, storagePath, setUploadProgress);
                    await updateDoc(caseDocRef, { attachments: arrayUnion({ name: fileToUpload.name, url: downloadURL, storagePath }) });
                }
                toast.success('Case file updated!');
            } else {
                const newCaseData = { ...caseData, attachments: [], createdAt: serverTimestamp() };
                const newCaseRef = await addDoc(casesCollection, newCaseData);
                if (fileToUpload) {
                    const storagePath = `artifacts/${appId}/users/${userId}/${newCaseRef.id}/${Date.now()}_${fileToUpload.name}`;
                    const downloadURL = await uploadFile(fileToUpload, storagePath, setUploadProgress);
                    await updateDoc(newCaseRef, { attachments: arrayUnion({ name: fileToUpload.name, url: downloadURL, storagePath }) });
                }
                toast.success('Case file added!');
            }
            setIsModalOpen(false); setEditingCase(null);
        } catch (error) { console.error("Error saving document: ", error); toast.error('Failed to save case file.'); }
    };

    const uploadFile = (file, storagePath, setProgress) => {
        return new Promise((resolve, reject) => {
            const storageRef = ref(storage, storagePath);
            const uploadTask = uploadBytesResumable(storageRef, file);
            uploadTask.on('state_changed', (snapshot) => setProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100), (error) => reject(error), async () => resolve(await getDownloadURL(uploadTask.snapshot.ref)));
        });
    };

    const handleDeleteAttachment = async (caseId, attachment) => {
        if (!window.confirm(`Are you sure you want to delete the file: ${attachment.name}?`)) return;
        try {
            await deleteObject(ref(storage, attachment.storagePath));
            await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/cases`, caseId), { attachments: arrayRemove(attachment) });
            toast.success("Attachment deleted.");
        } catch (error) { console.error("Error deleting attachment:", error); toast.error("Failed to delete attachment."); }
    };

    const filteredCases = useMemo(() => cases.filter(c => (activeFilter === 'All' || c.tags?.includes(activeFilter)) && (searchTerm === '' || [c.clientName, c.caseTitle, c.caseNumber, c.courtName].some(f => f?.toLowerCase().includes(searchTerm.toLowerCase())))), [cases, searchTerm, activeFilter]);
    const allTags = useMemo(() => ['All', ...Array.from(new Set(cases.flatMap(c => c.tags || [])))], [cases]);
    
    return (
      <>
        <Dashboard cases={cases} />
        <div className="bg-white p-4 rounded-xl shadow-lg mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-auto sm:flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" /><input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg" /></div>
            <div className="flex items-center gap-4 w-full sm:w-auto"><div className="relative w-full sm:w-48"><select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} className="w-full appearance-none bg-white px-4 py-2 border rounded-lg">{allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}</select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" /></div><button onClick={handleAddCase} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg"><FilePlus className="w-5 h-5" /><span>Add Case</span></button></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
            {filteredCases.length > 0 ? filteredCases.map(c => (
                <motion.div key={c.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-xl shadow-lg p-6 flex flex-col">
                    <div className="flex-grow">
                        <div className="flex justify-between items-start mb-2"><h3 className="font-bold text-lg text-slate-800 pr-2">{c.caseTitle}</h3><CaseStatusBadge status={c.caseStatus} /></div>
                        <p className="text-sm text-slate-500 mb-4">Case #: {c.caseNumber}</p>
                        <div className="space-y-3 text-sm mb-4"><InfoItem icon={User} label="Client" value={c.clientName} /><InfoItem icon={CalendarIcon} label="Date Filed" value={c.caseFiledOn ? new Date(c.caseFiledOn).toLocaleDateString() : 'N/A'} /><InfoItem icon={Users} label="Opposing Party" value={c.opposingParty} /><InfoItem icon={Briefcase} label="Court" value={c.courtName} /><InfoItem icon={MapPin} label="File Location" value={c.fileLocation} /></div>
                        <div className="mb-4"><h4 className="font-semibold text-xs text-slate-500 mb-2">TAGS</h4><div className="flex flex-wrap gap-2">{c.tags?.map(tag => <span key={tag} className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded-full">{tag}</span>)}</div></div>
                        <div className="mb-4"><h4 className="font-semibold text-xs text-slate-500 mb-2">NOTES</h4><p className="text-sm bg-slate-50 p-3 rounded-md whitespace-pre-wrap">{c.notes}</p></div>
                        {c.decisionSummary && <div className="mb-4"><h4 className="font-semibold text-xs text-slate-500 mb-2">DECISION</h4><p className="text-sm bg-amber-50 p-3 rounded-md whitespace-pre-wrap">{c.decisionSummary}</p></div>}
                        {c.attachments?.length > 0 && <div className="mt-4"><h4 className="font-semibold text-xs text-slate-500 mb-2">ATTACHMENTS</h4><ul className="space-y-2">{c.attachments.map((att, i) => <li key={i} className="flex items-center justify-between bg-slate-50 p-2 rounded-md"><a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 truncate"><Paperclip className="w-4 h-4" /><span className="truncate">{att.name}</span></a><button onClick={() => handleDeleteAttachment(c.id, att)} className="p-1 text-slate-400 hover:text-red-600"><X className="w-3 h-3" /></button></li>)}</ul></div>}
                    </div>
                    <div className="flex justify-end space-x-2 mt-4"><button onClick={() => handleEditCase(c)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full"><Edit className="w-4 h-4" /></button><button onClick={() => handleInitiateDelete(c.id)} className="p-2 text-slate-500 hover:bg-red-100 hover:text-red-600 rounded-full"><Trash2 className="w-4 h-4" /></button></div>
                    <div className="mt-auto pt-4 border-t"><h4 className="font-semibold text-xs text-slate-500 mb-2">HEARING DATES</h4><ul className="space-y-1 text-sm">{(c.hearingDates || []).map((date, i) => <li key={i} className="flex items-center gap-2"><CalendarIcon className="w-4 h-4 text-slate-400" />{new Date(date).toLocaleDateString()}</li>)}</ul></div>
                </motion.div>
            )) : <div className="col-span-full text-center py-12"><p className="text-slate-500">No cases found.</p></div>}</AnimatePresence>
        </div>
        <AnimatePresence>{isModalOpen && <CaseFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveCase} caseData={editingCase} />}</AnimatePresence>
        <AnimatePresence>{deletingCaseId && <ConfirmDeleteModal isOpen={!!deletingCaseId} onClose={() => setDeletingCaseId(null)} onConfirm={confirmDelete} />}</AnimatePresence>
      </>
    );
}

function CalendarView({ cases, customEvents }) {
    const [eventModalOpen, setEventModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const userId = auth.currentUser?.uid;

    const allEvents = useMemo(() => {
        const hearingEvents = cases.flatMap(c => (c.hearingDates || []).map(date => ({ id: `${c.id}-${date}`, title: `Hearing: ${c.caseTitle}`, start: moment(date).startOf('day').toDate(), end: moment(date).endOf('day').toDate(), allDay: true, isHearing: true, caseInfo: c })));
        const formattedCustomEvents = customEvents.map(e => ({...e, isHearing: false}));
        return [...hearingEvents, ...formattedCustomEvents];
    }, [cases, customEvents]);

    const handleSelectSlot = useCallback(({ start, end }) => { setSelectedSlot({ start, end }); setSelectedEvent(null); setEventModalOpen(true); }, []);
    const handleSelectEvent = useCallback((event) => { setSelectedSlot(null); setSelectedEvent(event); setEventModalOpen(true); }, []);

    const handleSaveEvent = async (eventData) => {
        const eventsCollection = collection(db, `artifacts/${appId}/users/${userId}/events`);
        const dataToSave = { ...eventData, start: Timestamp.fromDate(new Date(eventData.start)), end: Timestamp.fromDate(new Date(eventData.end)) };
        try {
            if (eventData.id) {
                await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/events`, eventData.id), dataToSave);
                toast.success("Appointment updated!");
            } else {
                await addDoc(eventsCollection, dataToSave);
                toast.success("Appointment added!");
            }
            setEventModalOpen(false);
        } catch (error) { toast.error("Failed to save appointment."); }
    };
    
    const handleDeleteEvent = async (eventId) => {
        if (!eventId || !window.confirm("Delete this appointment?")) return;
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/events`, eventId));
            toast.success("Appointment deleted.");
            setEventModalOpen(false);
        } catch (error) { toast.error("Failed to delete appointment."); }
    };

    const eventStyleGetter = (event) => ({ style: { backgroundColor: event.isHearing ? '#3b82f6' : '#8884d8', borderRadius: '5px', opacity: 0.8, color: 'white', border: '0px', display: 'block' } });

    return (
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg h-[80vh]">
             <Calendar localizer={localizer} events={allEvents} startAccessor="start" endAccessor="end" style={{ height: '100%' }} selectable onSelectSlot={handleSelectSlot} onSelectEvent={handleSelectEvent} eventPropGetter={eventStyleGetter} />
            <AnimatePresence>{eventModalOpen && <EventModal isOpen={eventModalOpen} onClose={() => setEventModalOpen(false)} onSave={handleSaveEvent} onDelete={handleDeleteEvent} eventData={selectedEvent} slotInfo={selectedSlot} />}</AnimatePresence>
        </div>
    );
}

function EventModal({ isOpen, onClose, onSave, onDelete, eventData, slotInfo }) {
    const [title, setTitle] = useState('');
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [loading, setLoading] = useState(false);
    const isHearing = eventData?.isHearing;
    useEffect(() => { if (eventData) { setTitle(eventData.title); setStart(moment(eventData.start).format('YYYY-MM-DDTHH:mm')); setEnd(moment(eventData.end).format('YYYY-MM-DDTHH:mm')); } else if (slotInfo) { setTitle(''); setStart(moment(slotInfo.start).format('YYYY-MM-DDTHH:mm')); setEnd(moment(slotInfo.end).format('YYYY-MM-DDTHH:mm')); } }, [eventData, slotInfo, isOpen]);
    const handleSubmit = async (e) => { e.preventDefault(); setLoading(true); await onSave({ id: eventData?.id, title, start, end }); setLoading(false); };
    return (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center p-4" onClick={onClose}><motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}><form onSubmit={handleSubmit}><div className="p-6 border-b"><h2 className="text-xl font-bold text-slate-800">{isHearing ? "View Hearing Details" : (eventData ? "Edit Appointment" : "Add Appointment")}</h2></div><div className="p-6 space-y-4"><InputField label="Title" id="event-title" value={title} onChange={e => setTitle(e.target.value)} required disabled={isHearing} /><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><InputField label="Start Time" id="start-time" type="datetime-local" value={start} onChange={e => setStart(e.target.value)} required disabled={isHearing} /><InputField label="End Time" id="end-time" type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} required disabled={isHearing} /></div>{isHearing && eventData.caseInfo && (<div className="bg-slate-50 p-4 rounded-lg border"><h4 className="font-bold mb-2">Case Information</h4><p><strong>Client:</strong> {eventData.caseInfo.clientName}</p><p><strong>Court:</strong> {eventData.caseInfo.courtName}</p><p><strong>Case #:</strong> {eventData.caseInfo.caseNumber}</p></div>)}</div><div className="p-6 bg-slate-50 rounded-b-xl flex justify-between items-center"><div>{!isHearing && eventData?.id && (<button type="button" onClick={() => onDelete(eventData.id)} className="text-red-600 hover:underline text-sm font-semibold">Delete</button>)}</div><div className="flex gap-3"><button type="button" onClick={onClose} className="bg-white text-slate-700 px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-100">Cancel</button>{!isHearing && (<button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center w-28">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save"}</button>)}</div></div></form></motion.div></motion.div>);
}

const Dashboard = ({ cases }) => { const caseTypeData = useMemo(() => { const counts = cases.reduce((acc, c) => { (c.tags || ['Uncategorized']).forEach(tag => { acc[tag] = (acc[tag] || 0) + 1; }); return acc; }, {}); return Object.entries(counts).map(([name, value]) => ({ name, value })); }, [cases]); const monthlyData = useMemo(() => { const months = Array.from({length: 6}, (_, i) => moment().subtract(i, 'months').format('MMM YY')).reverse(); const counts = months.reduce((acc, m) => ({...acc, [m]: 0}), {}); cases.forEach(c => { if (c.createdAt) { const month = moment(c.createdAt).format('MMM YY'); if(month in counts) counts[month]++; } }); return Object.entries(counts).map(([name, cases]) => ({ name, cases })); }, [cases]); const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ff4d4d']; const activeCases = cases.filter(c => ['Active', 'Pending', 'Appeal'].includes(c.caseStatus)).length; const decidedCases = cases.filter(c => ['Decided', 'Closed'].includes(c.caseStatus)).length; return (<div className="mb-8"><h2 className="text-2xl font-bold text-slate-700 mb-4">Dashboard</h2><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"><StatCard icon={Briefcase} title="Total Cases" value={cases.length} color="blue" /><StatCard icon={Activity} title="Active Cases" value={activeCases} color="green" /><StatCard icon={Archive} title="Decided/Closed" value={decidedCases} color="orange" /><StatCard icon={CalendarIcon} title="Upcoming Hearings" value={cases.flatMap(c => c.hearingDates || []).filter(d => new Date(d) >= new Date()).length} color="purple" /><div className="md:col-span-2 lg:col-span-2 bg-white p-6 rounded-xl shadow-lg"><h3 className="font-bold text-slate-800 text-lg mb-4">Case Types Distribution</h3><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={caseTypeData} cx="50%" cy="50%" labelLine={false} outerRadius={100} fill="#8884d8" dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>{caseTypeData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div><div className="md:col-span-2 lg:col-span-2 bg-white p-6 rounded-xl shadow-lg"><h3 className="font-bold text-slate-800 text-lg mb-4">New Cases (Last 6 Months)</h3><ResponsiveContainer width="100%" height={300}><BarChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Legend /><Bar dataKey="cases" fill="#8884d8" name="New Cases" /></BarChart></ResponsiveContainer></div></div></div>); };
const StatCard = ({ icon: Icon, title, value, color }) => { const colors = { blue: 'bg-blue-100 text-blue-600', green: 'bg-green-100 text-green-600', orange: 'bg-orange-100 text-orange-600', purple: 'bg-purple-100 text-purple-600' }; return (<div className="bg-white p-6 rounded-xl shadow-lg flex items-center space-x-4"><div className={`p-3 rounded-full ${colors[color]}`}><Icon className="w-6 h-6" /></div><div><p className="text-sm text-slate-500">{title}</p><p className="text-2xl font-bold text-slate-800">{value}</p></div></div>); };
const InputField = ({ name, label, value, onChange, type = 'text', required = false, id, disabled=false }) => (<div><label htmlFor={id || name} className="block text-sm font-medium text-slate-600 mb-1">{label}</label><input type={type} id={id || name} name={name} value={value} onChange={onChange} required={required} disabled={disabled} className="w-full px-3 py-2 border border-slate-300 rounded-lg disabled:bg-slate-50 disabled:cursor-not-allowed" /></div>);
function ConfirmDeleteModal({ isOpen, onClose, onConfirm }) { if (!isOpen) return null; return (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black bg-opacity-60 z-40 flex justify-center items-center p-4" onClick={onClose}><motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center" onClick={e => e.stopPropagation()}><div className="mx-auto bg-red-100 rounded-full h-12 w-12 flex items-center justify-center mb-4"><FileWarning className="h-6 w-6 text-red-600" /></div><h3 className="text-lg font-bold text-slate-800 mb-2">Are you sure?</h3><p className="text-slate-600 mb-6 text-sm">Do you really want to delete this case file? This action cannot be undone.</p><div className="flex justify-center gap-4"><button onClick={onClose} className="bg-slate-200 text-slate-800 px-6 py-2 rounded-lg hover:bg-slate-300 font-semibold">Cancel</button><button onClick={onConfirm} className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 font-semibold">Delete</button></div></motion.div></motion.div>); }

export default App;
