export interface Exercise {
  id: string;
  type: 'multiple_choice_en_to_or' | 'multiple_choice_or_to_en' | 'listening' | 'word_jumble' | 'text_input' | 'translate_sentence' | 'listen_type' | 'match_pairs';
  prompt: string;
  correctAnswer: string;
  options?: string[];
  audioPhrase?: string;
  jumbleWords?: string[];
  helpChips?: string[];
  pairs?: { odia: string; english: string }[];
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  exercises: Exercise[];
}

export interface Unit {
  id: number;
  title: string;
  description: string;
  lessons: Lesson[];
}

export const CURRICULUM: Unit[] = [
  {
    id: 1,
    title: "Greetings",
    description: "Learn how to greet others, make small talk, and say goodbye in Odia.",
    lessons: [
      {
        id: "u1_l1",
        title: "Hello & Welcome",
        description: "Learn basic hello, welcome, and how are you.",
        exercises: [
          {
            id: "u1_l1_ex1",
            type: "multiple_choice_en_to_or",
            prompt: "Hello",
            correctAnswer: "ନମସ୍କାର",
            options: ["ନମସ୍କାର", "ଧନ୍ୟବାଦ", "ବିଦାୟ", "ଶୁଭ ସକାଳ"]
          },
          {
            id: "u1_l1_ex2",
            type: "multiple_choice_or_to_en",
            prompt: "ନମସ୍କାର",
            correctAnswer: "Hello",
            options: ["Thank you", "Hello", "Welcome", "Goodbye"]
          },
          {
            id: "u1_l1_ex3",
            type: "listening",
            prompt: "ସ୍ୱାଗତ",
            audioPhrase: "ସ୍ୱାଗତ",
            correctAnswer: "Welcome",
            options: ["Welcome", "Thank you", "Excuse me", "Sorry"]
          },
          {
            id: "u1_l1_ex4",
            type: "word_jumble",
            prompt: "Hello and welcome",
            correctAnswer: "ନମସ୍କାର ଏବଂ ସ୍ୱାଗତ",
            jumbleWords: ["ସ୍ୱାଗତ", "ନମସ୍କାର", "ଏବଂ", "ଧନ୍ୟବାଦ", "ବିଦାୟ"]
          },
          {
            id: "u1_l1_ex5",
            type: "multiple_choice_en_to_or",
            prompt: "How are you? (Formal)",
            correctAnswer: "ଆପଣ କେମିତି ଅଛନ୍ତି?",
            options: ["ତୁମେ କେମିତି ଅଛ?", "ଆପଣ କେମିତି ଅଛନ୍ତି?", "ମୁଁ ଭଲ ଅଛି", "ତୁମ ନାମ କଣ?"]
          },
          {
            id: "u1_l1_ex6",
            type: "multiple_choice_or_to_en",
            prompt: "ମୁଁ ଭଲ ଅଛି",
            correctAnswer: "I am fine",
            options: ["How are you?", "I am fine", "Welcome", "Nice to meet you"]
          },
          {
            id: "u1_l1_ex7",
            type: "word_jumble",
            prompt: "How are you? (Formal)",
            correctAnswer: "ଆପଣ କେମିତି ଅଛନ୍ତି?",
            jumbleWords: ["କେମିତି", "ଅଛନ୍ତି?", "ତୁମେ", "ଆପଣ", "ଭଲ"]
          },
          {
            id: "u1_l1_ex8",
            type: "text_input",
            prompt: "Hello",
            correctAnswer: "ନମସ୍କାର",
            helpChips: ["ନ", "ମ", "ସ", "୍କ", "ା", "ର", "ଭ", "ଲ"]
          },
          {
            id: "u1_l1_ex9",
            type: "translate_sentence",
            prompt: "ଆପଣ କେମିତି ଅଛନ୍ତି?",
            correctAnswer: "How are you?"
          },
          {
            id: "u1_l1_ex10",
            type: "listen_type",
            prompt: "Listen and type what you hear",
            correctAnswer: "How are you?"
          }
        ]
      },
      {
        id: "u1_l2",
        title: "Small Talk & Goodbyes",
        description: "Learn to say thank you, ask for names, and say goodbye.",
        exercises: [
          {
            id: "u1_l2_ex1",
            type: "multiple_choice_en_to_or",
            prompt: "Thank you",
            correctAnswer: "ଧନ୍ୟବାଦ",
            options: ["ନମସ୍କାର", "ଧନ୍ୟବାଦ", "ବିଦାୟ", "ସ୍ୱାଗତ"]
          },
          {
            id: "u1_l2_ex2",
            type: "multiple_choice_or_to_en",
            prompt: "ଧନ୍ୟବାଦ",
            correctAnswer: "Thank you",
            options: ["Hello", "Thank you", "Goodbye", "Excuse me"]
          },
          {
            id: "u1_l2_ex3",
            type: "multiple_choice_en_to_or",
            prompt: "What is your name? (Formal)",
            correctAnswer: "ଆପଣଙ୍କ ନାମ କଣ?",
            options: ["ଆପଣଙ୍କ ନାମ କଣ?", "ମୋର ନାମ ରଞ୍ଜିତ", "ତୁମେ କେମିତି ଅଛ?", "ବିଦାୟ"]
          },
          {
            id: "u1_l2_ex4",
            type: "word_jumble",
            prompt: "My name is Ranjit",
            correctAnswer: "ମୋର ନାମ ରଞ୍ଜିତ",
            jumbleWords: ["ନାମ", "ମୋର", "ରଞ୍ଜିତ", "କଣ?", "ଅଛି"]
          },
          {
            id: "u1_l2_ex5",
            type: "listening",
            prompt: "ବିଦାୟ",
            audioPhrase: "ବିଦାୟ",
            correctAnswer: "Goodbye",
            options: ["Hello", "Welcome", "Goodbye", "Thank you"]
          },
          {
            id: "u1_l2_ex6",
            type: "multiple_choice_en_to_or",
            prompt: "See you again",
            correctAnswer: "ପୁଣି ଦେଖାହେବ",
            options: ["ପୁଣି ଦେଖାହେବ", "ଶୁଭ ରାତ୍ରି", "ବିଦାୟ", "ଧନ୍ୟବାଦ"]
          },
          {
            id: "u1_l2_ex7",
            type: "word_jumble",
            prompt: "Goodbye and thank you",
            correctAnswer: "ବିଦାୟ ଏବଂ ଧନ୍ୟବାଦ",
            jumbleWords: ["ଏବଂ", "ବିଦାୟ", "ଧନ୍ୟବାଦ", "ନମସ୍କାର", "ସ୍ୱାଗତ"]
          },
          {
            id: "u1_l2_ex8",
            type: "text_input",
            prompt: "Thank you",
            correctAnswer: "ଧନ୍ୟବାଦ",
            helpChips: ["ଧ", "ନ୍", "ୟ", "ବ", "ା", "ଦ", "ନ", "ମ"]
          },
          {
            id: "u1_l2_ex9",
            type: "translate_sentence",
            prompt: "ମୋର ନାମ ରଞ୍ଜିତ ।",
            correctAnswer: "My name is Ranjit"
          },
          {
            id: "u1_l2_ex10",
            type: "listen_type",
            prompt: "Listen and type what you hear",
            correctAnswer: "See you again"
          }
        ]
      }
    ]
  },
  {
    id: 2,
    title: "Numbers",
    description: "Learn to count from 1 to 10 in Odia.",
    lessons: [
      {
        id: "u2_l1",
        title: "Numbers 1 to 5",
        description: "Learn the first five Odia numbers.",
        exercises: [
          {
            id: "u2_l1_ex1",
            type: "multiple_choice_en_to_or",
            prompt: "One",
            correctAnswer: "ଏକ",
            options: ["ଏକ", "ଦୁଇ", "ତିନି", "ଚାରି"]
          },
          {
            id: "u2_l1_ex2",
            type: "multiple_choice_or_to_en",
            prompt: "ଦୁଇ",
            correctAnswer: "Two",
            options: ["One", "Two", "Three", "Four"]
          },
          {
            id: "u2_l1_ex3",
            type: "listening",
            prompt: "ତିନି",
            audioPhrase: "ତିନି",
            correctAnswer: "Three",
            options: ["Two", "Three", "Four", "Five"]
          },
          {
            id: "u2_l1_ex4",
            type: "multiple_choice_en_to_or",
            prompt: "Four",
            correctAnswer: "ଚାରି",
            options: ["ଏକ", "ଦୁଇ", "ଚାରି", "ପାଞ୍ଚ"]
          },
          {
            id: "u2_l1_ex5",
            type: "multiple_choice_or_to_en",
            prompt: "ପାଞ୍ଚ",
            correctAnswer: "Five",
            options: ["Three", "Four", "Five", "Six"]
          },
          {
            id: "u2_l1_ex6",
            type: "word_jumble",
            prompt: "One, two, three",
            correctAnswer: "ଏକ ଦୁଇ ତିନି",
            jumbleWords: ["ଦୁଇ", "ତିନି", "ଏକ", "ଚାରି", "ପାଞ୍ଚ"]
          },
          {
            id: "u2_l1_ex7",
            type: "multiple_choice_en_to_or",
            prompt: "Three and four",
            correctAnswer: "ତିନି ଏବଂ ଚାରି",
            options: ["ଦୁଇ ଏବଂ ତିନି", "ତିନି ଏବଂ ଚାରି", "ଚାରି ଏବଂ ପାଞ୍ଚ", "ଏକ ଏବଂ ଦୁଇ"]
          },
          {
            id: "u2_l1_ex8",
            type: "text_input",
            prompt: "Five",
            correctAnswer: "ପାଞ୍ଚ",
            helpChips: ["ପ", "ା", "ଞ", "୍", "ଚ", "ଏ", "କ", "ଦ"]
          },
          {
            id: "u2_l1_ex9",
            type: "translate_sentence",
            prompt: "ଏକ ଦୁଇ ତିନି",
            correctAnswer: "One two three"
          },
          {
            id: "u2_l1_ex10",
            type: "listen_type",
            prompt: "Listen and type what you hear",
            correctAnswer: "Three and four"
          }
        ]
      },
      {
        id: "u2_l2",
        title: "Numbers 6 to 10",
        description: "Learn numbers from six to ten.",
        exercises: [
          {
            id: "u2_l2_ex1",
            type: "multiple_choice_en_to_or",
            prompt: "Six",
            correctAnswer: "ଛଅ",
            options: ["ଛଅ", "ସାତ", "ଆଠ", "ନଅ"]
          },
          {
            id: "u2_l2_ex2",
            type: "multiple_choice_or_to_en",
            prompt: "ସାତ",
            correctAnswer: "Seven",
            options: ["Six", "Seven", "Eight", "Nine"]
          },
          {
            id: "u2_l2_ex3",
            type: "listening",
            prompt: "ଆଠ",
            audioPhrase: "ଆଠ",
            correctAnswer: "Eight",
            options: ["Seven", "Eight", "Nine", "Ten"]
          },
          {
            id: "u2_l2_ex4",
            type: "multiple_choice_en_to_or",
            prompt: "Nine",
            correctAnswer: "ନଅ",
            options: ["ସାତ", "ଆଠ", "ନଅ", "ଦଶ"]
          },
          {
            id: "u2_l2_ex5",
            type: "multiple_choice_or_to_en",
            prompt: "ଦଶ",
            correctAnswer: "Ten",
            options: ["Eight", "Nine", "Ten", "Five"]
          },
          {
            id: "u2_l2_ex6",
            type: "word_jumble",
            prompt: "Five and six",
            correctAnswer: "ପାଞ୍ଚ ଏବଂ ଛଅ",
            jumbleWords: ["ଏବଂ", "ଛଅ", "ପାଞ୍ଚ", "ସାତ", "ଦଶ"]
          },
          {
            id: "u2_l2_ex7",
            type: "multiple_choice_en_to_or",
            prompt: "Eight and nine",
            correctAnswer: "ଆଠ ଏବଂ ନଅ",
            options: ["ସାତ ଏବଂ ଆଠ", "ଆଠ ଏବଂ ନଅ", "ନଅ ଏବଂ ଦଶ", "ଛଅ ଏବଂ ସାତ"]
          },
          {
            id: "u2_l2_ex8",
            type: "text_input",
            prompt: "Ten",
            correctAnswer: "ଦଶ",
            helpChips: ["ଦ", "ଶ", "ଛ", "ଅ", "ସ", "ା", "ତ", "ଆ"]
          },
          {
            id: "u2_l2_ex9",
            type: "translate_sentence",
            prompt: "ଆଠ ଏବଂ ନଅ",
            correctAnswer: "Eight and nine"
          },
          {
            id: "u2_l2_ex10",
            type: "listen_type",
            prompt: "Listen and type what you hear",
            correctAnswer: "Eight and nine"
          }
        ]
      }
    ]
  },
  {
    id: 3,
    title: "Family",
    description: "Learn family terms like father, mother, sister, and brother.",
    lessons: [
      {
        id: "u3_l1",
        title: "Core Family",
        description: "Learn father, mother, brother, and sister.",
        exercises: [
          {
            id: "u3_l1_ex1",
            type: "multiple_choice_en_to_or",
            prompt: "Father",
            correctAnswer: "ବାପା",
            options: ["ବାପା", "ମା", "ଭାଇ", "ଭଉଣୀ"]
          },
          {
            id: "u3_l1_ex2",
            type: "multiple_choice_or_to_en",
            prompt: "ମା",
            correctAnswer: "Mother",
            options: ["Father", "Mother", "Sister", "Brother"]
          },
          {
            id: "u3_l1_ex3",
            type: "listening",
            prompt: "ଭାଇ",
            audioPhrase: "ଭାଇ",
            correctAnswer: "Brother",
            options: ["Brother", "Sister", "Father", "Mother"]
          },
          {
            id: "u3_l1_ex4",
            type: "multiple_choice_en_to_or",
            prompt: "Sister",
            correctAnswer: "ଭଉଣୀ",
            options: ["ବାପା", "ମା", "ଭଉଣୀ", "ଜେଜେମା"]
          },
          {
            id: "u3_l1_ex5",
            type: "word_jumble",
            prompt: "Mother and father",
            correctAnswer: "ମା ଏବଂ ବାପା",
            jumbleWords: ["ବାପା", "ମା", "ଏବଂ", "ଭାଇ", "ଭଉଣୀ"]
          },
          {
            id: "u3_l1_ex6",
            type: "multiple_choice_or_to_en",
            prompt: "ମୋର ଭାଇ",
            correctAnswer: "My brother",
            options: ["My brother", "My sister", "My father", "My mother"]
          },
          {
            id: "u3_l1_ex7",
            type: "word_jumble",
            prompt: "My sister",
            correctAnswer: "ମୋର ଭଉଣୀ",
            jumbleWords: ["ଭଉଣୀ", "ମୋର", "ବାପା", "ମା", "ଭାଇ"]
          },
          {
            id: "u3_l1_ex8",
            type: "text_input",
            prompt: "Mother",
            correctAnswer: "ମା",
            helpChips: ["ମ", "ା", "ବ", "ପ", "ଭ", "ଇ", "ଉ", "ଣ"]
          },
          {
            id: "u3_l1_ex9",
            type: "translate_sentence",
            prompt: "ସେ ମୋର ଭାଇ ଅଟନ୍ତି ।",
            correctAnswer: "He is my brother"
          },
          {
            id: "u3_l1_ex10",
            type: "listen_type",
            prompt: "Listen and type what you hear",
            correctAnswer: "Mother and father"
          }
        ]
      },
      {
        id: "u3_l2",
        title: "Extended Family",
        description: "Learn terms for grandfather, grandmother, son, and daughter.",
        exercises: [
          {
            id: "u3_l2_ex1",
            type: "multiple_choice_en_to_or",
            prompt: "Son",
            correctAnswer: "ପୁଅ",
            options: ["ପୁଅ", "ଝିଅ", "ବାପା", "ମା"]
          },
          {
            id: "u3_l2_ex2",
            type: "multiple_choice_or_to_en",
            prompt: "ଝିଅ",
            correctAnswer: "Daughter",
            options: ["Son", "Daughter", "Grandmother", "Sister"]
          },
          {
            id: "u3_l2_ex3",
            type: "listening",
            prompt: "ଜେଜେବାପା",
            audioPhrase: "ଜେଜେବାପା",
            correctAnswer: "Grandfather",
            options: ["Grandfather", "Grandmother", "Father", "Brother"]
          },
          {
            id: "u3_l2_ex4",
            type: "multiple_choice_en_to_or",
            prompt: "Grandmother",
            correctAnswer: "ଜେଜେମା",
            options: ["ଜେଜେବାପା", "ଜେଜେମା", "ମା", "ଭଉଣୀ"]
          },
          {
            id: "u3_l2_ex5",
            type: "multiple_choice_or_to_en",
            prompt: "ଏହା ମୋର ପୁଅ",
            correctAnswer: "This is my son",
            options: ["This is my son", "This is my daughter", "He is my brother", "She is my mother"]
          },
          {
            id: "u3_l2_ex6",
            type: "word_jumble",
            prompt: "My grandfather and grandmother",
            correctAnswer: "ମୋର ଜେଜେବାପା ଏବଂ ଜେଜେମା",
            jumbleWords: ["ଜେଜେମା", "ଜେଜେବାପା", "ଏବଂ", "ମୋର", "ମା"]
          },
          {
            id: "u3_l2_ex7",
            type: "multiple_choice_en_to_or",
            prompt: "She is my daughter",
            correctAnswer: "ସେ ମୋର ଝିଅ",
            options: ["ସେ ମୋର ଝିଅ", "ଏହା ମୋର ପୁଅ", "ସେ ମୋର ଭଉଣୀ", "ସେ ମୋର ମା"]
          },
          {
            id: "u3_l2_ex8",
            type: "text_input",
            prompt: "Daughter",
            correctAnswer: "ଝିଅ",
            helpChips: ["ଝ", "ି", "ଅ", "ପ", "ୁ", "ଜ", "େ", "ମ"]
          },
          {
            id: "u3_l2_ex9",
            type: "translate_sentence",
            prompt: "ଏହା ମୋର ପୁଅ ।",
            correctAnswer: "This is my son"
          },
          {
            id: "u3_l2_ex10",
            type: "listen_type",
            prompt: "Listen and type what you hear",
            correctAnswer: "She is my daughter"
          }
        ]
      }
    ]
  },
  {
    id: 4,
    title: "Food",
    description: "Learn to name foods, drinks, and describe tastes.",
    lessons: [
      {
        id: "u4_l1",
        title: "Food Items & Taste",
        description: "Learn words like water, rice, milk, and sweet.",
        exercises: [
          {
            id: "u4_l1_ex1",
            type: "multiple_choice_en_to_or",
            prompt: "Water",
            correctAnswer: "ପାଣି",
            options: ["ପାଣି", "ଭାତ", "କ୍ଷୀର", "ଖାଦ୍ୟ"]
          },
          {
            id: "u4_l1_ex2",
            type: "multiple_choice_or_to_en",
            prompt: "ଭାତ",
            correctAnswer: "Rice",
            options: ["Water", "Rice", "Milk", "Food"]
          },
          {
            id: "u4_l1_ex3",
            type: "listening",
            prompt: "କ୍ଷୀର",
            audioPhrase: "କ୍ଷୀର",
            correctAnswer: "Milk",
            options: ["Water", "Rice", "Milk", "Tea"]
          },
          {
            id: "u4_l1_ex4",
            type: "multiple_choice_en_to_or",
            prompt: "Sweet",
            correctAnswer: "ମିଠା",
            options: ["ମିଠା", "ଖଟା", "ତିକ୍ତ", "ଲୁଣିଆ"]
          },
          {
            id: "u4_l1_ex5",
            type: "word_jumble",
            prompt: "Rice and water",
            correctAnswer: "ଭାତ ଏବଂ ପାଣି",
            jumbleWords: ["ପାଣି", "ଭାତ", "ଏବଂ", "କ୍ଷୀର", "ମିଠା"]
          },
          {
            id: "u4_l1_ex6",
            type: "multiple_choice_or_to_en",
            prompt: "ଏହା ମିଠା ଅଟେ",
            correctAnswer: "This is sweet",
            options: ["This is sweet", "This is spicy", "I want water", "The food is tasty"]
          },
          {
            id: "u4_l1_ex7",
            type: "word_jumble",
            prompt: "Sweet milk",
            correctAnswer: "ମିଠା କ୍ଷୀର",
            jumbleWords: ["କ୍ଷୀର", "ମିଠା", "ପାଣି", "ଭାତ", "ଏବଂ"]
          },
          {
            id: "u4_l1_ex8",
            type: "text_input",
            prompt: "Water",
            correctAnswer: "ପାଣି",
            helpChips: ["ପ", "ା", "ଣ", "ି", "ଭ", "ତ", "କ୍ଷ", "ୀ"]
          },
          {
            id: "u4_l1_ex9",
            type: "translate_sentence",
            prompt: "ଭାତ ଏବଂ ପାଣି",
            correctAnswer: "Rice and water"
          },
          {
            id: "u4_l1_ex10",
            type: "listen_type",
            prompt: "Listen and type what you hear",
            correctAnswer: "Rice and water"
          }
        ]
      },
      {
        id: "u4_l2",
        title: "Restaurant & Dining",
        description: "Learn expressions like hungry, thirsty, and ordering food.",
        exercises: [
          {
            id: "u4_l2_ex1",
            type: "multiple_choice_en_to_or",
            prompt: "Hungry",
            correctAnswer: "ଭୋକ",
            options: ["ଭୋକ", "ଶୋଷ", "ଖାଦ୍ୟ", "ପାଣି"]
          },
          {
            id: "u4_l2_ex2",
            type: "multiple_choice_or_to_en",
            prompt: "ଶୋଷ",
            correctAnswer: "Thirsty",
            options: ["Hungry", "Thirsty", "Tired", "Sleepy"]
          },
          {
            id: "u4_l2_ex3",
            type: "listening",
            prompt: "ମତେ ପାଣି ଦରକାର",
            audioPhrase: "ମତେ ପାଣି ଦରକାର",
            correctAnswer: "I want water",
            options: ["I want food", "I want water", "I am hungry", "The food is sweet"]
          },
          {
            id: "u4_l2_ex4",
            type: "multiple_choice_en_to_or",
            prompt: "Very tasty",
            correctAnswer: "ବହୁତ ସ୍ୱାଦିଷ୍ଟ",
            options: ["ବହୁତ ସ୍ୱାଦିଷ୍ଟ", "ମିଠା ଅଟେ", "ମତେ ଭାତ ଦରକାର", "ଖଟା ଅଟେ"]
          },
          {
            id: "u4_l2_ex5",
            type: "word_jumble",
            prompt: "I want food",
            correctAnswer: "ମତେ ଖାଦ୍ୟ ଦରକାର",
            jumbleWords: ["ଦରକାର", "ଖାଦ୍ୟ", "ମତେ", "ପାଣି", "ଭୋକ"]
          },
          {
            id: "u4_l2_ex6",
            type: "multiple_choice_or_to_en",
            prompt: "ଖାଦ୍ୟ ବହୁତ ସ୍ୱାଦିଷ୍ଟ",
            correctAnswer: "The food is very tasty",
            options: ["The food is very tasty", "I want sweet food", "This water is sweet", "I am hungry"]
          },
          {
            id: "u4_l2_ex7",
            type: "word_jumble",
            prompt: "Is the food sweet?",
            correctAnswer: "ଖାଦ୍ୟ ମିଠା କି?",
            jumbleWords: ["ମିଠା", "ଖାଦ୍ୟ", "କି?", "ମତେ", "ଦରକାର"]
          },
          {
            id: "u4_l2_ex8",
            type: "text_input",
            prompt: "I want rice",
            correctAnswer: "ମତେ ଭାତ ଦରକାର",
            helpChips: ["ମ", "ତ", "େ", "ଭ", "ା", "ତ", "ଦ", "ר"]
          },
          {
            id: "u4_l2_ex9",
            type: "translate_sentence",
            prompt: "ମତେ ଖାଦ୍ୟ ଦରକାର ।",
            correctAnswer: "I want food"
          },
          {
            id: "u4_l2_ex10",
            type: "listen_type",
            prompt: "Listen and type what you hear",
            correctAnswer: "I want water"
          }
        ]
      }
    ]
  },
  {
    id: 5,
    title: "Travel",
    description: "Learn to ask for directions, places, and transportation.",
    lessons: [
      {
        id: "u5_l1",
        title: "Directions & Transport",
        description: "Learn words like where, left, right, and stop.",
        exercises: [
          {
            id: "u5_l1_ex1",
            type: "multiple_choice_en_to_or",
            prompt: "Where?",
            correctAnswer: "କେଉଁଠି?",
            options: ["କେଉଁଠି?", "କଣ?", "କେମିତି?", "କାହିଁକି?"]
          },
          {
            id: "u5_l1_ex2",
            type: "multiple_choice_or_to_en",
            prompt: "ରୁହ",
            correctAnswer: "Stop / Wait",
            options: ["Go", "Stop / Wait", "Where", "Right"]
          },
          {
            id: "u5_l1_ex3",
            type: "listening",
            prompt: "ବାମ",
            audioPhrase: "ବାମ",
            correctAnswer: "Left",
            options: ["Left", "Right", "Straight", "Stop"]
          },
          {
            id: "u5_l1_ex4",
            type: "multiple_choice_en_to_or",
            prompt: "Right",
            correctAnswer: "ଡାହାଣ",
            options: ["ବାମ", "ଡାହାଣ", "ରୁହ", "ଯାଅ"]
          },
          {
            id: "u5_l1_ex5",
            type: "word_jumble",
            prompt: "Turn left",
            correctAnswer: "ବାମକୁ ମୋଡ଼",
            jumbleWords: ["ବାମକୁ", "ମୋଡ଼", "ଡାହାଣକୁ", "ଯାଅ", "ରୁହ"]
          },
          {
            id: "u5_l1_ex6",
            type: "multiple_choice_or_to_en",
            prompt: "ଡାହାଣକୁ ଯାଅ",
            correctAnswer: "Go right",
            options: ["Go right", "Turn left", "Stop here", "Where to go?"]
          },
          {
            id: "u5_l1_ex7",
            type: "word_jumble",
            prompt: "Stop here",
            correctAnswer: "ଏଠାରେ ରୁହ",
            jumbleWords: ["ଏଠାରେ", "ରୁହ", "ଯାଅ", "ବାମକୁ", "କେଉଁଠି"]
          },
          {
            id: "u5_l1_ex8",
            type: "text_input",
            prompt: "Go",
            correctAnswer: "ଯାଅ",
            helpChips: ["ଯ", "ା", "ଅ", "ର", "ୁ", "ହ", "ବ", "ମ"]
          },
          {
            id: "u5_l1_ex9",
            type: "translate_sentence",
            prompt: "ଡାହାଣକୁ ଯାଅ ।",
            correctAnswer: "Go right"
          },
          {
            id: "u5_l1_ex10",
            type: "listen_type",
            prompt: "Listen and type what you hear",
            correctAnswer: "Turn left"
          }
        ]
      },
      {
        id: "u5_l2",
        title: "Places & Hotels",
        description: "Learn to ask for hotels, tickets, and buses.",
        exercises: [
          {
            id: "u5_l2_ex1",
            type: "multiple_choice_en_to_or",
            prompt: "Where is the hotel?",
            correctAnswer: "ହୋଟେଲ କେଉଁଠି ଅଛି?",
            options: ["ହୋଟେଲ କେଉଁଠି ଅଛି?", "ବସ୍ କେଉଁଠି ଅଛି?", "ଟିକେଟ କେଉଁଠି ଅଛି?", "ଓଡ଼ିଶା କେଉଁଠି ଅଛି?"]
          },
          {
            id: "u5_l2_ex2",
            type: "multiple_choice_or_to_en",
            prompt: "ଟିକେଟ",
            correctAnswer: "Ticket",
            options: ["Hotel", "Ticket", "Bus", "Where"]
          },
          {
            id: "u5_l2_ex3",
            type: "listening",
            prompt: "ବସ୍",
            audioPhrase: "ବସ୍",
            correctAnswer: "Bus",
            options: ["Train", "Car", "Bus", "Ticket"]
          },
          {
            id: "u5_l2_ex4",
            type: "multiple_choice_en_to_or",
            prompt: "Where is Odisha?",
            correctAnswer: "ଓଡ଼ିଶା କେଉଁଠି ଅଛି?",
            options: ["ଓଡ଼ିଶା କେଉଁଠି ଅଛି?", "ହୋଟେଲ ଏଠାରେ ଅଛି", "ବସ୍ କେଉଁଠି ଅଛି?", "ଏଠାରେ ରୁହ"]
          },
          {
            id: "u5_l2_ex5",
            type: "word_jumble",
            prompt: "Where is the bus?",
            correctAnswer: "ବସ୍ କେଉଁଠି ଅଛି?",
            jumbleWords: ["ଅଛି?", "କେଉଁଠି", "ବସ୍", "ହୋଟେଲ", "ଟିକେଟ"]
          },
          {
            id: "u5_l2_ex6",
            type: "multiple_choice_or_to_en",
            prompt: "ମତେ ଟିକେଟ ଦରକାର",
            correctAnswer: "I want a ticket",
            options: ["I want a ticket", "Where is the ticket?", "I want water", "Go to the hotel"]
          },
          {
            id: "u5_l2_ex7",
            type: "word_jumble",
            prompt: "The hotel is here",
            correctAnswer: "ହୋଟେଲ ଏଠାରେ ଅଛି",
            jumbleWords: ["ଏଠାରେ", "ଅଛି", "ହୋଟେଲ", "ବସ୍", "କେଉଁଠି"]
          },
          {
            id: "u5_l2_ex8",
            type: "text_input",
            prompt: "Where is the hotel?",
            correctAnswer: "ହୋଟେଲ କେଉଁଠି ଅଛି?",
            helpChips: ["ହ", "ୋ", "ଟ", "େ", "ଲ", "କ", "େ", "ଉ"]
          },
          {
            id: "u5_l2_ex9",
            type: "translate_sentence",
            prompt: "ହୋଟେଲ କେଉଁଠି ଅଛି?",
            correctAnswer: "Where is the hotel?"
          },
          {
            id: "u5_l2_ex10",
            type: "listen_type",
            prompt: "Listen and type what you hear",
            correctAnswer: "Where is the hotel?"
          }
        ]
      }
    ]
  }
];
