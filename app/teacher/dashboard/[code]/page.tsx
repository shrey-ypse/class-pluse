'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, BarChart2, Play, Award, 
  HelpCircle, Download, CheckCircle, ArrowRight, Home, ShieldAlert,
  Clock, Lock, Unlock, Eye, EyeOff, LayoutGrid, Monitor
} from 'lucide-react';
import { Question } from '@/lib/types';

interface Student {
  rollNumber: string;
  name: string;
  answers: { [qId: string]: number };
  exitTicket?: {
    confidence: 'very' | 'somewhat' | 'not';
    confusion: string;
  };
}

export default function TeacherDashboard({ params }: { params: Promise<{ code: string }> }) {
  const router = useRouter();
  const { code } = use(params);

  // Live state
  const [status, setStatus] = useState<'lobby' | 'active' | 'completed'>('lobby');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(-1);
  const [students, setStudents] = useState<Student[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [activeQuestionResponses, setActiveQuestionResponses] = useState(0);
  const [questionDistribution, setQuestionDistribution] = useState<{ [qId: string]: number[] }>({});
  const [pivotPrompts, setPivotPrompts] = useState<{ [qId: string]: string }>({});

  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  
  // Custom states added for enhancements
  const [themeMode, setThemeMode] = useState<'console' | 'projector'>('console');
  const [isLocked, setIsLocked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [showRealNames, setShowRealNames] = useState(false);
  const [leaderboardMode, setLeaderboardMode] = useState<'class' | 'competitive' | 'cooperative'>('class');

  // Timer States
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);

  // Polling hook with smart intervals based on status
  useEffect(() => {
    fetchSession(); // Initial load

    // Setup active session code in localStorage
    localStorage.setItem('classpulse_active_session_code', code);

    // Adaptive polling: 1.2s if active (response phase), else 3s (lobby/completed)
    let intervalTime = 1200;
    if (status === 'lobby' || status === 'completed') {
      intervalTime = 3000;
    }

    const interval = setInterval(fetchSession, intervalTime);
    return () => clearInterval(interval);
  }, [code, status]);

  // Reset revealed state and timer when active question changes
  useEffect(() => {
    setRevealed(false);
    setTimerSeconds(0);
    setIsTimerActive(false);
  }, [activeQuestionIndex]);

  // Countdown timer clock effect
  useEffect(() => {
    let clock: any = null;
    if (isTimerActive && timerSeconds > 0) {
      clock = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            setIsTimerActive(false);
            lockSubmissions(); // Auto-lock when timer hits 0
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setIsTimerActive(false);
    }
    return () => clearInterval(clock);
  }, [isTimerActive, timerSeconds]);

  const fetchSession = async () => {
    try {
      const res = await fetch(`/api/session?code=${code}`);
      if (!res.ok) return;
      const data = await res.json();
      
      setStatus(data.status);
      setQuestions(data.questions || []);
      setActiveQuestionIndex(data.activeQuestionIndex);
      setStudents(data.students || []);
      setTotalStudents(data.totalStudents || 0);
      setActiveQuestionResponses(data.activeQuestionResponses || 0);
      setQuestionDistribution(data.questionDistribution || {});
      setPivotPrompts(data.pivotPrompts || {});
      setSubject(data.subject || '');
      setTopic(data.topic || '');
      setIsLocked(data.isLocked || false);

      // Save details for local recovery
      if (data.subject && data.topic) {
        localStorage.setItem(
          'classpulse_active_session_details', 
          JSON.stringify({ subject: data.subject, unit: data.unit || '', topic: data.topic })
        );
      }
    } catch (err) {
      console.error('Error polling session details:', err);
    }
  };

  const startQuiz = async () => {
    try {
      await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', code })
      });
      setStatus('active');
      setActiveQuestionIndex(0);
    } catch (err) {
      console.error(err);
    }
  };

  const nextQuestion = async () => {
    try {
      await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'next', code })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const toggleLock = async () => {
    try {
      const action = isLocked ? 'unlock' : 'lock';
      await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, code })
      });
      setIsLocked(!isLocked);
    } catch (err) {
      console.error(err);
    }
  };

  const lockSubmissions = async () => {
    try {
      await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lock', code })
      });
      setIsLocked(true);
    } catch (err) {
      console.error(err);
    }
  };

  const startPresetTimer = (sec: number) => {
    setTimerSeconds(sec);
    setIsTimerActive(true);
    // Auto-unlock when starting a timer to let student submit answers
    if (isLocked) {
      toggleLock();
    }
  };

  // Detailed CSV Gradebook Exporter with answer matrices
  const exportCSV = () => {
    if (students.length === 0) return;
    
    let csvContent = 'data:text/csv;charset=utf-8,';
    
    // Header Row
    let headers = 'Roll No,Name,Joined,';
    questions.forEach((q, idx) => {
      headers += `Q${idx + 1} Selected,Q${idx + 1} Correct?,`;
    });
    headers += 'Overall Accuracy (%),Exit Confidence,Exit Confusion\r\n';
    csvContent += headers;

    students.forEach((s) => {
      let row = `"${s.rollNumber}","${s.name}","Yes",`;
      let correctAnswersCount = 0;
      
      questions.forEach((q) => {
        const selectedIdx = s.answers[q.id];
        if (selectedIdx === undefined || selectedIdx === null) {
          row += '"None","No",';
        } else {
          const optionLetter = String.fromCharCode(65 + selectedIdx);
          const isCorrect = selectedIdx === q.correctAnswerIndex;
          if (isCorrect) correctAnswersCount++;
          row += `"${optionLetter}","${isCorrect ? 'Yes' : 'No'}",`;
        }
      });
      
      const accuracy = questions.length > 0 ? Math.round((correctAnswersCount / questions.length) * 100) : 0;
      const confidence = s.exitTicket?.confidence || 'N/A';
      const confusion = s.exitTicket?.confusion ? s.exitTicket.confusion.replace(/"/g, '""') : '';

      row += `${accuracy}%,"${confidence}","${confusion}"\r\n`;
      csvContent += row;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `classpulse_gradebook_${code}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearSessionStorageData = () => {
    localStorage.removeItem('classpulse_active_session_code');
    localStorage.removeItem('classpulse_active_session_details');
    router.push('/teacher');
  };

  // Exit Ticket Metrics
  const getExitTicketStats = () => {
    let very = 0, somewhat = 0, not = 0;
    const confusions: string[] = [];

    students.forEach((s) => {
      if (s.exitTicket) {
        if (s.exitTicket.confidence === 'very') very++;
        else if (s.exitTicket.confidence === 'somewhat') somewhat++;
        else if (s.exitTicket.confidence === 'not') not++;
        
        if (s.exitTicket.confusion.trim()) {
          confusions.push(s.exitTicket.confusion);
        }
      }
    });

    return { very, somewhat, not, confusions };
  };

  const { very, somewhat, not, confusions } = getExitTicketStats();
  const currentQ = questions[activeQuestionIndex];

  const getLeaderboardData = () => {
    return [...students]
      .map((s) => {
        let correctCount = 0;
        questions.forEach((q) => {
          if (s.answers[q.id] === q.correctAnswerIndex) {
            correctCount++;
          }
        });
        const accuracyVal = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
        return {
          rollNumber: s.rollNumber,
          name: s.name,
          accuracy: accuracyVal,
        };
      })
      .sort((a, b) => b.accuracy - a.accuracy);
  };

  const getClassAverage = () => {
    if (students.length === 0) return 0;
    let totalAccuracy = 0;
    students.forEach((s) => {
      let correctCount = 0;
      questions.forEach((q) => {
        if (s.answers[q.id] === q.correctAnswerIndex) {
          correctCount++;
        }
      });
      totalAccuracy += questions.length > 0 ? (correctCount / questions.length) * 100 : 0;
    });
    return Math.round(totalAccuracy / students.length);
  };

  const podium = getLeaderboardData();
  const classAverage = getClassAverage();
  const aiThreshold = subject.toLowerCase().includes('database') || topic.toLowerCase().includes('2nf') ? 70 : 60;

  // Custom text for display that respects themeMode (Projector View forces Roll numbers for safety)
  const getStudentDisplay = (s: { name: string; rollNumber: string }) => {
    return themeMode === 'projector' ? `Student #${s.rollNumber}` : (showRealNames ? s.name : `Student #${s.rollNumber}`);
  };

  return (
    <div className={`flex-grow min-h-screen flex flex-col p-4 md:p-8 transition-colors duration-300 ${
      themeMode === 'console' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      
      {/* Top Meta info */}
      <header className={`flex flex-col md:flex-row md:justify-between md:items-center border-b pb-4 mb-6 gap-4 ${
        themeMode === 'console' ? 'border-slate-800' : 'border-slate-200'
      }`}>
        <div>
          <span className="text-xs font-bold text-blue-500 uppercase tracking-widest">{subject}</span>
          <h1 className="text-2xl font-black tracking-tight">{topic}</h1>
        </div>
        
        {/* Header Control Widgets */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Theme Selector Toggle */}
          <div className={`flex rounded-lg p-1 border text-xs font-bold ${
            themeMode === 'console' ? 'bg-slate-900 border-slate-800' : 'bg-slate-200 border-slate-300'
          }`}>
            <button
              onClick={() => setThemeMode('console')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                themeMode === 'console' 
                  ? 'bg-blue-600 text-white shadow' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Monitor size={14} />
              <span>Console View</span>
            </button>
            <button
              onClick={() => setThemeMode('projector')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                themeMode === 'projector' 
                  ? 'bg-blue-600 text-white shadow' 
                  : 'text-slate-500 hover:text-slate-400'
              }`}
            >
              <LayoutGrid size={14} />
              <span>Projector Mode</span>
            </button>
          </div>

          <div className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold ${
            themeMode === 'console' ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-300'
          }`}>
            <Users size={14} className="text-blue-500" />
            <span>{totalStudents} joined</span>
          </div>

          <span className={`text-xs border px-3 py-1.5 rounded-lg font-black tracking-wide ${
            themeMode === 'console' ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-slate-200 border-slate-300 text-slate-700'
          }`}>
            CODE: {code}
          </span>
        </div>
      </header>

      {/* LOBBY VIEW */}
      {status === 'lobby' && (
        <div className="flex-grow flex flex-col justify-center items-center py-10 max-w-4xl mx-auto w-full">
          <div className="text-center mb-8">
            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Projector Mode Join Instructions</span>
            <div className="text-6xl md:text-8xl font-black text-blue-600 tracking-wider my-4 select-all drop-shadow-sm">
              {code}
            </div>
            <p className="text-base font-semibold">
              Open <strong className="text-blue-600">/student/join</strong> on your phone and enter this room code.
            </p>
          </div>

          <div className={`w-full border rounded-2xl p-6 shadow ${
            themeMode === 'console' ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div className="flex justify-between items-center mb-4 border-b pb-3 border-slate-800">
              <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <Users size={16} className="text-slate-400" />
                Joined Students ({totalStudents})
              </h3>
              
              {/* Only show/hide names selector in teacher dashboard mode */}
              {themeMode === 'console' && (
                <button
                  onClick={() => setShowRealNames(!showRealNames)}
                  className="text-xs font-bold text-blue-500 hover:text-blue-400 flex items-center gap-1 cursor-pointer"
                >
                  {showRealNames ? <EyeOff size={14} /> : <Eye size={14} />}
                  <span>{showRealNames ? 'Hide Real Names (Safe Projection)' : 'Show Real Names (Teacher View)'}</span>
                </button>
              )}
            </div>

            {/* Students Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-72 overflow-y-auto p-1">
              {students.map((s, idx) => (
                <div
                  key={idx}
                  className={`px-3 py-2 border rounded-xl text-center text-xs font-bold transition-all ${
                    themeMode === 'console'
                      ? 'bg-slate-900 border-slate-800 text-slate-300'
                      : 'bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  {getStudentDisplay(s)}
                </div>
              ))}
              {students.length === 0 && (
                <div className="col-span-full py-10 text-center text-xs text-slate-400 italic">
                  Waiting for students to connect...
                </div>
              )}
            </div>

            <button
              onClick={startQuiz}
              disabled={totalStudents === 0}
              className="w-full mt-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-sm uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 disabled:from-blue-400 disabled:to-indigo-400 disabled:cursor-not-allowed cursor-pointer transition-all"
            >
              <Play size={18} />
              <span>Start Quiz Session</span>
            </button>
          </div>
        </div>
      )}

      {/* ACTIVE QUESTION VIEW */}
      {status === 'active' && currentQ && (
        <div className="grid md:grid-cols-3 gap-6 flex-grow max-w-6xl mx-auto w-full">
          
          {/* Question Presentation Panel */}
          <div className="md:col-span-2 space-y-6">
            <div className={`border rounded-2xl p-6 md:p-8 shadow transition-all ${
              themeMode === 'console' ? 'bg-slate-900/30 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Question {activeQuestionIndex + 1} of {questions.length}
                </span>
                
                {/* Locked Status Badge */}
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                  isLocked
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {isLocked ? <Lock size={10} /> : <Unlock size={10} />}
                  <span>{isLocked ? 'Locked' : 'Open for responses'}</span>
                </span>
              </div>

              <h2 className={`font-black leading-snug mb-8 tracking-tight ${
                themeMode === 'projector' ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl'
              }`}>
                {currentQ.text}
              </h2>

              {/* Options Grid (with Animated SVG growth bar) */}
              <div className="space-y-4">
                {currentQ.options.map((opt, idx) => {
                  const answersCount = (questionDistribution[currentQ.id] || [])[idx] || 0;
                  const percent = activeQuestionResponses > 0 ? Math.round((answersCount / activeQuestionResponses) * 100) : 0;
                  const isCorrect = currentQ.correctAnswerIndex === idx;

                  let optionCardStyle = '';
                  if (themeMode === 'console') {
                    optionCardStyle = revealed
                      ? isCorrect
                        ? 'border-emerald-500 bg-emerald-950/40 text-emerald-200 font-bold'
                        : 'border-slate-800 bg-slate-900/30 text-slate-500'
                      : 'border-slate-800 bg-slate-900 hover:border-slate-700 text-slate-200';
                  } else {
                    optionCardStyle = revealed
                      ? isCorrect
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold'
                        : 'border-slate-200 bg-slate-50 text-slate-400'
                      : 'border-slate-300 bg-white hover:border-slate-400 text-slate-800';
                  }

                  return (
                    <div
                      key={idx}
                      className={`relative border rounded-xl p-4 transition-all duration-300 flex justify-between items-center overflow-hidden ${optionCardStyle}`}
                    >
                      {/* Percent Fill bar */}
                      <div
                        className={`absolute top-0 left-0 bottom-0 transition-all duration-700 ease-out opacity-15 ${
                          revealed && isCorrect ? 'bg-emerald-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      />

                      <div className="z-10 flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                          revealed && isCorrect 
                            ? 'bg-emerald-600 text-white' 
                            : themeMode === 'console' ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {String.fromCharCode(65 + idx)}
                        </div>
                        <span className="font-semibold">{opt}</span>
                      </div>

                      {/* Vote Count indicator */}
                      <span className="z-10 text-xs font-black shrink-0">
                        {answersCount} ({percent}%)
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Reveal Actions */}
              <div className="flex gap-4 mt-6 pt-6 border-t border-slate-800">
                {!revealed ? (
                  <button
                    onClick={() => setRevealed(true)}
                    className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all cursor-pointer text-center text-xs uppercase tracking-wider shadow"
                  >
                    Reveal Correct Answer
                  </button>
                ) : (
                  <button
                    onClick={nextQuestion}
                    className="flex-grow py-3.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer text-xs uppercase tracking-wider border border-slate-700 shadow"
                  >
                    <span>
                      {activeQuestionIndex === questions.length - 1 ? 'End Quiz & View exit tickets' : 'Next Question'}
                    </span>
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Live Student Submission Tracker Grid */}
            <div className={`border rounded-2xl p-6 shadow ${
              themeMode === 'console' ? 'bg-slate-900/30 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex justify-between items-center">
                <span>Live Student Responders Tracker</span>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[9px] font-black">Sync</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5 max-h-48 overflow-y-auto p-1">
                {students.map((s, idx) => {
                  const hasAnswered = s.answers[currentQ.id] !== undefined;
                  return (
                    <div
                      key={idx}
                      className={`px-2 py-1.5 border rounded-lg text-center text-[10px] font-bold transition-all ${
                        hasAnswered
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : themeMode === 'console' ? 'border-slate-800 bg-slate-900/50 text-slate-600 animate-pulse' : 'border-slate-200 bg-slate-50 text-slate-400 animate-pulse'
                      }`}
                    >
                      {hasAnswered ? '✔ ' : '... '}
                      {getStudentDisplay(s)}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Sidebar: Countdown timer, Pivot prompts & settings */}
          <div className="space-y-6">
            
            {/* Interactive Timer & Lock Control Widget */}
            <div className={`border rounded-2xl p-6 shadow ${
              themeMode === 'console' ? 'bg-slate-900/30 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex justify-between items-center">
                <span>Pacing & Controls</span>
                <Clock size={14} className="text-slate-500" />
              </h3>

              {/* Timer UI Display */}
              <div className="flex flex-col items-center py-4 bg-slate-50 rounded-xl border border-slate-200 dark:bg-slate-950 dark:border-slate-800 relative overflow-hidden">
                <div className={`text-4xl font-black tracking-widest transition-all ${
                  timerSeconds > 0 && timerSeconds <= 5 ? 'text-red-500 scale-110 animate-bounce' : themeMode === 'console' ? 'text-slate-200' : 'text-slate-800'
                }`}>
                  {timerSeconds}s
                </div>
                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">
                  {isTimerActive ? '🕒 Time Ticking Down' : 'Timer Idle'}
                </div>

                {/* Simulated red ticker overlay under 5 seconds */}
                {timerSeconds > 0 && timerSeconds <= 5 && (
                  <div className="absolute inset-0 bg-red-500/10 border-2 border-red-500 pointer-events-none animate-pulse" />
                )}
              </div>

              {/* Preset buttons */}
              <div className="grid grid-cols-3 gap-2 mt-4">
                {[15, 30, 60].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => startPresetTimer(sec)}
                    className={`py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      themeMode === 'console'
                        ? 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    +{sec}s
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                <button
                  onClick={toggleLock}
                  className={`py-2 px-3 text-xs font-bold rounded-lg border flex items-center justify-center gap-1.5 cursor-pointer shadow-sm ${
                    isLocked
                      ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  {isLocked ? <Unlock size={12} /> : <Lock size={12} />}
                  <span>{isLocked ? 'Unlock Answers' : 'Lock Answers'}</span>
                </button>
                <button
                  onClick={() => setIsTimerActive(!isTimerActive)}
                  disabled={timerSeconds === 0}
                  className={`py-2 px-3 text-xs font-black rounded-lg border cursor-pointer ${
                    isTimerActive
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-blue-600 hover:bg-blue-700 text-white border-transparent'
                  } disabled:opacity-50`}
                >
                  {isTimerActive ? 'Pause Clock' : 'Start Clock'}
                </button>
              </div>

              <div className="text-center mt-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Responses: {activeQuestionResponses} / {totalStudents}
              </div>
            </div>

            {/* Pivot Prompt Area (HIDDEN IN PROJECTOR MODE FOR TEACHER VIEW PRIVACY) */}
            {revealed && themeMode === 'console' && (
              <div className="border border-amber-200 bg-amber-50/70 p-6 rounded-2xl space-y-3 shadow-sm animate-slide-in">
                <h4 className="text-xs font-black text-amber-800 uppercase tracking-widest flex items-center gap-1.5">
                  <ShieldAlert size={16} className="text-amber-600" />
                  Pedagogical Pivot Advice
                </h4>
                <p className="text-xs font-semibold text-amber-950 leading-relaxed italic">
                  "{pivotPrompts[currentQ.id] || 'Analyzing student incorrect answer patterns to construct advice...'}"
                </p>
              </div>
            )}

            {/* Leaderboard Settings */}
            <div className={`border rounded-2xl p-6 space-y-4 shadow ${
              themeMode === 'console' ? 'bg-slate-900/30 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b pb-2 border-slate-800">
                Classroom gamification
              </h4>
              <div className="space-y-2">
                {[
                  { id: 'class', label: 'Default: Class Mastery Only' },
                  { id: 'cooperative', label: 'Cooperative (Class vs. AI)' },
                  { id: 'competitive', label: 'Competitive (3D Podium)' }
                ].map((mode) => (
                  <label key={mode.id} className="flex items-center gap-2.5 text-xs font-bold cursor-pointer">
                    <input
                      type="radio"
                      name="leaderboardMode"
                      value={mode.id}
                      checked={leaderboardMode === mode.id}
                      onChange={() => setLeaderboardMode(mode.id as any)}
                      className="text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>{mode.label}</span>
                  </label>
                ))}
              </div>

              {leaderboardMode === 'class' && (
                <div className="pt-2">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Class Mastery Meter</span>
                  <div className={`w-full h-3 rounded-full overflow-hidden border ${
                    themeMode === 'console' ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
                  }`}>
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.round((activeQuestionResponses / (totalStudents || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* 3D Gold/Silver/Bronze Podium */}
              {leaderboardMode === 'competitive' && (
                <div className="pt-2 space-y-2">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Classroom Podium (Top 3)</span>
                  
                  {podium.length === 0 ? (
                    <div className="text-center py-4 text-[10px] text-slate-400 italic">No answers submitted yet.</div>
                  ) : (
                    <div className="flex items-end justify-center gap-2 pt-6 pb-2 h-44">
                      {/* 2nd Place */}
                      {podium[1] && (
                        <div className="flex flex-col items-center w-16">
                          <span className="text-[8px] font-bold text-slate-400 truncate w-full text-center">
                            {getStudentDisplay(podium[1])}
                          </span>
                          <span className="text-[10px] font-black text-slate-500 mb-0.5">{podium[1].accuracy}%</span>
                          <div className={`w-full border-t border-slate-400 rounded-t h-16 flex flex-col justify-end items-center pb-1 ${
                            themeMode === 'console' ? 'bg-slate-800' : 'bg-slate-200'
                          }`}>
                            <span className="text-base font-black text-slate-500">2</span>
                          </div>
                        </div>
                      )}

                      {/* 1st Place */}
                      {podium[0] && (
                        <div className="flex flex-col items-center w-20">
                          <span className="text-[9px] font-black text-amber-500 truncate w-full text-center">
                            👑 {getStudentDisplay(podium[0])}
                          </span>
                          <span className="text-xs font-black text-amber-500 mb-0.5">{podium[0].accuracy}%</span>
                          <div className={`w-full border-t-2 border-amber-300 rounded-t h-24 flex flex-col justify-end items-center pb-2 shadow-sm ${
                            themeMode === 'console' ? 'bg-amber-950/20' : 'bg-amber-100'
                          }`}>
                            <span className="text-2xl font-black text-amber-500">1</span>
                          </div>
                        </div>
                      )}

                      {/* 3rd Place */}
                      {podium[2] && (
                        <div className="flex flex-col items-center w-14">
                          <span className="text-[8px] font-bold text-amber-800 truncate w-full text-center">
                            {getStudentDisplay(podium[2])}
                          </span>
                          <span className="text-[10px] font-black text-amber-700 mb-0.5">{podium[2].accuracy}%</span>
                          <div className={`w-full border-t border-amber-600 rounded-t h-10 flex flex-col justify-end items-center ${
                            themeMode === 'console' ? 'bg-amber-900/10' : 'bg-amber-50'
                          }`}>
                            <span className="text-xs font-black text-amber-600">3</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Gamified AI Boss Healthbar */}
              {leaderboardMode === 'cooperative' && (
                <div className="pt-2 space-y-3">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Class vs. AI Boss</span>
                  
                  <div className={`flex items-center gap-2 p-2 rounded-lg border text-[10px] ${
                    themeMode === 'console' ? 'bg-red-950/20 border-red-900/40 text-red-300' : 'bg-red-50 border-red-100 text-red-700'
                  }`}>
                    <span>👾</span>
                    <p className="font-semibold leading-relaxed">
                      AI Boss Threshold is set at {aiThreshold}%. Beat it to win!
                    </p>
                  </div>

                  {/* Boss Health (Inverse of class accuracy) */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[9px] font-bold text-red-500 uppercase">
                      <span>👾 AI Boss Health</span>
                      <span>{100 - classAverage}%</span>
                    </div>
                    <div className={`w-full h-3 rounded-full overflow-hidden border ${
                      themeMode === 'console' ? 'bg-slate-950 border-slate-800 shadow-inner' : 'bg-slate-100 border-slate-200'
                    }`}>
                      <div
                        className="bg-red-600 h-full rounded-full transition-all duration-700"
                        style={{ width: `${100 - classAverage}%` }}
                      />
                    </div>
                  </div>

                  {/* Class Shield */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[9px] font-bold text-emerald-500 uppercase">
                      <span>🛡 Class Level</span>
                      <span>{classAverage}%</span>
                    </div>
                    <div className={`w-full h-3 rounded-full overflow-hidden border ${
                      themeMode === 'console' ? 'bg-slate-950 border-slate-800 shadow-inner' : 'bg-slate-100 border-slate-200'
                    }`}>
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-700"
                        style={{ width: `${classAverage}%` }}
                      />
                    </div>
                  </div>

                  <div className={`text-center py-1.5 border rounded text-[9px] font-black uppercase tracking-wider ${
                    classAverage >= aiThreshold ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5' : 'text-red-500 border-red-500/20 bg-red-500/5'
                  }`}>
                    {classAverage >= aiThreshold ? '🎉 Class is leading!' : '⚡ AI Boss is winning!'}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* COMPLETED VIEW / EXIT TICKET SUMMARY */}
      {status === 'completed' && (
        <div className="space-y-6 max-w-5xl mx-auto w-full">
          <div className="grid md:grid-cols-3 gap-6">
            
            {/* Left: Session stats & CSV download */}
            <div className={`border rounded-2xl p-6 flex flex-col justify-between shadow ${
              themeMode === 'console' ? 'bg-slate-900/30 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div>
                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full px-2.5 py-0.5 text-xs font-bold mb-4">
                  <CheckCircle size={12} /> Session Complete
                </span>
                <h2 className="text-xl font-bold mb-2">Quiz Summary</h2>
                <p className="text-slate-500 text-xs leading-relaxed mb-6">
                  Classroom metrics are compiled. You can export the student participation logs as a spreadsheet for your grading journal.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={exportCSV}
                  disabled={students.length === 0}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Download size={16} />
                  <span>Export Gradebook (CSV)</span>
                </button>
                <button
                  onClick={clearSessionStorageData}
                  className={`w-full py-3 border hover:bg-slate-50 hover:text-slate-800 font-bold rounded-lg flex items-center justify-center gap-2 cursor-pointer bg-transparent transition-all ${
                    themeMode === 'console' ? 'border-slate-800 text-slate-300' : 'border-slate-300 text-slate-600'
                  }`}
                >
                  <Home size={16} />
                  <span>Back to Home</span>
                </button>
              </div>
            </div>

            {/* Middle: Exit Ticket Confidence Grid */}
            <div className={`border rounded-2xl p-6 col-span-2 shadow ${
              themeMode === 'console' ? 'bg-slate-900/30 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <h3 className="text-sm font-bold uppercase tracking-wider mb-6 pb-2 border-b border-slate-800">
                Exit Ticket: Confidence Levels
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center mb-6">
                <div className="p-4 bg-emerald-50/5 border border-emerald-500/20 rounded-xl">
                  <div className="text-3xl font-black text-emerald-500">{very}</div>
                  <div className="text-[9px] font-bold text-emerald-500 uppercase mt-1">😃 Very Confident</div>
                </div>
                <div className="p-4 bg-amber-50/5 border border-amber-500/20 rounded-xl">
                  <div className="text-3xl font-black text-amber-500">{somewhat}</div>
                  <div className="text-[9px] font-bold text-amber-500 uppercase mt-1">🙂 Somewhat</div>
                </div>
                <div className="p-4 bg-red-50/5 border border-red-500/20 rounded-xl">
                  <div className="text-3xl font-black text-red-500">{not}</div>
                  <div className="text-[9px] font-bold text-red-500 uppercase mt-1">😕 Struggling</div>
                </div>
              </div>

              {/* Confusion Topics Scroll area */}
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                Reported Areas of Confusion
              </h4>
              <div className={`max-h-48 overflow-y-auto space-y-2 p-3 rounded-lg border ${
                themeMode === 'console' ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                {confusions.map((text, idx) => (
                  <div key={idx} className={`p-3 border rounded-xl text-xs font-semibold leading-relaxed ${
                    themeMode === 'console' ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
                  }`}>
                    "{text}"
                  </div>
                ))}
                {confusions.length === 0 && (
                  <div className="text-center py-6 text-xs text-slate-500 italic">
                    No student confusion comments reported.
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
