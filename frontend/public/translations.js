// English | Filipino — Philippines-focused interface
// Fixed interface translations only. Field notes and member data are never sent for translation.
const rows=`
Group meetings|Mga pulong ng grupo
Quick actions|Mabilis na aksyon
Records & permissions|Mga tala at pahintulot
Clear search|Burahin ang paghahanap
Member details|Detalye ng miyembro
Household budget|Badyet ng sambahayan
Identity details|Detalye ng pagkakakilanlan
Visit details|Detalye ng pagbisita
Collections|Mga koleksyon
Observations|Mga obserbasyon
Member & currency|Miyembro at pera
Repayment plan|Plano ng pagbabayad
Review the details before saving. Fields marked * are required.|Suriin ang detalye bago i-save. Kailangan ang mga may *.
Overview|Pangkalahatan
Field operations|Gawain sa komunidad
Member records, collections, and what needs your team’s attention.|Mga tala, koleksyon, at mga kailangang tutukan ng pangkat.
Total recorded to date|Kabuuang naitala hanggang ngayon
Repayments + savings in this period|Mga bayad at ipon sa panahong ito
Scheduled group visits|Nakatakdang pagbisita sa mga grupo
Attendance and payment observations|Mga tala ng pagdalo at pagbabayad
No dues recorded|Walang nakatalang dapat bayaran
Record an approved loan|Magtala ng aprubadong pautang
Attendance, collections, and observations from this visit.|Pagdalo, koleksyon, at obserbasyon sa pagbisitang ito.
Members|Mga miyembro
Groups|Mga grupo
Field visits|Mga pagbisita
Loan register|Talaan ng pautang
Consent & sharing|Pahintulot at pagbabahagi
Organization|Organisasyon
Follow-up cases|Mga follow-up
Offline records|Mga offline na tala
Staff accounts|Mga kawani
Workspace|Workspace
Language|Wika
Reporting currency|Salapi sa ulat
Currency|Salapi
Default currency|Karaniwang salapi
Household currency|Salapi ng sambahayan
Loan currency|Salapi ng pautang
Collection currency|Salapi ng koleksyon
Record a visit|Magtala ng pagbisita
Record visit|Magtala ng pagbisita
Add member|Magdagdag ng miyembro
Add a member|Magdagdag ng miyembro
Create group|Gumawa ng grupo
Create a group|Gumawa ng grupo
Record a loan|Magtala ng pautang
Record loan|Magtala ng pautang
Record a field visit|Magtala ng pagbisita
Group meeting|Pulong ng grupo
Save meeting|I-save ang pulong
Meeting date|Petsa ng pulong
Cancel|Kanselahin
Close|Isara
Save record|I-save ang tala
Save visit|I-save ang pagbisita
Save preferences|I-save ang mga setting
Save configuration|I-save ang pagsasaayos
Connected|Konektado
Offline|Walang koneksyon
Sign in|Mag-sign in
Sign out|Mag-sign out
Username|Username
Password|Password
Member|Miyembro
Group|Grupo
Date|Petsa
Due date|Takdang petsa
Status|Katayuan
Attendance|Pagdalo
Present|Dumalo
Absent|Hindi dumalo
Excused absence|May pahintulot na lumiban
Not recorded|Hindi naitala
Savings|Ipon
Repayments|Mga pagbabayad
Notes|Mga tala
Assigned to|Nakatakdang kawani
Open|Bukas
Resolved|Nalutas
Receipt|Resibo
Collection receipt|Resibo ng koleksyon
Print receipt|I-print ang resibo
Schedule|Iskedyul
Repayment schedule|Iskedyul ng pagbabayad
Correct|Iwasto
History|Kasaysayan
Correction history|Kasaysayan ng pagwawasto
Save correction|I-save ang pagwawasto
Full name|Buong pangalan
Community group|Grupo sa komunidad
Livelihood / business|Kabuhayan / negosyo
Monthly household income|Buwanang kita ng sambahayan
Monthly household expenses|Buwanang gastos ng sambahayan
Household members|Mga kasapi ng sambahayan
Income earners|Mga kumikita
Identity document type|Uri ng dokumento
ID last four digits only|Huling apat na numero ng ID
Visit date|Petsa ng pagbisita
Loan being repaid|Pautang na binabayaran
Principal repayment received|Natanggap na bayad sa prinsipal
Savings contributed|Inihulog na ipon
Loan utilisation check|Pagsuri sa paggamit ng pautang
Group name|Pangalan ng grupo
Village / location|Barangay / lugar
Field officer|Kawani sa komunidad
Next meeting|Susunod na pulong
Loan purpose|Layunin ng pautang
Principal amount|Halaga ng prinsipal
Installment amount|Halaga ng hulog
Repayment frequency|Dalas ng pagbabayad
Loan start date|Petsa ng simula ng pautang
Organization name|Pangalan ng organisasyon
Country|Bansa
Community groups|Mga grupo sa komunidad
Member register|Talaan ng miyembro
Upcoming meetings|Mga susunod na pulong
Member records|Mga tala ng miyembro
Outstanding principal|Natitirang prinsipal
Savings contributions|Mga hulog na ipon
Full scheduled payments|Mga buong bayad
Full payments|Mga buong bayad
Follow-up|Follow-up
Collections by visit date|Koleksyon ayon sa petsa
Create follow-up|Gumawa ng follow-up
Create case|Gumawa ng kaso
Open case|Buksan ang kaso
Update case|I-update ang kaso
Case title|Pamagat ng kaso
Unlock records|Buksan ang mga tala
Lock records|I-lock ang mga tala
Sync now|I-sync ngayon
Import CSV|Mag-import ng CSV
Preview CSV|Silipin ang CSV
Import members|I-import ang mga miyembro
Download backup|I-download ang backup
Configure forms & language|Ayusin ang form at wika
Forms & language|Mga form at wika
Time zone|Sona ng oras
Add question|Magdagdag ng tanong
Remove|Alisin
Required|Kailangan
Paid|Nabayaran
Balance|Balanse
Remaining|Natitira
Total received|Kabuuang natanggap
Principal repayment|Bayad sa prinsipal
Savings contribution|Hulog na ipon
Search by name or member ID…|Hanapin sa pangalan o ID…
All members|Lahat ng miyembro
Weekly|Lingguhan
Fortnightly|Kada dalawang linggo
Monthly|Buwanan
No loan payment|Walang bayad sa pautang
No payment|Walang bayad
Principal|Prinsipal
Installment|Hulog
Partial|Bahagya
Overdue|Lampas sa takdang petsa
Upcoming|Paparating
Active|Aktibo
Disabled|Hindi aktibo
Verified|Napatunayan
Income|Kita
Expenses|Gastos
Contributions|Mga hulog
Needs review|Kailangang suriin
Up to date|Napapanahon
View schedule|Tingnan ang iskedyul
Open follow-up list|Buksan ang listahan ng follow-up
`;
export const dictionaries={en:{},fil:{}};
for(const line of rows.trim().split('\n')) {
  const cells=line.split('|');if(cells.length!==2)throw new Error('Invalid translation row: '+cells[0]);
  for(const [index,code] of ['en','fil'].entries())dictionaries[code][cells[0]]=cells[index];
}

// Philippines household-support workflow. English remains the source/fallback.
Object.assign(dictionaries.fil,{
  'Household support':'Suporta sa sambahayan','Financial health':'Kalusugang pinansyal',
  'Outcomes':'Mga pagbabago','Support directory':'Talaan ng suporta','Available support':'Magagamit na suporta',
  'Household check-in':'Kumustahan ng sambahayan','Create support plan':'Gumawa ng plano ng suporta',
  'Start with a conversation':'Magsimula sa pag-uusap',
  'Check-ins cover the previous 30 days. Answers are voluntary and are never used for loan eligibility.':'Saklaw ang nakaraang 30 araw. Kusang-loob ang pagsagot at hindi ito ginagamit sa pagpapasya sa pautang.',
  'Understand recurring shortfalls, agree on support, and return to check what changed.':'Unawain ang paulit-ulit na kakulangan, magkasundo sa suporta, at balikan ang naging pagbabago.',
  'Search households':'Maghanap ng sambahayan','All groups':'Lahat ng grupo','Household':'Sambahayan',
  'Latest check-in':'Huling kumustahan','Essential-spending shortfalls':'Kakulangan sa pangunahing gastusin',
  'Open support':'Aktibong suporta','Not yet checked':'Wala pang kumustahan','Unknown':'Hindi alam',
  'Check in':'Kumustahin','Support plans':'Mga plano ng suporta','Delivery':'Paghahatid ng suporta',
  'Delivery and household outcomes are tracked separately.':'Magkahiwalay na sinusubaybayan ang naihatid na suporta at pagbabago sa sambahayan.',
  'Household / agreed action':'Sambahayan / napagkasunduang hakbang','Owner / next action':'Kawani / susunod na hakbang',
  'Case':'Kaso','Open plan':'Buksan ang plano','Action overdue':'Lampas sa takdang araw',
  'Check-in details':'Detalye ng kumustahan','Check-in date':'Petsa ng kumustahan','Response status':'Katayuan ng sagot',
  'Answered':'Sumagot','Prefer not to answer':'Mas gustong hindi sumagot','Household unavailable':'Hindi nakausap ang sambahayan',
  'Previous 30 days':'Nakaraang 30 araw','Days unable to afford essentials':'Mga araw na hindi kayang tustusan ang pangunahing pangangailangan',
  'Financial stress (0 = none; 4 = very high)':'Pag-aalala sa pera (0 = wala; 4 = napakataas)',
  'Which essentials could not be covered?':'Aling pangunahing pangangailangan ang hindi natustusan?',
  'Food':'Pagkain','Housing':'Tirahan','Utilities':'Tubig at kuryente','Healthcare':'Pangangalagang pangkalusugan',
  'Education':'Edukasyon','Transport':'Pamasahe','Other':'Iba pa',
  'Household-reported contributing circumstances':'Mga sitwasyong iniulat ng sambahayan',
  'Delayed income':'Naantalang kita','Lower income':'Bumabang kita','Higher expenses':'Tumaas na gastusin',
  'Debt payments':'Pagbabayad ng utang','Seasonal income':'Pana-panahong kita',
  'Household explanation':'Paliwanag ng sambahayan','Officer observations':'Obserbasyon ng kawani',
  'Officer notes':'Tala ng kawani','Optional household budget':'Opsyonal na badyet ng sambahayan',
  'Income received in the previous 30 days':'Kitang natanggap sa nakaraang 30 araw',
  'Total spending in the previous 30 days':'Kabuuang ginastos sa nakaraang 30 araw',
  'Borrowed for essentials or existing debt?':'Nangutang para sa pangunahing pangangailangan o dating utang?',
  'Would the household like support?':'Nais ba ng sambahayan ng suporta?',
  'Support requested':'Humiling ng suporta','No support requested':'Hindi humiling ng suporta','Undecided':'Hindi pa napagpapasyahan',
  'Save check-in':'I-save ang kumustahan','Outcome check-in':'Kumustahan sa naging pagbabago',
  'Did this support help?':'Nakatulong ba ang suportang ito?','Helped':'Nakatulong','Partly helped':'Bahagyang nakatulong','Did not help':'Hindi nakatulong',
  'yes':'Oo','no':'Hindi','Unknown / prefer not to answer':'Hindi alam / mas gustong hindi sumagot',
  'Ask privately. Members may skip questions or decline the entire check-in.':'Magtanong nang pribado. Maaaring laktawan ang tanong o tanggihan ang buong kumustahan.',
  'The household freely agreed to answer. Skipping questions does not affect access to services or loans.':'Kusang-loob na sumang-ayon ang sambahayan. Hindi naaapektuhan ng hindi pagsagot ang serbisyo o pautang.',
  'Record their explanation, not a diagnosis. Avoid sensitive identity or medical details.':'Itala ang kanilang paliwanag. Iwasan ang sensitibong detalye ng pagkakakilanlan o kalusugan.',
  'Separate observations from household answers. Optional.':'Ihiwalay ang obserbasyon sa sagot ng sambahayan. Opsyonal.',
  'Baseline check-in':'Panimulang kumustahan','Service or referral':'Serbisyo o pagsangguni','Other agreed support':'Ibang napagkasunduang suporta',
  'Agreed action':'Napagkasunduang hakbang','Plan start date':'Petsa ng simula ng plano','Next action due':'Takdang araw ng susunod na hakbang',
  'Plan notes':'Mga tala ng plano','Support plan':'Plano ng suporta','Support delivery':'Paghahatid ng suporta',
  'Delivery status':'Katayuan ng paghahatid','Case status':'Katayuan ng kaso','Suggested':'Iminungkahi','Received':'Natanggap',
  'Not received':'Hindi natanggap','Cancelled':'Kinansela','In progress':'Isinasagawa','Closed':'Isinara',
  'Date requested (optional)':'Petsa ng paghiling (opsyonal)','Date received (if received)':'Petsa ng pagtanggap (kung natanggap)',
  'Support ended (optional)':'Pagtatapos ng suporta (opsyonal)','Delivery notes / reason not received':'Tala / dahilan kung bakit hindi natanggap',
  'Closure reason / resolution':'Dahilan ng pagsasara / kinalabasan','Save support update':'I-save ang pagbabago sa suporta',
  'Outcome check-ins':'Mga kumustahan sa pagbabago','No updates yet.':'Wala pang pagbabago.',
  'Household timeline':'Kasaysayan ng sambahayan','Household history':'Kasaysayan ng sambahayan',
  'Household financial health':'Kalusugang pinansyal ng sambahayan','No household check-in recorded yet.':'Wala pang naitalang kumustahan.',
  'Support history':'Kasaysayan ng suporta','Income / spending':'Kita / ginastos','Stress / borrowing':'Pag-aalala / pangungutang',
  'Support preference':'Kagustuhan sa suporta','Support feedback':'Puna sa suporta','Void incorrect report':'Pawalang-bisa ang maling ulat',
  'Add support service':'Magdagdag ng serbisyo','Edit support service':'Baguhin ang serbisyo','Service name':'Pangalan ng serbisyo',
  'Provider / organization':'Tagapagbigay / organisasyon','Service type':'Uri ng serbisyo','Availability':'Pagkakaroon ng serbisyo',
  'Available':'Mayroon','Unavailable':'Wala sa ngayon','What support is available?':'Anong suporta ang magagamit?',
  'Access requirements / referral instructions':'Mga kailangan / paraan ng pagsangguni','Save service':'I-save ang serbisyo','Edit service':'Baguhin ang serbisyo',
  'List services your NGO can actually provide or refer households to.':'Ilista ang tunay na maibibigay na serbisyo o mapagsasangguniang organisasyon.',
  'Programme learning':'Pagkatuto ng programa','Export summary CSV':'I-download ang buod na CSV',
  'Baseline from':'Simula ng panimulang panahon','Baseline to':'Dulo ng panimulang panahon','As of':'Hanggang sa','Apply filters':'Ilapat ang pagpili',
  'Households checked':'Mga sambahayang nakumusta','Support received':'Natanggap na suporta','Median time to support':'Gitnang tagal bago matanggap ang suporta',
  'Actions overdue':'Mga hakbang na lampas sa takdang araw','Shortfall days: baseline':'Araw ng kakulangan: panimula',
  'Shortfall days: follow-up':'Araw ng kakulangan: kasunod','Average among matched households only':'Karaniwan sa mga sambahayang may magkatugmang sagot lamang',
  'Days out of the previous 30':'Bilang ng araw sa nakaraang 30','Fewer / same / more days':'Mas kaunti / pareho / mas marami',
  'Households with matched answers':'Mga sambahayang may magkatugmang sagot','Unmatched responses':'Mga sagot na walang katugma',
  'Follow-up due':'Takdang araw ng kumustahan','Baseline days':'Araw sa panimula','Follow-up days':'Araw sa kasunod',
  'Cash-flow planner':'Plano ng daloy ng pera','Add expected entry':'Magdagdag ng inaasahang kita o gastos',
  'Opening available money':'Magagamit na pera sa simula','From date':'Mula sa petsa','To date':'Hanggang sa petsa',
  'Show expected gaps':'Ipakita ang inaasahang kakulangan','Expected entries':'Mga inaasahang kita at gastos',
  'Entry':'Tala','Amount':'Halaga','Cancel entry':'Kanselahin ang tala','Add expected cash flow':'Magdagdag ng inaasahang daloy ng pera',
  'Label / purpose':'Pangalan / layunin','Entry type':'Uri ng tala','Expected date':'Inaasahang petsa','Expected amount':'Inaasahang halaga',
  'Planning notes':'Tala sa pagpaplano','Save expected entry':'I-save ang inaasahang tala','Expected income':'Inaasahang kita',
  'Expected expenses':'Inaasahang gastos','Available after entries':'Matitirang pera pagkatapos ng mga tala',
  'Barangay / location':'Barangay / lugar','Reason':'Dahilan','Void report':'Pawalang-bisa ang ulat'
});

Object.assign(dictionaries.fil,{
  'Reporting member':'Kinatawan ng sambahayan','Reporting members':'Mga kinatawan ng sambahayan',
  'Household link':'Ugnayan ng sambahayan','Reporting household':'Sambahayan para sa pag-uulat',
  'Share a reporting household with':'Kaparehong sambahayan ni','Separate household':'Hiwalay na sambahayan',
  'Save household link':'I-save ang ugnayan','Support view':'Uri ng suporta',
  'Supervisors can link members who report for the same household. Linked households count once in outcomes.':'Maaaring iugnay ng superbisor ang mga miyembrong nasa iisang sambahayan. Isang beses lamang silang bibilangin sa mga pagbabago.'
});

Object.assign(dictionaries.fil,{
  'Households with check-in records':'Mga sambahayang may naitalang kumustahan',
  'Count each day once, even if several essentials were affected.':'Bilangin ang bawat araw nang isang beses kahit maraming pangangailangan ang naapektuhan.',
  'Observe household changes alongside support delivery. These comparisons do not establish causation.':'Tingnan ang pagbabago sa sambahayan kasabay ng suporta. Hindi pinatutunayan ng paghahambing na ito ang sanhi ng pagbabago.',
  'No records yet.':'Wala pang mga tala.', 'No household check-ins yet. Begin with a voluntary conversation.':'Wala pang kumustahan. Magsimula sa kusang-loob na pag-uusap.'
});

Object.assign(dictionaries.fil,{'Community':'Komunidad','Lending & sharing':'Pautang at pagbabahagi'});
