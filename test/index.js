const assert = require('assert');
const tune = require('tune-sdk');
const patch = require('../src/patch.tool.js');
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
