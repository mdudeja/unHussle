// icons are names from lucide icon set: https://lucide.dev/icons/

export const areasData = [
  {
    title: 'Health & Fitness',
    description:
      'Activities and goals related to maintaining physical and mental health.',
    color: '#6acc83',
    icon: 'battery-plus',
    area_tag: 'health_fitness',
  },
  {
    title: 'Work',
    description: 'Tasks and projects related to your professional life.',
    color: '#ff6f61',
    icon: 'briefcase-business',
    area_tag: 'work',
  },
  {
    title: 'Education',
    description: 'Learning goals, courses, and educational resources.',
    color: '#f7c548',
    icon: 'book-open-text',
    area_tag: 'education',
  },
  {
    title: 'Friends & Family',
    description: 'Maintaining relationships and social activities.',
    color: '#4a90e2',
    icon: 'heart-handshake',
    area_tag: 'friends_family',
  },
  {
    title: 'Rest & Relaxation',
    description: 'Activities for unwinding and recharging.',
    color: '#9b59b6',
    icon: 'trees',
    area_tag: 'rest_relaxation',
  },
  {
    title: 'Travel & Adventure',
    description: 'Planning trips and exploring new places.',
    color: '#e67e22',
    icon: 'plane',
    area_tag: 'travel_adventure',
  },
  {
    title: 'Brain Dump',
    description:
      'A place to quickly jot down thoughts, ideas, and tasks for later organization.',
    color: '#95a5a6',
    icon: 'brain-circuit',
    area_tag: 'brain_dump',
  },
]

export const goalsData = [
  {
    title: 'Exercise Regularly this month',
    description: 'Engage in physical activity at least 4 times a week.',
    due_date: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
    icon: 'dumbbell',
    mapToArea: 'Health & Fitness',
    goal_tag: 'exercise',
  },
  {
    title: 'Meditate Daily for 15 Minutes this month',
    description: 'Practice mindfulness meditation every day.',
    due_date: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
    icon: 'snowflake',
    mapToArea: 'Health & Fitness',
    goal_tag: 'meditation',
  },
  {
    title: 'One focused code session every weekday this month',
    description: 'Dedicate uninterrupted time to coding tasks.',
    due_date: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
    icon: 'square-dashed-bottom-code',
    mapToArea: 'Work',
    goal_tag: 'coding',
  },
  {
    title: 'Read 3 books this month',
    description: 'Finish reading three books of your choice.',
    due_date: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
    icon: 'library',
    mapToArea: 'Education',
    goal_tag: 'reading',
  },
  {
    title: 'Meet up with friends or family at least twice this month',
    description: 'Plan and attend social gatherings.',
    due_date: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
    icon: 'handshake',
    mapToArea: 'Friends & Family',
    goal_tag: 'socializing',
  },
  {
    title: 'Watch 2 movies or series episodes each week this month',
    description: 'Relax and enjoy some screen time.',
    due_date: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
    icon: 'popcorn',
    mapToArea: 'Rest & Relaxation',
    goal_tag: 'entertainment',
  },
  {
    title: 'Plan a weekend getaway this month',
    description: 'Organize a short trip to explore a new place.',
    due_date: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
    icon: 'tent-tree',
    mapToArea: 'Travel & Adventure',
    goal_tag: 'getaway',
  },
]
