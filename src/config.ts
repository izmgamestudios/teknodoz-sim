export const CREDITS = {
  name: 'Hüseyin Bayer',
  studio: 'İzmir Game Studios',
  email: 'izmgamestudios@gmail.com',
  whatsapp: 'https://wa.me/905417709205',
  linkedin: 'https://www.linkedin.com/in/huseyin-bayer-izmgamestudios',
} as const

export type PageId = 'dashboard' | 'personas' | 'runs' | 'faq' | 'admin' | 'credits'

export const NAV_ITEMS: { id: PageId; icon: string }[] = [
  { id: 'dashboard', icon: '◈' },
  { id: 'personas', icon: '☺' },
  { id: 'runs', icon: '▶' },
  { id: 'faq', icon: '?' },
  { id: 'admin', icon: '⚙' },
  { id: 'credits', icon: '★' },
]
