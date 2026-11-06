const { singaporeDate, validDate, weekDays } = require('./check-in-dates')
function nextMonday(now = new Date()) {
  const day = new Date(singaporeDate(now) + 'T00:00:00Z')
  const offset = (8 - day.getUTCDay()) % 7 || 7
  day.setUTCDate(day.getUTCDate() + offset)
  return day.toISOString().slice(0,10)
}
function isMonday(date) { return validDate(date) && weekDays(date)[0] === date }
function competitionStart(group, member) {
  if (!member?.userId || !isMonday(group?.competitionStartDate) || !isMonday(member.competitionStartDate)) return null
  return group.competitionStartDate > member.competitionStartDate ? group.competitionStartDate : member.competitionStartDate
}
function recordScope(group, member, entry) {
  const start = competitionStart(group,member)
  if (!entry || !start || !['practice','official'].includes(entry.competitionType)) return 'historical'
  if (entry.competitionType === 'practice' || entry.date < start) return 'practice'
  return String(entry.userId) === String(member.userId) ? 'official' : 'historical'
}
module.exports = { nextMonday, isMonday, competitionStart, recordScope }
