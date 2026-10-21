const assert = require('assert');
const tune = require('tune-sdk');
const patch = require('../src/patch.tool.js');
const filter = require('../src/filter.proc.js');
const fs = require('fs');
const { usageRender, usageParse } = require('../src/utils.js');

const tests = {};


tests.patch = async function() {
  let files = (fs.readdirSync("test")
    .filter(item => item.match(/p\d{2}\.txt/)));
  for (const filename of files) {
    console.log(`patch ${filename}`)
    const env = {} 
    const [src, text, result] = fs.readFileSync(`test/${filename}`, "utf8").split(/\n-------------------------------\n/)
    env[filename] = src
    

    let res
    const ctx = tune.makeContext(env, async function write(filename, content) {
        res = content
    })
    await patch({text, filename}, ctx)
    assert.equal(result.trim(), res.trim())
  }
}

tests.filter_single = async function() {
  const toolNode = { type: 'tool', name: 'rf', schema: {} }
  const branchNode = { type: 'tool', name: 'branch', schema: {} }
  const textNode = { type: 'text', name: '__parent', read: async () => '' }

  assert.equal(await filter(toolNode, 'type=="tool"', {}), toolNode)
  assert.equal(await filter(branchNode, 'type=="tool" && name!="branch"', {}), undefined)
  assert.equal(await filter(textNode, 'type=="tool"', {}), undefined)
  assert.equal(await filter(toolNode, '!(name=="branch")', {}), toolNode)
  assert.equal(await filter(branchNode, '!(name=="branch")', {}), undefined)
}

tests.filter_array = async function() {
  const nodes = [
    { type: 'tool', name: 'branch' },
    { type: 'tool', name: 'rf' },
    { type: 'text', name: '__parent' },
    { type: 'tool', name: 'list_files' },
  ]

  let res = await filter(nodes, 'type=="tool" && name!="branch"', {})
  assert.deepEqual(res, [
    { type: 'tool', name: 'rf' },
    { type: 'tool', name: 'list_files' },
  ])

  res = await filter(nodes, 'name =~ /^list_/', {})
  assert.deepEqual(res, [
    { type: 'tool', name: 'list_files' },
  ])

  res = await filter(nodes, 'type=="text" || name=="rf"', {})
  assert.deepEqual(res, [
    { type: 'tool', name: 'rf' },
    { type: 'text', name: '__parent' },
  ])
}

tests.filter_grouping_and_not = async function() {
  const nodes = [
    { type: 'tool', name: 'branch' },
    { type: 'tool', name: 'rf' },
    { type: 'text', name: 'rf' },
    { type: 'text', name: '__parent' },
  ]

  let res = await filter(nodes, '(type=="tool" && name=="rf") || (type=="text" && name=="__parent")', {})
  assert.deepEqual(res, [
    { type: 'tool', name: 'rf' },
    { type: 'text', name: '__parent' },
  ])

  res = await filter(nodes, '!(type=="text")', {})
  assert.deepEqual(res, [
    { type: 'tool', name: 'branch' },
    { type: 'tool', name: 'rf' },
  ])

  res = await filter(nodes, 'name !~ /^__/', {})
  assert.deepEqual(res, [
    { type: 'tool', name: 'branch' },
    { type: 'tool', name: 'rf' },
    { type: 'text', name: 'rf' },
  ])
}

tests.usage_tokens = async function() {
  const usage = {
    prompt_tokens: 3755,
    completion_tokens: 3360,
    total_tokens: 7115,
    prompt_tokens_details: { cached_tokens: 1200 },
    completion_tokens_details: { audio_tokens: 20, video_tokens: 30 },
  };
  const template = '↑%i:h[/%c:h] ↓%o:h Σ%t:h audio=%a video=%v';
  const text = '↑3.8K/1.2K ↓3.4K Σ7.1K audio=20 video=30';
  assert.strictEqual(usageRender(template, usage), text);
  assert.deepStrictEqual(usageParse(template, text), {
    input: 3800, cache: 1200, output: 3400, total: 7100, audio: 20, video: 30,
  });
  assert.strictEqual(usageRender('%i %o %t', usage), '3755 3360 7115');
  assert.strictEqual(usageRender('%i:h %o:h %t:h', {
    prompt_tokens: 999, completion_tokens: 12000, total_tokens: 2500000,
  }), '999 12K 2.5M');
};

tests.usage_costs = async function() {
  const usage = {
    cost: 0.01641625, total_cost: 1.25, daily_cost: 2.5, monthly_cost: 30,
  };
  const template = '%C:100.2¢ total=$%T:.2 daily=$%D:.2 monthly=$%M:.2';
  const text = '1.64¢ total=$1.25 daily=$2.50 monthly=$30.00';
  assert.strictEqual(usageRender(template, usage), text);
  const parsed = usageParse(template, text);
  assert.deepStrictEqual(parsed, {
    cents: 0.0164, total_cost: 1.25, daily_cost: 2.5, monthly_cost: 30,
  });
  assert.strictEqual(usageRender(template, parsed), text);
  assert.strictEqual(usageRender('$%C:.4 / %C:1000.3', usage), '$0.0164 / 16.416');
  assert.deepStrictEqual(usageParse('%C:1000.3', '16.416'), { cents: 0.016416 });
};

tests.usage_optional = async function() {
  const template = '↑%i[/%c] ↓%o[ %C:100.2¢]';
  for (const cached_tokens of [undefined, null, 0]) {
    const usage = {
      prompt_tokens: 100, completion_tokens: 20, cost: 0,
      prompt_tokens_details: { cached_tokens },
    };
    assert.strictEqual(usageRender(template, usage), '↑100 ↓20');
  }
  assert.deepStrictEqual(usageParse(template, '↑100 ↓20'), { input: 100, output: 20 });
  assert.strictEqual(usageRender('[%i/%o]', { prompt_tokens: 10 }), '');
  // Optional visibility depends on the source value, not its rounded display.
  assert.strictEqual(usageRender('[ $%C:.2]', { cost: 0.001 }), ' $0.00');
  assert.strictEqual(usageRender('%i/%c', { prompt_tokens: 0 }), '0/');
};

tests.usage_literals_and_errors = async function() {
  const template = String.raw`(↑%i) %% \[%o\]`;
  const text = '(↑42) % [7]';
  assert.strictEqual(usageRender(template, { prompt_tokens: 42, completion_tokens: 7 }), text);
  assert.deepStrictEqual(usageParse(template, text), { input: 42, output: 7 });
  assert.strictEqual(usageParse(template, 'wrong'), null);
  assert.strictEqual(usageParse(template, text + '\n'), null);
  assert.throws(() => usageRender('%x', {}), SyntaxError);
  assert.throws(() => usageRender('[%i', {}), SyntaxError);
  assert.throws(() => usageRender('%C:0.2', {}), RangeError);
  assert.throws(() => usageRender('%C:.101', {}), RangeError);
  assert.throws(() => usageRender('%i', { prompt_tokens: NaN }), TypeError);
};

async function run(testList){
  testList = (testList && testList.length) ? testList : Object.keys(tests)
  let curTest
  while(curTest = testList.shift()) {
    try {
      await tests[curTest]()
      console.log(`pass: ${curTest}`)
    } catch (e) {
      console.log(`fail: ${curTest} ${e}`)
    }
  }
  

}
run(process.argv.slice(2));
