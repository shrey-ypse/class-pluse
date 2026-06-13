import Link from 'next/link';
import { Presentation, GraduationCap, ArrowRight, Activity } from 'lucide-react';


export default function Home() {
  return (
    <div className="flex-1 flex flex-col justify-center items-center p-6 bg-slate-50">
      <div className="max-w-4xl w-full text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-100 text-sm font-semibold mb-6">
          <Activity size={16} className="text-blue-600 animate-pulse" />
          Active Learning Accelerator
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 mb-4">
          Class<span className="text-blue-600">Pulse</span>
        </h1>
        <p className="text-lg text-slate-600 max-w-xl mx-auto">
          Know exactly what your students understood in under 60 seconds. Generate instant quizzes, review live responses, and pivot your teaching.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-3xl w-full">
        {/* Teacher Card */}
        <div className="classroom-card bg-white p-8 flex flex-col items-start hover:border-blue-400 transition-all group">
          <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 mb-6">
            <Presentation size={24} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">I am a Lecturer</h2>
          <p className="text-slate-500 text-sm mb-8">
            Create instant review quizzes, project responses anonymously, identify misconceptions, and export participation CSVs.
          </p>
          <Link
            href="/teacher"
            className="mt-auto inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition-colors w-full justify-center"
          >
            Start a Session
            <ArrowRight size={16} />
          </Link>
        </div>

        {/* Student Card */}
        <div className="classroom-card bg-white p-8 flex flex-col items-start hover:border-emerald-400 transition-all group">
          <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 mb-6">
            <GraduationCap size={24} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">I am a Student</h2>
          <p className="text-slate-500 text-sm mb-8">
            Enter your room code, register with your roll number, participate in live questions, and complete exit tickets.
          </p>
          <Link
            href="/student/join"
            className="mt-auto inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white rounded-md font-semibold hover:bg-slate-900 transition-colors w-full justify-center"
          >
            Join Live Class
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      <div className="mt-16 text-center text-xs text-slate-400">
        ClassPulse MVP v1.2 • Designed for tired lecturers and poor Wi-Fi.
      </div>
    </div>
  );
}
