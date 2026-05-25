export interface PlacementQuestion {
  id: number;
  odia: string;
  english: string;
  options: string[];
  unit: number;
}

export const PLACEMENT_QUESTIONS: PlacementQuestion[] = [
  {
    id: 1,
    odia: 'ନମସ୍କାର',
    english: 'Hello',
    options: ['Hello', 'Thank you', 'Goodbye'],
    unit: 1,
  },
  {
    id: 2,
    odia: 'ଧନ୍ୟବାଦ',
    english: 'Thank you',
    options: ['Welcome', 'Thank you', 'Excuse me'],
    unit: 1,
  },
  {
    id: 3,
    odia: 'ସ୍ୱାଗତ',
    english: 'Welcome',
    options: ['Hello', 'Welcome', 'Sorry'],
    unit: 1,
  },
  {
    id: 4,
    odia: 'ତିନି',
    english: 'Three',
    options: ['Two', 'Three', 'Four'],
    unit: 2,
  },
  {
    id: 5,
    odia: 'ପାଞ୍ଚ',
    english: 'Five',
    options: ['Four', 'Five', 'Six'],
    unit: 2,
  },
  {
    id: 6,
    odia: 'ସାତ',
    english: 'Seven',
    options: ['Six', 'Seven', 'Eight'],
    unit: 2,
  },
  {
    id: 7,
    odia: 'ବାପା',
    english: 'Father',
    options: ['Father', 'Mother', 'Brother'],
    unit: 3,
  },
  {
    id: 8,
    odia: 'ଭଉଣୀ',
    english: 'Sister',
    options: ['Mother', 'Sister', 'Grandmother'],
    unit: 3,
  },
  {
    id: 9,
    odia: 'ପାଣି',
    english: 'Water',
    options: ['Water', 'Rice', 'Milk'],
    unit: 4,
  },
  {
    id: 10,
    odia: 'କେଉଁଠି?',
    english: 'Where?',
    options: ['Who?', 'Where?', 'How?'],
    unit: 5,
  },
];

export function getPlacementUnit(score: number): number {
  if (score <= 3) {
    return 1;
  } else if (score <= 6) {
    return 2;
  } else {
    return 3;
  }
}
