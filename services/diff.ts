/**
 * Computes the Levenshtein distance between two strings.
 */
export function getLevenshteinDistance(a: string, b: string): number {
  const tmpA = a.toLowerCase();
  const tmpB = b.toLowerCase();
  
  const matrix: number[][] = [];

  for (let i = 0; i <= tmpB.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= tmpA.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= tmpB.length; i++) {
    for (let j = 1; j <= tmpA.length; j++) {
      if (tmpB.charAt(i - 1) === tmpA.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[tmpB.length][tmpA.length];
}

/**
 * Normalizes a string by converting it to lowercase, removing punctuation,
 * and collapsing spaces.
 */
export function cleanStringForFuzzy(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Checks if user input is a fuzzy match to the correct answer.
 * Accepts minor spelling mistakes based on the length of the correct answer.
 */
export function isFuzzyMatch(userInput: string, correctAnswer: string): boolean {
  const cleanUser = cleanStringForFuzzy(userInput);
  const cleanCorrect = cleanStringForFuzzy(correctAnswer);

  if (cleanUser === cleanCorrect) {
    return true;
  }

  const distance = getLevenshteinDistance(cleanUser, cleanCorrect);

  // Set threshold dynamically based on string length:
  // - Length < 8: Max 1 edit
  // - Length 8-15: Max 2 edits
  // - Length > 15: Max 3 edits
  const length = cleanCorrect.length;
  let threshold = 1;
  if (length >= 8 && length < 15) {
    threshold = 2;
  } else if (length >= 15) {
    threshold = 3;
  }

  return distance <= threshold;
}

export interface DiffWord {
  text: string;
  type: 'correct' | 'missing' | 'incorrect';
}

/**
 * Generates a word-by-word diff comparing the user input to the correct answer.
 * Labels each word in the correct answer as 'correct', 'missing', or 'incorrect' (misspelled).
 */
export function generateWordDiff(userInput: string, correctAnswer: string): DiffWord[] {
  const uWords = cleanStringForFuzzy(userInput).split(/\s+/).filter(Boolean);
  const cWords = correctAnswer.trim().split(/\s+/).filter(Boolean); // Keep original casing/punctuation for display
  
  const cWordsClean = cWords.map(w => w.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, ''));
  const uWordsClean = uWords.map(w => w.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, ''));

  const diff: DiffWord[] = [];
  let uPtr = 0;

  for (let i = 0; i < cWords.length; i++) {
    const cClean = cWordsClean[i];
    const originalWord = cWords[i];

    if (!cClean) {
      // Punctuation-only word
      diff.push({ text: originalWord, type: 'correct' });
      continue;
    }

    // 1. Check if user word matches exactly at current pointer
    if (uPtr < uWordsClean.length && uWordsClean[uPtr] === cClean) {
      diff.push({ text: originalWord, type: 'correct' });
      uPtr++;
      continue;
    }

    // 2. Check if misspelled (Levenshtein distance <= 2)
    if (uPtr < uWordsClean.length && getLevenshteinDistance(uWordsClean[uPtr], cClean) <= 2) {
      diff.push({ text: originalWord, type: 'incorrect' });
      uPtr++;
      continue;
    }

    // 3. Look ahead in user words to see if they inserted words before matching this one
    let foundAhead = false;
    for (let j = uPtr + 1; j < Math.min(uPtr + 3, uWordsClean.length); j++) {
      if (uWordsClean[j] === cClean || getLevenshteinDistance(uWordsClean[j], cClean) <= 1) {
        diff.push({ text: originalWord, type: 'correct' });
        uPtr = j + 1;
        foundAhead = true;
        break;
      }
    }

    if (foundAhead) continue;

    // 4. Otherwise, this word is missing from the user's answer
    diff.push({ text: originalWord, type: 'missing' });
  }

  return diff;
}
