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
  const env={ OPENROUTER_API_KEY:'private-test-key', OPENROUTER_MODEL:'gemini-3.5-flash-lite' }
  const result=await suggestActivities(prefs,{env,fetchImpl:async(url,request)=>{
    assert.equal(url,'https://api.apiyi.com/v1/chat/completions')
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
test('endpoint validates before the shared rate limiter, and a 429 from the limiter stops the AI call', async () => {
  const express=require('express');const app=express();app.use(express.json())
  let limited=0, calls=0, block=false
  const limit=(req,res,next)=>{limited++;if(block)return res.status(429).json({message:'Rate limit exceeded.',queries_used:5});next()}
  app.use(createActivityRouter({limit,suggest:async()=>{calls++;return activities}}))
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.on('listening',resolve))
  const post=(body=prefs)=>fetch(`http://127.0.0.1:${server.address().port}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
  try {
    assert.equal((await post({...prefs,extra:'bad'})).status,400);assert.equal(limited,0)
    assert.equal((await post()).status,200);assert.equal(limited,1);assert.equal(calls,1)
    block=true
    const response=await post();assert.equal(response.status,429);assert.equal((await response.json()).queries_used,5);assert.equal(calls,1)
  }finally{await new Promise(resolve=>server.close(resolve))}
})
test('missing OpenRouter key answers 500 before the limiter, never 503', async () => {
  const express=require('express');const app=express();app.use(express.json())
  let limited=0
  app.use(createActivityRouter({env:{},limit:(req,res,next)=>{limited++;next()}}))
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.on('listening',resolve))
  try {
    const response=await fetch(`http://127.0.0.1:${server.address().port}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(prefs)})
    assert.equal(response.status,500);assert.equal(limited,0)
  }finally{await new Promise(resolve=>server.close(resolve))}
})
test('built-in suggestions cover preference combinations and storage uses the project slug', async()=>{
  const { builtInActivities, storageKey, validSaved }=await import('../client-vue/src/activity-utils.mjs')
  for(const interest of ['outdoors','fitness','creative','relaxing','social'])for(const company of ['solo','friends'])for(const location of ['indoors','outdoors'])for(const minutes of [10,20,30,60]){
    const prefs={interests:[interest],company,location,minutes}
    const result=builtInActivities(prefs)
    assert.equal(validateActivities({activities:result},prefs).length,3)
    assert.ok(validSaved({version:1,source:'built-in',activities:result}))
  }
  assert.equal(storageKey,'ail-ay2627-s1-kaavya-touchgrass:activities')
  assert.equal(validSaved({version:1,source:'ai',activities:[]}),false)
})

test('provider failure returns a sanitized error and a retry can succeed', async () => {
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
