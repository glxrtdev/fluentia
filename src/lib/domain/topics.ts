/**
 * The topic catalogue. `brief` is handed to the teacher prompt so the opening
 * question is specific instead of "what would you like to talk about?".
 */
export type Topic = {
  id: string
  label: string
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
    label: 'Career',
    tagline: 'Interviews, work and leadership',
    icon: 'briefcase',
  },
  { id: 'studies', label: 'Studies', tagline: 'University, exams and learning', icon: 'graduation' },
  { id: 'travel', label: 'Travel', tagline: 'Airports, hotels and getting around', icon: 'plane' },
  { id: 'daily-life', label: 'Daily Life', tagline: 'Routine, friends and hobbies', icon: 'coffee' },
  { id: 'technology', label: 'Technology', tagline: 'AI, code and the future', icon: 'cpu' },
  { id: 'business', label: 'Business', tagline: 'Selling, negotiating, building', icon: 'trending' },
]

export const TOPICS: Topic[] = [
  // Career
  {
    id: 'job-interview',
    label: 'Job interview',
    category: 'career',
    brief:
      'Run a realistic job interview. Play a friendly hiring manager, ask about experience, strengths and a difficult situation the learner handled.',
  },
  {
    id: 'my-career',
    label: 'My career',
    category: 'career',
    brief:
      "Talk about the learner's career path so far, what they do today and where they want to be in a few years.",
  },
  {
    id: 'workplace',
    label: 'Workplace',
    category: 'career',
    brief:
      'Discuss day-to-day work life: colleagues, remote work, deadlines, office culture and what makes a good team.',
  },
  {
    id: 'leadership',
    label: 'Leadership',
    category: 'career',
    brief:
      'Explore leadership: managing people, giving feedback, difficult decisions and the best or worst boss they had.',
  },
  {
    id: 'meetings',
    label: 'Meetings',
    category: 'career',
    brief:
      'Simulate professional meetings: presenting an update, disagreeing politely, summarising decisions and next steps.',
  },

  // Studies
  {
    id: 'university',
    label: 'University',
    category: 'studies',
    brief:
      'Talk about university life: the course, favourite subjects, professors, projects and campus routine.',
  },
  {
    id: 'exams',
    label: 'Exams',
    category: 'studies',
    brief:
      'Discuss exams and tests: how they prepare, dealing with pressure, and the hardest exam they ever took.',
  },
  {
    id: 'learning-habits',
    label: 'Learning habits',
    category: 'studies',
    brief:
      'Explore how the learner learns: study routines, note taking, procrastination and what actually works for them.',
  },
  {
    id: 'study-technology',
    label: 'Technology',
    category: 'studies',
    brief:
      'Talk about technology in education: online courses, AI tutors, laptops in class and studying with a phone nearby.',
  },

  // Travel
  {
    id: 'airport',
    label: 'Airport',
    category: 'travel',
    brief:
      'Role-play the airport: check-in, security, gate changes and a delayed connection. Play the staff, then discuss real trips.',
  },
  {
    id: 'hotel',
    label: 'Hotel',
    category: 'travel',
    brief:
      'Role-play hotel situations: checking in, asking about breakfast, requesting a room change, checking out.',
  },
  {
    id: 'restaurant',
    label: 'Restaurant',
    category: 'travel',
    brief:
      'Role-play ordering in a restaurant: asking about dishes, dietary needs, complaining politely and paying the bill.',
  },
  {
    id: 'directions',
    label: 'Asking for directions',
    category: 'travel',
    brief:
      'Practise getting around a new city: asking for directions, public transport, taxis and being lost.',
  },
  {
    id: 'travel-problems',
    label: 'Travel problems',
    category: 'travel',
    brief:
      'Handle travel going wrong: lost luggage, missed trains, cancelled bookings and asking for help or a refund.',
  },

  // Daily life
  {
    id: 'hobbies',
    label: 'Hobbies',
    category: 'daily-life',
    brief:
      'Talk about hobbies and free time: how they started, how often they do it, and what they would like to try.',
  },
  {
    id: 'friends',
    label: 'Friends',
    category: 'daily-life',
    brief:
      'Discuss friendship: how they met their closest friends, what they do together, keeping in touch.',
  },
  {
    id: 'family',
    label: 'Family',
    category: 'daily-life',
    brief: 'Talk about family: who they live with, traditions, family meals and childhood memories.',
  },
  {
    id: 'weekend',
    label: 'Weekend',
    category: 'daily-life',
    brief:
      'Talk about last weekend and the next one. Naturally invite past tenses and future plans.',
  },
  {
    id: 'daily-routine',
    label: 'Daily routine',
    category: 'daily-life',
    brief:
      'Walk through a normal day from morning to night: habits, commute, meals, evenings, sleep.',
  },

  // Technology
  {
    id: 'ai',
    label: 'AI',
    category: 'technology',
    brief:
      'Discuss artificial intelligence: where they already use it, what worries them, and how it changes their work.',
  },
  {
    id: 'programming',
    label: 'Programming',
    category: 'technology',
    brief:
      'Talk about programming: languages they use, a project they are proud of, debugging stories, learning to code.',
  },
  {
    id: 'social-media',
    label: 'Social media',
    category: 'technology',
    brief:
      'Discuss social media habits: which apps, screen time, online arguments and whether they would quit.',
  },
  {
    id: 'future-technology',
    label: 'Future technology',
    category: 'technology',
    brief:
      'Speculate about the next ten years: transport, work, health and cities. Naturally invite future forms and conditionals.',
  },

  // Business
  {
    id: 'entrepreneurship',
    label: 'Entrepreneurship',
    category: 'business',
    brief:
      'Explore starting a business: an idea they have, first customers, risk, funding and failure.',
  },
  {
    id: 'negotiation',
    label: 'Negotiation',
    category: 'business',
    brief:
      'Role-play a negotiation: price, deadlines or salary. Push back politely and look for a deal.',
  },
  {
    id: 'sales',
    label: 'Sales',
    category: 'business',
    brief:
      'Practise selling: pitching a product in one minute, handling objections and following up with a client.',
  },
  {
    id: 'marketing',
    label: 'Marketing',
    category: 'business',
    brief:
      'Discuss marketing: campaigns that stuck with them, brands they trust, and how they would launch a product.',
  },
]

export const TOPIC_BY_ID = new Map(TOPICS.map((t) => [t.id, t]))
export const CATEGORY_BY_ID = new Map(TOPIC_CATEGORIES.map((c) => [c.id, c]))

export const topicsByCategory = (category: string) => TOPICS.filter((t) => t.category === category)
