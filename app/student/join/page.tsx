'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight, GraduationCap, AlertCircle, ArrowLeft } from 'lucide-react';

export default function StudentJoinPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Hydrate roll number & name from memory to help quick reconnects
  useEffect(() => {
    const savedRoll = localStorage.getItem('classpulse_student_roll');
    const savedName = localStorage.getItem('classpulse_student_name');
    if (savedRoll) setRollNumber(savedRoll);
    if (savedName) setName(savedName);
  }, []);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !rollNumber.trim() || !name.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    
    setError('');
    setLoading(true);

    try {
      const normalizedRoll = rollNumber.trim().toUpperCase();
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          code: code.trim(),
          rollNumber: normalizedRoll,
          name: name.trim()
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to join. Double check the code.');
      }

      const data = await res.json();
      if (data.success) {
        // Cache credentials for recovery
        localStorage.setItem('classpulse_student_roll', normalizedRoll);
        localStorage.setItem('classpulse_student_name', name.trim());
        
        router.push(`/student/quiz/${code.trim()}?rollNumber=${normalizedRoll}`);
      } else {
        throw new Error('Could not join room.');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to room.');
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center p-6 bg-slate-50">
      <div className="w-full max-w-md">
        
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl mb-4 border-2 border-blue-200">
            <GraduationCap size={28} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Join Class<span className="text-blue-600">Pulse</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">Answer questions and share confidence levels live</p>
        </div>

        {/* Form Card */}
        <div className="student-card bg-white p-6 md:p-8 relative">
          <button
            onClick={() => router.push('/')}
            className="absolute -top-12 left-0 inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            <ArrowLeft size={12} />
            <span>Back</span>
          </button>
          {error && (
            <div className="p-3 bg-rose-50 border-2 border-rose-200 text-rose-800 rounded-xl flex items-center gap-2.5 text-xs font-semibold mb-6">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleJoin} className="space-y-5">
            <div>
              <label htmlFor="code" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                4-Digit Join Code *
              </label>
              <input
                type="text"
                id="code"
                pattern="[0-9]*"
                maxLength={4}
                placeholder="e.g. 4892"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-center text-xl font-bold tracking-widest text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="roll" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Roll Number *
                </label>
                <input
                  type="text"
                  id="roll"
                  placeholder="e.g. 23"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label htmlFor="name" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  id="name"
                  placeholder="e.g. Shreyas"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="student-button w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span>Entering Room...</span>
              ) : (
                <>
                  <span>Join Session</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="text-center text-[10px] text-slate-400 mt-8 font-semibold">
          No registration required. Data is stored on your device temporarily.
        </div>
      </div>
    </div>
  );
}
