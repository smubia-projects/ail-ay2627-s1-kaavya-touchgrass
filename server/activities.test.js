const { test } = require('node:test')
const assert = require('node:assert/strict')
const { validatePreferences, validateActivities, suggestActivities, createActivityRouter } = require('./activities')
const prefs = { interests: ['creative','relaxing'], minutes: 20, company: 'solo', location: 'indoors' }
const activities = [1,2,3].map(i=>({ title: `Activity ${i}`, minutes: 10, description: 'Use paper to draw.', firstStep: 'Find paper.', interest: 'creative', company: 'solo', location: 'indoors' }))
test('validates strict preference allowlist; no extra screenshots or identity data', () => {
  assert.deepEqual(validatePreferences(prefs),prefs)
  for (const value of [{...prefs,interests:[]},{...prefs,minutes:15},{...prefs,company:'any'},{...prefs,location:'any'},{...prefs,interests:['creative','creative']},{...prefs,image:'secret'}, {...prefs,memberId:'private'}]) assert.throws(()=>validatePreferences(value), {status:400})
})
test('structured AI output must have three distinct bounded matching activities', () => {
  assert.equal(validateActivities({activities},prefs).length,3)
  for (const invalid of [activities.slice(0,2),[activities[0],activities[0],activities[2]],activities.map(a=>({...a,minutes:30})),activities.map(a=>({...a,location:'outdoors'})),activities.map(a=>({...a,firstStep:''}))]) assert.throws(()=>validateActivities({activities:invalid},prefs))
})
test('uses configured private backend AI client and sends only preferences plus fixed instructions', async () => {
  const env={ OPENROUTER_API_KEY:'private-test-key', OPENROUTER_MODEL:'openai/gpt-4o-mini' }
  const result=await suggestActivities(prefs,{env,fetchImpl:async(url,request)=>{
    assert.equal(url,'https://openrouter.ai/api/v1/chat/completions')
    const body=JSON.parse(request.body)
    assert.deepEqual(JSON.parse(body.messages[1].content.slice(body.messages[1].content.indexOf('{'))),prefs)
    assert.equal(body.response_format.type,'json_object')
    assert.ok(body.messages[0].content.includes('json'))
    assert.ok(body.messages[1].content.includes('json'))
    assert.equal(body.model,env.OPENROUTER_MODEL)
    assert.ok(!JSON.stringify(body).includes(env.OPENROUTER_API_KEY))
    return { ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({activities})}}]}) }
  }})
  assert.deepEqual(result,activities)
  await assert.rejects(suggestActivities(prefs,{env,fetchImpl:async()=>({ok:true,json:async()=>({choices:[{message:{content:'{}'}}]})})}),{status:502})
})
test('endpoint blocks parallel requests and rate limits attempts with retry header', async () => {
  const express=require('express');const app=express();app.use(express.json())
  let release, started
  const running=new Promise(resolve=>{started=resolve})
  let calls=0
  app.use(createActivityRouter({suggest:async()=>{calls++;if(calls===1){started();await new Promise(resolve=>{release=resolve})} return activities}}))
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.on('listening',resolve))
  const url=`http://127.0.0.1:${server.address().port}`
  const post=(body=prefs)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
  try {
    assert.equal((await post({...prefs,extra:'bad'})).status,400)
    const first=post();await running
    const duplicate=await post();assert.equal(duplicate.status,429);assert.ok(duplicate.headers.get('retry-after'))
    release();assert.equal((await first).status,200)
    for(let i=0;i<4;i++)assert.equal((await post()).status,200)
    assert.equal((await post()).status,429);assert.equal(calls,5)
  }finally{release?.();await new Promise(resolve=>server.close(resolve))}
})
test('built-in suggestions cover preference combinations and storage is member/group scoped', async()=>{
  const { builtInActivities, storageKey, validSaved }=await import('../client-vue/src/activity-utils.mjs')
  for(const interest of ['outdoors','fitness','creative','relaxing','social'])for(const company of ['solo','friends'])for(const location of ['indoors','outdoors'])for(const minutes of [10,20,30,60]){
    const prefs={interests:[interest],company,location,minutes}
    const result=builtInActivities(prefs)
    assert.equal(validateActivities({activities:result},prefs).length,3)
    assert.ok(validSaved({version:1,source:'built-in',activities:result}))
  }
  assert.notEqual(storageKey('g','a'),storageKey('g','b'));assert.notEqual(storageKey('g','a'),storageKey('h','a'))
  assert.equal(validSaved({version:1,source:'ai',activities:[]}),false)
})

test('provider failure returns sanitized error and releases in-flight lock for retry', async () => {
  const express=require('express');const app=express();app.use(express.json())
  let calls=0
  app.use(createActivityRouter({suggest:async()=>{calls++;if(calls===1)throw Object.assign(new Error('AI provider HTTP 429: Provider rate limit or quota exceeded.'),{status:502});return activities}}))
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.on('listening',resolve))
  const post=()=>fetch(`http://127.0.0.1:${server.address().port}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(prefs)})
  try {
    const failed=await post();assert.equal(failed.status,502);assert.match((await failed.json()).message,/429/)
    assert.equal((await post()).status,200)
  }finally{await new Promise(resolve=>server.close(resolve))}
})
