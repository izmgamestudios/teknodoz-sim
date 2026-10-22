#!/usr/bin/env python3
"""Generate Teknodoz custom MatrAIx survey tasks into custom-tasks/.

Format follows MatrAIx application survey tasks (MIT). The shared verifier files in
scripts/survey-tests/ are copied unchanged from application/tasks/example-survey_product-feedback/tests.

Usage:  python3 -I scripts/build-custom-tasks.py
"""
import json
import os
import shutil
import textwrap

import yaml

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "custom-tasks")
TESTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "survey-tests")


# ---------- question helpers ----------
def single(qid, prompt, construct, options, rationale=False):
    q = {"id": qid, "prompt": prompt, "type": "single_choice", "construct": construct, "required": True,
         "options": [{"id": f"{qid}_{k}", "label": v} for k, v in options]}
    if rationale:
        q["askRationale"] = True
    return q


def multi(qid, prompt, construct, options):
    q = single(qid, prompt, construct, options)
    q["type"] = "multi_choice"
    return q


def likert(qid, prompt, construct, lo=1, hi=5):
    return {"id": qid, "prompt": prompt, "type": "likert", "construct": construct, "required": True,
            "minValue": lo, "maxValue": hi}


def text(qid, prompt, construct):
    return {"id": qid, "prompt": prompt, "type": "free_text", "construct": construct, "required": True}


def yes_no(qid, prompt, construct):
    return {"id": qid, "prompt": prompt, "type": "single_choice", "construct": construct, "required": True,
            "options": [{"id": "true", "label": "Yes"}, {"id": "false", "label": "No"}]}


SCALE5 = "Rate from 1 (strongly disagree) to 5 (strongly agree)."

# ---------- product briefs ----------
BRIEF_TEKLIF = """\
# Teklif Stüdyosu — product brief

**Category:** Business tools for freelancers and small software studios
**Stage:** Concept test (this brief is stimulus material for simulated personas)

## One-liner

Teklif Stüdyosu is a browser-based quote builder for full-stack development work: pick
modules, set hours and difficulty, and get an itemized, defensible price in minutes.

## How it works

- **Module catalog** of ready-made modules (for example Frontend Development, Backend & API,
  Mobile App, DevOps & CI/CD, Test & QA Automation), each with estimated person-hours.
- **Pricing logic:** hours x difficulty multiplier x hourly base rate; then urgency,
  maintenance/SLA, support and working-model multipliers (hourly, fixed project, retainer);
  finally a discount. Every line item can be defended in a negotiation.
- **AI assistance flag** per module: "included in budget" or "extra budget (external)".
- **Payment plans** such as a classic 3-installment plan (40% advance, 30% on demo approval,
  30% on go-live).
- **Gantt timeline** estimated from weekly team capacity and parallel lanes.
- **Market comparison** bands for freelancer, boutique studio, enterprise agency, no-code
  platform and offshore outsourcing.
- **Export** to PNG and PDF, JSON export/import for backups, and legal templates (software
  service agreement, NDA, privacy notice).
- **Privacy:** all data stays on the user's device. There is no account and no database.
- Prices are shown in Turkish lira with a USD equivalent.

## Target user

Freelance developers and owners of small studios (1-10 people) who must send itemized quotes to
clients and defend them in negotiations.
"""

BRIEF_AYAK = """\
# Digital Footprint Analysis — product brief

**Category:** Digital maturity assessment for brands and small businesses (by IZM Game Studios)
**Stage:** Concept test (this brief is stimulus material for simulated personas)

## One-liner

A guided assessment that measures how mature a brand's digital presence is and returns a score
and a prioritized roadmap.

## How it works

- A **14-step questionnaire** grouped into: Profile information; Corporate identity and strategy
  (brand foundations; mission, vision and values); Market and target audience; Social media
  quality (channel presence, content production, engagement and community); Website and content
  (technical quality and performance; content, SEO and conversion); Technology infrastructure;
  Budget and finance management; Team and management; SWOT analysis; Business Model Canvas.
- **Question types:** 1-5 maturity scales (from "none / I don't know" to "excellent"), yes/no,
  0-10 sliders, multi-select checklists and short free text.
- A live **completion percentage** and **score** are shown while answering. Each category has a
  weight (for example Brand Foundations counts for 8%).
- The flow ends with a **Result and Report** page.
- Positioned as the entry point to services from IZM Game Studios: measurable strategies and
  actionable roadmaps for brands.
"""

HOW_TO = """\

## How to answer

- Read the brief before you start.
- Answer every required question.
- For multiple-choice, use the listed option ids.
- For rating scales, use a whole number in the given range.
- For free-text numeric questions, give a number only (no currency symbols or words).
- Give the answer alone unless a question also asks for a short reason or confidence.
"""

FILTER_TEKLIF = {
    "company_size": ["Solo / freelance", "Startup (<50)", "SMB (50-500)"],
    "economic_motivation": ["Cost-sensitive", "Value-driven", "Premium-seeking", "Indifferent"],
}
FILTER_AYAK = {
    "company_size": ["Solo / freelance", "Startup (<50)", "SMB (50-500)", "Mid (500-5k)"],
}

TASKS = []


def task(**kw):
    TASKS.append(kw)


# ============ Teklif Stüdyosu ============
task(
    id="tk_teklif-studyosu_concept-feedback",
    title="Teklif Studio Concept Feedback",
    intro="We're gathering reactions to **Teklif Stüdyosu**, a quote builder for freelance developers and small studios. Read the brief, then tell us how it fits how you quote work today.",
    tags=["Teklif Stüdyosu", "quote builder", "concept test", "freelancers"],
    filters=FILTER_TEKLIF,
    context=BRIEF_TEKLIF + """
## What this survey is probing

- How quotes are prepared today and where it hurts
- Clarity of value and intent to try
- Most valuable feature and biggest concern
- Reaction to local-only storage (no account, no database)
""",
    questions=[
        single("q0", "How do you prepare client quotes today?", "current_quoting_method", [
            ("spreadsheet", "A spreadsheet I maintain myself"),
            ("document", "A Word or PDF template"),
            ("email_numbers", "A rough total written in an email or chat message"),
            ("paid_tool", "A paid quoting or invoicing tool"),
            ("no_quotes", "I rarely or never send formal quotes"),
        ]),
        multi("q1", "Which of these problems have you actually run into? (Select all that apply)", "pain_points", [
            ("underpricing", "I underpriced a project and lost money"),
            ("scope_creep", "Scope crept and I had no basis to say no"),
            ("justify_lines", "A client asked me to justify the price line by line"),
            ("slow", "Preparing a quote takes too long"),
            ("inconsistent", "My quotes are inconsistent from client to client"),
            ("payment_disputes", "Payment schedules caused disagreements"),
            ("none", "None of these"),
        ]),
        likert("q2", "The value of this tool is clear to me. " + SCALE5, "value_clarity"),
        likert("q3", "I would try this tool for my next quote. " + SCALE5, "trial_intent"),
        single("q4", "Which capability matters most to you?", "most_valuable_feature", [
            ("modules_multipliers", "Module catalog with hours and multipliers"),
            ("payment_timeline", "Payment plans and the Gantt timeline"),
            ("market_comparison", "Market comparison bands"),
            ("export_contracts", "PDF/PNG export and legal templates"),
            ("local_privacy", "Everything stays on my device"),
        ], rationale=True),
        single("q5", "What is your biggest concern?", "main_concern", [
            ("trust_numbers", "I would not trust the numbers it produces"),
            ("no_sync", "Data lives only on one device, with no sync"),
            ("learning_curve", "Multipliers and modules look complicated to learn"),
            ("generic_look", "Quotes might look generic to my clients"),
            ("no_concern", "No real concern; I would just not need it"),
        ]),
        single("q6", "Local-only storage (no account, no database) makes me...", "local_storage_stance", [
            ("more_likely", "More likely to use it"),
            ("indifferent", "Neither more nor less likely"),
            ("less_likely", "Less likely; I need access across devices"),
        ]),
        likert("q7", "I would recommend this tool to another freelancer or studio owner. " + SCALE5, "recommend"),
        yes_no("would_try_beta", "Would you try a beta version?", "beta_intent"),
        text("q9", "In one sentence, what would make you trust the price this tool produces?", "trust_drivers"),
    ],
)

task(
    id="tk_teklif-studyosu_pricing-sensitivity",
    title="Teklif Studio Pricing Sensitivity",
    intro="We are testing prices for **Teklif Stüdyosu**. The plans below are hypothetical test stimuli. Answer as yourself, using US dollars.",
    tags=["Teklif Stüdyosu", "price sensitivity", "Van Westendorp", "subscription pricing"],
    filters=FILTER_TEKLIF,
    context=BRIEF_TEKLIF + """
## Proposed plans (hypothetical, for testing only)

| Plan | Price | What you get |
|------|-------|--------------|
| Free | $0 | 3 quotes per month, watermark on PDF/PNG exports |
| Pro | $9 / month | Unlimited quotes, no watermark, custom branding |
| Studio | $29 / month | Everything in Pro, custom module catalogs, legal template packs, priority support |
| Lifetime | $149 one-time | Pro features, one payment, no subscription |

## What this survey is probing

- Van Westendorp price thresholds (too cheap, bargain, getting expensive, too expensive)
- Subscription vs. one-time purchase preference
- Reaction to free-plan limits and the watermark
- What would justify paying
""",
    questions=[
        text("vw_too_cheap", "At what monthly price (USD) would this tool be so cheap that you would doubt its quality? Number only.", "price_too_cheap"),
        text("vw_bargain", "At what monthly price (USD) would you consider it a bargain, a great buy for the money? Number only.", "price_bargain"),
        text("vw_expensive", "At what monthly price (USD) would it start to feel expensive, but you would still consider it? Number only.", "price_getting_expensive"),
        text("vw_too_expensive", "At what monthly price (USD) would it be too expensive to consider at all? Number only.", "price_too_expensive"),
        single("q_model", "Which way of paying would you prefer?", "payment_model_preference", [
            ("free_only", "Stay on the Free plan"),
            ("monthly_pro", "Pro, billed monthly"),
            ("studio", "Studio, billed monthly"),
            ("lifetime", "The $149 lifetime payment"),
            ("wont_pay", "I would not pay for this kind of tool"),
        ], rationale=True),
        single("q_free_limit", "Free is limited to 3 quotes a month with a watermark. You would...", "free_plan_reaction", [
            ("stay_until_limit", "Use Free until I hit the limit"),
            ("pay_remove_watermark", "Pay right away to remove the watermark"),
            ("dealbreaker", "Treat the limits as a dealbreaker and look for another tool"),
            ("rarely_need_more", "Rarely need more than 3 quotes anyway"),
        ]),
        single("q_justify", "What would justify paying for it?", "payment_justification", [
            ("win_projects", "Helping me win or keep one more project"),
            ("save_time", "Saving time on every quote"),
            ("look_professional", "Making my quotes look professional"),
            ("market_data", "The market comparison data"),
            ("nothing", "Nothing; I would not pay"),
        ]),
        single("q_lifetime", "A one-time $149 lifetime option is...", "lifetime_attitude", [
            ("more_attractive", "More attractive than a subscription"),
            ("same", "About as attractive as a subscription"),
            ("less_attractive", "Less attractive than a subscription"),
            ("vendor_risk", "Worrying; the product might disappear"),
        ]),
        likert("q_intent_pro", "At $9 per month, I would subscribe to Pro within the first month. " + SCALE5, "pro_purchase_intent"),
        likert("q_fair", "The proposed pricing feels fair for what the tool offers. " + SCALE5, "price_fairness"),
    ],
)

# MVT: 4 paired choice sets covering the full 2x2x2 factorial (headline x button x pricing line)
H = {1: "Prepare a defensible quote in 10 minutes", 2: "Price every module. Win the project."}
C = {1: "Start free", 2: "See a sample quote"}
P = {1: "Free for 3 quotes a month", 2: "From $9 a month"}


def mock(label, h, c, p):
    return (f"**Option {label}**\n\n- Headline: \"{H[h]}\"\n- Button: [ {C[c]} ]\n- Pricing line: \"{P[p]}\"\n")


# Side A/B is counterbalanced so every level appears on side A in exactly 2 of the 4 sets.
SETS = [
    ((1, 1, 1), (2, 2, 2)),
    ((1, 2, 2), (2, 1, 1)),
    ((2, 1, 2), (1, 2, 1)),
    ((2, 2, 1), (1, 1, 2)),
]
mvt_sets = ""
mvt_questions = []
for i, (a, b) in enumerate(SETS, start=1):
    mvt_sets += f"### Set {i}\n\n{mock('A', *a)}\n{mock('B', *b)}\n"
    mvt_questions.append(single(
        f"set_{i}", f"Set {i}: Which landing page would make you more likely to try the product?", f"landing_choice_set_{i}",
        [("a", "Option A"), ("b", "Option B"), ("neither", "Neither")], rationale=True))
task(
    id="tk_teklif-studyosu_mvt-landing-page",
    title="Teklif Studio Landing Page Multivariate Test",
    intro="We are comparing landing-page variants for **Teklif Stüdyosu**. You will see four head-to-head comparisons. Pick the page that makes you more likely to try the product.",
    tags=["Teklif Stüdyosu", "multivariate test", "landing page", "choice-based conjoint"],
    filters=FILTER_TEKLIF,
    context=BRIEF_TEKLIF + f"""
## Test design (multivariate, choice-based)

Three elements vary at once: the **headline** (2 versions), the **button label** (2 versions)
and the **pricing line** (2 versions). The four sets below cover all 8 combinations exactly once,
so the effect of each element can be estimated from the choices. Everything else on the page is
identical. These are test variants, not real claims.

{mvt_sets}
## What this survey is probing

- Which headline, button label and pricing line drive intent to try
- How consistent the choices are, and which element people say mattered
""",
    questions=mvt_questions + [
        single("q_driver", "Which element influenced your choices the most?", "decisive_element", [
            ("headline", "The headline"),
            ("button", "The button label"),
            ("pricing", "The pricing line"),
            ("none", "None of them; the pages felt the same"),
        ]),
        likert("q_clarity", "After reading these pages I understand what the product does. " + SCALE5, "message_clarity"),
    ],
)

task(
    id="tk_teklif-studyosu_usability-walkthrough",
    title="Teklif Studio Usability Walkthrough",
    intro="Imagine using **Teklif Stüdyosu** for the first time to prepare a quote for a client project. Walk through the steps described in the brief and rate each one.",
    tags=["Teklif Stüdyosu", "usability", "cognitive walkthrough", "first-time use"],
    filters=FILTER_TEKLIF,
    context=BRIEF_TEKLIF + """
## Screen walkthrough (text description)

**Scenario:** you must quote a client project: a web app with login, payments and an admin panel.

**Quote header form** (top): quote title, client company, contact person, preparer, validity
period (for example 15 days), payment plan, notes and terms.

**Module area:** modules are grouped by category (for example Development Services). Above the
grid: category tabs, phase filters (Phase 1, 2, 3), a "Search module..." box, "+ New module",
"Reset" and a grid/list toggle. Each module card shows its name, phase, description, estimated
hours, a difficulty multiplier (for example x1.25), a price, and the buttons "Edit", "Delete" and
"+ Add". Some cards also have an AI assistance selector: "Included in budget" or "Extra budget
(external)".

**Multiplier settings:** hourly base rate, weekly capacity, urgency, maintenance & SLA, support
and a discount percentage, plus a working model choice: hourly (x1.00), fixed project (x1.25) or
retainer (x1.10).

**Quote summary** (side panel): selected modules, subtotal, total hours, total multiplier, AI extra
budget, discount, estimated duration, validity, the total and its USD equivalent, and the buttons
"Save template", "Clear", "PNG" and "PDF quote".

## The six steps

1. Fill in the quote header form
2. Find and add the right modules
3. Understand and adjust the multipliers
4. Choose a payment plan and apply a discount
5. Read the summary and the timeline
6. Export the PDF and send it to the client

## What this survey is probing

- Perceived ease of each step (Single Ease Question, 1-7)
- First-click behavior and expected failure points
- Terms that need explanation
""",
    questions=[
        likert("s1_header", "Step 1, filling in the quote header form. How easy would this be? 1 = very difficult, 7 = very easy.", "ease_step_header", 1, 7),
        likert("s2_modules", "Step 2, finding and adding the right modules. How easy would this be? 1 = very difficult, 7 = very easy.", "ease_step_modules", 1, 7),
        likert("s3_multipliers", "Step 3, understanding and adjusting the multipliers. How easy would this be? 1 = very difficult, 7 = very easy.", "ease_step_multipliers", 1, 7),
        likert("s4_payment", "Step 4, choosing a payment plan and applying a discount. How easy would this be? 1 = very difficult, 7 = very easy.", "ease_step_payment", 1, 7),
        likert("s5_summary", "Step 5, reading the summary and the timeline. How easy would this be? 1 = very difficult, 7 = very easy.", "ease_step_summary", 1, 7),
        likert("s6_export", "Step 6, exporting the PDF and sending it. How easy would this be? 1 = very difficult, 7 = very easy.", "ease_step_export", 1, 7),
        single("fc_add", "You want to add the 'Backend & API' module. Where do you click first?", "first_click_add_module", [
            ("search", "The 'Search module...' box"),
            ("filters", "The category or phase filters"),
            ("add_button", "The '+ Add' button on the module card"),
            ("new_module", "'+ New module'"),
            ("unsure", "I am not sure where to start"),
        ]),
        single("fc_rate", "You want to change your hourly base rate. Where do you look first?", "first_click_change_rate", [
            ("multiplier_settings", "The multiplier settings section"),
            ("summary", "The quote summary panel"),
            ("module_card", "The 'Edit' button on a module card"),
            ("header_form", "The quote header form"),
            ("unsure", "I am not sure"),
        ]),
        multi("terms", "Which labels or terms would you need explained? (Select all that apply)", "unclear_terms", [
            ("difficulty_multiplier", "Difficulty multiplier (for example x1.25)"),
            ("working_model", "Working model: fixed project x1.25 or retainer x1.10"),
            ("ai_flag", "AI assistance: included in budget vs. extra budget"),
            ("phases", "Phase 1 / Phase 2 / Phase 3"),
            ("effective_rate", "Effective hourly rate"),
            ("capacity_lanes", "Weekly capacity and parallel lanes"),
            ("none", "None; everything is clear"),
        ]),
        single("stuck", "Where do you expect to get stuck first?", "expected_failure_point", [
            ("header", "The quote header form"),
            ("finding_modules", "Finding the right modules among many"),
            ("multipliers", "The multipliers"),
            ("payment_plan", "The payment plan"),
            ("export", "Exporting"),
            ("nowhere", "Nowhere"),
        ], rationale=True),
        likert("q_confidence", "I could produce an accurate, client-ready quote on my first attempt. " + SCALE5, "first_attempt_confidence"),
    ],
)

# ============ Dijital Ayak İzi Analizi ============
task(
    id="tk_ayak-izi_concept-feedback",
    title="Digital Footprint Analysis Concept Feedback",
    intro="We're gathering reactions to **Digital Footprint Analysis**, a guided digital maturity assessment for brands. Read the brief, then tell us whether it would be useful to you.",
    tags=["Digital Footprint Analysis", "digital maturity", "concept test", "brand assessment"],
    filters=FILTER_AYAK,
    context=BRIEF_AYAK + """
## What this survey is probing

- How digital presence is assessed today
- Perceived value and trust in a self-assessed score
- Most valuable output, willingness to share results, willingness to pay
""",
    questions=[
        single("q0", "How do you assess your brand's digital presence today?", "current_assessment_method", [
            ("never", "I have never formally assessed it"),
            ("adhoc", "Ad hoc, on my own"),
            ("agency_audit", "An audit from an agency or consultant"),
            ("checklist", "A checklist or template"),
            ("paid_tools", "Paid analytics or audit tools"),
        ]),
        likert("q1", "I would start this assessment if a colleague sent me the link. " + SCALE5, "start_intent"),
        likert("q2", "A single maturity score would be useful to me. " + SCALE5, "score_usefulness"),
        likert("q3", "I would trust a score built from my own self-assessed answers. " + SCALE5, "score_trust"),
        single("q4", "Which output would you value the most?", "most_valuable_output", [
            ("overall_score", "The overall score"),
            ("category_breakdown", "The breakdown by category"),
            ("roadmap", "A prioritized roadmap of actions"),
            ("benchmark", "A comparison against similar businesses"),
            ("canvas_swot", "The SWOT and Business Model Canvas summary"),
        ], rationale=True),
        single("q5", "Who would most likely use it in your organization?", "likely_user", [
            ("owner", "The owner or founder"),
            ("marketing", "A marketing manager"),
            ("agency", "An agency running it for its clients"),
            ("nobody", "Nobody; it is not relevant to us"),
        ]),
        single("q6", "Would you share your results with the agency behind it to get tailored recommendations?", "share_results", [
            ("yes_email", "Yes, with my email address"),
            ("anonymous_only", "Only anonymously"),
            ("no", "No"),
        ]),
        single("q7", "What would you realistically pay for a detailed report?", "report_willingness_to_pay", [
            ("nothing", "Nothing; it must be free"),
            ("up_to_20", "Up to $20"),
            ("20_to_50", "$20 to $50"),
            ("50_to_100", "$50 to $100"),
            ("over_100", "More than $100"),
        ]),
        likert("q8", "I would recommend this assessment to another business owner. " + SCALE5, "recommend"),
        yes_no("would_try_beta", "Would you try a beta version?", "beta_intent"),
    ],
)

STEPS = [
    ("profile", "1. Profile information"),
    ("identity", "2. Corporate identity and strategy (brand foundations, mission, vision, values)"),
    ("market", "3. Market and target audience (including market research and competition)"),
    ("social", "4. Social media quality (channels, content, engagement)"),
    ("website", "5. Website and content (technical quality, SEO, conversion)"),
    ("tech", "6. Technology infrastructure"),
    ("finance", "7. Budget and finance management"),
    ("team", "8. Team and management"),
    ("swot", "9. SWOT analysis"),
    ("canvas", "10. Business Model Canvas"),
]
task(
    id="tk_ayak-izi_funnel-dropoff",
    title="Digital Footprint Analysis Funnel Drop-off",
    intro="Imagine starting the **Digital Footprint Analysis** for your own business. Tell us where you would slow down or quit and what would keep you going.",
    tags=["Digital Footprint Analysis", "funnel drop-off", "questionnaire fatigue", "completion rate"],
    filters=FILTER_AYAK,
    context=BRIEF_AYAK + """
## Flow under test

The assessment has 14 steps, grouped as follows:

""" + "\n".join(f"- {label}" for _, label in STEPS) + """

For this test, assume the full flow takes about 15 to 20 minutes (an assumption under test, not a
measured value). A progress bar, completion percentage and live score are visible throughout.
Several questions ask for facts you may need to look up (for example technical performance
metrics, budget figures or audience research).

## What this survey is probing

- Where people would abandon the flow, and why
- Time tolerance and sensitivity to specific steps
- Which design changes would improve completion
""",
    questions=[
        likert("q0", "After reading the intro, I would start the assessment. " + SCALE5, "start_intent"),
        single("q1", "How long would you be willing to spend on a free assessment like this?", "time_tolerance", [
            ("under_5", "Up to 5 minutes"),
            ("5_to_10", "5 to 10 minutes"),
            ("10_to_20", "10 to 20 minutes"),
            ("over_20", "More than 20 minutes if the result is valuable"),
        ]),
        single("q2", "At which point would you most likely stop?", "likely_abandon_step",
               [(k, v) for k, v in STEPS] + [("finish", "I would finish the whole assessment")], rationale=True),
        multi("q3", "Which changes would make you more likely to finish? (Select all that apply)", "completion_levers", [
            ("save_resume", "Save and resume later"),
            ("skip_unknown", "Skip a question when I do not know the answer"),
            ("short_version", "A 5-minute short version first"),
            ("benchmark_preview", "A preview of how I compare to similar businesses"),
            ("examples", "Examples next to each question"),
            ("progress", "A visible progress bar and score"),
            ("none", "Nothing would change my behavior"),
        ]),
        single("q4", "When you do not know an answer, you would...", "unknown_answer_behavior", [
            ("honest_none", "Pick the 'none / I do not know' option honestly"),
            ("guess_optimistic", "Guess optimistically"),
            ("skip_return", "Skip it and come back later"),
            ("stop", "Stop the assessment"),
        ]),
        single("q5", "Budget and finance questions would make you...", "finance_sensitivity", [
            ("truthful", "Answer truthfully"),
            ("approximate", "Answer approximately"),
            ("skip", "Skip them"),
            ("stop", "Stop the assessment"),
        ]),
        likert("q6", "Seeing my score and progress while I answer motivates me to continue. " + SCALE5, "progress_motivation"),
        single("q7", "Which format would you prefer?", "format_preference", [
            ("one_go", "All 14 steps in one go"),
            ("short_then_deep", "A short version first, with an optional deep dive"),
            ("split_days", "Spread across several days with save and resume"),
        ]),
        likert("q8", "I would answer at least 80% of the questions. " + SCALE5, "completion_intent"),
    ],
)

task(
    id="tk_ayak-izi_report-comprehension",
    title="Digital Footprint Analysis Report Comprehension",
    intro="You have just completed the **Digital Footprint Analysis**. Read the illustrative result page below and tell us how you understand it and what you would do next.",
    tags=["Digital Footprint Analysis", "report comprehension", "result page", "actionability"],
    filters=FILTER_AYAK,
    context=BRIEF_AYAK + """
## Illustrative result page (sample values, not real data)

**Overall digital maturity score: 62 / 100**   |   Completion: 100%

| Category | Score (0-100) |
|----------|---------------|
| Corporate identity and strategy | 70 |
| Market and target audience | 55 |
| Social media quality | 48 |
| Website and content | 66 |
| Technology infrastructure | 72 |
| Budget and finance management | 40 |
| Team and management | 64 |

**Top gaps:** social media engagement and community; budget tracking; target audience definition.

**Suggested roadmap (illustrative):**

1. Define one primary target audience and publish a positioning statement.
2. Set up a monthly budget and channel-level spend tracking.
3. Plan a 4-week content and community routine for the weakest social channel.

## What this survey is probing

- Whether the score and categories are understood correctly
- Credibility, actionability, and what is missing
- Likely next action
""",
    questions=[
        single("q0", "What does the overall score of 62 / 100 mean?", "score_interpretation", [
            ("moderate", "Moderate maturity with clear room to improve"),
            ("excellent", "Excellent; there is little to do"),
            ("failing", "Failing; the digital presence is in bad shape"),
            ("cannot_tell", "I cannot tell from this page"),
        ]),
        single("q1", "Which area would you fix first?", "first_priority", [
            ("identity", "Corporate identity and strategy"),
            ("market", "Market and target audience"),
            ("social", "Social media quality"),
            ("website", "Website and content"),
            ("tech", "Technology infrastructure"),
            ("finance", "Budget and finance management"),
            ("team", "Team and management"),
        ], rationale=True),
        likert("q2", "I trust this score. " + SCALE5, "score_trust"),
        likert("q3", "After reading this page I know what to do next. " + SCALE5, "actionability"),
        likert("q4", "The report feels credible, not like generic marketing. " + SCALE5, "credibility"),
        single("q5", "Who would you share this report with?", "sharing_audience", [
            ("nobody", "Nobody"),
            ("team", "My team"),
            ("manager", "My manager or partners"),
            ("clients", "Clients or investors"),
            ("public", "I would publish it"),
        ]),
        multi("q6", "What is missing from this page? (Select all that apply)", "missing_elements", [
            ("benchmark", "A comparison with similar businesses"),
            ("cost", "Cost estimates for each action"),
            ("steps", "A step-by-step plan"),
            ("examples", "Examples of good practice"),
            ("timeline", "A timeline"),
            ("expert", "A chance to talk with an expert"),
            ("nothing", "Nothing is missing"),
        ]),
        single("q7", "What would you do next?", "next_action", [
            ("book_call", "Book a consultation with the agency behind the tool"),
            ("diy", "Work through the roadmap myself"),
            ("forward", "Forward it to my team"),
            ("ignore", "Close the page and do nothing"),
        ], rationale=True),
    ],
)


# ---------- writers ----------
def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)


def build(t):
    d = os.path.join(OUT, t["id"])
    slug = t["id"].replace("_", "-")
    questionnaire = {
        "schemaVersion": "1.0",
        "id": t["id"].replace("-", "_") + "_v1",
        "title": t["title"],
        "description": t["intro"].replace("**", ""),
        "questions": t["questions"],
    }
    write(os.path.join(d, "input", "questionnaire.yaml"),
          yaml.safe_dump(questionnaire, sort_keys=False, allow_unicode=True, width=110))
    write(os.path.join(d, "input", "context.md"), t["context"])
    write(os.path.join(d, "instruction.md"), f"# {t['title']}\n\n{t['intro']}\n{HOW_TO}")
    tags = ", ".join(json.dumps(x) for x in t["tags"])
    write(os.path.join(d, "task.toml"), textwrap.dedent(f"""\
        version = "1.0"
        artifacts = [ "/app/output",]

        [task]
        name = "application/{slug}"

        [metadata]
        difficulty = "easy"
        type = "survey"
        domain = "software"
        tags = [ {tags},]


        [verifier]
        timeout_sec = 120.0

        [agent]
        timeout_sec = 600.0

        [environment]
        definition = "application/shared-survey-form"
        build_timeout_sec = 600.0
        cpus = 1
        memory_mb = 2048
        storage_mb = 10240
        gpus = 0
        """))
    write(os.path.join(d, "persona_strategy.json"), json.dumps({
        "schemaVersion": "1.0", "sources": [], "dimensionFilters": t["filters"],
        "sampling": {"mode": "random", "sampleSize": 8},
    }, indent=2) + "\n")
    write(os.path.join(d, "reporting.json"), json.dumps({"schemaVersion": "1.0", "contextRules": []}, indent=2) + "\n")
    write(os.path.join(d, "README.md"), textwrap.dedent(f"""\
        # {t['title']}

        Teknodoz custom **survey** task for MatrAIx (format: `application/tasks/example-survey_product-feedback`).
        Generated by `scripts/build-custom-tasks.py`; edit the generator, not the output.

        - Stimulus material is in `input/context.md`; questions are in `input/questionnaire.yaml`.
        - Persona pool: random sample filtered by company size (dev-sample pools are small, so
          narrow filters may undershoot; widen them or use the 1M pool for coverage).
        - Product claims, plans and numbers in the context are **test stimuli**, not real data.
        - Verifier files are copied unchanged from the MatrAIx reference survey task (MIT).
        """))
    for name in ("test.sh", "verifier_env.sh", "test_state.py"):
        shutil.copy(os.path.join(TESTS, name), os.path.join(d, "tests", name)) if os.path.isdir(os.path.join(d, "tests")) else (
            os.makedirs(os.path.join(d, "tests"), exist_ok=True), shutil.copy(os.path.join(TESTS, name), os.path.join(d, "tests", name)))
    os.chmod(os.path.join(d, "tests", "test.sh"), 0o755)


def main():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    for t in TASKS:
        build(t)
    # question labels for the results view (kept outside the task folders so MatrAIx never sees them)
    with open(os.path.join(ROOT, "shared", "questionnaires.json"), "w", encoding="utf-8") as f:
        json.dump({t["id"]: {"title": t["title"], "questions": t["questions"]} for t in TASKS}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(TASKS)} tasks -> custom-tasks/")


if __name__ == "__main__":
    main()
