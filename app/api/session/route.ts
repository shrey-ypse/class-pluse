import { NextResponse } from 'next/server';
import { sessionStore, Question } from '@/lib/sessionStore';

// Optional: LLM integration to generate dynamic Pivot Prompts based on incorrect student answers
async function generatePivotPromptFromAI(questionText: string, options: string[], correctAnswer: string, incorrectDistribution: { [option: string]: number }): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return '';

  try {
    const distributionStr = Object.entries(incorrectDistribution)
      .map(([opt, count]) => `"${opt}": ${count} students`)
      .join(', ');

    const prompt = `You are a pedagogy expert and teaching assistant.
We just ran a live classroom question:
Question: "${questionText}"
Correct Answer: "${correctAnswer}"
Incorrect answers distribution: ${distributionStr}

Please analyze this distribution and provide a 2-sentence Pivot Prompt for the teacher. 
- Sentence 1: Diagnose the main misconception (why are they choosing those wrong options?).
- Sentence 2: Provide a concrete, 1-sentence explanation or analogy they can say out loud right now to fix it.
Keep it extremely concise (under 45 words total).
Do not use bullet points or markdown styling.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        })
      }
    );

    if (response.ok) {
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return text ? text.trim() : '';
    }
  } catch (error) {
    console.error('Error generating AI pivot prompt:', error);
  }
  return '';
}

// Local mock Pivot Prompt generator if API keys are missing
function generateLocalPivotPrompt(question: Question, responses: number[]): string {
  const total = responses.reduce((a, b) => a + b, 0);
  if (total === 0) return 'No student answers submitted yet. Waiting for participation.';

  const wrongAnswers = responses.map((count, idx) => ({ idx, count })).filter(item => item.idx !== question.correctAnswerIndex);
  const mainWrong = wrongAnswers.sort((a, b) => b.count - a.count)[0];
  
  if (!mainWrong || mainWrong.count === 0) {
    return '100% Accuracy! The class understands this perfectly. Proceed to the next concept.';
  }

  const wrongOptionText = question.options[mainWrong.idx];
  const correctOptionText = question.options[question.correctAnswerIndex];

  if (question.text.toLowerCase().includes('anomaly')) {
    return `misconception alert: Students are confusing update/insertion anomalies with deletion anomalies because they both deal with state changes. Clarify that deletion anomaly is specifically about losing unrelated data when a row is removed.`;
  }
  if (question.text.toLowerCase().includes('dependency') || question.text.toLowerCase().includes('2nf') || question.text.toLowerCase().includes('3nf')) {
    return `misconception alert: Many students confused partial dependency (violates 2NF) with transitive dependency (violates 3NF). Remind them: if it depends on part of a composite key, it is 2NF; if non-key depends on non-key, it is 3NF.`;
  }

  return `misconception alert: Students are selecting "${wrongOptionText}" instead of "${correctOptionText}". Remind them that ${correctOptionText} is the correct answer because it directly addresses the core constraint.`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const rollNumber = searchParams.get('rollNumber')?.trim().toUpperCase();

  if (!code) {
    return NextResponse.json({ error: 'Session code is required.' }, { status: 400 });
  }

  const session = await sessionStore.getSession(code);
  if (!session) {
    return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
  }

  // Calculate live statistics
  const totalStudents = Object.keys(session.students).length;
  let activeQuestionResponses = 0;
  const questionDistribution: { [key: string]: number[] } = {};

  // Initialize distributions
  session.questions.forEach((q) => {
    questionDistribution[q.id] = new Array(q.options.length).fill(0);
  });

  // Populate answer distributions
  Object.values(session.students).forEach((student) => {
    Object.entries(student.answers).forEach(([qId, ansIdx]) => {
      if (questionDistribution[qId] && ansIdx !== undefined && ansIdx >= 0) {
        questionDistribution[qId][ansIdx]++;
      }
    });

    // Check if they answered the active question
    if (session.activeQuestionIndex >= 0 && session.activeQuestionIndex < session.questions.length) {
      const activeQ = session.questions[session.activeQuestionIndex];
      if (student.answers[activeQ.id] !== undefined) {
        activeQuestionResponses++;
      }
    }
  });

  // Calculate Pivot Prompts locally or trigger AI if needed
  if (session.status === 'active' && session.activeQuestionIndex >= 0 && session.activeQuestionIndex < session.questions.length) {
    const currentQ = session.questions[session.activeQuestionIndex];
    if (!session.pivotPrompts[currentQ.id] && activeQuestionResponses > 0) {
      const wrongDist: { [opt: string]: number } = {};
      currentQ.options.forEach((opt, idx) => {
        if (idx !== currentQ.correctAnswerIndex) {
          wrongDist[opt] = questionDistribution[currentQ.id][idx];
        }
      });

      const aiPrompt = await generatePivotPromptFromAI(
        currentQ.text,
        currentQ.options,
        currentQ.options[currentQ.correctAnswerIndex],
        wrongDist
      );

      session.pivotPrompts[currentQ.id] = aiPrompt || generateLocalPivotPrompt(currentQ, questionDistribution[currentQ.id]);
    }
  }

  // Construct response payload
  const result: any = {
    code: session.code,
    subject: session.subject,
    unit: session.unit,
    topic: session.topic,
    status: session.status,
    isLocked: session.isLocked,
    activeQuestionIndex: session.activeQuestionIndex,
    totalStudents,
    activeQuestionResponses,
    questionDistribution,
  };

  // If request is from a student
  if (rollNumber) {
    const student = session.students[rollNumber];
    if (!student) {
      return NextResponse.json({ error: 'Student not registered in this session.' }, { status: 403 });
    }
    result.student = {
      rollNumber: student.rollNumber,
      name: student.name,
      answers: student.answers,
      exitTicket: student.exitTicket,
    };
    // Send questions list hiding correct answers if active and student hasn't answered yet
    result.questions = session.questions.map((q) => {
      const answered = student.answers[q.id] !== undefined;
      return {
        id: q.id,
        text: q.text,
        options: q.options,
        explanation: answered ? q.explanation : undefined,
        correctAnswerIndex: answered ? q.correctAnswerIndex : undefined,
      };
    });
  } else {
    // Teacher view has full access
    result.questions = session.questions;
    result.students = Object.values(session.students).map((s) => ({
      rollNumber: s.rollNumber,
      name: s.name,
      answers: s.answers,
      exitTicket: s.exitTicket,
    }));
    result.pivotPrompts = session.pivotPrompts;
  }

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, code } = body;

    if (!code) {
      return NextResponse.json({ error: 'Session code is required.' }, { status: 400 });
    }

    const session = await sessionStore.getSession(code);
    if (!session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    }

    switch (action) {
      case 'join': {
        const { rollNumber, name } = body;
        if (!rollNumber || !name) {
          return NextResponse.json({ error: 'Roll number and Name are required.' }, { status: 400 });
        }
        const success = await sessionStore.joinStudent(code, rollNumber, name);
        return NextResponse.json({ success });
      }

      case 'start': {
        const updated = await sessionStore.updateSession(code, (s) => {
          s.status = 'active';
          s.isLocked = false; // Reset lock on start
          s.activeQuestionIndex = 0;
        });
        return NextResponse.json({ success: true, session: updated });
      }

      case 'next': {
        const updated = await sessionStore.updateSession(code, (s) => {
          s.activeQuestionIndex++;
          s.isLocked = false; // Reset lock on next question
          if (s.activeQuestionIndex >= s.questions.length) {
            s.status = 'completed';
          }
        });
        return NextResponse.json({ success: true, session: updated });
      }

      case 'lock': {
        const updated = await sessionStore.updateSession(code, (s) => {
          s.isLocked = true;
        });
        return NextResponse.json({ success: true, session: updated });
      }

      case 'unlock': {
        const updated = await sessionStore.updateSession(code, (s) => {
          s.isLocked = false;
        });
        return NextResponse.json({ success: true, session: updated });
      }

      case 'submit-answer': {
        const { rollNumber, questionId, answerIndex } = body;
        if (!rollNumber || !questionId || answerIndex === undefined) {
          return NextResponse.json({ error: 'Invalid submission data.' }, { status: 400 });
        }
        if (session.isLocked) {
          return NextResponse.json({ error: 'Submissions are locked for this question.' }, { status: 400 });
        }
        const success = await sessionStore.submitAnswer(code, rollNumber, questionId, answerIndex);
        return NextResponse.json({ success });
      }

      case 'submit-exit-ticket': {
        const { rollNumber, confidence, confusion } = body;
        if (!rollNumber || !confidence) {
          return NextResponse.json({ error: 'Roll number and Confidence are required.' }, { status: 400 });
        }
        const success = await sessionStore.submitExitTicket(code, rollNumber, confidence, confusion || '');
        return NextResponse.json({ success });
      }

      case 'edit-question': {
        const { questionId, updatedQuestion } = body;
        if (!questionId || !updatedQuestion) {
          return NextResponse.json({ error: 'Invalid edit data.' }, { status: 400 });
        }
        await sessionStore.updateSession(code, (s) => {
          const idx = s.questions.findIndex(q => q.id === questionId);
          if (idx !== -1) {
            s.questions[idx] = { ...s.questions[idx], ...updatedQuestion };
          }
        });
        return NextResponse.json({ success: true });
      }

      case 'delete-question': {
        const { questionId } = body;
        if (!questionId) {
          return NextResponse.json({ error: 'Question ID required.' }, { status: 400 });
        }
        await sessionStore.updateSession(code, (s) => {
          s.questions = s.questions.filter(q => q.id !== questionId);
        });
        return NextResponse.json({ success: true });
      }

      case 'regenerate-question': {
        const { questionId } = body;
        if (!questionId) {
          return NextResponse.json({ error: 'Question ID required.' }, { status: 400 });
        }

        const newQ: Question = {
          id: `q-reg-${Date.now()}`,
          text: 'Which of the following is a key advantage of relational database schemas over flat files?',
          options: [
            'Faster raw sequential read speeds',
            'Enforcement of data integrity constraints and relationship checks',
            'Lower physical storage footprint',
            'Direct access by hardware drivers'
          ],
          correctAnswerIndex: 1,
          explanation: 'Relational databases enforce data integrity through primary/foreign keys and constraints, avoiding data inconsistency common in flat files.'
        };

        const updated = await sessionStore.updateSession(code, (s) => {
          const idx = s.questions.findIndex(q => q.id === questionId);
          if (idx !== -1) {
            s.questions[idx] = newQ;
          }
        });
        return NextResponse.json({ success: true, newQuestion: newQ, session: updated });
      }

      default:
        return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error handling session POST:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
