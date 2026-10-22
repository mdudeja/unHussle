// icons are names from lucide icon set: https://lucide.dev/icons/

export const areasData = [
  {
    title: 'Health & Fitness',
    description:
      'Activities and goals related to maintaining physical and mental health.',
    color: '#2f8a57',
    icon: 'battery-plus',
    tags: [
      { title: 'health', color: '#2a7449' },
      { title: 'fitness', color: '#1d7566' },
    ],
  },
  {
    title: 'Work',
    description: 'Tasks and projects related to your professional life.',
    color: '#c0473c',
    icon: 'briefcase-business',
    tags: [
      { title: 'work', color: '#b03a2e' },
      { title: 'career', color: '#8a4b1c' },
    ],
  },
  {
    title: 'Education',
    description: 'Learning goals, courses, and educational resources.',
    color: '#b07a12',
    icon: 'book-open-text',
    tags: [
      { title: 'education', color: '#8f6400' },
      { title: 'learning', color: '#a0560a' },
    ],
  },
  {
    title: 'Friends & Family',
    description: 'Maintaining relationships and social activities.',
    color: '#3a74bf',
    icon: 'heart-handshake',
    tags: [
      { title: 'friends', color: '#2862a8' },
      { title: 'family', color: '#ad3f68' },
    ],
  },
  {
    title: 'Rest & Relaxation',
    description: 'Activities for unwinding and recharging.',
    color: '#8656a8',
    icon: 'trees',
    tags: [
      { title: 'rest', color: '#74489c' },
      { title: 'relaxation', color: '#5b5ea6' },
    ],
  },
  {
    title: 'Travel & Adventure',
    description: 'Planning trips and exploring new places.',
    color: '#c4631c',
    icon: 'plane',
    tags: [
      { title: 'travel', color: '#a94f0c' },
      { title: 'adventure', color: '#2f7340' },
    ],
  },
  {
    title: 'Brain Dump',
    description:
      'A place to quickly jot down thoughts, ideas, and tasks for later organization.',
    color: '#6f7a7c',
    icon: 'brain-circuit',
    tags: [
      { title: 'brain_dump', color: '#5f6b73' },
      { title: 'ideas', color: '#946200' },
    ],
  },
]

export const goalsData = [
  {
    title: 'Exercise Regularly this month',
    description: 'Engage in physical activity at least 4 times a week.',
    due_date: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
    icon: 'dumbbell',
    mapToArea: 'Health & Fitness',
    tags: [
      { title: 'exercise', color: '#3d7a1f' },
      { title: 'fitness', color: '#1d7566' },
    ],
  },
  {
    title: 'Meditate Daily for 15 Minutes this month',
    description: 'Practice mindfulness meditation every day.',
    due_date: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
    icon: 'snowflake',
    mapToArea: 'Health & Fitness',
    tags: [
      { title: 'meditation', color: '#5457b8' },
      { title: 'mindfulness', color: '#6a52a8' },
    ],
  },
  {
    title: 'One focused code session every weekday this month',
    description: 'Dedicate uninterrupted time to coding tasks.',
    due_date: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
    icon: 'square-dashed-bottom-code',
    mapToArea: 'Work',
    tags: [
      { title: 'coding', color: '#0f6a87' },
      { title: 'tech', color: '#4b5563' },
    ],
  },
  {
    title: 'Read 3 books this month',
    description: 'Finish reading three books of your choice.',
    due_date: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
    icon: 'library',
    mapToArea: 'Education',
    tags: [
      { title: 'reading', color: '#7a5530' },
      { title: 'books', color: '#8b4513' },
    ],
  },
  {
    title: 'Meet up with friends or family at least twice this month',
    description: 'Plan and attend social gatherings.',
    due_date: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
    icon: 'handshake',
    mapToArea: 'Friends & Family',
    tags: [
      { title: 'social', color: '#1b7690' },
      { title: 'relationships', color: '#9c3d78' },
    ],
  },
  {
    title: 'Watch 2 movies or series episodes each week this month',
    description: 'Relax and enjoy some screen time.',
    due_date: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
    icon: 'popcorn',
    mapToArea: 'Rest & Relaxation',
    tags: [
      { title: 'movies', color: '#9e3550' },
      { title: 'relaxation', color: '#5b5ea6' },
    ],
  },
  {
    title: 'Plan a weekend getaway this month',
    description: 'Organize a short trip to explore a new place.',
    due_date: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
    icon: 'tent-tree',
    mapToArea: 'Travel & Adventure',
    tags: [
      { title: 'travel', color: '#a94f0c' },
      { title: 'adventure', color: '#2f7340' },
    ],
  },
]
