export function localDate(timeZone='Asia/Kolkata',now=new Date()) {
  const values=Object.fromEntries(new Intl.DateTimeFormat('en',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
