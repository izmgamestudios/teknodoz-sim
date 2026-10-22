import type { DraftQuestion } from './importers'
import type { SourceType } from './studyDraft'
import { TEMPLATES } from './studyTemplates'

export type Example = {
  id: 'coffee' | 'landing' | 'store' | 'pricing' | 'support'
  src: SourceType
  /** English on purpose: personas read it (MatrAIx task content is English). All products below are fictional. */
  brief: string
  questions: DraftQuestion[]
  audience?: { countries: string[]; perCountry: number }
}

const L = (prompt: string, min = 1, max = 5, askRationale = false): DraftQuestion => ({ type: 'likert', prompt, options: [], min, max, askRationale })
const S = (prompt: string, options: string[], askRationale = false): DraftQuestion => ({ type: 'single_choice', prompt, options, min: 1, max: 5, askRationale })
const M = (prompt: string, options: string[]): DraftQuestion => ({ type: 'multi_choice', prompt, options, min: 1, max: 5, askRationale: false })
const T = (prompt: string): DraftQuestion => ({ type: 'free_text', prompt, options: [], min: 1, max: 5, askRationale: false })

export const EXAMPLES: Example[] = [
  {
    id: 'coffee',
    src: 'product',
    brief:
      'BeanBox is a monthly coffee subscription (example product, fictional). Every month you receive two freshly roasted single-origin coffees (250 g each), delivered to your door. You can skip a month or cancel at any time.\n\nPlans: Starter (1 bag, $12 per month), Duo (2 bags, $22 per month), Gift (3 months prepaid, $60). Shipping is free from the second month. Beans are roasted within 7 days of dispatch.',
    questions: TEMPLATES.product.map((q) => ({ ...q, options: [...q.options] })),
    audience: { countries: ['TR', 'DE'], perCountry: 5 },
  },
  {
    id: 'landing',
    src: 'website',
    brief:
      'Source: (replace with your page URL and press "Fetch")\n\nTitle: NotePilot: meeting notes that write themselves\n\nMeta description: Record, transcribe and summarize your meetings automatically.\n\nHeadings:\n- Never take meeting notes again\n- How it works\n- Pricing\n\nPage text:\nNotePilot joins your video calls, transcribes them and sends a summary with action items within minutes. Works with Zoom, Google Meet and Microsoft Teams. Free for 5 meetings a month. Pro is $15 per user per month with unlimited meetings and searchable archives. Start free, no credit card required.',
    questions: TEMPLATES.website.map((q) => ({ ...q, options: [...q.options] })),
  },
  {
    id: 'store',
    src: 'appstore',
    brief:
      'App: PocketBudget (example listing, fictional)\nDeveloper: Example Labs\nCategory: Finance\nPrice: Free, with in-app purchases\nAverage rating: 4.5 / 5 from 12400 ratings\n\nStore description:\nPocketBudget turns your bank notifications into a simple monthly budget. Set a limit for each category, see what is left at a glance and get a gentle nudge before you overspend. Your data stays on your phone. Premium ($3.99 per month) adds shared budgets for couples and yearly reports.',
    questions: TEMPLATES.appstore.map((q) => ({ ...q, options: [...q.options] })),
  },
  {
    id: 'pricing',
    src: 'survey',
    brief:
      'SprintBoard is a project-management tool for small agencies (example product, fictional). It combines task boards, time tracking and client-ready weekly reports in one place. Plans under consideration: Solo (1 user), Team (up to 10 users) and Agency (unlimited users, client portal). Prices have not been decided yet; this study explores what people would expect to pay per user per month.',
    questions: [
      T('At what price per user per month (USD) would this tool be so cheap that you would doubt its quality? Number only.'),
      T('At what price per user per month (USD) would you consider it a bargain? Number only.'),
      T('At what price per user per month (USD) would it start to feel expensive, but you would still consider it? Number only.'),
      T('At what price per user per month (USD) would it be too expensive to consider? Number only.'),
      S('Which plan would you most likely choose?', ['Solo', 'Team', 'Agency', 'None of them'], true),
      L('I would switch from my current tool if SprintBoard cost 20% less. Rate from 1 (strongly disagree) to 5 (strongly agree).'),
    ],
  },
  {
    id: 'support',
    src: 'survey',
    brief:
      'A food-delivery app is evaluating its support experience (example scenario, fictional). Imagine your dinner order arrived 70 minutes late and cold. You opened the in-app chat, waited 4 minutes for an agent, and received a 30% refund after explaining the problem twice.',
    questions: [
      L('How likely are you to recommend this app to a friend? 0 = not at all likely, 10 = extremely likely.', 0, 10),
      L('How satisfied are you with how the problem was handled? Rate from 1 (very dissatisfied) to 5 (very satisfied).'),
      S('What mattered most in this situation?', ['A quick response', 'A fair refund', 'Not having to repeat myself', 'A sincere apology', 'Compensation for next time'], true),
      M('What would you have wanted differently? (Select all that apply)', ['Faster answer', 'Full refund', 'Automatic compensation', 'A single agent from start to end', 'Live order tracking', 'Nothing']),
      T('What is the one thing the company should fix first?'),
    ],
  },
]
