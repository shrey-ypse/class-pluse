'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Play, Edit2, Trash2, RefreshCw, Check, 
  X, CheckCircle, AlertCircle, ArrowLeft, Info
} from 'lucide-react';
import { Question } from '@/lib/types';

function ReviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get('code');

  const [questions, setQuestions] = useState<Question[]>([]);
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Question | null>(null);
  const [regeneratingIds, setRegeneratingIds] = useState<string[]>([]);

  useEffect(() => {
    if (!code) {
      setError('Missing session code.');
      setLoading(false);
      return;
    }
    fetchSession();
  }, [code]);

  const fetchSession = async () => {
    try {
      const res = await fetch(`/api/session?code=${code}`);
      if (!res.ok) throw new Error('Could not retrieve session info.');
      const data = await res.json();
      setQuestions(data.questions || []);
      setSubject(data.subject || '');
      setTopic(data.topic || '');
    } catch (err: any) {
      setError(err.message || 'Error loading quiz.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (q: Question) => {
    setEditingId(q.id);
    setEditForm({ ...q });
  };

  const handleSaveEdit = async () => {
    if (!editForm || !code) return;
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit-question',
          code,
          questionId: editForm.id,
          updatedQuestion: editForm
        })
      });
      if (res.ok) {
        setQuestions(questions.map(q => q.id === editForm.id ? editForm : q));
        setEditingId(null);
        setEditForm(null);
      } else {
        throw new Error('Could not save edits.');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (questionId: string) => {
    if (!code) return;
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete-question',
          code,
          questionId
        })
      });
      if (res.ok) {
        setQuestions(questions.filter(q => q.id !== questionId));
      } else {
        throw new Error('Failed to delete question.');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRegenerate = async (questionId: string) => {
    if (!code) return;
    setRegeneratingIds(prev => [...prev, questionId]);
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'regenerate-question',
          code,
          questionId
        })
      });
      if (!res.ok) throw new Error('Failed to regenerate.');
      const data = await res.json();
      if (data.success && data.newQuestion) {
        setQuestions(questions.map(q => q.id === questionId ? data.newQuestion : q));
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRegeneratingIds(prev => prev.filter(id => id !== questionId));
    }
  };

  const handleLaunch = async () => {
    if (!code) return;
    if (questions.length === 0) {
      alert('You must have at least one question to launch the session.');
      return;
    }
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          code
        })
      });
      if (res.ok) {
        router.push(`/teacher/dashboard/${code}`);
      } else {
        throw new Error('Failed to start session.');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center p-8 bg-slate-50">
        <svg className="animate-spin h-10 w-10 text-blue-600 mb-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-sm font-semibold text-slate-600">Retrieving Generated Questions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center p-8 bg-slate-50 text-center">
        <AlertCircle size={48} className="text-rose-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-800 mb-2">Failed to load session</h2>
        <p className="text-slate-500 mb-6 max-w-sm">{error}</p>
        <button
          onClick={() => router.push('/teacher')}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 max-w-4xl mx-auto w-full">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b border-slate-200 mb-8 gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/teacher')}
            className="p-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl cursor-pointer transition-all flex items-center justify-center shrink-0 shadow-sm"
            title="Back to Teacher Setup"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Verify Generated Quiz
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Course: <strong className="text-slate-800 font-bold">{subject}</strong> • Topic: <span className="italic">"{topic}"</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => router.push('/teacher')}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 bg-white rounded-md text-sm font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleLaunch}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-bold shadow-sm transition-colors cursor-pointer"
          >
            <Play size={16} />
            <span>Launch Quiz (Code: {code})</span>
          </button>
        </div>
      </header>

      {/* Safety Alert */}
      <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg flex items-start gap-3 text-xs mb-8">
        <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <strong className="font-bold block mb-0.5">Safety Check: Protect Teacher Trust</strong>
          Review the questions below. If the AI generated an untaught concept, you can delete it, regenerate it, or edit the options directly before students join.
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-6">
        {questions.map((q, qIndex) => {
          const isEditing = editingId === q.id;
          const isRegenerating = regeneratingIds.includes(q.id);

          return (
            <div key={q.id} className="classroom-card bg-white p-6 relative overflow-hidden">
              {/* Question Index Badge */}
              <div className="absolute top-0 left-0 bg-slate-100 text-slate-500 font-black text-xs px-3 py-1.5 rounded-br-lg border-r border-b border-slate-200">
                Q{qIndex + 1}
              </div>

              {isEditing && editForm ? (
                /* Editing Layout */
                <div className="space-y-4 pt-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Question Text</label>
                    <textarea
                      rows={2}
                      value={editForm.text}
                      onChange={(e) => setEditForm({ ...editForm, text: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm focus:outline-none focus:border-blue-500 resize-none font-bold text-slate-800"
                    />
                  </div>

                  {/* Options */}
                  <div className="grid md:grid-cols-2 gap-3">
                    {editForm.options.map((opt, oIdx) => (
                      <div key={oIdx}>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Option {oIdx + 1}</label>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const newOptions = [...editForm.options];
                            newOptions[oIdx] = e.target.value;
                            setEditForm({ ...editForm, options: newOptions });
                          }}
                          className={`w-full px-3 py-2 border rounded text-xs focus:outline-none focus:border-blue-500 ${
                            editForm.correctAnswerIndex === oIdx 
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold' 
                              : 'border-slate-300 bg-white text-slate-700'
                          }`}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Correct Option & Explanation */}
                  <div className="grid md:grid-cols-3 gap-4 items-end">
                    <div className="md:col-span-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Correct Answer</label>
                      <select
                        value={editForm.correctAnswerIndex}
                        onChange={(e) => setEditForm({ ...editForm, correctAnswerIndex: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs focus:outline-none focus:border-blue-500"
                      >
                        {editForm.options.map((_, oIdx) => (
                          <option key={oIdx} value={oIdx}>Option {oIdx + 1}</option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Explanation</label>
                      <input
                        type="text"
                        value={editForm.explanation}
                        onChange={(e) => setEditForm({ ...editForm, explanation: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Save/Cancel Edit */}
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditForm(null);
                      }}
                      className="px-3 py-1.5 border border-slate-300 bg-white rounded text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      <X size={14} /> Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check size={14} /> Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                /* Static Display Layout */
                <div className="pt-6 space-y-4">
                  <h3 className="text-base font-bold text-slate-900 leading-snug">{q.text}</h3>

                  {/* Choices list */}
                  <div className="grid md:grid-cols-2 gap-3">
                    {q.options.map((opt, oIdx) => {
                      const isCorrect = q.correctAnswerIndex === oIdx;
                      return (
                        <div
                          key={oIdx}
                          className={`p-3 rounded-lg border text-sm flex items-start gap-2.5 ${
                            isCorrect
                              ? 'border-emerald-300 bg-emerald-50/70 text-emerald-950 font-medium'
                              : 'border-slate-200 bg-slate-50/50 text-slate-700'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${
                            isCorrect 
                              ? 'bg-emerald-600 text-white' 
                              : 'bg-slate-200 text-slate-500'
                          }`}>
                            {String.fromCharCode(65 + oIdx)}
                          </div>
                          <span>{opt}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation box */}
                  {q.explanation && (
                    <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-lg text-xs text-blue-900 flex items-start gap-2">
                      <CheckCircle size={15} className="text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-bold">Explanation:</strong> {q.explanation}
                      </div>
                    </div>
                  )}

                  {/* Toolbar Actions */}
                  <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                    <button
                      onClick={() => handleEditClick(q)}
                      disabled={isRegenerating}
                      className="px-3 py-1.5 border border-slate-300 bg-white rounded text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit2 size={13} /> Edit
                    </button>
                    <button
                      onClick={() => handleRegenerate(q.id)}
                      disabled={isRegenerating}
                      className="px-3 py-1.5 border border-slate-300 bg-white rounded text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw size={13} className={isRegenerating ? 'animate-spin' : ''} />
                      <span>{isRegenerating ? 'Swapping...' : 'Regenerate'}</span>
                    </button>
                    <button
                      onClick={() => handleDelete(q.id)}
                      disabled={isRegenerating}
                      className="px-3 py-1.5 border border-rose-200 bg-rose-50 text-rose-700 rounded text-xs font-semibold hover:bg-rose-100 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {questions.length === 0 && (
          <div className="classroom-card bg-white p-8 text-center text-slate-400 italic text-sm">
            All questions deleted. Click cancel and modify your topic criteria.
          </div>
        )}
      </div>

      <div className="mt-10 flex justify-center">
        <button
          onClick={handleLaunch}
          className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-base font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
        >
          <Play size={18} />
          <span>Launch Classroom Session (Code: {code})</span>
        </button>
      </div>
    </div>
  );
}

export default function TeacherReviewPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex justify-center items-center bg-slate-50 p-8">
        <span className="text-sm font-semibold text-slate-600">Loading URL params...</span>
      </div>
    }>
      <ReviewContent />
    </Suspense>
  );
}
