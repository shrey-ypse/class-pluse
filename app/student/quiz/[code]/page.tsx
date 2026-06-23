'use client';

import { useState, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Check, X, Smile, AlertCircle, 
  HelpCircle, Send, CheckCircle2, Award, Lock, ArrowLeft
} from 'lucide-react';
import { Question } from '@/lib/types';

interface SessionState {
  status: 'lobby' | 'active' | 'completed';
  activeQuestionIndex: number;
  questions: Question[];
  isLocked?: boolean;
  student: {
    rollNumber: string;
    name: string;
    answers: { [qId: string]: number };
    exitTicket?: {
      confidence: 'very' | 'somewhat' | 'not';
      confusion: string;
    };
  };
}

export default function StudentQuizPage({ params }: { params: Promise<{ code: string }> }) {
  const router = useRouter();
  const { code } = use(params);
  const searchParams = useSearchParams();
  const rollNumber = searchParams.get('rollNumber');

  // Session details
  const [status, setStatus] = useState<'lobby' | 'active' | 'completed'>('lobby');
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(-1);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [studentAnswers, setStudentAnswers] = useState<{ [qId: string]: number }>({});
  const [hasExitTicket, setHasExitTicket] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  // Student specific inputs
  const [studentName, setStudentName] = useState('');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Exit Ticket states
  const [exitConfidence, setExitConfidence] = useState<'very' | 'somewhat' | 'not' | null>(null);
  const [exitConfusion, setExitConfusion] = useState('');
  const [exitSubmitted, setExitSubmitted] = useState(false);

  useEffect(() => {
    if (!code || !rollNumber) {
      setError('Missing session parameters.');
      return;
    }
    
    // Initial fetch
    pollSession();
    
    // Set polling interval
    const interval = setInterval(pollSession, 1500);
    return () => clearInterval(interval);
  }, [code, rollNumber]);

  const pollSession = async () => {
    try {
      const res = await fetch(`/api/session?code=${code}&rollNumber=${rollNumber}`);
      if (!res.ok) {
        if (res.status === 403) {
          setError('Student not authorized in this session. Join again.');
        }
        return;
      }
      
      const data: SessionState = await res.json();
      
      setStatus(data.status);
      setActiveQuestionIndex(data.activeQuestionIndex);
      setQuestions(data.questions || []);
      setStudentAnswers(data.student?.answers || {});
      setStudentName(data.student?.name || '');
      setIsLocked(data.isLocked || false);
      
      if (data.student?.exitTicket) {
        setHasExitTicket(true);
        setExitSubmitted(true);
      }
    } catch (err) {
      console.error('Error polling session:', err);
    }
  };

  // Submit Answer Action
  const submitAnswer = async () => {
    if (selectedOption === null || !currentQ || !rollNumber) return;
    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit-answer',
          code,
          rollNumber,
          questionId: currentQ.id,
          answerIndex: selectedOption
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Answer submission failed.');
      }
      
      // Update local answers state
      setStudentAnswers(prev => ({ ...prev, [currentQ.id]: selectedOption }));
      setSelectedOption(null); // Clear selection for next questions
    } catch (err: any) {
      setError(err.message || 'Error sending answer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Exit Ticket Action
  const handleExitTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exitConfidence || !rollNumber) return;
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit-exit-ticket',
          code,
          rollNumber,
          confidence: exitConfidence,
          confusion: exitConfusion
        })
      });

      if (res.ok) {
        setExitSubmitted(true);
        setHasExitTicket(true);
      } else {
        throw new Error('Failed to submit exit ticket.');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getScoreStats = () => {
    let correctCount = 0;
    let totalAnswered = 0;
    questions.forEach((q) => {
      const studentAnswer = studentAnswers[q.id];
      if (studentAnswer !== undefined) {
        totalAnswered++;
        // Check if the correct answer index matches the student's answer
        if (q.correctAnswerIndex !== undefined && q.correctAnswerIndex !== null && studentAnswer === q.correctAnswerIndex) {
          correctCount++;
        }
      }
    });
    return { correctCount, totalAnswered };
  };

  const { correctCount, totalAnswered } = getScoreStats();
  const accuracy = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

  let performanceBadge = 'Persistent Learner';
  let badgeEmoji = '📚';
  if (accuracy === 100) {
    performanceBadge = 'Query Master';
    badgeEmoji = '🏆';
  } else if (accuracy >= 70) {
    performanceBadge = 'Logic Wizard';
    badgeEmoji = '⚡';
  } else if (accuracy >= 40) {
    performanceBadge = 'Rising Scholar';
    badgeEmoji = '🌱';
  }

  const currentQ = questions[activeQuestionIndex];
  const hasAnsweredCurrent = currentQ ? studentAnswers[currentQ.id] !== undefined : false;
  const submittedAnswerIdx = currentQ ? studentAnswers[currentQ.id] : null;

  // Correct answer is returned in response only if teacher has revealed it
  const correctIdx = currentQ ? currentQ.correctAnswerIndex : undefined;
  const isAnswerRevealed = correctIdx !== undefined;

  return (
    <div className="flex-1 flex flex-col p-4 max-w-md mx-auto w-full justify-between min-h-screen bg-slate-50">
      
      {/* Top Header Card */}
      <header className="flex items-center gap-3 p-4 bg-white rounded-2xl border-2 border-slate-200 shadow-sm mb-4 shrink-0">
        <button
          onClick={() => {
            if (confirm('Are you sure you want to leave this quiz session? You can re-join later using the same roll number.')) {
              router.push('/student/join');
            }
          }}
          className="p-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl cursor-pointer transition-all flex items-center justify-center shrink-0 shadow-sm"
          title="Leave Room"
        >
          <ArrowLeft size={14} />
        </button>
        <div className="flex-grow">
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Joined Room</span>
          <span className="text-sm font-bold text-slate-800">Student #{rollNumber} ({studentName})</span>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-xs bg-slate-200 text-slate-700 px-2.5 py-1 rounded-full font-black border border-slate-300">
            Code: {code}
          </span>
          {totalAnswered > 0 && (
            <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
              Score: {correctCount}/{totalAnswered}
            </span>
          )}
        </div>
      </header>

      {/* Main Content Pane */}
      <main className="flex-grow flex flex-col justify-center my-4">
        {error && (
          <div className="p-4 bg-rose-50 border-2 border-rose-200 text-rose-800 rounded-2xl flex items-center gap-2.5 text-xs font-semibold mb-6">
            <AlertCircle size={18} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Dynamic Progress Bar for active questions */}
        {status === 'active' && questions.length > 0 && (
          <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden mb-6 border border-slate-300 shadow-inner">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${(activeQuestionIndex / questions.length) * 100}%` }}
            />
          </div>
        )}

        {/* LOBBY STATE */}
        {status === 'lobby' && (
          <div className="text-center py-10 space-y-4">
            <div className="w-16 h-16 bg-blue-50 border-2 border-blue-200 text-blue-600 rounded-full flex items-center justify-center mx-auto animate-soft-pulse">
              <Smile size={32} />
            </div>
            <h2 className="text-xl font-black text-slate-800">You're in the Lobby!</h2>
            <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
              Waiting for the lecturer to activate the quiz. Keep this tab open. Your phone will buzz as soon as the first question starts!
            </p>
          </div>
        )}

        {/* ACTIVE QUESTION STATE */}
        {status === 'active' && currentQ && (
          <div className="space-y-6">
            
            {/* Question Box */}
            <div className="student-card bg-white p-5 border-slate-200">
              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Question {activeQuestionIndex + 1} of {questions.length}
              </span>
              <h2 className="text-base font-bold text-slate-800 leading-snug">
                {currentQ.text}
              </h2>
            </div>

            {/* Answer Options */}
            {!hasAnsweredCurrent ? (
              /* Input Selector */
              <div className="space-y-3">
                
                {/* Lock banner if submissions frozen */}
                {isLocked && (
                  <div className="p-4 bg-red-50 border-2 border-red-200 text-red-800 rounded-2xl flex items-center gap-2.5 text-xs font-black mb-2 shadow-sm animate-pulse">
                    <Lock size={16} className="text-red-600 shrink-0" />
                    <span>Submissions locked by lecturer!</span>
                  </div>
                )}

                {currentQ.options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => !isLocked && setSelectedOption(idx)}
                    disabled={isLocked}
                    className={`student-card w-full p-4 text-left text-xs font-semibold flex items-center gap-3 transition-all ${
                      isLocked 
                        ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                        : selectedOption === idx
                          ? 'student-card-selected cursor-pointer'
                          : 'border-slate-200 bg-white text-slate-700 cursor-pointer hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                      isLocked
                        ? 'bg-slate-200 text-slate-400'
                        : selectedOption === idx 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-slate-200 text-slate-500'
                    }`}>
                      {String.fromCharCode(65 + idx)}
                    </div>
                    <span>{opt}</span>
                  </button>
                ))}

                {/* Submit button */}
                <button
                  onClick={submitAnswer}
                  disabled={selectedOption === null || isSubmitting || isLocked}
                  className="student-button w-full py-4 mt-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={14} />
                  <span>Submit Answer</span>
                </button>
              </div>
            ) : (
              /* Answered State (Waiting / Correctness display) */
              <div className="space-y-4">
                <div className="space-y-3">
                  {currentQ.options.map((opt, idx) => {
                    const isSelected = submittedAnswerIdx === idx;
                    const isCorrect = correctIdx === idx;
                    
                    let cardStyle = 'border-slate-200 bg-slate-50/70 text-slate-400';
                    if (isAnswerRevealed) {
                      if (isCorrect) {
                        cardStyle = 'border-emerald-400 bg-emerald-50 text-emerald-950 font-bold';
                      } else if (isSelected) {
                        cardStyle = 'border-rose-400 bg-rose-50 text-rose-950 font-bold';
                      }
                    } else if (isSelected) {
                      cardStyle = 'border-blue-400 bg-blue-50 text-blue-900 font-bold';
                    }

                    return (
                      <div
                        key={idx}
                        className={`student-card w-full p-4 text-left text-xs flex items-center gap-3 ${cardStyle}`}
                      >
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                          isAnswerRevealed && isCorrect 
                            ? 'bg-emerald-600 text-white' 
                            : isSelected 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-slate-200 text-slate-400'
                        }`}>
                          {String.fromCharCode(65 + idx)}
                        </div>
                        <span>{opt}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Outcome card */}
                {!isAnswerRevealed ? (
                  <div className="text-center py-4 bg-blue-50 border-2 border-blue-200 rounded-2xl text-xs text-blue-700 font-bold animate-soft-pulse shadow-sm">
                    Answer saved! Waiting for lecturer to reveal results...
                  </div>
                ) : (
                  <div className="space-y-4">
                    {submittedAnswerIdx === correctIdx ? (
                      <div className="p-4 bg-emerald-50 border-2 border-emerald-300 text-emerald-950 rounded-2xl flex items-start gap-3 text-xs leading-relaxed shadow-sm">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                          <Check size={18} className="stroke-[3]" />
                        </div>
                        <div>
                          <span className="block font-black text-emerald-800 text-sm mb-0.5">🎉 Correct Answer!</span>
                          Great job, you fully grasped this concept. Keep this momentum going!
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-amber-50 border-2 border-amber-300 text-amber-950 rounded-2xl flex items-start gap-3 text-xs leading-relaxed shadow-sm">
                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                          <HelpCircle size={18} className="stroke-[3]" />
                        </div>
                        <div>
                          <span className="block font-black text-amber-800 text-sm mb-0.5">💡 Nice Attempt!</span>
                          Every mistake is a step toward learning. Review the professor's explanation below to master this concept.
                        </div>
                      </div>
                    )}

                    {currentQ.explanation && (
                      <div className="bg-slate-100 border border-slate-300 p-4 rounded-2xl text-xs text-slate-600">
                        <strong className="text-slate-800 font-bold block mb-1">Professor's Explanation:</strong>
                        <p className="leading-relaxed">{currentQ.explanation}</p>
                      </div>
                    )}

                    {/* Waiting on Teacher indicator */}
                    <div className="text-center py-3 bg-slate-100 border border-slate-200 rounded-2xl text-xs text-slate-500 font-bold animate-soft-pulse">
                      Waiting for lecturer to start next question...
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* COMPLETED / EXIT TICKET FORM */}
        {status === 'completed' && (
          <div className="space-y-6">
            {!exitSubmitted ? (
              <div className="student-card bg-white p-5 border-slate-200">
                <h2 className="text-lg font-black text-slate-800 mb-2">Lecture Complete!</h2>
                <p className="text-xs text-slate-400 mb-6">Take 15 seconds to submit your Exit Ticket so the professor can pivot next class.</p>

                <form onSubmit={handleExitTicketSubmit} className="space-y-6">
                  {/* Question 1: Confidence */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                      How confident are you about today's lesson?
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'very', emoji: '😃', text: 'Confident' },
                        { value: 'somewhat', emoji: '🙂', text: 'Somewhat' },
                        { value: 'not', emoji: '😕', text: 'Struggling' }
                      ].map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setExitConfidence(item.value as any)}
                          className={`student-card p-3 rounded-xl border text-center flex flex-col items-center justify-center gap-1 cursor-pointer ${
                            exitConfidence === item.value
                              ? 'student-card-selected'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          <span className="text-2xl">{item.emoji}</span>
                          <span className="text-[10px] font-bold">{item.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Question 2: Confusion */}
                  <div>
                    <label htmlFor="confusion" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Which topic confused you most? (Optional)
                    </label>
                    <input
                      type="text"
                      id="confusion"
                      placeholder="e.g. BCNF anomalies"
                      value={exitConfusion}
                      onChange={(e) => setExitConfusion(e.target.value)}
                      className="w-full px-3 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                    />
                  </div>

                  {/* Submit Exit Ticket */}
                  <button
                    type="submit"
                    disabled={!exitConfidence || isSubmitting}
                    className="student-button w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <span>Submit Exit Ticket</span>
                  </button>
                </form>
              </div>
            ) : (
              /* Final Thank You & Performance Badge Display */
              <div className="student-card bg-white p-6 border-slate-200 text-center space-y-6">
                <div className="w-16 h-16 bg-emerald-50 border-2 border-emerald-200 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 size={32} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800">Exit Ticket Submitted!</h2>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                    Your feedback has been shared anonymously with your lecturer to help shape the next class.
                  </p>
                </div>

                {/* Score Stats & Badge Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-500 border-b border-slate-200 pb-3">
                    <span>QUIZ ACCURACY</span>
                    <span className="text-slate-800">{accuracy}%</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 py-2 border-b border-slate-200 pb-3">
                    <div>
                      <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Correct</span>
                      <span className="text-lg font-black text-emerald-600">{correctCount}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Total Questions</span>
                      <span className="text-lg font-black text-slate-800">{questions.length}</span>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col items-center">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Earned Badge</span>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-xs font-black">
                      <span>{badgeEmoji}</span>
                      <span>{performanceBadge}</span>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 font-bold">
                  You are cleared to exit this session. Have a great day!
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer Branding */}
      <footer className="text-center text-[9px] text-slate-400 font-bold uppercase tracking-wider pt-6 shrink-0">
        ClassPulse • Active Student Console
      </footer>
    </div>
  );
}
