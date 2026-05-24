export interface OdiaItem {
  id: string;
  title: string;
  description: string;
  category: string;
  content: string;
}

const MOCK_ITEMS: OdiaItem[] = [
  {
    id: '1',
    title: 'Konark Sun Temple',
    description: 'A 13th-century CE Sun Temple at Konark, famous for its unique chariot architecture.',
    category: 'Monuments',
    content: 'The Konark Sun Temple is a classic illustration of Odia temple architecture, built by King Narasimhadeva I of the Eastern Ganga Dynasty. Shaped like a colossal chariot with 24 wheels and 7 horses, it is a UNESCO World Heritage Site.',
  },
  {
    id: '2',
    title: 'Odia Language Origin',
    description: 'An ancient Indo-Aryan language, recognized as a Classical Language of India.',
    category: 'Language',
    content: 'Odia is spoken by millions of people primarily in Odisha. It is the sixth Indian language to be designated as a Classical Language on the basis of having a long literary history and not borrowing extensively from other languages.',
  },
  {
    id: '3',
    title: 'Rath Yatra of Puri',
    description: 'The annual chariot festival of Lord Jagannath celebrated in Puri.',
    category: 'Festivals',
    content: 'Rath Yatra is one of the oldest and grandest chariot festivals in the world, where deities Lord Jagannath, Balabhadra, and Subhadra are pulled in massive wooden chariots to the Gundicha Temple.',
  },
  {
    id: '4',
    title: 'Pattachitra Art',
    description: 'A traditional scroll painting technique representing Hindu mythological narratives.',
    category: 'Art & Craft',
    content: 'Pattachitra is a Sanskrit term meaning cloth painting. It originates from Odisha and is known for its intricate details, natural colors, and depictions of mythological events, particularly relating to Lord Jagannath.',
  },
];

export const fetchOdiaItems = async (): Promise<OdiaItem[]> => {
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 800));
  return MOCK_ITEMS;
};

export const fetchOdiaItemById = async (id: string): Promise<OdiaItem | undefined> => {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return MOCK_ITEMS.find((item) => item.id === id);
};
