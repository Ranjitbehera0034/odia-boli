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
