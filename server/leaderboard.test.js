const { test } = require('node:test')
const assert = require('node:assert/strict')
const { buildLeaderboard } = require('./leaderboard')
const group = { _id: 'g', competitionStartDate: '2026-10-05', forfeit: 'Buy bubble tea', members: ['a','b','c','d'].map(_id => ({ _id, name: _id.toUpperCase(), userId: _id, competitionStartDate: '2026-10-05' })) }
function entry(memberId, date, minutes, status = 'completed', backed = true) {
  return { memberId, userId: memberId, competitionType: 'official', date, socialMediaMinutes: minutes, status, usedAnalysisIds: backed ? ['receipt'] : [] }
}
const monday = new Date('2026-10-18T16:01:00Z')
const dates = ['2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-17','2026-10-18']
const full = (id, minutes) => dates.map(date => entry(id, date, minutes))

test('Singapore Monday boundary selects correct current and previous Monday-Sunday', () => {
  const current = buildLeaderboard(group, [], { now: monday })
  assert.equal(current.startDate, '2026-10-19'); assert.equal(current.endDate, '2026-10-25')
  assert.equal(current.requiredDates.length, 0)
  assert.ok(current.members.every(m => m.rank === null && m.noCheckIns && m.totalMinutes === null))
  const previous = buildLeaderboard(group, [], { now: monday, week: 'previous' })
  assert.equal(previous.startDate, dates[0]); assert.equal(previous.endDate, dates[6]); assert.equal(previous.isFinal, true)
})
test('weekly totals, explicit zero, missing days, no records and unrelated records', () => {
  const board = buildLeaderboard(group, [...full('a', 10), ...full('b', 0), entry('c', dates[0], 2), entry('a','2026-10-11',999)], { now: monday, week: 'previous' })
  assert.equal(board.members.find(m=>m.memberId==='a').totalMinutes, 70)
  const zero = board.members.find(m=>m.memberId==='b'); assert.equal(zero.totalMinutes,0); assert.equal(zero.rank,1); assert.equal(zero.outcome,'Winner')
  const partial = board.members.find(m=>m.memberId==='c'); assert.equal(partial.rank,null); assert.equal(partial.missingDays.length,6); assert.equal(partial.totalMinutes,2)
  const none = board.members.find(m=>m.memberId==='d'); assert.equal(none.noCheckIns,true); assert.equal(none.totalMinutes,null); assert.equal(none.missingDays.length,7)
  assert.equal(board.loserMemberId,'a'); assert.equal(board.forfeit,group.forfeit)
})
test('provisional, legacy and non-screenshot completed records never qualify or auto-promote', () => {
  const records = [...full('a',10).slice(0,6), entry('a',dates[6],90,'provisional'), ...full('b',4).slice(0,6), entry('b',dates[6],3,'completed',false), entry('c',dates[0],50,'accepted')]
  const board = buildLeaderboard(group, records, { now: monday, week: 'previous' })
  assert.ok(board.members.every(m=>m.rank===null)); assert.equal(board.loserMemberId,null)
  const a=board.members.find(m=>m.memberId==='a'); assert.equal(a.totalMinutes,60); assert.equal(a.days[6].status,'provisional'); assert.deepEqual(a.missingDays,[dates[6]])
})
test('in-week comparisons require all elapsed days and exclude today provisional', () => {
  const now = new Date('2026-10-14T03:00:00Z')
  const records = [entry('a',dates[0],10),entry('a',dates[1],20),entry('a',dates[2],500,'provisional'),entry('b',dates[0],1)]
  const board=buildLeaderboard(group,records,{now})
  assert.equal(board.isFinal,false); assert.equal(board.label,'Provisional standings')
  const a=board.members.find(m=>m.memberId==='a'); assert.equal(a.rank,1); assert.equal(a.totalMinutes,30); assert.equal(a.todayProvisionalMinutes,500); assert.equal(a.outcome,null)
  assert.equal(board.members.find(m=>m.memberId==='b').rank,null)
  assert.equal(board.loserMemberId,null)
})
test('ties share competition ranks; tied highest usage has no single loser', () => {
  const board=buildLeaderboard(group,[...full('a',1),...full('b',5),...full('c',5)],{now:monday,week:'previous'})
  assert.deepEqual(board.members.slice(0,3).map(m=>m.rank),[1,2,2]); assert.equal(board.loserMemberId,null)
  assert.equal(board.members.find(m=>m.memberId==='b').outcome,'Tied highest usage')
  const all=buildLeaderboard(group,[...full('a',0),...full('b',0)],{now:monday,week:'previous'})
  assert.equal(all.loserMemberId,null); assert.ok(all.members.filter(m=>m.eligible).every(m=>m.outcome==='Joint winner'))
})
test('Sunday completion submitted Monday changes previous week only; sole eligible member has no loser', () => {
  const records=full('a',10).slice(0,6)
  assert.equal(buildLeaderboard(group,records,{now:monday,week:'previous'}).members[0].rank,null)
  records.push(entry('a',dates[6],20))
  const previous=buildLeaderboard(group,records,{now:monday,week:'previous'})
  assert.equal(previous.members[0].totalMinutes,80); assert.equal(previous.members[0].rank,1); assert.equal(previous.loserMemberId,null)
  assert.equal(buildLeaderboard(group,records,{now:monday}).members[0].totalMinutes,null)
})
