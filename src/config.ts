export const CREDITS = {
  name: 'Hüseyin Bayer',
  studio: 'İzmir Game Studios',
  email: 'izmgamestudios@gmail.com',
  whatsapp: 'https://wa.me/905417709205',
  linkedin: 'https://www.linkedin.com/in/huseyin-bayer-izmgamestudios',
} as const

export type PageId = 'dashboard' | 'personas' | 'runs' | 'credits'

export const NAV_ITEMS: { id: PageId; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Panel', icon: '◈' },
  { id: 'personas', label: 'Personalar', icon: '☺' },
  { id: 'runs', label: 'Simülasyonlar', icon: '▶' },
  { id: 'credits', label: 'Credits', icon: '★' },
]
