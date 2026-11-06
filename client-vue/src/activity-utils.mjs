export const interestOptions = ['outdoors', 'fitness', 'creative', 'relaxing', 'social']
// Browser-local only (no accounts); prefixed with the project slug.
export const storageKey = 'ail-ay2627-s1-kaavya-touchgrass:activities'
export function builtInActivities(prefs) {
  const place = prefs.location === 'outdoors' ? 'in a familiar outdoor space' : 'in a comfortable indoor space'
  const together = prefs.company === 'friends' ? 'with your friends' : 'on your own'
  const ideas = {
    outdoors: [
      ['Nature observation', 'Notice shapes, textures and natural light around you.', 'Choose a nearby leaf, plant, or view to observe.'],
      ['Nature sketch', 'Draw something inspired by nature using paper and a pencil.', 'Pick a natural shape to sketch.'],
      ['Nature reflection', 'Write a few observations about the natural world from memory or what you can see.', 'Write down one natural detail you appreciate.']
    ],
    fitness: [
      ['Gentle movement', 'Move at a comfortable pace with easy marching and shoulder rolls.', 'Clear a small space and start with slow steps.'],
      ['Balance practice', 'Practice comfortable balance movements beside stable support.', 'Stand beside a stable surface and shift weight gently.'],
      ['Easy stretch break', 'Try gentle stretches within your comfortable range.', 'Relax your shoulders and begin a gentle shoulder roll.']
    ],
    creative: [
      ['Paper doodles', 'Fill a page with patterns and simple shapes.', 'Draw one shape on a piece of paper.'],
      ['Short story', 'Invent a short story with an unexpected ending.', 'Choose a character and write the opening sentence.'],
      ['Found-object composition', 'Arrange ordinary objects into an interesting pattern.', 'Choose three objects already available to you.']
    ],
    relaxing: [
      ['Quiet pause', 'Sit comfortably and notice your surroundings without a screen.', 'Settle into a comfortable position.'],
      ['Gratitude notes', 'Use paper to reflect on small things you appreciate.', 'Write one thing that made your day easier.'],
      ['Slow observation', 'Observe colours, sounds and textures at a relaxed pace.', 'Notice three colours around you.']
    ],
    social: [
      ['Conversation prompts', 'Think about a meaningful conversation and interesting questions to ask.', 'Choose a light question about a favourite memory.'],
      ['Kindness note', 'Write a thoughtful paper note for someone you appreciate.', 'Write the name of someone you would like to thank.'],
      ['Shared-memory reflection', 'Recall a happy experience with another person and its small details.', 'Pick one memory to describe on paper.']
    ]
  }
  return [0,1,2].map(i => {
    const interest = prefs.interests[i % prefs.interests.length]
    const [title, description, firstStep] = ideas[interest][i]
    return { title, description: `${description} Try this ${place}, ${together}.`, firstStep, minutes: prefs.minutes, interest, location: prefs.location, company: prefs.company, completed: false }
  })
}
export function validSaved(value) {
  return value?.version === 1 && ['ai','built-in'].includes(value.source) && Array.isArray(value.activities) && value.activities.length === 3 && value.activities.every(a =>
    a && typeof a.title === 'string' && a.title.length > 0 && a.title.length <= 80 && typeof a.description === 'string' && a.description.length <= 600 && typeof a.firstStep === 'string' && a.firstStep.length <= 200 && Number.isInteger(a.minutes) && a.minutes > 0 && a.minutes <= 60 && typeof a.completed === 'boolean')
}
