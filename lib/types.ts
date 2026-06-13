export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface StudentResponse {
  rollNumber: string;
  name: string;
  answers: { [questionId: string]: number }; // questionId -> selectedOptionIndex
  joinedAt: string;
  exitTicket?: {
    confidence: 'very' | 'somewhat' | 'not';
    confusion: string;
  };
}

export interface Session {
  code: string;
  subject: string;
  unit: string;
  topic: string;
  questions: Question[];
  activeQuestionIndex: number; // -1 = lobby, 0..N = active questions, N = finished
  status: 'lobby' | 'active' | 'completed';
  isLocked: boolean; // Controls whether students can submit answers
  students: { [rollNumber: string]: StudentResponse };
  pivotPrompts: { [questionId: string]: string }; // questionId -> advice text
  createdAt: string;
}
