export interface Phrase {
  id: string;
  odia: string;
  english: string;
  category: 'Greetings' | 'Shopping' | 'Travel' | 'Food' | 'Emergency';
}

export const PRACTICAL_PHRASES: Phrase[] = [
  // Greetings
  { id: 'g1', odia: 'ନମସ୍କାର', english: 'Hello / Greetings', category: 'Greetings' },
  { id: 'g2', odia: 'ଆପଣ କେମିତି ଅଛନ୍ତି?', english: 'How are you?', category: 'Greetings' },
  { id: 'g3', odia: 'ମୁଁ ଭଲ ଅଛି।', english: 'I am doing well.', category: 'Greetings' },
  { id: 'g4', odia: 'ଧନ୍ୟବାଦ।', english: 'Thank you.', category: 'Greetings' },
  { id: 'g5', odia: 'ଆପଣଙ୍କ ନାମ କଣ?', english: 'What is your name?', category: 'Greetings' },
  { id: 'g6', odia: 'ଦେଖା ହେବା ବହୁତ ଖୁସି ଲାଗିଲା।', english: 'Nice to meet you.', category: 'Greetings' },

  // Shopping
  { id: 's1', odia: 'ଏହାର ଦାମ କେତେ?', english: 'How much does this cost?', category: 'Shopping' },
  { id: 's2', odia: 'ଏହା ବହୁତ ମହଙ୍ଗା।', english: 'This is very expensive.', category: 'Shopping' },
  { id: 's3', odia: 'କିଛି ରିହାତି ମିଳିବ କି?', english: 'Can I get a discount?', category: 'Shopping' },
  { id: 's4', odia: 'ମୁଁ ଏହାକୁ କିଣିବି।', english: 'I will buy this.', category: 'Shopping' },
  { id: 's5', odia: 'ରସିଦ ମିଳିବ କି?', english: 'Can I get a receipt?', category: 'Shopping' },
  { id: 's6', odia: 'କାର୍ଡ ପେମେଣ୍ଟ ହେବ କି?', english: 'Do you accept card payment?', category: 'Shopping' },

  // Travel
  { id: 't1', odia: 'ରେଳଷ୍ଟେସନ କେଉଁଠି ଅଛି?', english: 'Where is the railway station?', category: 'Travel' },
  { id: 't2', odia: 'ମୋତେ ଏହିଠାକୁ ଯିବାକୁ ଅଛି।', english: 'I need to go to this place.', category: 'Travel' },
  { id: 't3', odia: 'ବସ କେତେବେଳେ ଆସିବ?', english: 'When will the bus arrive?', category: 'Travel' },
  { id: 't4', odia: 'ମୋତେ ଏକ ଟିକେଟ ଦିଅନ୍ତୁ।', english: 'Please give me a ticket.', category: 'Travel' },
  { id: 't5', odia: 'ଏହି ବାଟଟି ସଠିକ କି?', english: 'Is this path correct?', category: 'Travel' },
  { id: 't6', odia: 'ଗାଡ଼ି ରୋକନ୍ତୁ।', english: 'Stop the vehicle.', category: 'Travel' },

  // Food
  { id: 'f1', odia: 'ମୋତେ ଭୋକ ଲାଗୁଛି।', english: 'I am hungry.', category: 'Food' },
  { id: 'f2', odia: 'ଟିକେ ପାଣି ଦିଅନ୍ତୁ।', english: 'Please give me some water.', category: 'Food' },
  { id: 'f3', odia: 'ଏଠି କଣ ଭଲ ମିଳେ?', english: 'What is good here?', category: 'Food' },
  { id: 'f4', odia: 'ଖାଦ୍ୟ ବହୁତ ସ୍ୱାଦିଷ୍ଟ ଥିଲା।', english: 'The food was very delicious.', category: 'Food' },
  { id: 'f5', odia: 'ବିଲ୍ ନେଇ ଆସନ୍ତୁ।', english: 'Please bring the bill.', category: 'Food' },
  { id: 'f6', odia: 'ମୋତେ ମିଠା ପସନ୍ଦ।', english: 'I like sweets.', category: 'Food' },

  // Emergency
  { id: 'e1', odia: 'ମୋତେ ସାହାଯ୍ୟ କରନ୍ତୁ!', english: 'Please help me!', category: 'Emergency' },
  { id: 'e2', odia: 'ଏଠି ଡାକ୍ତରଖାନା କେଉଁଠି ଅଛି?', english: 'Where is the hospital here?', category: 'Emergency' },
  { id: 'e3', odia: 'ପୋଲିସକୁ ଡାକନ୍ତୁ।', english: 'Call the police.', category: 'Emergency' },
  { id: 'e4', odia: 'ମୁଁ ହଜି ଯାଇଛି।', english: 'I am lost.', category: 'Emergency' },
  { id: 'e5', odia: 'ମୋର ମୋବାଇଲ୍ ହଜିଯାଇଛି।', english: 'My mobile is lost.', category: 'Emergency' },
  { id: 'e6', odia: 'ମୋତେ ଭଲ ଲାଗୁନି।', english: 'I am not feeling well.', category: 'Emergency' },
];
