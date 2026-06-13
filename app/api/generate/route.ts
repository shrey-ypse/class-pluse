import { NextResponse } from 'next/server';
import { sessionStore, Question } from '@/lib/sessionStore';

// Multimodal LLM integration to generate quiz questions
async function callGeminiAPI(
  topic: string, 
  subject: string, 
  unit: string, 
  numQuestions: number, 
  difficulty: string,
  customApiKey?: string,
  whiteboardImage?: string,
  notesText?: string
): Promise<Question[] | null> {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    let notesSection = '';
    if (notesText && notesText.trim()) {
      notesSection = `\n\nADDITIONAL REFERENCE NOTES SUBMITTED BY TEACHER:\n"""\n${notesText}\n"""\n`;
    }

    const prompt = `You are a professional university professor. Generate a high-quality classroom quiz based on the following:
Subject: ${subject}
Unit: ${unit}
Today's Topics Taught: ${topic}${notesSection}
Number of Questions: ${numQuestions}
Difficulty Level: ${difficulty}

Constraints:
1. ONLY generate questions directly related to what was taught today (or from the uploaded notes/whiteboard image if provided). Do not include future topics.
2. Provide exactly 4 multiple-choice options for each question.
3. Mark the correct answer index (0-indexed).
4. Provide a detailed, constructive explanation explaining why the correct answer is right and why other options are common traps.
5. Format your output strictly as a JSON array of objects with this structure:
[
  {
    "id": "q1",
    "text": "Question text...",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswerIndex": 0,
    "explanation": "Detailed explanation..."
  }
]
Return ONLY raw JSON matching the array. Do not wrap it in markdown codeblocks.`;

    const parts: any[] = [{ text: prompt }];

    // If a whiteboard image is provided, parse it as base64 inline data for Gemini
    if (whiteboardImage && whiteboardImage.startsWith('data:')) {
      const matches = whiteboardImage.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/);
      if (matches && matches.length === 3) {
        parts.push({
          inlineData: {
            mimeType: matches[1],
            data: matches[2]
          }
        });
      }
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      }
    );

    if (!response.ok) {
      console.error('Gemini API returned error status:', response.status);
      return null;
    }

    const data = await response.json();
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) return null;

    const questions: Question[] = JSON.parse(textResponse);
    return questions.map((q, idx) => ({
      ...q,
      id: q.id || `q-${idx}-${Date.now()}`
    }));
  } catch (error) {
    console.error('Error in callGeminiAPI:', error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      subject, 
      unit, 
      topic, 
      numQuestions = 3, 
      difficulty = 'medium',
      geminiApiKey,
      whiteboardImage,
      notesText
    } = body;

    if (!topic || !subject) {
      return NextResponse.json(
        { error: 'Subject and Topic are required.' },
        { status: 400 }
      );
    }

    // Attempt to call Gemini (using custom key if supplied, or server-side key fallback)
    let questions = await callGeminiAPI(
      topic, 
      subject, 
      unit, 
      numQuestions, 
      difficulty, 
      geminiApiKey, 
      whiteboardImage, 
      notesText
    );

    // If Gemini fails or key is missing, fall back to smart presets
    if (!questions || questions.length === 0) {
      questions = sessionStore.getMockQuestions(topic, numQuestions);
    }

    // Limit questions to the requested count
    questions = questions.slice(0, numQuestions);

    // Create the session in our store
    const session = await sessionStore.createSession(subject, unit, topic, questions);

    return NextResponse.json({
      success: true,
      sessionCode: session.code,
      session: session
    });
  } catch (error) {
    console.error('Error generating quiz:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
