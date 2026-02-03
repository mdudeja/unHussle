// icons are names from lucide icon set: https://lucide.dev/icons/

export const areasData = [
  {
    title: 'Health & Fitness',
    description:
      'Activities and goals related to maintaining physical and mental health.',
    color: '#6acc83',
    icon: 'battery-plus',
  },
  {
    title: 'Work',
    description: 'Tasks and projects related to your professional life.',
    color: '#ff6f61',
    icon: 'briefcase-business',
  },
  {
    title: 'Education',
    description: 'Learning goals, courses, and educational resources.',
    color: '#f7c548',
    icon: 'book-open-text',
  },
  {
    title: 'Friends & Family',
    description: 'Maintaining relationships and social activities.',
    color: '#4a90e2',
    icon: 'heart-handshake',
  },
  {
    title: 'Rest & Relaxation',
    description: 'Activities for unwinding and recharging.',
    color: '#9b59b6',
    icon: 'trees',
  },
  {
    title: 'Travel & Adventure',
    description: 'Planning trips and exploring new places.',
    color: '#e67e22',
    icon: 'plane',
  },
  {
    title: 'Brain Dump',
    description:
      'A place to quickly jot down thoughts, ideas, and tasks for later organization.',
    color: '#95a5a6',
    icon: 'brain-circuit',
  },
]

export const goalsData = [
  {
    title: 'Exercise Regularly this month',
    description: 'Engage in physical activity at least 4 times a week.',
    due_date: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
    icon: 'dumbbell',
    mapToArea: 'Health & Fitness',
  },
  {
    title: 'Meditate Daily for 15 Minutes this month',
    description: 'Practice mindfulness meditation every day.',
    due_date: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
    icon: 'snowflake',
    mapToArea: 'Health & Fitness',
  },
  {
    title: 'One focused code session every weekday this month',
    description: 'Dedicate uninterrupted time to coding tasks.',
    due_date: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
    icon: 'square-dashed-bottom-code',
    mapToArea: 'Work',
  },
  {
    title: 'Read 3 books this month',
    description: 'Finish reading three books of your choice.',
    due_date: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
    icon: 'library',
    mapToArea: 'Education',
  },
  {
    title: 'Meet up with friends or family at least twice this month',
    description: 'Plan and attend social gatherings.',
    due_date: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
    icon: 'handshake',
    mapToArea: 'Friends & Family',
  },
  {
    title: 'Watch 2 movies or series episodes each week this month',
    description: 'Relax and enjoy some screen time.',
    due_date: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
    icon: 'popcorn',
    mapToArea: 'Rest & Relaxation',
  },
  {
    title: 'Plan a weekend getaway this month',
    description: 'Organize a short trip to explore a new place.',
    due_date: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
    icon: 'tent-tree',
    mapToArea: 'Travel & Adventure',
  },
]
