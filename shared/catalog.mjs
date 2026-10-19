export const CURRENCIES = ['PHP','INR','USD','IDR','KHR','VND','THB','MYR','SGD','HKD','CNY','BDT','NPR','LKR','JPY','KRW','EUR','GBP','AUD'];
export const LANGUAGES = [
  {code:'en',name:'English',locale:'en'}, {code:'fil',name:'Filipino',locale:'fil'},
  {code:'hi',name:'हिन्दी',locale:'hi'}, {code:'bn',name:'বাংলা',locale:'bn'},
  {code:'id',name:'Bahasa Indonesia',locale:'id'}, {code:'vi',name:'Tiếng Việt',locale:'vi'},
  {code:'th',name:'ไทย',locale:'th'}, {code:'zh-Hant',name:'繁體中文',locale:'zh-Hant'}
];
export function currencyDigits(currency) {
  if(!CURRENCIES.includes(currency))throw new Error('Unsupported currency');
  return new Intl.NumberFormat('en',{style:'currency',currency}).resolvedOptions().maximumFractionDigits;
}
export function validMoney(value,currency) {
  if(!CURRENCIES.includes(currency)||typeof value!=='number'||!Number.isFinite(value)||value<0||value>100000000)return false;
  const units=value*10**currencyDigits(currency);return Math.abs(units-Math.round(units))<0.00001;
}
export function formatMoney(value,currency,locale='en') {
  const digits=currencyDigits(currency);
  return new Intl.NumberFormat(locale,{style:'currency',currency,currencyDisplay:'code',minimumFractionDigits:Number.isInteger(value)?0:digits,maximumFractionDigits:digits}).format(value);
}
export function totalsByCurrency(records,valueKey,fallback='PHP') {
  const totals={};for(const record of records){const currency=record.currency||fallback;totals[currency]=(totals[currency]||0)+Math.round((record[valueKey]||0)*100);}
  return Object.fromEntries(Object.entries(totals).map(([currency,value])=>[currency,value/100]));
}
export function attendanceByDate(records) {
  const byDate=new Map();
  for(const record of records){if(!byDate.has(record.date))byDate.set(record.date,[]);byDate.get(record.date).push(record.attendance);}
  return [...byDate].map(([date,values])=>{const statuses=[...new Set(values.filter(v=>v!=='not-recorded'))];return {date,attendance:statuses.includes('present')?'present':statuses[0]||'not-recorded',conflict:statuses.length>1};});
}
