const adjectives = [
  'quick',
  'lazy',
  'bright',
  'dark',
  'swift',
  'calm',
  'bold',
  'wise',
  'neat',
  'cool',
  'brave',
  'fierce',
  'gentle',
  'happy',
  'sad',
  'lucky',
  'mighty',
  'noble',
  'proud',
  'sly',
]

const nouns = [
  'fox',
  'cat',
  'dog',
  'bird',
  'fish',
  'bear',
  'wolf',
  'deer',
  'lion',
  'tiger',
  'oppossum',
  'eagle',
  'shark',
  'whale',
  'dolphin',
]

export function generateRandomSlug(): string {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  const number = Math.floor(Math.random() * 1000)

  return `${adjective}-${noun}-${number}`
}
