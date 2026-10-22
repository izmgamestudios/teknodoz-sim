// Run: node --experimental-strip-types scripts/test-importers.mjs
import assert from 'node:assert/strict'
import { parseImport, parseCsv } from '../src/importers.ts'

// JSON
let r = parseImport('[{"question":"How clear is it?","type":"rating"},{"prompt":"Pick one","type":"radio","options":["A",{"label":"B"}]},{"prompt":"Pick many","type":"checkbox","options":"X|Y|Z"},{"prompt":"Say more","type":"text"},{"prompt":"Would you buy?","type":"yes/no"},{"prompt":"NPS style","type":"scale","scale":[0,10]}]')
assert.deepEqual(r.errors, [])
assert.deepEqual(r.questions.map((q) => q.type), ['likert', 'single_choice', 'multi_choice', 'free_text', 'single_choice', 'likert'])
assert.deepEqual(r.questions[1].options, ['A', 'B'])
assert.deepEqual(r.questions[2].options, ['X', 'Y', 'Z'])
assert.deepEqual(r.questions[4].options, ['Yes', 'No'])
assert.equal(r.questions[5].min, 0); assert.equal(r.questions[5].max, 10)
r = parseImport('{"questions":[{"prompt":"Wrapped object form","type":"likert"}]}')
assert.equal(r.questions.length, 1)
r = parseImport('[{"prompt":"x"}, {"prompt":"Choice with one option","type":"single","options":["only"]}, 5]')
assert.equal(r.questions.length, 0); assert.equal(r.errors.length, 3)
assert.match(parseImport('{bad json').errors[0], /^JSON:/)

// CSV (comma, semicolon, quotes, newline inside quotes)
r = parseImport('prompt,type,options,min,max\n"How easy, really?",likert,,1,7\nPick a plan,single_choice,Free|Pro|Team,,\n"Multi ""quoted""",multi_choice,"A|B",,')
assert.deepEqual(r.errors, [])
assert.equal(r.questions[0].prompt, 'How easy, really?'); assert.equal(r.questions[0].max, 7)
assert.deepEqual(r.questions[1].options, ['Free', 'Pro', 'Team'])
assert.equal(r.questions[2].prompt, 'Multi "quoted"')
r = parseImport('question;type;options\nIs it clear?;likert;\nWhich one?;single;Red|Blue')
assert.equal(r.questions.length, 2)
assert.equal(parseCsv('a,b\r\n"x\ny",z').length, 2)
assert.match(parseImport('title,notes\nfoo,bar').errors[0] ?? 'lines', /.*/)

// plain lines
r = parseImport('How clear is the offer?\nWhich plan would you pick? | Free | Pro | Team\nAnything else? [text]\nab')
assert.deepEqual(r.questions.map((q) => q.type), ['likert', 'single_choice', 'free_text'])
assert.equal(r.errors.length, 1, 'too-short line is reported')

// cap at 10
r = parseImport(Array.from({ length: 14 }, (_, i) => `Question number ${i + 1} text`).join('\n'))
assert.equal(r.questions.length, 10)
assert.ok(r.errors.some((e) => /first 10/.test(e)))
assert.deepEqual(parseImport('   ').questions, [])
console.log('OK importers')
