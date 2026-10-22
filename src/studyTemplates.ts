import type { DraftQuestion } from './importers'

const L = (prompt: string, askRationale = false): DraftQuestion => ({ type: 'likert', prompt, options: [], min: 1, max: 5, askRationale })
const S = (prompt: string, options: string[], askRationale = false): DraftQuestion => ({ type: 'single_choice', prompt, options, min: 1, max: 5, askRationale })
const M = (prompt: string, options: string[]): DraftQuestion => ({ type: 'multi_choice', prompt, options, min: 1, max: 5, askRationale: false })
const T = (prompt: string): DraftQuestion => ({ type: 'free_text', prompt, options: [], min: 1, max: 5, askRationale: false })
const AGREE = ' Rate from 1 (strongly disagree) to 5 (strongly agree).'

export type TemplateId = 'website' | 'appstore' | 'product' | 'blank'

export const TEMPLATES: Record<TemplateId, DraftQuestion[]> = {
  website: [
    L('After reading this page, I understand what is being offered.' + AGREE),
    S('Who do you think this is for?', ['People like me', 'Small businesses', 'Large companies', 'Professionals in a specific field', 'It is unclear']),
    L('The page makes me trust the company or product.' + AGREE),
    L('I would want to learn more or try it.' + AGREE),
    S('What is your most likely next step?', ['Sign up or buy now', 'Look for reviews or comparisons', 'Bookmark it and come back later', 'Ask someone I know', 'Leave the page'], true),
    M('What, if anything, is confusing or missing? (Select all that apply)', ['What it costs', 'How it works', 'Who is behind it', 'Proof or reviews', 'How it differs from alternatives', 'How to get started', 'Nothing is missing']),
    S('Compared with what I use today, this would be...', ['Better', 'About the same', 'Worse', 'I use nothing like it today']),
    T('In one sentence, what is your main hesitation?'),
  ],
  appstore: [
    L('I would download this app.' + AGREE),
    S('Based on this listing, what would you do?', ['Install it right away', 'Read the reviews first', 'Install only if it is free', 'This is not for me']),
    L('The description makes clear what the app does.' + AGREE),
    L('The price (or free offer) seems fair for what the app offers.' + AGREE),
    S('Which part of a store listing matters most to you?', ['Rating and reviews', 'Description', 'Price', 'Screenshots', 'Developer', 'Privacy information']),
    S('How would you prefer to pay for an app like this?', ['One-time purchase', 'Subscription', 'Free with ads', 'Free with optional in-app purchases', 'I avoid paid apps']),
    M('What concerns would you have? (Select all that apply)', ['Privacy and data use', 'Hidden costs', 'Battery and performance', 'Too many ads', 'Quality and bugs', 'I do not need it']),
    L('I would still be using this app a month from now.' + AGREE),
  ],
  product: [
    L('This product or service interests me.' + AGREE),
    L('It solves a problem I actually have.' + AGREE),
    S('How likely are you to buy or sign up?', ['Definitely', 'Probably', 'Not sure', 'Probably not', 'Definitely not'], true),
    S('If a price is mentioned, it seems...', ['Too cheap, I would doubt the quality', 'Fair', 'Slightly high', 'Too expensive', 'No price was mentioned']),
    M('What would hold you back? (Select all that apply)', ['Price', 'Trust in the provider', 'Not sure it works', 'Hassle of switching', 'I already have a solution', 'Nothing']),
    S('What do you use instead today?', ['Nothing', 'A competitor', 'A do-it-yourself solution', 'Advice from friends or family']),
    L('I trust the claims made about this product or service.' + AGREE),
    T('What one change would make you more likely to buy?'),
  ],
  blank: [],
}
