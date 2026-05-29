const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

export interface TranslationResult {
  translation: string;
  words: {
    word: string;
    phonetic: string;
  }[];
}

export async function translateOdiaToEnglish(text: string): Promise<TranslationResult> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Gemini API Key is missing. Please set EXPO_PUBLIC_GEMINI_API_KEY in your local environment or .env file.'
    );
  }

  if (!text.trim()) {
    throw new Error('Input text cannot be empty.');
  }

  const prompt = `You are a professional translator and language learning assistant.
Translate the following Odia text into fluent, grammatically correct English.
Also, break down the English translation into a list of individual words, and for each word, provide a simple, readable phonetic pronunciation hint (e.g. "HEH-loh" for "hello").
Return the result STRICTLY as a JSON object with the following structure:
{
  "translation": "English translation here",
  "words": [
    {
      "word": "word_here",
      "phonetic": "phonetic_hint_here"
    }
  ]
}

Odia text:
"${text}"`;

  try {
    const response = await fetch(`${BASE_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData?.error?.message || `API error with status code ${response.status}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error('Received empty response from translation service.');
    }

    const result = JSON.parse(rawText.trim()) as TranslationResult;
    
    if (!result.translation || !Array.isArray(result.words)) {
      throw new Error('Invalid response structure from translation service.');
    }

    return result;
  } catch (error: any) {
    console.error('Translation service error:', error);
    throw new Error(error?.message || 'A network error occurred while communicating with Gemini API.');
  }
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export async function chatWithAi(history: ChatMessage[]): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Gemini API Key is missing. Please set EXPO_PUBLIC_GEMINI_API_KEY in your local environment or .env file.'
    );
  }

  const systemInstruction = {
    parts: [
      {
        text: `You are an English tutor for Odia speakers. Keep sentences simple.
If the user makes a grammar mistake, gently correct it and explain why.
Respond in a warm, encouraging tone. Max 2 sentences per reply.`
      }
    ]
  };

  const contents = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }]
  }));

  try {
    const response = await fetch(`${BASE_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        systemInstruction,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 150
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData?.error?.message || `API error with status code ${response.status}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error('Received empty response from AI tutor.');
    }

    return rawText.trim();
  } catch (error: any) {
    console.error('AI Tutor service error:', error);
    throw new Error(error?.message || 'A network error occurred while communicating with Gemini API.');
  }
}

export interface PronunciationWordScore {
  word: string;
  score: number;
}

export interface PronunciationResult {
  score: number;
  feedback: string;
  words: PronunciationWordScore[];
}

export async function analyzePronunciation(
  audioBase64: string,
  sentence: string,
  mimeType: string = 'audio/m4a'
): Promise<PronunciationResult> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Gemini API Key is missing. Please set EXPO_PUBLIC_GEMINI_API_KEY in your local environment or .env file.'
    );
  }

  const prompt = `Analyze the pronunciation of the speaker in the attached audio relative to the target English sentence: "${sentence}".
Determine:
1. An overall pronunciation accuracy score from 0 to 100.
2. Specific constructive feedback (1-2 sentences) about their accent or pronunciation, highlighting any weak sounds (like "th", "r", "s", or vowels) and how to improve.
3. An accuracy score (0 to 100) for each individual word in the target sentence. The words list should contain all the words from the target sentence in order, with punctuation stripped from the keys.

Return the result STRICTLY as a JSON object with the following structure:
{
  "score": number,
  "feedback": "string",
  "words": [
    {
      "word": "string",
      "score": number
    }
  ]
}`;

  try {
    const response = await fetch(`${BASE_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: audioBase64,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData?.error?.message || `API error with status code ${response.status}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error('Received empty response from Gemini API.');
    }

    const result = JSON.parse(rawText.trim()) as PronunciationResult;
    
    if (typeof result.score !== 'number' || !result.feedback || !Array.isArray(result.words)) {
      throw new Error('Invalid response structure from Gemini API.');
    }

    return result;
  } catch (error: any) {
    console.error('Pronunciation analysis service error:', error);
    throw new Error(error?.message || 'A network error occurred while communicating with Gemini API.');
  }
}

export interface GrammarExplanation {
  explanation: string;
  odiaExample: string;
  tip: string;
}

export async function getGrammarExplanation(
  question: string,
  correctAnswer: string,
  userAnswer: string
): Promise<GrammarExplanation> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Gemini API Key is missing. Please set EXPO_PUBLIC_GEMINI_API_KEY in your local environment or .env file.'
    );
  }

  const prompt = `You are a friendly English grammar teacher for Odia speakers. A student got this question wrong.

Question: "${question}"
Student's wrong answer: "${userAnswer}"
Correct answer: "${correctAnswer}"

Explain in simple terms why the correct answer is right. Use one Odia cultural example (e.g. something about food, festivals, family, or daily life in Odisha) to make it relatable. Keep it friendly and encouraging.

Return STRICTLY as JSON with this structure:
{
  "explanation": "1-2 sentences explaining the grammar rule clearly",
  "odiaExample": "1 sentence showing the rule with an Odia cultural context",
  "tip": "1 short memory trick or tip to remember this rule"
}`;

  try {
    const response = await fetch(`${BASE_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData?.error?.message || `API error with status code ${response.status}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error('Received empty response from grammar explanation service.');
    }

    const result = JSON.parse(rawText.trim()) as GrammarExplanation;

    if (!result.explanation || !result.odiaExample || !result.tip) {
      throw new Error('Invalid response structure from grammar explanation service.');
    }

    return result;
  } catch (error: any) {
    console.error('Grammar explanation service error:', error);
    throw new Error(error?.message || 'A network error occurred while communicating with Gemini API.');
  }
}

export interface Challenge {
  id: string;
  text: string;
  focus: string;
  odia: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export async function generateSmartSentences(
  interests: string[],
  weakAreas: string[],
  level: number,
  recentMistakes: { question: string; correct_answer: string }[]
): Promise<Challenge[]> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Gemini API Key is missing. Please set EXPO_PUBLIC_GEMINI_API_KEY in your local environment or .env file.'
    );
  }

  const prompt = `You are an expert English language tutor. Generate 5 customized English sentences for an Odia speaker to practice pronunciation.
Personalize the sentences based on:
1. User's interests: ${interests.join(', ') || 'general conversational'}
2. User's weak pronunciation or vocabulary areas: ${weakAreas.join(', ') || 'none specified'}
3. User's English level: ${level} (where 1 is beginner, 10 is advanced)
4. Recent mistakes made by user: ${recentMistakes.map(m => m.correct_answer).join(', ') || 'none'}

For each sentence:
- It must be in English, relevant to the user's interests, and target some of their weak areas or mistakes if possible.
- Provide a clear, natural Odia translation.
- Identify the focus phonetic sound or topic (e.g. "'th' sound", "silent letters", "vowel sounds").
- Keep sentences between 5 to 10 words.
- Assign a difficulty level: "Easy", "Medium", or "Hard".

Return the result STRICTLY as a JSON array of objects with the following structure:
[
  {
    "id": "string",
    "text": "string",
    "odia": "string",
    "focus": "string",
    "difficulty": "Easy" | "Medium" | "Hard"
  }
]`;

  try {
    const response = await fetch(`${BASE_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData?.error?.message || `API error with status code ${response.status}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error('Received empty response from sentence generation service.');
    }

    const result = JSON.parse(rawText.trim()) as Challenge[];
    
    if (!Array.isArray(result)) {
      throw new Error('Invalid response structure from sentence generation service.');
    }

    return result;
  } catch (error: any) {
    console.error('Sentence generation error:', error);
    throw new Error(error?.message || 'A network error occurred while communicating with Gemini API.');
  }
}



