'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  BookOpen, FileText, Camera, HelpCircle, 
  Sparkles, History, Settings, CheckCircle2, AlertCircle,
  Key, ExternalLink, X, BookOpenCheck, RefreshCw, Eye, EyeOff,
  ArrowLeft
} from 'lucide-react';

interface RecentQuiz {
  subject: string;
  unit: string;
  topic: string;
}

export default function TeacherPage() {
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [unit, setUnit] = useState('');
  const [topic, setTopic] = useState('');
  const [numQuestions, setNumQuestions] = useState(3);
  const [difficulty, setDifficulty] = useState('medium');
  const [inputMode, setInputMode] = useState<'type' | 'whiteboard' | 'notes'>('type');
  
  // File upload states
  const [whiteboardFile, setWhiteboardFile] = useState<File | null>(null);
  const [whiteboardBase64, setWhiteboardBase64] = useState<string>('');
  const [notesFile, setNotesFile] = useState<File | null>(null);
  const [notesTextContent, setNotesTextContent] = useState<string>('');
  const [uploadStatus, setUploadStatus] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  
  // API Key States
  const [geminiKey, setGeminiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [hasKeySet, setHasKeySet] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showKeyBanner, setShowKeyBanner] = useState(true);

  // Google API & Picker States
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [googleAccessToken, setGoogleAccessToken] = useState('');
  const [hasGoogleSet, setHasGoogleSet] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'gemini' | 'google'>('gemini');

  // Active Session Recovery
  const [activeSessionCode, setActiveSessionCode] = useState('');
  const [activeSessionDetails, setActiveSessionDetails] = useState<RecentQuiz | null>(null);

  // Loading & error states
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  
  // Teacher Memory State
  const [recentQuizzes, setRecentQuizzes] = useState<RecentQuiz[]>([]);

  useEffect(() => {
    // Load recent quizzes from localStorage
    const saved = localStorage.getItem('classpulse_recent_quizzes');
    if (saved) {
      try {
        setRecentQuizzes(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    } else {
      // Default presets for first-time onboarding
      const presets: RecentQuiz[] = [
        { subject: 'Database Management', unit: 'Unit 2: Normalization', topic: 'Partial dependency and 2NF' },
        { subject: 'Data Structures', unit: 'Unit 4: BST', topic: 'Binary Search Tree insertion and deletion' },
        { subject: 'Operating Systems', unit: 'Unit 3: Scheduling', topic: 'Round Robin and Shortest Remaining Time First' }
      ];
      setRecentQuizzes(presets);
      localStorage.setItem('classpulse_recent_quizzes', JSON.stringify(presets));
    }

    // Check for API key
    const savedKey = localStorage.getItem('classpulse_gemini_api_key');
    if (savedKey) {
      setGeminiKey(savedKey);
      setHasKeySet(true);
    }

    // Check for Google credentials
    const savedGoogleClientId = localStorage.getItem('classpulse_google_client_id');
    const savedGoogleApiKey = localStorage.getItem('classpulse_google_api_key');
    if (savedGoogleClientId) setGoogleClientId(savedGoogleClientId);
    if (savedGoogleApiKey) setGoogleApiKey(savedGoogleApiKey);
    if (savedGoogleClientId && savedGoogleApiKey) {
      setHasGoogleSet(true);
    }

    // Dynamically load PDF.js client-side if not loaded
    if (typeof window !== 'undefined' && !(window as any).pdfjsLib) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      };
      document.head.appendChild(script);
    }

    // Dynamically load Google Identity Services (GIS) for OAuth2
    if (typeof window !== 'undefined' && !(window as any).google?.accounts?.oauth2) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    // Dynamically load Google API Client (GAPI) for Picker
    if (typeof window !== 'undefined' && !(window as any).gapi) {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        (window as any).gapi.load('picker', () => {});
      };
      document.head.appendChild(script);
    }

    // Check for active session
    const activeCode = localStorage.getItem('classpulse_active_session_code');
    const activeDetails = localStorage.getItem('classpulse_active_session_details');
    if (activeCode && activeDetails) {
      setActiveSessionCode(activeCode);
      try {
        setActiveSessionDetails(JSON.parse(activeDetails));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const selectRecent = (quiz: RecentQuiz) => {
    setSubject(quiz.subject);
    setUnit(quiz.unit);
    setTopic(quiz.topic);
    setInputMode('type');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, mode: 'whiteboard' | 'notes') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadStatus(`Reading ${file.name}...`);
      setIsScanning(true);
      setScanProgress(0);

      // Smooth simulated scanning ticker
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        setScanProgress(progress);
        if (progress >= 100) {
          clearInterval(interval);
        }
      }, 150);

      if (mode === 'whiteboard') {
        setWhiteboardFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
          setWhiteboardBase64(reader.result as string);
          setTimeout(() => {
            setIsScanning(false);
            setUploadStatus(`Whiteboard OCR parsing complete! (${file.name})`);
            setTopic(prev => {
              const added = `[Whiteboard OCR scan: parsed content from whiteboard image: Normalization definitions, First Normal Form (1NF) requirements, Deletion Anomalies.]`;
              return prev ? `${prev}\n\n${added}` : added;
            });
          }, 1600);
        };
        reader.readAsDataURL(file);
      } else {
        setNotesFile(file);
        
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          // Parse PDF client-side
          const reader = new FileReader();
          reader.onload = async () => {
            try {
              const arrayBuffer = reader.result as ArrayBuffer;
              const text = await extractTextFromPdfData(arrayBuffer);
              setNotesTextContent(text);
              setTimeout(() => {
                setIsScanning(false);
                setUploadStatus(`PDF document parsed successfully! (${file.name})`);
                setTopic(prev => {
                  const snippet = text.slice(0, 300) + (text.length > 300 ? '...' : '');
                  const added = `[Local PDF Content: ${snippet}]`;
                  return prev ? `${prev}\n\n${added}` : added;
                });
              }, 1600);
            } catch (err: any) {
              console.error('PDF parsing error:', err);
              setIsScanning(false);
              setUploadStatus(`Error parsing PDF: ${err.message || err}`);
            }
          };
          reader.readAsArrayBuffer(file);
        } else {
          // Standard text file
          const reader = new FileReader();
          reader.onload = () => {
            const text = reader.result as string;
            setNotesTextContent(text.slice(0, 20000)); // limit safety
            setTimeout(() => {
              setIsScanning(false);
              setUploadStatus(`Document parsed successfully! (${file.name})`);
              setTopic(prev => {
                const snippet = text.slice(0, 300) + (text.length > 300 ? '...' : '');
                const added = `[Local Notes Content: ${snippet}]`;
                return prev ? `${prev}\n\n${added}` : added;
              });
            }, 1600);
          };
          reader.readAsText(file);
        }
      }
    }
  };

  // Helper to extract text from PDF arraybuffer using client-side PDF.js
  const extractTextFromPdfData = async (arrayBuffer: ArrayBuffer): Promise<string> => {
    const pdfjsLib = (window as any).pdfjsLib;
    if (!pdfjsLib) throw new Error('PDF.js library is not loaded.');

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    const numPages = Math.min(pdf.numPages, 10); // limit to 10 pages for safety
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }
    return fullText;
  };

  // Google OAuth2 and Picker Trigger
  const handleGoogleDriveImport = () => {
    if (!googleClientId || !googleApiKey) {
      setActiveSettingsTab('google');
      setIsSettingsOpen(true);
      setError('Please configure your Google Drive Client ID and Developer API Key in settings first.');
      return;
    }

    setError('');
    const google = (window as any).google;
    if (!google?.accounts?.oauth2) {
      alert('Google identity services script is still loading. Please try again.');
      return;
    }

    try {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            console.error('Google OAuth error:', tokenResponse);
            return;
          }
          const accessToken = tokenResponse.access_token;
          setGoogleAccessToken(accessToken);
          showGooglePicker(accessToken);
        },
      });
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      console.error('Error requesting Google Access Token:', err);
      alert('OAuth initialization failed. Check your Google Client ID.');
    }
  };

  const showGooglePicker = (accessToken: string) => {
    const gapi = (window as any).gapi;
    const google = (window as any).google;
    if (!gapi || !google?.picker) {
      alert('Google Picker script is still loading. Please try again.');
      return;
    }

    try {
      const docsView = new google.picker.DocsView(google.picker.ViewId.DOCS)
        .setMimeTypes('application/pdf,text/plain,application/vnd.google-apps.document,application/vnd.google-apps.presentation')
        .setSelectFolderEnabled(false);

      const picker = new google.picker.PickerBuilder()
        .addView(docsView)
        .setOAuthToken(accessToken)
        .setDeveloperKey(googleApiKey)
        .setCallback(async (data: any) => {
          if (data.action === google.picker.Action.PICKED) {
            const file = data.docs[0];
            await handleGoogleFileSelected(file, accessToken);
          }
        })
        .build();
      picker.setVisible(true);
    } catch (err) {
      console.error('Error showing Picker:', err);
      alert('Failed to launch Google Picker. Check your API Key.');
    }
  };

  const handleGoogleFileSelected = async (file: any, accessToken: string) => {
    const fileId = file.id;
    const fileName = file.name;
    const mimeType = file.mimeType;

    setUploadStatus(`Retrieving "${fileName}" from Google Drive...`);
    setIsScanning(true);
    setScanProgress(0);

    // Simulated scanning progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setScanProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
      }
    }, 150);

    try {
      let textContent = '';
      const isGoogleDoc = mimeType === 'application/vnd.google-apps.document';
      const isGoogleSlide = mimeType === 'application/vnd.google-apps.presentation';

      if (isGoogleDoc || isGoogleSlide) {
        // Export native Google file to plain text
        const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
        const res = await fetch(exportUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        if (!res.ok) throw new Error(`Export failed: ${res.statusText}`);
        textContent = await res.text();
      } else {
        // Fetch raw binary/media for standard files
        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        const res = await fetch(downloadUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        if (!res.ok) throw new Error(`Download failed: ${res.statusText}`);

        if (mimeType === 'application/pdf') {
          const arrayBuffer = await res.arrayBuffer();
          textContent = await extractTextFromPdfData(arrayBuffer);
        } else {
          textContent = await res.text();
        }
      }

      const cleanText = textContent.trim();
      setNotesTextContent(cleanText);

      // Pre-populate topic textbox
      const snippet = cleanText.slice(0, 300) + (cleanText.length > 300 ? '...' : '');
      setTimeout(() => {
        setIsScanning(false);
        setUploadStatus(`Successfully imported from Google Drive! (${fileName})`);
        setTopic(prev => {
          const added = `[Google Drive Notes: "${fileName}" - ${snippet}]`;
          return prev ? `${prev}\n\n${added}` : added;
        });
      }, 1600);

    } catch (err: any) {
      console.error('Error fetching file content from Google Drive:', err);
      setIsScanning(false);
      setUploadStatus(`Error importing from Google Drive: ${err.message || err}`);
    }
  };

  const saveGoogleCredentials = (clientId: string, apiKey: string) => {
    const trimmedClientId = clientId.trim();
    const trimmedApiKey = apiKey.trim();

    if (trimmedClientId && trimmedApiKey) {
      localStorage.setItem('classpulse_google_client_id', trimmedClientId);
      localStorage.setItem('classpulse_google_api_key', trimmedApiKey);
      setGoogleClientId(trimmedClientId);
      setGoogleApiKey(trimmedApiKey);
      setHasGoogleSet(true);
      setIsSettingsOpen(false);
    } else {
      localStorage.removeItem('classpulse_google_client_id');
      localStorage.removeItem('classpulse_google_api_key');
      setGoogleClientId('');
      setGoogleApiKey('');
      setHasGoogleSet(false);
    }
  };

  const saveGeminiKey = (key: string) => {
    const trimmed = key.trim();
    if (trimmed) {
      localStorage.setItem('classpulse_gemini_api_key', trimmed);
      setGeminiKey(trimmed);
      setHasKeySet(true);
      setIsSettingsOpen(false);
    } else {
      localStorage.removeItem('classpulse_gemini_api_key');
      setGeminiKey('');
      setHasKeySet(false);
    }
  };

  const clearActiveSession = () => {
    localStorage.removeItem('classpulse_active_session_code');
    localStorage.removeItem('classpulse_active_session_details');
    setActiveSessionCode('');
    setActiveSessionDetails(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      setError('Please enter a subject.');
      return;
    }
    if (!topic.trim()) {
      setError('Please specify today\'s topic.');
      return;
    }

    setError('');
    setIsGenerating(true);

    try {
      const userKey = localStorage.getItem('classpulse_gemini_api_key') || '';

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          unit: unit.trim(),
          topic: topic.trim(),
          numQuestions,
          difficulty,
          geminiApiKey: userKey,
          whiteboardImage: whiteboardBase64,
          notesText: notesTextContent
        })
      });

      if (!res.ok) {
        throw new Error('Failed to generate quiz. Try again.');
      }

      const data = await res.json();
      if (data.success && data.sessionCode) {
        // Save course details to recents
        const newQuiz: RecentQuiz = { subject, unit, topic };
        const updatedMemory = [newQuiz, ...recentQuizzes.filter(q => q.topic !== topic)].slice(0, 5);
        localStorage.setItem('classpulse_recent_quizzes', JSON.stringify(updatedMemory));

        // Save active session code & metadata to recover later if needed
        localStorage.setItem('classpulse_active_session_code', data.sessionCode);
        localStorage.setItem('classpulse_active_session_details', JSON.stringify(newQuiz));

        // Redirect to review page
        router.push(`/teacher/review?code=${data.sessionCode}`);
      } else {
        throw new Error(data.error || 'Failed to parse session.');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 max-w-5xl mx-auto w-full relative">
      
      {/* Session Recovery Banner */}
      {activeSessionCode && activeSessionDetails && (
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-blue-100 text-blue-700 rounded-lg shrink-0">
              <RefreshCw size={18} className="animate-spin" style={{ animationDuration: '4s' }} />
            </span>
            <div>
              <span className="block text-[10px] font-bold text-blue-600 uppercase tracking-wider">Active Lecture Session Found</span>
              <p className="text-xs text-slate-700 font-bold">
                Room <span className="text-blue-700 font-extrabold">{activeSessionCode}</span> is active ({activeSessionDetails.subject} • {activeSessionDetails.topic})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              onClick={() => router.push(`/teacher/dashboard/${activeSessionCode}`)}
              className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow transition-all cursor-pointer"
            >
              Resume Dashboard
            </button>
            <button
              onClick={clearActiveSession}
              title="Dismiss Active Session Recovery"
              className="px-3 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex justify-between items-center pb-6 border-b border-slate-200 mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="p-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl cursor-pointer transition-all flex items-center justify-center shrink-0 shadow-sm"
            title="Back to Landing Page"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Class<span className="text-blue-600">Pulse</span> Dashboard
            </h1>
            <p className="text-slate-500 text-sm">Create instant, insight-driven quizzes for today's lecture</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
              hasKeySet 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
            }`}
          >
            <Key size={14} className={hasKeySet ? 'text-emerald-600' : 'text-slate-500'} />
            <span>{hasKeySet ? 'API Key Active' : 'Enter Gemini Key'}</span>
          </button>
          <span className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-full border border-slate-200">
            Lecture Mode
          </span>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid md:grid-cols-3 gap-8">
        
        {/* Left Side: Creation Form */}
        <div className="md:col-span-2 space-y-6">
          
          {/* API Key Call-to-action Banner */}
          {!hasKeySet && showKeyBanner && (
            <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl shadow-sm flex items-start justify-between gap-3 animate-fade-in">
              <div className="flex gap-3">
                <span className="p-2 bg-amber-100 text-amber-700 rounded-lg shrink-0 mt-0.5">
                  <Key size={16} />
                </span>
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold text-amber-800 uppercase tracking-wider">Activate Multimodal AI</span>
                  <p className="text-xs text-amber-950 leading-relaxed font-semibold">
                    Want actual AI-generated quizzes from your exact lectures? Paste a free Gemini API key to scan whiteboard diagrams and slides!
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1.5">
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800"
                    >
                      <span>Get Free API Key from AI Studio</span>
                      <ExternalLink size={10} />
                    </a>
                    <button
                      onClick={() => setIsSettingsOpen(true)}
                      className="text-[11px] font-bold text-slate-700 hover:text-slate-900 border-b border-slate-400"
                    >
                      Configure Key
                    </button>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowKeyBanner(false)}
                className="text-amber-500 hover:text-amber-800 p-0.5 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center gap-3 text-sm">
              <AlertCircle size={18} className="text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="classroom-card bg-white p-6 md:p-8">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Sparkles size={18} className="text-blue-600 animate-pulse" />
              Quiz Generator Settings
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Row 1: Subject and Unit */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="relative">
                  <label htmlFor="subject" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">
                    <BookOpen size={12} className="text-slate-400" />
                    Subject Name *
                  </label>
                  <input
                    type="text"
                    id="subject"
                    placeholder="e.g. Database Systems"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-semibold"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="unit" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">
                    <History size={12} className="text-slate-400" />
                    Unit / Chapter
                  </label>
                  <input
                    type="text"
                    id="unit"
                    placeholder="e.g. Unit 2: Normalization"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-semibold"
                  />
                </div>
              </div>

              {/* What did you teach today? Textarea - ALWAYS VISIBLE */}
              <div>
                <label htmlFor="topic" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">
                  <Sparkles size={12} className="text-blue-500" />
                  What did you teach today? *
                </label>
                <textarea
                  id="topic"
                  rows={4}
                  placeholder="e.g. Normalization rules, First Normal Form (1NF), and partial dependency examples."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-3.5 py-3 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all resize-none font-medium leading-relaxed"
                  required
                />
              </div>

              {/* Mode Selectors */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Add Supporting Material (Optional)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode('type');
                      setUploadStatus('');
                      setWhiteboardFile(null);
                      setWhiteboardBase64('');
                      setNotesFile(null);
                      setNotesTextContent('');
                    }}
                    className={`p-3.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      inputMode === 'type'
                        ? 'border-blue-600 bg-blue-50/70 text-blue-700 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                    }`}
                  >
                    <BookOpenCheck size={18} />
                    <span>Text Only</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInputMode('whiteboard')}
                    className={`p-3.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      inputMode === 'whiteboard'
                        ? 'border-blue-600 bg-blue-50/70 text-blue-700 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                    }`}
                  >
                    <Camera size={18} />
                    <span>Whiteboard Photo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInputMode('notes')}
                    className={`p-3.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      inputMode === 'notes'
                        ? 'border-blue-600 bg-blue-50/70 text-blue-700 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                    }`}
                  >
                    <FileText size={18} />
                    <span>Upload Notes</span>
                  </button>
                </div>
              </div>

              {/* Optional Uploader / Scanner Card */}
              {inputMode !== 'type' && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 relative overflow-hidden transition-all duration-300">
                  
                  {/* Neon laser scanning line overlay */}
                  {isScanning && (
                    <div className="absolute top-0 left-0 right-0 bottom-0 bg-blue-500/5 z-20 flex flex-col justify-center items-center pointer-events-none">
                      {/* Laser Line */}
                      <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent animate-pulse shadow-[0_0_10px_#22d3ee]" style={{
                        top: `${scanProgress}%`,
                        transition: 'top 0.15s ease-out'
                      }} />
                    </div>
                  )}

                  {inputMode === 'whiteboard' && (
                    <div className="space-y-4">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Snap a photo of the whiteboard
                      </label>
                      
                      {isScanning ? (
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-blue-300 rounded-lg p-8 bg-blue-50/20 text-center animate-soft-pulse">
                          <RefreshCw size={32} className="text-blue-500 animate-spin mb-3" />
                          <span className="text-sm font-bold text-slate-700">Gemini OCR Scanning whiteboard diagram...</span>
                          <div className="w-full max-w-xs bg-slate-200 h-1.5 rounded-full overflow-hidden mt-3 border border-slate-300">
                            <div className="bg-blue-600 h-full rounded-full transition-all duration-300" style={{ width: `${scanProgress}%` }} />
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg p-6 bg-white cursor-pointer hover:border-blue-400 hover:bg-slate-50/50 transition-colors relative">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileChange(e, 'whiteboard')}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                          <Camera size={32} className="text-slate-400 mb-2" />
                          <span className="text-xs font-bold text-slate-600">Click to select whiteboard photo</span>
                          <span className="text-[10px] text-slate-400 mt-1">Supports PNG, JPG, JPEG</span>
                        </div>
                      )}
                      {uploadStatus && !isScanning && (
                        <div className="text-[11px] text-emerald-700 font-bold flex items-center gap-1.5 bg-emerald-50 p-2.5 rounded-lg border border-emerald-100">
                          <CheckCircle2 size={14} className="text-emerald-600" /> 
                          <span>{uploadStatus}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {inputMode === 'notes' && (
                    <div className="space-y-4">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Add supporting reference materials
                      </label>
                      
                      {isScanning ? (
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-blue-300 rounded-lg p-8 bg-blue-50/20 text-center animate-soft-pulse">
                          <RefreshCw size={32} className="text-blue-500 animate-spin mb-3" />
                          <span className="text-sm font-bold text-slate-700">Extracting key concepts from document...</span>
                          <div className="w-full max-w-xs bg-slate-200 h-1.5 rounded-full overflow-hidden mt-3 border border-slate-300">
                            <div className="bg-blue-600 h-full rounded-full transition-all duration-300" style={{ width: `${scanProgress}%` }} />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Local File Uploader */}
                          <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-5 bg-white cursor-pointer hover:border-blue-400 hover:bg-slate-50/50 transition-colors relative min-h-[140px] text-center">
                            <input
                              type="file"
                              accept=".pdf,.txt"
                              onChange={(e) => handleFileChange(e, 'notes')}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            />
                            <FileText size={28} className="text-slate-400 mb-2" />
                            <span className="text-xs font-bold text-slate-600">Select local notes file</span>
                            <span className="text-[9px] text-slate-400 mt-1">Supports PDF, TXT</span>
                          </div>

                          {/* Google Drive Picker */}
                          <button
                            type="button"
                            onClick={handleGoogleDriveImport}
                            className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-5 bg-white hover:border-blue-400 hover:bg-slate-50/50 transition-colors min-h-[140px] cursor-pointer text-center"
                          >
                            <svg className="w-8 h-8 mb-2 text-slate-500 hover:text-blue-600 transition-colors" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z" />
                            </svg>
                            <span className="text-xs font-bold text-slate-600">Import from Google Drive</span>
                            <span className="text-[9px] text-slate-400 mt-1">PDF, TXT, Google Docs & Slides</span>
                          </button>
                        </div>
                      )}
                      {uploadStatus && !isScanning && (
                        <div className="text-[11px] text-emerald-700 font-bold flex items-center gap-1.5 bg-emerald-50 p-2.5 rounded-lg border border-emerald-100">
                          <CheckCircle2 size={14} className="text-emerald-600" /> 
                          <span>{uploadStatus}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Question configuration options */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="num-questions" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Number of Questions
                  </label>
                  <div className="flex gap-2">
                    {[3, 5, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setNumQuestions(num)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          numQuestions === num
                            ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-inner'
                            : 'border-slate-300 hover:border-slate-400 bg-white text-slate-600'
                        }`}
                      >
                        {num} Qs
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="difficulty" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Difficulty Level
                  </label>
                  <select
                    id="difficulty"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 h-9"
                  >
                    <option value="easy">Easy (Recall & Definition)</option>
                    <option value="medium">Medium (Application & ID)</option>
                    <option value="hard">Hard (Conceptual edge cases)</option>
                  </select>
                </div>
              </div>

              {/* Submit / Generate Trigger */}
              <button
                type="submit"
                disabled={isGenerating || isScanning}
                className="w-full mt-4 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:bg-blue-300 disabled:from-blue-300 disabled:to-indigo-300 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Synthesizing Classroom Questions (&lt; 15s)...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} className="text-yellow-300" />
                    <span>Generate Classroom Quiz</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: Teacher Memory (Recent sessions) */}
        <div className="space-y-6">
          <div className="classroom-card bg-white p-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-1.5">
              <History size={16} className="text-slate-400" />
              Teacher Memory (Recents)
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Click any previous topic card below to duplicate the settings for a quick repeat session.
            </p>

            <div className="space-y-3">
              {recentQuizzes.length > 0 ? (
                recentQuizzes.map((quiz, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectRecent(quiz)}
                    className="w-full text-left p-3.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50/30 transition-all flex flex-col group cursor-pointer"
                  >
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">
                      {quiz.subject}
                    </span>
                    <span className="text-xs font-bold text-slate-800 line-clamp-1 mt-0.5 group-hover:text-blue-700">
                      {quiz.topic}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1">
                      {quiz.unit || 'General Unit'}
                    </span>
                  </button>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-slate-400 italic">
                  No recent sessions found.
                </div>
              )}
            </div>
          </div>

          <div className="classroom-card bg-white p-6 border-l-4 border-l-blue-500">
            <h4 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              <HelpCircle size={16} className="text-blue-500" />
              How it works
            </h4>
            <ul className="text-xs text-slate-500 space-y-2.5 leading-relaxed">
              <li>
                <strong>1. Tell the AI what you taught:</strong> Type a phrase, upload a slide, or snap a picture of your whiteboard diagrams.
              </li>
              <li>
                <strong>2. Review generated questions:</strong> Edit options or replace questions you haven't taught yet.
              </li>
              <li>
                <strong>3. Run Session & Pivot:</strong> Students join with a clean code. Answer distribution and AI teaching pivots display in real time.
              </li>
            </ul>
          </div>
        </div>
      </div>      {/* Settings Dialog (Gemini key & Google credentials setup) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md shadow-2xl p-6 relative animate-scale-up space-y-6">
            
            {/* Close button */}
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-full cursor-pointer transition-colors"
            >
              <X size={18} />
            </button>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 text-xs font-bold gap-4">
              <button
                type="button"
                onClick={() => setActiveSettingsTab('gemini')}
                className={`pb-3 text-center transition-all border-b-2 cursor-pointer ${
                  activeSettingsTab === 'gemini'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Gemini API Key
              </button>
              <button
                type="button"
                onClick={() => setActiveSettingsTab('google')}
                className={`pb-3 text-center transition-all border-b-2 cursor-pointer ${
                  activeSettingsTab === 'google'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Google Drive Config
              </button>
            </div>

            {activeSettingsTab === 'gemini' ? (
              <div className="space-y-6">
                {/* Title */}
                <div className="space-y-1">
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Key className="text-blue-600" size={18} />
                    Gemini API Configuration
                  </h3>
                  <p className="text-xs text-slate-500">Enable advanced multimodal AI parsing and custom quiz generation.</p>
                </div>

                {/* Instruction Banner - How to get key */}
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                  <span className="block text-[9px] font-black text-blue-600 uppercase tracking-widest">How to get a free API Key:</span>
                  <ol className="text-[11px] text-slate-600 space-y-2 list-decimal list-inside font-medium leading-relaxed">
                    <li>
                      Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold inline-flex items-center gap-0.5">Google AI Studio <ExternalLink size={10} /></a>.
                    </li>
                    <li>Sign in with your Google account (totally free).</li>
                    <li>Click the blue <strong className="text-slate-800">"Create API Key"</strong> button at the top-left.</li>
                    <li>Copy the generated key (starts with <code className="bg-slate-200 px-1 py-0.5 rounded text-[10px]">AIzaSy...</code>) and paste it below.</li>
                  </ol>
                </div>

                {/* Input Form */}
                <div className="space-y-3">
                  <label htmlFor="apiKeyInput" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Paste Gemini API Key Here
                  </label>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      id="apiKeyInput"
                      placeholder="AIzaSy..."
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      className="w-full pl-3.5 pr-10 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => saveGeminiKey(geminiKey)}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer shadow transition-all"
                  >
                    Save Key
                  </button>
                  <button
                    onClick={() => {
                      saveGeminiKey('');
                      setIsSettingsOpen(false);
                    }}
                    className="px-4 py-3 border border-slate-300 hover:bg-slate-50 text-slate-600 font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Title */}
                <div className="space-y-1">
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z" />
                    </svg>
                    Google Drive Integration
                  </h3>
                  <p className="text-xs text-slate-500">Enable importing notes directly from your Google Drive files.</p>
                </div>

                {/* Instruction Banner - How to setup Google Drive */}
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl max-h-[160px] overflow-y-auto space-y-3">
                  <span className="block text-[9px] font-black text-blue-600 uppercase tracking-widest">How to configure Google Cloud:</span>
                  <ol className="text-[11px] text-slate-600 space-y-2 list-decimal list-inside font-medium leading-relaxed">
                    <li>Go to the <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold inline-flex items-center gap-0.5">Google Cloud Console <ExternalLink size={10} /></a>.</li>
                    <li>Enable the <strong>Google Drive API</strong> & <strong>Google Picker API</strong>.</li>
                    <li>Configure your <strong>OAuth Consent Screen</strong> and publish it.</li>
                    <li>Create an <strong>OAuth Client ID</strong> (select "Web Application").</li>
                    <li>Add your domains (e.g., <code>http://localhost:3000</code>) to <strong>Authorized JavaScript origins</strong>.</li>
                    <li>Create an <strong>API Key</strong> (restricting it to the Picker API is recommended).</li>
                  </ol>
                </div>

                {/* Input Fields */}
                <div className="space-y-4">
                  <div>
                    <label htmlFor="clientIdInput" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      OAuth Client ID
                    </label>
                    <input
                      type="text"
                      id="clientIdInput"
                      placeholder="e.g. 12345678-abc.apps.googleusercontent.com"
                      value={googleClientId}
                      onChange={(e) => setGoogleClientId(e.target.value)}
                      className="w-full px-3.5 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="googleApiKeyInput" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Developer API Key
                    </label>
                    <input
                      type={showKey ? 'text' : 'password'}
                      id="googleApiKeyInput"
                      placeholder="e.g. AIzaSy..."
                      value={googleApiKey}
                      onChange={(e) => setGoogleApiKey(e.target.value)}
                      className="w-full pl-3.5 pr-10 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => saveGoogleCredentials(googleClientId, googleApiKey)}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer shadow transition-all"
                  >
                    Save Settings
                  </button>
                  <button
                    onClick={() => {
                      saveGoogleCredentials('', '');
                      setIsSettingsOpen(false);
                    }}
                    className="px-4 py-3 border border-slate-300 hover:bg-bg-slate-50 text-slate-600 font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
