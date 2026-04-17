const assert = require('assert');
const tune = require('tune-sdk');
const patch = require('../src/patch.tool.js');
const filter = require('../src/filter.proc.js');
const fs = require('fs');

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
