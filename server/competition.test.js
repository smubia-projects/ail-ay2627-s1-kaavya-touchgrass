const {test}=require('node:test')
const assert=require('node:assert/strict')
const {nextMonday,competitionStart,recordScope}=require('./competition')
const {buildLeaderboard}=require('./leaderboard')
test('strictly following Monday uses Singapore date across Sunday midnight and year boundaries',()=>{
 assert.equal(nextMonday(new Date('2026-10-18T15:59:59Z')),'2026-10-19')
 assert.equal(nextMonday(new Date('2026-10-18T16:00:00Z')),'2026-10-26')
 assert.equal(nextMonday(new Date('2026-10-14T02:00:00Z')),'2026-10-19')
 assert.equal(nextMonday(new Date('2026-12-31T17:00:00Z')),'2027-01-04')
})
function group(){return {competitionStartDate:'2026-10-12',forfeit:'Snacks',members:[{_id:'a',name:'A',userId:'ua',competitionStartDate:'2026-10-12'},{_id:'b',name:'B',userId:'ub',competitionStartDate:'2026-10-19'}]}}
function entry(member,date,minutes=10,type='official'){return {memberId:member._id,userId:member.userId,date,socialMediaMinutes:minutes,status:'completed',usedAnalysisIds:['receipt'],competitionType:type}}
test('midweek newcomer is practice without delaying established member rankings',()=>{
 const g=group(),records=g.members.flatMap(member=>['2026-10-12','2026-10-13'].map(date=>entry(member,date,10,member._id==='b'?'practice':'official')))
 const board=buildLeaderboard(g,records,{now:new Date('2026-10-14T03:00:00Z')})
 const a=board.members.find(m=>m.memberId==='a'),b=board.members.find(m=>m.memberId==='b')
 assert.equal(a.rank,1);assert.equal(a.totalMinutes,20)
 assert.equal(b.rank,null);assert.equal(b.rankingStatus,'practice');assert.equal(b.totalMinutes,null);assert.equal(b.practiceTotalMinutes,20);assert.deepEqual(b.missingDays,[])
 assert.equal(g.competitionStartDate,'2026-10-12');assert.equal(g.members[0].competitionStartDate,'2026-10-12')
})
test('Sunday submitted Monday stays practice, and practice never auto-promotes',()=>{
 const g=group(),member=g.members[1],record=entry(member,'2026-10-18',90,'practice')
 assert.equal(recordScope(g,member,record),'practice')
 const previous=buildLeaderboard(g,[record],{now:new Date('2026-10-18T16:01:00Z'),week:'previous'})
 assert.equal(previous.members.find(m=>m.memberId==='b').rank,null)
 assert.equal(previous.members.find(m=>m.memberId==='b').practiceTotalMinutes,90)
 const monday=entry(member,'2026-10-19',0)
 const active=buildLeaderboard(g,[record,monday],{now:new Date('2026-10-20T02:00:00Z')})
 assert.equal(active.members.find(m=>m.memberId==='b').totalMinutes,0)
 assert.equal(active.members.find(m=>m.memberId==='b').rank,1)
 assert.equal(recordScope(g,member,{...monday,competitionType:'practice'}),'practice')
})
test('legacy dates are unknown and records stay visible without invented historical eligibility',()=>{
 const g={members:[{_id:'old',name:'Old'}],forfeit:'Snacks'}
 const record=entry({_id:'old'},'2026-10-13',155);delete record.competitionType
 assert.equal(competitionStart(g,g.members[0]),null)
 const board=buildLeaderboard(g,[record],{now:new Date('2026-10-14T02:00:00Z')})
 assert.equal(board.members[0].rankingStatus,'unknown-eligibility');assert.equal(board.members[0].rank,null)
 assert.equal(board.members[0].historicalTotalMinutes,155);assert.equal(board.members[0].totalMinutes,null)
 const known=group();assert.equal(recordScope(known,known.members[0],{...entry(known.members[0],'2026-10-13'),competitionType:undefined}),'historical')
})
test('backend requires both group and member eligibility; forged official practice dates cannot rank',()=>{
 const g=group();g.competitionStartDate='2026-10-19'
 assert.equal(competitionStart(g,g.members[0]),'2026-10-19')
 const forged=entry(g.members[0],'2026-10-13',1,'official')
 assert.equal(recordScope(g,g.members[0],forged),'practice')
 assert.equal(buildLeaderboard(g,[forged],{now:new Date('2026-10-14T03:00:00Z')}).members[0].rank,null)
})
