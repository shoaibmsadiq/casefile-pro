// Welcome to your Case File Management App!
// FEATURE UPDATE: This version introduces an advanced dashboard with charts for case analysis.
// It uses the 'recharts' library to display a pie chart for case types and a bar chart for monthly new cases.

// -----------------------------------------------------------------------------
// 1. DEPENDENCIES
// -----------------------------------------------------------------------------
import React, { useState, useEffect, useMemo } from 'react';
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
    serverTimestamp
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
// NEW: Import recharts for dashboard visualizations
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { AreaChart, FileText, BarChart2, Bell, BellOff, Paperclip, UploadCloud, FileWarning, FilePlus, Search, Edit, Trash2, X, Calendar, Briefcase, User, Users, MapPin, Tag, ChevronDown, LogOut, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { ToastContainer, toast } from 'react-toastify';

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

// -----------------------------------------------------------------------------
// 3. REACT APP STARTS HERE
// -----------------------------------------------------------------------------

// --- Main App Component ---
function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/react-toastify@9.1.3/dist/ReactToastify.min.css';
        document.head.appendChild(link);

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUser(user);
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        onMessage(messaging, (payload) => {
            console.log('Message received. ', payload);
            toast.info(payload.notification.title + ": " + payload.notification.body);
        });

        return () => {
            document.head.removeChild(link);
            unsubscribe();
        };
    }, []);

    if (loading) {
        return <LoadingScreen message="Checking authentication..." />;
    }

    return (
        <div className="bg-slate-100 min-h-screen font-sans">
            {user ? <CaseManagementSystem user={user} /> : <AuthScreen />}
            <ToastContainer position="bottom-right" autoClose={5000} hideProgressBar={false} />
        </div>
    );
}

// --- Loading Screen Component ---
const LoadingScreen = ({ message = "Loading..." }) => (
    <div className="flex flex-col justify-center items-center min-h-screen bg-slate-100 text-slate-700">
        <Loader2 className="w-12 h-12 animate-spin mb-4" />
        <p className="text-lg">{message}</p>
    </div>
);

// --- Authentication Screen (Login/Signup) ---
function AuthScreen() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAuth = async (e) => {
        e.preventDefault(); setLoading(true); setError('');
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
                toast.success("Logged in successfully!");
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
                toast.success("Account created successfully! You are now logged in.");
            }
        } catch (err) { setError(err.message.replace('Firebase: ', '')); }
        setLoading(false);
    };

    return (
        <div className="flex justify-center items-center min-h-screen p-4 bg-slate-100">
            <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-2xl">
                <h2 className="text-3xl font-bold text-center text-slate-800 mb-2">Malik Awan Law Associates</h2>
                <p className="text-center text-slate-500 mb-8">Case File Management Portal</p>
                <form onSubmit={handleAuth}>
                    <div className="mb-4"><InputField type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} label="Email Address" required /></div>
                    <div className="mb-6"><InputField type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} label="Password" required /></div>
                    {error && <p className="text-red-500 text-sm text-center mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
                    <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors flex justify-center items-center text-base">{loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (isLogin ? 'Login' : 'Sign Up & Login')}</button>
                </form>
                <p className="text-center text-sm text-slate-500 mt-6">{isLogin ? "Team mein naye hain?" : "Pehle se account hai?"}<button onClick={() => {setIsLogin(!isLogin); setError('');}} className="text-blue-600 hover:underline font-semibold ml-1">{isLogin ? 'Naya Account Banayein' : 'Login Karein'}</button></p>
            </div>
        </div>
    );
}

// --- Main Application Component after Login ---
function CaseManagementSystem({ user }) {
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCase, setEditingCase] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState('All');
    const [deletingCaseId, setDeletingCaseId] = useState(null);
    const [notificationPermission, setNotificationPermission] = useState(Notification.permission);
    
    const userId = auth.currentUser?.uid;

    useEffect(() => {
        if (!userId) return;
        setLoading(true);
        const casesCollection = collection(db, `artifacts/${appId}/users/${userId}/cases`);
        const q = query(casesCollection);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const casesData = snapshot.docs.map(doc => {
                const data = doc.data();
                return { 
                    id: doc.id, 
                    ...data,
                    // Convert Firestore Timestamp to JS Date for charting
                    createdAt: data.createdAt?.toDate() 
                };
            });
            setCases(casesData);
            setLoading(false);
        }, (error) => { console.error("Error fetching cases: ", error); toast.error("Could not fetch cases."); setLoading(false); });

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

    const handleAddCase = () => { setEditingCase(null); setIsModalOpen(true); };
    const handleEditCase = (caseData) => { setEditingCase(caseData); setIsModalOpen(true); };
    const handleInitiateDelete = (caseId) => setDeletingCaseId(caseId);

    const confirmDelete = async () => {
        if (!deletingCaseId) return;
        try {
            const caseToDelete = cases.find(c => c.id === deletingCaseId);
            if (caseToDelete && caseToDelete.attachments) {
                for (const attachment of caseToDelete.attachments) {
                    await deleteObject(ref(storage, attachment.storagePath));
                }
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
                // NEW: Add a createdAt timestamp for new cases for dashboard reporting
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
    
    const filteredCases = useMemo(() => cases.filter(c => (activeFilter === 'All' || c.tags?.includes(activeFilter)) && (searchTerm === '' || c.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || c.caseTitle.toLowerCase().includes(searchTerm.toLowerCase()) || c.caseNumber.toLowerCase().includes(searchTerm.toLowerCase()) || c.courtName.toLowerCase().includes(searchTerm.toLowerCase()))), [cases, searchTerm, activeFilter]);
    const allTags = useMemo(() => ['All', ...Array.from(new Set(cases.flatMap(c => c.tags || [])))], [cases]);
    const handleLogout = async () => { try { await signOut(auth); toast.info("You have been logged out."); } catch (error) { console.error("Error signing out: ", error); toast.error("Failed to sign out."); } };

    return (
        <>
             <header className="bg-white shadow-md sticky top-0 z-20">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8"><div className="flex justify-between items-center py-4"><h1 className="text-2xl font-bold text-slate-800">CaseFile Pro</h1><div className="flex items-center space-x-2 sm:space-x-4">
                    <button onClick={handleRequestNotificationPermission} className={`p-2 rounded-full transition-colors ${notificationPermission === 'granted' ? 'text-green-600 bg-green-100' : 'text-slate-600 hover:bg-slate-200'}`} title={notificationPermission === 'granted' ? 'Notifications enabled' : 'Enable notifications'}>
                        {notificationPermission === 'granted' ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                    </button>
                    <p className="text-sm text-slate-600 hidden sm:block">Welcome, {user.email}</p>
                    <button onClick={handleLogout} className="p-2 rounded-full text-slate-600 hover:bg-slate-200 transition-colors"><LogOut className="w-5 h-5" /></button>
                </div></div></div>
            </header>

            <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                {/* NEW: Advanced Dashboard Component */}
                <Dashboard cases={cases} />

                <div className="bg-white p-4 rounded-xl shadow-lg mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="relative w-full sm:w-auto sm:flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" /><input type="text" placeholder="Search by client, title, case no..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                    <div className="flex items-center gap-4 w-full sm:w-auto"><div className="relative w-full sm:w-48"><select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} className="w-full appearance-none bg-white px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">{allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}</select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" /></div><button onClick={handleAddCase} className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow"><FilePlus className="w-5 h-5" /><span className="hidden sm:inline">Add Case</span></button></div>
                </div>

                {loading ? <LoadingScreen message="Loading cases..." /> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <AnimatePresence>
                        {filteredCases.length > 0 ? filteredCases.map(c => (
                            <motion.div key={c.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-xl shadow-lg p-6 flex flex-col">
                                <div className="flex-grow">
                                    <div className="flex justify-between items-start mb-2"><h3 className="font-bold text-lg text-slate-800 pr-2">{c.caseTitle}</h3><div className="flex-shrink-0 flex items-center gap-2"><button onClick={() => handleEditCase(c)} className="p-1 text-slate-500 hover:text-blue-600"><Edit className="w-4 h-4" /></button><button onClick={() => handleInitiateDelete(c.id)} className="p-1 text-slate-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></div></div>
                                    <p className="text-sm text-slate-500 mb-4">Case #: {c.caseNumber}</p>
                                    <div className="space-y-3 text-sm text-slate-600 mb-4"><InfoItem icon={User} label="Client" value={c.clientName} /><InfoItem icon={Users} label="Opposing Party" value={c.opposingParty} /><InfoItem icon={Briefcase} label="Court" value={c.courtName} /><InfoItem icon={MapPin} label="File Location" value={c.fileLocation} /></div>
                                    <div className="mb-4"><h4 className="font-semibold text-xs text-slate-500 mb-2">TAGS</h4><div className="flex flex-wrap gap-2">{c.tags?.map(tag => <span key={tag} className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded-full">{tag}</span>)}</div></div>
                                    <div className="mb-4"><h4 className="font-semibold text-xs text-slate-500 mb-2">NOTES</h4><p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-md whitespace-pre-wrap">{c.notes}</p></div>
                                    {c.attachments && c.attachments.length > 0 && <div className="mb-4"><h4 className="font-semibold text-xs text-slate-500 mb-2">ATTACHMENTS</h4><ul className="space-y-2">{c.attachments.map((att, i) => <li key={i} className="flex items-center justify-between bg-slate-50 p-2 rounded-md"><a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline truncate"><Paperclip className="w-4 h-4" /><span className="truncate">{att.name}</span></a><button onClick={() => handleDeleteAttachment(c.id, att)} className="p-1 text-slate-400 hover:text-red-600 flex-shrink-0"><X className="w-3 h-3" /></button></li>)}</ul></div>}
                                </div>
                                <div className="mt-auto pt-4 border-t border-slate-200"><h4 className="font-semibold text-xs text-slate-500 mb-2">HEARING DATES</h4><ul className="space-y-1 text-sm">{(c.hearingDates || []).map((date, i) => <li key={i} className="flex items-center gap-2 text-slate-700"><Calendar className="w-4 h-4 text-slate-400" />{new Date(date).toLocaleDateString()}</li>)}</ul></div>
                            </motion.div>
                        )) : <div className="col-span-full text-center py-12"><p className="text-slate-500">No case files found. Click 'Add Case' to get started!</p></div>}
                        </AnimatePresence>
                    </div>
                )}
            </main>

            <AnimatePresence>{isModalOpen && <CaseFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveCase} caseData={editingCase} />}</AnimatePresence>
            <AnimatePresence>{deletingCaseId && <ConfirmDeleteModal isOpen={!!deletingCaseId} onClose={() => setDeletingCaseId(null)} onConfirm={confirmDelete} />}</AnimatePresence>
        </>
    );
}

// --- NEW: Dashboard Component ---
const Dashboard = ({ cases }) => {
    // Data for Pie Chart (Case Types)
    const caseTypeData = useMemo(() => {
        const counts = cases.reduce((acc, caseItem) => {
            (caseItem.tags || ['Uncategorized']).forEach(tag => {
                acc[tag] = (acc[tag] || 0) + 1;
            });
            return acc;
        }, {});
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [cases]);

    // Data for Bar Chart (Monthly New Cases)
    const monthlyData = useMemo(() => {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const counts = {};
        
        // Initialize last 6 months
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
            counts[key] = 0;
        }

        cases.forEach(caseItem => {
            if (caseItem.createdAt && caseItem.createdAt instanceof Date) {
                const key = `${monthNames[caseItem.createdAt.getMonth()]} ${caseItem.createdAt.getFullYear()}`;
                if (key in counts) {
                    counts[key]++;
                }
            }
        });

        return Object.entries(counts).map(([name, cases]) => ({ name, cases }));
    }, [cases]);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ff4d4d'];

    const totalCases = cases.length;
    const activeCases = cases.filter(c => !(c.tags?.includes('Decided') || c.tags?.includes('Closed'))).length;
    const decidedCases = totalCases - activeCases;

    return (
        <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-700 mb-4">Dashboard</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Stat Cards */}
                <StatCard icon={Briefcase} title="Total Cases" value={totalCases} color="blue" />
                <StatCard icon={AreaChart} title="Active Cases" value={activeCases} color="green" />
                <StatCard icon={FileText} title="Decided Cases" value={decidedCases} color="orange" />
                <StatCard icon={Calendar} title="Upcoming Hearings" value={cases.flatMap(c => c.hearingDates || []).filter(d => new Date(d) >= new Date()).length} color="purple" />

                {/* Pie Chart */}
                <div className="md:col-span-2 lg:col-span-2 bg-white p-6 rounded-xl shadow-lg">
                    <h3 className="font-bold text-slate-800 text-lg mb-4">Case Types Distribution</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie data={caseTypeData} cx="50%" cy="50%" labelLine={false} outerRadius={100} fill="#8884d8" dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                {caseTypeData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Bar Chart */}
                <div className="md:col-span-2 lg:col-span-2 bg-white p-6 rounded-xl shadow-lg">
                    <h3 className="font-bold text-slate-800 text-lg mb-4">New Cases (Last 6 Months)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={monthlyData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="cases" fill="#8884d8" name="New Cases" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ icon: Icon, title, value, color }) => {
    const colors = {
        blue: 'bg-blue-100 text-blue-600',
        green: 'bg-green-100 text-green-600',
        orange: 'bg-orange-100 text-orange-600',
        purple: 'bg-purple-100 text-purple-600',
    };
    return (
        <div className="bg-white p-6 rounded-xl shadow-lg flex items-center space-x-4">
            <div className={`p-3 rounded-full ${colors[color]}`}>
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-sm text-slate-500">{title}</p>
                <p className="text-2xl font-bold text-slate-800">{value}</p>
            </div>
        </div>
    );
};


// All other components (InfoItem, CaseFormModal, InputField, ConfirmDeleteModal) remain the same.
const InfoItem = ({ icon: Icon, label, value }) => (<div className="flex items-start"><Icon className="w-4 h-4 text-slate-400 mt-0.5 mr-3 flex-shrink-0" /><div><p className="text-xs text-slate-500">{label}</p><p className="font-medium text-slate-800">{value}</p></div></div>);
function CaseFormModal({ isOpen, onClose, onSave, caseData }) {
    const [formData, setFormData] = useState({ clientName: '', caseTitle: '', courtName: '', caseNumber: '', hearingDates: [], opposingParty: '', fileLocation: '', tags: [], notes: '', attachments: [] });
    const [newDate, setNewDate] = useState('');
    const [newTag, setNewTag] = useState('');
    const [fileToUpload, setFileToUpload] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [loading, setLoading] = useState(false);
    useEffect(() => { if (caseData) setFormData({ ...caseData, hearingDates: caseData.hearingDates || [], tags: caseData.tags || [], attachments: caseData.attachments || [] }); else setFormData({ clientName: '', caseTitle: '', courtName: '', caseNumber: '', hearingDates: [], opposingParty: '', fileLocation: '', tags: [], notes: '', attachments: [] }); setFileToUpload(null); setUploadProgress(0); }, [caseData, isOpen]);
    const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleFileChange = (e) => { if (e.target.files[0]) setFileToUpload(e.target.files[0]); };
    const handleAddDate = () => { if (newDate && !formData.hearingDates.includes(newDate)) { setFormData(prev => ({ ...prev, hearingDates: [...prev.hearingDates, newDate].sort() })); setNewDate(''); } };
    const handleRemoveDate = (dateToRemove) => setFormData(prev => ({ ...prev, hearingDates: prev.hearingDates.filter(d => d !== dateToRemove) }));
    const handleAddTag = () => { if (newTag && !formData.tags.includes(newTag.trim())) { setFormData(prev => ({ ...prev, tags: [...prev.tags, newTag.trim()] })); setNewTag(''); } };
    const handleRemoveTag = (tagToRemove) => setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tagToRemove) }));
    const handleSubmit = async (e) => { e.preventDefault(); setLoading(true); await onSave(formData, fileToUpload, setUploadProgress); setLoading(false); };
    return (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black bg-opacity-50 z-30 flex justify-center items-center p-4" onClick={onClose}><motion.div initial={{ scale: 0.9, y: -20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: -20 }} className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}><div className="p-6 border-b border-slate-200 flex justify-between items-center"><h2 className="text-xl font-bold text-slate-800">{caseData ? 'Edit Case File' : 'Add New Case File'}</h2><button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-200"><X className="w-5 h-5" /></button></div><form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><InputField name="clientName" label="Client Name" value={formData.clientName} onChange={handleChange} required /><InputField name="caseTitle" label="Case Title" value={formData.caseTitle} onChange={handleChange} required /><InputField name="courtName" label="Court Name / Type" value={formData.courtName} onChange={handleChange} required /><InputField name="caseNumber" label="Case Number" value={formData.caseNumber} onChange={handleChange} required /><InputField name="opposingParty" label="Opposing Party" value={formData.opposingParty} onChange={handleChange} /><InputField name="fileLocation" label="Physical File Location" value={formData.fileLocation} onChange={handleChange} /></div><div><label className="block text-sm font-medium text-slate-600 mb-1">Hearing Dates</label><div className="flex gap-2 mb-2"><input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="flex-grow w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /><button type="button" onClick={handleAddDate} className="bg-slate-200 text-slate-800 px-4 rounded-lg hover:bg-slate-300">Add</button></div><div className="flex flex-wrap gap-2">{formData.hearingDates.map(date => <span key={date} className="flex items-center gap-2 bg-slate-100 text-slate-700 text-sm px-2 py-1 rounded-full">{new Date(date).toLocaleDateString()}<button type="button" onClick={() => handleRemoveDate(date)}><X className="w-3 h-3" /></button></span>)}</div></div><div><label className="block text-sm font-medium text-slate-600 mb-1">Tags</label><div className="flex gap-2 mb-2"><input type="text" placeholder="Add a tag..." value={newTag} onChange={e => setNewTag(e.target.value)} className="flex-grow w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /><button type="button" onClick={handleAddTag} className="bg-slate-200 text-slate-800 px-4 rounded-lg hover:bg-slate-300">Add</button></div><div className="flex flex-wrap gap-2">{formData.tags.map(tag => <span key={tag} className="flex items-center gap-2 bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded-full">{tag}<button type="button" onClick={() => handleRemoveTag(tag)}><X className="w-3 h-3" /></button></span>)}</div></div><div><label htmlFor="notes" className="block text-sm font-medium text-slate-600 mb-1">Notes / Updates</label><textarea id="notes" name="notes" rows="4" value={formData.notes} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea></div><div><label className="block text-sm font-medium text-slate-600 mb-1">Attach File</label><div className="mt-2 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-md"><div className="space-y-1 text-center"><UploadCloud className="mx-auto h-12 w-12 text-slate-400" /><div className="flex text-sm text-slate-600"><label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"><span>Upload a file</span><input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} /></label><p className="pl-1">or drag and drop</p></div>{fileToUpload ? <p className="text-sm text-slate-500">{fileToUpload.name}</p> : <p className="text-xs text-slate-500">PDF, PNG, JPG, DOCX up to 10MB</p>}</div></div>{uploadProgress > 0 && <div className="w-full bg-slate-200 rounded-full h-2.5 mt-2"><div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div></div>}</div><div className="pt-4 border-t border-slate-200 flex justify-end gap-3"><button type="button" onClick={onClose} className="bg-white text-slate-700 px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50">Cancel</button><button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center w-28">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Case'}</button></div></form></motion.div></motion.div>);
}
const InputField = ({ name, label, value, onChange, type = 'text', required = false, id }) => (<div><label htmlFor={id || name} className="block text-sm font-medium text-slate-600 mb-1">{label}</label><input type={type} id={id || name} name={name} value={value} onChange={onChange} required={required} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>);
function ConfirmDeleteModal({ isOpen, onClose, onConfirm }) {
    if (!isOpen) return null;
    return (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black bg-opacity-60 z-40 flex justify-center items-center p-4" onClick={onClose}><motion.div initial={{ scale: 0.9, y: -20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: -20 }} className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center" onClick={e => e.stopPropagation()}><div className="mx-auto bg-red-100 rounded-full h-12 w-12 flex items-center justify-center mb-4"><FileWarning className="h-6 w-6 text-red-600" /></div><h3 className="text-lg font-bold text-slate-800 mb-2">Are you sure?</h3><p className="text-slate-600 mb-6 text-sm">Do you really want to delete this case file? This action cannot be undone.</p><div className="flex justify-center gap-4"><button onClick={onClose} className="bg-slate-200 text-slate-800 px-6 py-2 rounded-lg hover:bg-slate-300 font-semibold">Cancel</button><button onClick={onConfirm} className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 font-semibold">Delete</button></div></motion.div></motion.div>);
}

export default App;
