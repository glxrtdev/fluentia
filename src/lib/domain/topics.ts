/**
 * The topic catalogue. `brief` is handed to the teacher prompt so the opening
 * question is specific instead of "what would you like to talk about?".
 */
export type Topic = {
  id: string
  label: string
  /** One line for the picker card. The brief below is for the model, not for
   *  a person to read. */
  blurb: string
  category: TopicCategory['id']
  brief: string
}

export type TopicCategory = {
  id: 'career' | 'studies' | 'travel' | 'daily-life' | 'technology' | 'business'
  label: string
  tagline: string
  icon: string
}

export const TOPIC_CATEGORIES: TopicCategory[] = [
  {
    id: 'career',
    label: 'Carreira',
    tagline: 'Entrevistas, trabalho e liderança',
    icon: 'briefcase',
  },
  { id: 'studies', label: 'Estudos', tagline: 'Faculdade, provas e aprendizado', icon: 'graduation' },
  { id: 'travel', label: 'Viagem', tagline: 'Aeroportos, hotéis e locomoção', icon: 'plane' },
  { id: 'daily-life', label: 'Dia a dia', tagline: 'Rotina, amigos e hobbies', icon: 'coffee' },
  { id: 'technology', label: 'Tecnologia', tagline: 'IA, código e o futuro', icon: 'cpu' },
  { id: 'business', label: 'Negócios', tagline: 'Vender, negociar, construir', icon: 'trending' },
]

export const TOPICS: Topic[] = [
  // Career
  {
    id: 'job-interview',
    label: 'Entrevista de emprego',
    blurb: 'Uma entrevista realista, do começo ao fim',
    category: 'career',
    brief:
      'Run a realistic job interview. Play a friendly hiring manager, ask about experience, strengths and a difficult situation the learner handled.',
  },
  {
    id: 'my-career',
    label: 'Minha carreira',
    blurb: 'Por onde você passou e para onde vai',
    category: 'career',
    brief:
      "Talk about the learner's career path so far, what they do today and where they want to be in a few years.",
  },
  {
    id: 'workplace',
    label: 'Ambiente de trabalho',
    blurb: 'Colegas, prazos e cultura da empresa',
    category: 'career',
    brief:
      'Discuss day-to-day work life: colleagues, remote work, deadlines, office culture and what makes a good team.',
  },
  {
    id: 'leadership',
    label: 'Liderança',
    blurb: 'Gerir pessoas e decisões difíceis',
    category: 'career',
    brief:
      'Explore leadership: managing people, giving feedback, difficult decisions and the best or worst boss they had.',
  },
  {
    id: 'meetings',
    label: 'Reuniões',
    blurb: 'Apresentar, discordar, combinar o próximo passo',
    category: 'career',
    brief:
      'Simulate professional meetings: presenting an update, disagreeing politely, summarising decisions and next steps.',
  },

  // Studies
  {
    id: 'university',
    label: 'Faculdade',
    blurb: 'Matérias, professores e vida no campus',
    category: 'studies',
    brief:
      'Talk about university life: the course, favourite subjects, professors, projects and campus routine.',
  },
  {
    id: 'exams',
    label: 'Provas',
    blurb: 'Preparar, entrar em pânico e passar',
    category: 'studies',
    brief:
      'Discuss exams and tests: how they prepare, dealing with pressure, and the hardest exam they ever took.',
  },
  {
    id: 'learning-habits',
    label: 'Hábitos de estudo',
    blurb: 'O que funciona para você e o que nunca funcionou',
    category: 'studies',
    brief:
      'Explore how the learner learns: study routines, note taking, procrastination and what actually works for them.',
  },
  {
    id: 'study-technology',
    label: 'Tecnologia',
    blurb: 'As ferramentas com que você estuda',
    category: 'studies',
    brief:
      'Talk about technology in education: online courses, AI tutors, laptops in class and studying with a phone nearby.',
  },

  // Travel
  {
    id: 'airport',
    label: 'Aeroporto',
    blurb: 'Check-in, segurança e um voo atrasado',
    category: 'travel',
    brief:
      'Role-play the airport: check-in, security, gate changes and a delayed connection. Play the staff, then discuss real trips.',
  },
  {
    id: 'hotel',
    label: 'Hotel',
    blurb: 'Reservar, fazer check-in, algo errado no quarto',
    category: 'travel',
    brief:
      'Role-play hotel situations: checking in, asking about breakfast, requesting a room change, checking out.',
  },
  {
    id: 'restaurant',
    label: 'Restaurante',
    blurb: 'Pedir, perguntar o que é cada coisa, pagar',
    category: 'travel',
    brief:
      'Role-play ordering in a restaurant: asking about dishes, dietary needs, complaining politely and paying the bill.',
  },
  {
    id: 'directions',
    label: 'Pedir informação',
    blurb: 'Se perder e achar o caminho de volta',
    category: 'travel',
    brief:
      'Practise getting around a new city: asking for directions, public transport, taxis and being lost.',
  },
  {
    id: 'travel-problems',
    label: 'Problemas de viagem',
    blurb: 'Mala perdida, trem perdido, pequenos desastres',
    category: 'travel',
    brief:
      'Handle travel going wrong: lost luggage, missed trains, cancelled bookings and asking for help or a refund.',
  },

  // Daily life
  {
    id: 'hobbies',
    label: 'Hobbies',
    blurb: 'O que você faz quando ninguém está pedindo',
    category: 'daily-life',
    brief:
      'Talk about hobbies and free time: how they started, how often they do it, and what they would like to try.',
  },
  {
    id: 'friends',
    label: 'Amigos',
    blurb: 'As pessoas que você mantém por perto',
    category: 'daily-life',
    brief:
      'Discuss friendship: how they met their closest friends, what they do together, keeping in touch.',
  },
  {
    id: 'family',
    label: 'Família',
    blurb: 'Quem são e como é a convivência',
    category: 'daily-life',
    brief: 'Talk about family: who they live with, traditions, family meals and childhood memories.',
  },
  {
    id: 'weekend',
    label: 'Fim de semana',
    blurb: 'O último, o próximo, o ideal',
    category: 'daily-life',
    brief:
      'Talk about last weekend and the next one. Naturally invite past tenses and future plans.',
  },
  {
    id: 'daily-routine',
    label: 'Rotina diária',
    blurb: 'De acordar até desligar',
    category: 'daily-life',
    brief:
      'Walk through a normal day from morning to night: habits, commute, meals, evenings, sleep.',
  },

  // Technology
  {
    id: 'ai',
    label: 'IA',
    blurb: 'O que ela muda e o que não muda',
    category: 'technology',
    brief:
      'Discuss artificial intelligence: where they already use it, what worries them, and how it changes their work.',
  },
  {
    id: 'programming',
    label: 'Programação',
    blurb: 'O que você constrói e onde travou',
    category: 'technology',
    brief:
      'Talk about programming: languages they use, a project they are proud of, debugging stories, learning to code.',
  },
  {
    id: 'social-media',
    label: 'Redes sociais',
    blurb: 'Quanto disso você realmente quer',
    category: 'technology',
    brief:
      'Discuss social media habits: which apps, screen time, online arguments and whether they would quit.',
  },
  {
    id: 'future-technology',
    label: 'Tecnologia do futuro',
    blurb: 'O que vem aí e se você quer isso',
    category: 'technology',
    brief:
      'Speculate about the next ten years: transport, work, health and cities. Naturally invite future forms and conditionals.',
  },

  // Business
  {
    id: 'entrepreneurship',
    label: 'Empreendedorismo',
    blurb: 'Começar algo e manter de pé',
    category: 'business',
    brief:
      'Explore starting a business: an idea they have, first customers, risk, funding and failure.',
  },
  {
    id: 'negotiation',
    label: 'Negociação',
    blurb: 'Pedir mais sem perder a sala',
    category: 'business',
    brief:
      'Role-play a negotiation: price, deadlines or salary. Push back politely and look for a deal.',
  },
  {
    id: 'sales',
    label: 'Vendas',
    blurb: 'Explicar por que vale a pena',
    category: 'business',
    brief:
      'Practise selling: pitching a product in one minute, handling objections and following up with a client.',
  },
  {
    id: 'marketing',
    label: 'Marketing',
    blurb: 'Alcançar quem ainda não está ouvindo',
    category: 'business',
    brief:
      'Discuss marketing: campaigns that stuck with them, brands they trust, and how they would launch a product.',
  },
]

export const TOPIC_BY_ID = new Map(TOPICS.map((t) => [t.id, t]))
export const CATEGORY_BY_ID = new Map(TOPIC_CATEGORIES.map((c) => [c.id, c]))

export const topicsByCategory = (category: string) => TOPICS.filter((t) => t.category === category)
