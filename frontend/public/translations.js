// English | Filipino | Hindi | Bengali | Indonesian | Vietnamese | Thai | Traditional Chinese
// Fixed interface translations only. Field notes and member data are never sent for translation.
const rows=`
Group meetings|Mga pulong ng grupo|समूह बैठकें|দলীয় সভা|Pertemuan kelompok|Họp nhóm|การประชุมกลุ่ม|小組會議
Quick actions|Mabilis na aksyon|त्वरित कार्य|দ্রুত কাজ|Tindakan cepat|Thao tác nhanh|การดำเนินการด่วน|快捷操作
Records & permissions|Mga tala at pahintulot|रिकॉर्ड और अनुमतियाँ|নথি ও অনুমতি|Catatan & izin|Hồ sơ và quyền|บันทึกและสิทธิ์|記錄與權限
Clear search|Burahin ang paghahanap|खोज साफ़ करें|অনুসন্ধান মুছুন|Hapus pencarian|Xóa tìm kiếm|ล้างการค้นหา|清除搜尋
Member details|Detalye ng miyembro|सदस्य विवरण|সদস্যের তথ্য|Detail anggota|Thông tin thành viên|ข้อมูลสมาชิก|成員資料
Household budget|Badyet ng sambahayan|घरेलू बजट|পরিবারের বাজেট|Anggaran rumah tangga|Ngân sách hộ gia đình|งบประมาณครัวเรือน|家庭預算
Identity details|Detalye ng pagkakakilanlan|पहचान विवरण|পরিচয় তথ্য|Detail identitas|Thông tin định danh|ข้อมูลยืนยันตัวตน|身分資料
Visit details|Detalye ng pagbisita|दौरे का विवरण|পরিদর্শনের তথ্য|Detail kunjungan|Thông tin chuyến thăm|ข้อมูลการเยี่ยม|訪察資料
Collections|Mga koleksyon|संग्रह|আদায়|Penerimaan|Khoản thu|ยอดรับชำระ|收款
Observations|Mga obserbasyon|अवलोकन|পর্যবেক্ষণ|Pengamatan|Ghi nhận|ข้อสังเกต|觀察記錄
Member & currency|Miyembro at pera|सदस्य और मुद्रा|সদস্য ও মুদ্রা|Anggota & mata uang|Thành viên và tiền tệ|สมาชิกและสกุลเงิน|成員與幣別
Repayment plan|Plano ng pagbabayad|पुनर्भुगतान योजना|পরিশোধের পরিকল্পনা|Rencana pembayaran|Kế hoạch trả nợ|แผนชำระคืน|還款計劃
Review the details before saving. Fields marked * are required.|Suriin ang detalye bago i-save. Kailangan ang mga may *.|सहेजने से पहले विवरण जाँचें। * वाले फ़ील्ड आवश्यक हैं।|সংরক্ষণের আগে তথ্য যাচাই করুন। * চিহ্নিত ঘর আবশ্যক।|Periksa detail sebelum menyimpan. Kolom bertanda * wajib diisi.|Kiểm tra trước khi lưu. Các trường có * là bắt buộc.|ตรวจสอบข้อมูลก่อนบันทึก ช่องที่มี * จำเป็นต้องกรอก|儲存前請核對資料。標有 * 的欄位為必填。
Overview|Pangkalahatan|सारांश|সারসংক্ষেপ|Ringkasan|Tổng quan|ภาพรวม|總覽
Field operations|Gawain sa komunidad|क्षेत्रीय कार्य|মাঠ কার্যক্রম|Operasional lapangan|Hoạt động thực địa|งานภาคสนาม|外勤工作
Member records, collections, and what needs your team’s attention.|Mga tala, koleksyon, at mga kailangang tutukan ng pangkat.|सदस्य रिकॉर्ड, संग्रह और आपकी टीम के ध्यान योग्य कार्य।|সদস্যের নথি, আদায় এবং দলের মনোযোগ প্রয়োজন এমন কাজ।|Catatan anggota, penerimaan, dan hal yang perlu ditangani tim Anda.|Hồ sơ thành viên, khoản thu và việc nhóm cần lưu ý.|ข้อมูลสมาชิก ยอดรับชำระ และงานที่ทีมต้องติดตาม|成員記錄、收款及團隊需要跟進的事項。
Total recorded to date|Kabuuang naitala hanggang ngayon|अब तक दर्ज कुल राशि|এ পর্যন্ত নথিভুক্ত মোট|Total tercatat hingga kini|Tổng ghi nhận đến nay|ยอดรวมที่บันทึกถึงปัจจุบัน|截至目前記錄總額
Repayments + savings in this period|Mga bayad at ipon sa panahong ito|इस अवधि में पुनर्भुगतान और बचत|এই সময়ে পরিশোধ ও সঞ্চয়|Pembayaran dan tabungan dalam periode ini|Trả nợ và tiết kiệm trong kỳ|การชำระคืนและเงินออมในช่วงนี้|本期間還款及儲蓄
Scheduled group visits|Nakatakdang pagbisita sa mga grupo|निर्धारित समूह दौरे|নির্ধারিত দলীয় পরিদর্শন|Kunjungan kelompok terjadwal|Lịch thăm nhóm|กำหนดลงพื้นที่กลุ่ม|小組訪察安排
Attendance and payment observations|Mga tala ng pagdalo at pagbabayad|उपस्थिति और भुगतान के अवलोकन|উপস্থিতি ও পরিশোধের পর্যবেক্ষণ|Catatan kehadiran dan pembayaran|Ghi nhận điểm danh và thanh toán|ข้อมูลการเข้าร่วมและการชำระเงิน|出席及還款觀察記錄
No dues recorded|Walang nakatalang dapat bayaran|कोई देय राशि दर्ज नहीं|কোনো প্রাপ্য নথিভুক্ত নেই|Belum ada tagihan tercatat|Chưa ghi nhận khoản đến hạn|ยังไม่มีข้อมูลยอดที่ต้องชำระ|尚無應繳款項記錄
Record an approved loan|Magtala ng aprubadong pautang|स्वीकृत ऋण दर्ज करें|অনুমোদিত ঋণ নথিভুক্ত করুন|Catat pinjaman yang disetujui|Ghi nhận khoản vay đã duyệt|บันทึกเงินกู้ที่อนุมัติแล้ว|記錄已獲批准的貸款
Attendance, collections, and observations from this visit.|Pagdalo, koleksyon, at obserbasyon sa pagbisitang ito.|इस दौरे की उपस्थिति, संग्रह और अवलोकन।|এই পরিদর্শনের উপস্থিতি, আদায় ও পর্যবেক্ষণ।|Kehadiran, penerimaan, dan catatan kunjungan ini.|Điểm danh, khoản thu và ghi nhận của chuyến thăm.|การเข้าร่วม ยอดรับชำระ และข้อสังเกตในการลงพื้นที่ครั้งนี้|本次訪察的出席、收款及觀察記錄。
Members|Mga miyembro|सदस्य|সদস্য|Anggota|Thành viên|สมาชิก|成員
Groups|Mga grupo|समूह|দল|Kelompok|Nhóm|กลุ่ม|小組
Field visits|Mga pagbisita|क्षेत्रीय दौरे|মাঠ পরিদর্শন|Kunjungan lapangan|Chuyến thăm thực địa|การลงพื้นที่|實地訪察
Loan register|Talaan ng pautang|ऋण रजिस्टर|ঋণ নিবন্ধন|Daftar pinjaman|Sổ khoản vay|ทะเบียนเงินกู้|貸款登記冊
Consent & sharing|Pahintulot at pagbabahagi|सहमति और साझा करना|সম্মতি ও তথ্য ভাগাভাগি|Persetujuan & berbagi|Đồng ý và chia sẻ|ความยินยอมและการแบ่งปัน|同意與資料分享
Organization|Organisasyon|संस्था|সংস্থা|Organisasi|Tổ chức|องค์กร|機構
Follow-up cases|Mga follow-up|अनुवर्ती मामले|ফলোআপ কার্যক্রম|Tindak lanjut|Trường hợp theo dõi|รายการติดตาม|跟進個案
Offline records|Mga offline na tala|ऑफ़लाइन रिकॉर्ड|অফলাইন নথি|Catatan offline|Bản ghi ngoại tuyến|ข้อมูลออฟไลน์|離線記錄
Staff accounts|Mga kawani|कर्मचारी खाते|কর্মী অ্যাকাউন্ট|Akun staf|Tài khoản nhân viên|บัญชีเจ้าหน้าที่|職員帳戶
Workspace|Workspace|कार्यक्षेत्र|কর্মক্ষেত্র|Ruang kerja|Không gian làm việc|พื้นที่ทำงาน|工作區
Language|Wika|भाषा|ভাষা|Bahasa|Ngôn ngữ|ภาษา|語言
Reporting currency|Salapi sa ulat|रिपोर्ट की मुद्रा|প্রতিবেদনের মুদ্রা|Mata uang laporan|Tiền tệ báo cáo|สกุลเงินรายงาน|報表幣別
Currency|Salapi|मुद्रा|মুদ্রা|Mata uang|Tiền tệ|สกุลเงิน|幣別
Default currency|Karaniwang salapi|डिफ़ॉल्ट मुद्रा|ডিফল্ট মুদ্রা|Mata uang bawaan|Tiền tệ mặc định|สกุลเงินเริ่มต้น|預設幣別
Household currency|Salapi ng sambahayan|परिवार की मुद्रा|পরিবারের মুদ্রা|Mata uang rumah tangga|Tiền tệ hộ gia đình|สกุลเงินครัวเรือน|住戶幣別
Loan currency|Salapi ng pautang|ऋण की मुद्रा|ঋণের মুদ্রা|Mata uang pinjaman|Tiền tệ khoản vay|สกุลเงินกู้|貸款幣別
Collection currency|Salapi ng koleksyon|संग्रह की मुद्रा|আদায়ের মুদ্রা|Mata uang penerimaan|Tiền tệ thu tiền|สกุลเงินรับชำระ|收款幣別
Record a visit|Magtala ng pagbisita|दौरा दर्ज करें|পরিদর্শন নথিভুক্ত করুন|Catat kunjungan|Ghi nhận chuyến thăm|บันทึกการลงพื้นที่|記錄訪察
Record visit|Magtala ng pagbisita|दौरा दर्ज करें|পরিদর্শন নথিভুক্ত করুন|Catat kunjungan|Ghi nhận chuyến thăm|บันทึกการลงพื้นที่|記錄訪察
Add member|Magdagdag ng miyembro|सदस्य जोड़ें|সদস্য যোগ করুন|Tambah anggota|Thêm thành viên|เพิ่มสมาชิก|新增成員
Add a member|Magdagdag ng miyembro|सदस्य जोड़ें|সদস্য যোগ করুন|Tambah anggota|Thêm thành viên|เพิ่มสมาชิก|新增成員
Create group|Gumawa ng grupo|समूह बनाएँ|দল তৈরি করুন|Buat kelompok|Tạo nhóm|สร้างกลุ่ม|建立小組
Create a group|Gumawa ng grupo|समूह बनाएँ|দল তৈরি করুন|Buat kelompok|Tạo nhóm|สร้างกลุ่ม|建立小組
Record a loan|Magtala ng pautang|ऋण दर्ज करें|ঋণ নথিভুক্ত করুন|Catat pinjaman|Ghi nhận khoản vay|บันทึกเงินกู้|記錄貸款
Record loan|Magtala ng pautang|ऋण दर्ज करें|ঋণ নথিভুক্ত করুন|Catat pinjaman|Ghi nhận khoản vay|บันทึกเงินกู้|記錄貸款
Record a field visit|Magtala ng pagbisita|क्षेत्रीय दौरा दर्ज करें|মাঠ পরিদর্শন নথিভুক্ত করুন|Catat kunjungan lapangan|Ghi nhận thăm thực địa|บันทึกการลงพื้นที่|記錄實地訪察
Group meeting|Pulong ng grupo|समूह बैठक|দলীয় সভা|Pertemuan kelompok|Họp nhóm|การประชุมกลุ่ม|小組會議
Save meeting|I-save ang pulong|बैठक सहेजें|সভার তথ্য সংরক্ষণ করুন|Simpan pertemuan|Lưu cuộc họp|บันทึกการประชุม|儲存會議
Meeting date|Petsa ng pulong|बैठक की तारीख|সভার তারিখ|Tanggal pertemuan|Ngày họp|วันที่ประชุม|會議日期
Cancel|Kanselahin|रद्द करें|বাতিল করুন|Batal|Hủy|ยกเลิก|取消
Close|Isara|बंद करें|বন্ধ করুন|Tutup|Đóng|ปิด|關閉
Save record|I-save ang tala|रिकॉर्ड सहेजें|নথি সংরক্ষণ করুন|Simpan catatan|Lưu bản ghi|บันทึกข้อมูล|儲存記錄
Save visit|I-save ang pagbisita|दौरा सहेजें|পরিদর্শন সংরক্ষণ করুন|Simpan kunjungan|Lưu chuyến thăm|บันทึกการเยี่ยม|儲存訪察
Save preferences|I-save ang mga setting|प्राथमिकताएँ सहेजें|পছন্দ সংরক্ষণ করুন|Simpan preferensi|Lưu tùy chọn|บันทึกการตั้งค่า|儲存偏好設定
Save configuration|I-save ang pagsasaayos|सेटिंग्स सहेजें|সেটিংস সংরক্ষণ করুন|Simpan konfigurasi|Lưu cấu hình|บันทึกการกำหนดค่า|儲存設定
Connected|Konektado|कनेक्टेड|সংযুক্ত|Terhubung|Đã kết nối|เชื่อมต่อแล้ว|已連線
Offline|Walang koneksyon|ऑफ़लाइन|অফলাইন|Offline|Ngoại tuyến|ออฟไลน์|離線
Sign in|Mag-sign in|साइन इन करें|সাইন ইন করুন|Masuk|Đăng nhập|เข้าสู่ระบบ|登入
Sign out|Mag-sign out|साइन आउट करें|সাইন আউট করুন|Keluar|Đăng xuất|ออกจากระบบ|登出
Username|Username|उपयोगकर्ता नाम|ব্যবহারকারীর নাম|Nama pengguna|Tên đăng nhập|ชื่อผู้ใช้|使用者名稱
Password|Password|पासवर्ड|পাসওয়ার্ড|Kata sandi|Mật khẩu|รหัสผ่าน|密碼
Member|Miyembro|सदस्य|সদস্য|Anggota|Thành viên|สมาชิก|成員
Group|Grupo|समूह|দল|Kelompok|Nhóm|กลุ่ม|小組
Date|Petsa|तारीख|তারিখ|Tanggal|Ngày|วันที่|日期
Due date|Takdang petsa|देय तिथि|নির্ধারিত তারিখ|Tanggal jatuh tempo|Ngày đến hạn|วันครบกำหนด|到期日
Status|Katayuan|स्थिति|অবস্থা|Status|Trạng thái|สถานะ|狀態
Attendance|Pagdalo|उपस्थिति|উপস্থিতি|Kehadiran|Điểm danh|การเข้าร่วม|出席
Present|Dumalo|उपस्थित|উপস্থিত|Hadir|Có mặt|เข้าร่วม|出席
Absent|Hindi dumalo|अनुपस्थित|অনুপস্থিত|Tidak hadir|Vắng mặt|ไม่เข้าร่วม|缺席
Excused absence|May pahintulot na lumiban|स्वीकृत अनुपस्थिति|অনুমোদিত অনুপস্থিতি|Tidak hadir dengan izin|Vắng có phép|ลาที่ได้รับอนุญาต|已准假缺席
Not recorded|Hindi naitala|दर्ज नहीं|নথিভুক্ত নয়|Belum dicatat|Chưa ghi nhận|ยังไม่บันทึก|未記錄
Savings|Ipon|बचत|সঞ্চয়|Tabungan|Tiết kiệm|เงินออม|儲蓄
Repayments|Mga pagbabayad|पुनर्भुगतान|ঋণ পরিশোধ|Pembayaran pinjaman|Trả nợ|การชำระคืน|還款
Notes|Mga tala|टिप्पणियाँ|মন্তব্য|Catatan|Ghi chú|หมายเหตุ|備註
Assigned to|Nakatakdang kawani|जिम्मेदार कर्मचारी|দায়িত্বপ্রাপ্ত|Ditugaskan kepada|Người phụ trách|ผู้รับผิดชอบ|負責人
Open|Bukas|खुला|চলমান|Terbuka|Mở|เปิด|待處理
Resolved|Nalutas|हल किया गया|সমাধান হয়েছে|Selesai|Đã giải quyết|แก้ไขแล้ว|已解決
Receipt|Resibo|रसीद|রসিদ|Kuitansi|Biên nhận|ใบเสร็จ|收據
Collection receipt|Resibo ng koleksyon|संग्रह रसीद|আদায়ের রসিদ|Kuitansi penerimaan|Biên nhận thu tiền|ใบเสร็จรับชำระ|收款收據
Print receipt|I-print ang resibo|रसीद प्रिंट करें|রসিদ প্রিন্ট করুন|Cetak kuitansi|In biên nhận|พิมพ์ใบเสร็จ|列印收據
Schedule|Iskedyul|समय-सारणी|সময়সূচি|Jadwal|Lịch trả nợ|กำหนดการ|還款時間表
Repayment schedule|Iskedyul ng pagbabayad|पुनर्भुगतान अनुसूची|পরিশোধের সময়সূচি|Jadwal pembayaran|Lịch trả nợ|ตารางชำระคืน|還款時間表
Correct|Iwasto|सुधारें|সংশোধন করুন|Koreksi|Sửa|แก้ไข|更正
History|Kasaysayan|इतिहास|ইতিহাস|Riwayat|Lịch sử|ประวัติ|歷程
Correction history|Kasaysayan ng pagwawasto|सुधार इतिहास|সংশোধনের ইতিহাস|Riwayat koreksi|Lịch sử chỉnh sửa|ประวัติการแก้ไข|更正歷程
Save correction|I-save ang pagwawasto|सुधार सहेजें|সংশোধন সংরক্ষণ করুন|Simpan koreksi|Lưu chỉnh sửa|บันทึกการแก้ไข|儲存更正
Full name|Buong pangalan|पूरा नाम|পুরো নাম|Nama lengkap|Họ và tên|ชื่อและนามสกุล|姓名
Community group|Grupo sa komunidad|सामुदायिक समूह|কমিউনিটি দল|Kelompok komunitas|Nhóm cộng đồng|กลุ่มชุมชน|社區小組
Livelihood / business|Kabuhayan / negosyo|आजीविका / व्यवसाय|জীবিকা / ব্যবসা|Mata pencaharian / usaha|Sinh kế / kinh doanh|อาชีพ / ธุรกิจ|生計／業務
Monthly household income|Buwanang kita ng sambahayan|परिवार की मासिक आय|পরিবারের মাসিক আয়|Pendapatan bulanan rumah tangga|Thu nhập hộ gia đình hằng tháng|รายได้ครัวเรือนต่อเดือน|住戶每月收入
Monthly household expenses|Buwanang gastos ng sambahayan|परिवार का मासिक खर्च|পরিবারের মাসিক ব্যয়|Pengeluaran bulanan rumah tangga|Chi tiêu hộ gia đình hằng tháng|รายจ่ายครัวเรือนต่อเดือน|住戶每月支出
Household members|Mga kasapi ng sambahayan|परिवार के सदस्य|পরিবারের সদস্যসংখ্যা|Anggota rumah tangga|Số người trong hộ|สมาชิกในครัวเรือน|住戶人數
Income earners|Mga kumikita|कमाने वाले सदस्य|উপার্জনকারী সদস্য|Anggota berpenghasilan|Số người có thu nhập|ผู้มีรายได้|有收入人數
Identity document type|Uri ng dokumento|पहचान दस्तावेज़ का प्रकार|পরিচয়পত্রের ধরন|Jenis dokumen identitas|Loại giấy tờ tùy thân|ประเภทเอกสารประจำตัว|身分證明類別
ID last four digits only|Huling apat na numero ng ID|पहचान संख्या के केवल अंतिम चार अंक|পরিচয়পত্রের শুধু শেষ চার সংখ্যা|Hanya empat digit terakhir identitas|Chỉ bốn số cuối giấy tờ|เฉพาะสี่หลักสุดท้ายของเอกสาร|僅填證件末四位
Visit date|Petsa ng pagbisita|दौरे की तारीख|পরিদর্শনের তারিখ|Tanggal kunjungan|Ngày thăm|วันที่ลงพื้นที่|訪察日期
Loan being repaid|Pautang na binabayaran|चुकाया जा रहा ऋण|যে ঋণ পরিশোধ হচ্ছে|Pinjaman yang dibayar|Khoản vay đang trả|เงินกู้ที่ชำระคืน|正在償還的貸款
Principal repayment received|Natanggap na bayad sa prinsipal|प्राप्त मूलधन भुगतान|আদায়কৃত মূলধন|Pembayaran pokok diterima|Tiền gốc đã nhận|เงินต้นที่รับชำระ|已收本金還款
Savings contributed|Inihulog na ipon|जमा की गई बचत|জমাকৃত সঞ্চয়|Setoran tabungan|Tiền tiết kiệm đã góp|เงินออมที่ฝาก|已收儲蓄供款
Loan utilisation check|Pagsuri sa paggamit ng pautang|ऋण उपयोग जाँच|ঋণ ব্যবহারের যাচাই|Pemeriksaan penggunaan pinjaman|Kiểm tra sử dụng vốn vay|ตรวจสอบการใช้เงินกู้|貸款用途查核
Group name|Pangalan ng grupo|समूह का नाम|দলের নাম|Nama kelompok|Tên nhóm|ชื่อกลุ่ม|小組名稱
Village / location|Barangay / lugar|गाँव / स्थान|গ্রাম / অবস্থান|Desa / lokasi|Làng / địa điểm|หมู่บ้าน / สถานที่|村落／地點
Field officer|Kawani sa komunidad|क्षेत्रीय कर्मचारी|মাঠকর্মী|Petugas lapangan|Nhân viên thực địa|เจ้าหน้าที่ภาคสนาม|外勤職員
Next meeting|Susunod na pulong|अगली बैठक|পরবর্তী সভা|Pertemuan berikutnya|Cuộc họp tiếp theo|การประชุมครั้งถัดไป|下次會議
Loan purpose|Layunin ng pautang|ऋण का उद्देश्य|ঋণের উদ্দেশ্য|Tujuan pinjaman|Mục đích vay|วัตถุประสงค์เงินกู้|貸款用途
Principal amount|Halaga ng prinsipal|मूलधन राशि|মূলধনের পরিমাণ|Jumlah pokok|Số tiền gốc|จำนวนเงินต้น|本金金額
Installment amount|Halaga ng hulog|किस्त की राशि|কিস্তির পরিমাণ|Jumlah angsuran|Số tiền mỗi kỳ|จำนวนเงินต่องวด|每期還款金額
Repayment frequency|Dalas ng pagbabayad|भुगतान की आवृत्ति|পরিশোধের বিরতি|Frekuensi pembayaran|Tần suất trả nợ|ความถี่การชำระคืน|還款頻率
Loan start date|Petsa ng simula ng pautang|ऋण आरंभ तिथि|ঋণ শুরুর তারিখ|Tanggal mulai pinjaman|Ngày bắt đầu khoản vay|วันที่เริ่มเงินกู้|貸款起始日期
Organization name|Pangalan ng organisasyon|संस्था का नाम|সংস্থার নাম|Nama organisasi|Tên tổ chức|ชื่อองค์กร|機構名稱
Country|Bansa|देश|দেশ|Negara|Quốc gia|ประเทศ|國家
Community groups|Mga grupo sa komunidad|सामुदायिक समूह|কমিউনিটি দলসমূহ|Kelompok komunitas|Nhóm cộng đồng|กลุ่มชุมชน|社區小組
Member register|Talaan ng miyembro|सदस्य रजिस्टर|সদস্য নিবন্ধন|Daftar anggota|Sổ thành viên|ทะเบียนสมาชิก|成員登記冊
Upcoming meetings|Mga susunod na pulong|आगामी बैठकें|আসন্ন সভা|Pertemuan mendatang|Cuộc họp sắp tới|การประชุมที่กำลังจะมาถึง|即將舉行的會議
Member records|Mga tala ng miyembro|सदस्य रिकॉर्ड|সদস্যের নথি|Catatan anggota|Hồ sơ thành viên|ข้อมูลสมาชิก|成員記錄
Outstanding principal|Natitirang prinsipal|बकाया मूलधन|বকেয়া মূলধন|Sisa pokok|Dư nợ gốc|เงินต้นคงค้าง|未償還本金
Savings contributions|Mga hulog na ipon|बचत अंशदान|সঞ্চয় জমা|Setoran tabungan|Tiền tiết kiệm đóng góp|เงินออมสะสม|儲蓄供款
Full scheduled payments|Mga buong bayad|पूर्ण निर्धारित भुगतान|সম্পূর্ণ নির্ধারিত পরিশোধ|Pembayaran terjadwal penuh|Kỳ trả nợ đầy đủ|การชำระตามกำหนดครบจำนวน|全額按期還款
Full payments|Mga buong bayad|पूर्ण भुगतान|সম্পূর্ণ পরিশোধ|Pembayaran penuh|Thanh toán đầy đủ|ชำระครบจำนวน|全額還款
Follow-up|Follow-up|अनुवर्ती कार्रवाई|ফলোআপ|Tindak lanjut|Theo dõi|ติดตาม|跟進
Collections by visit date|Koleksyon ayon sa petsa|दौरे की तारीख के अनुसार संग्रह|পরিদর্শনের তারিখ অনুযায়ী আদায়|Penerimaan per tanggal kunjungan|Khoản thu theo ngày thăm|ยอดรับชำระตามวันที่ลงพื้นที่|按訪察日期列示收款
Create follow-up|Gumawa ng follow-up|अनुवर्ती मामला बनाएँ|ফলোআপ তৈরি করুন|Buat tindak lanjut|Tạo trường hợp theo dõi|สร้างรายการติดตาม|新增跟進
Create case|Gumawa ng kaso|मामला बनाएँ|কার্যক্রম তৈরি করুন|Buat kasus|Tạo trường hợp|สร้างรายการ|建立個案
Open case|Buksan ang kaso|मामला खोलें|কার্যক্রম খুলুন|Buka kasus|Mở trường hợp|เปิดรายการ|開啟個案
Update case|I-update ang kaso|मामला अपडेट करें|কার্যক্রম হালনাগাদ করুন|Perbarui kasus|Cập nhật trường hợp|อัปเดตรายการ|更新個案
Case title|Pamagat ng kaso|मामले का शीर्षक|কার্যক্রমের শিরোনাম|Judul kasus|Tiêu đề trường hợp|ชื่อรายการ|個案標題
Unlock records|Buksan ang mga tala|रिकॉर्ड अनलॉक करें|নথি আনলক করুন|Buka kunci catatan|Mở khóa bản ghi|ปลดล็อกข้อมูล|解鎖記錄
Lock records|I-lock ang mga tala|रिकॉर्ड लॉक करें|নথি লক করুন|Kunci catatan|Khóa bản ghi|ล็อกข้อมูล|鎖定記錄
Sync now|I-sync ngayon|अभी सिंक करें|এখন সিঙ্ক করুন|Sinkronkan sekarang|Đồng bộ ngay|ซิงค์ตอนนี้|立即同步
Import CSV|Mag-import ng CSV|CSV आयात करें|CSV আমদানি করুন|Impor CSV|Nhập CSV|นำเข้า CSV|匯入 CSV
Preview CSV|Silipin ang CSV|CSV पूर्वावलोकन|CSV পূর্বরূপ|Pratinjau CSV|Xem trước CSV|ดูตัวอย่าง CSV|預覽 CSV
Import members|I-import ang mga miyembro|सदस्य आयात करें|সদস্য আমদানি করুন|Impor anggota|Nhập thành viên|นำเข้าสมาชิก|匯入成員
Download backup|I-download ang backup|बैकअप डाउनलोड करें|ব্যাকআপ ডাউনলোড করুন|Unduh cadangan|Tải bản sao lưu|ดาวน์โหลดข้อมูลสำรอง|下載備份
Configure forms & language|Ayusin ang form at wika|फ़ॉर्म और भाषा सेट करें|ফর্ম ও ভাষা নির্ধারণ করুন|Atur formulir & bahasa|Cấu hình biểu mẫu và ngôn ngữ|ตั้งค่าแบบฟอร์มและภาษา|設定表格與語言
Forms & language|Mga form at wika|फ़ॉर्म और भाषा|ফর্ম ও ভাষা|Formulir & bahasa|Biểu mẫu và ngôn ngữ|แบบฟอร์มและภาษา|表格與語言
Time zone|Sona ng oras|समय क्षेत्र|সময় অঞ্চল|Zona waktu|Múi giờ|เขตเวลา|時區
Add question|Magdagdag ng tanong|प्रश्न जोड़ें|প্রশ্ন যোগ করুন|Tambah pertanyaan|Thêm câu hỏi|เพิ่มคำถาม|新增問題
Remove|Alisin|हटाएँ|সরান|Hapus|Xóa|นำออก|移除
Required|Kailangan|अनिवार्य|আবশ্যক|Wajib|Bắt buộc|จำเป็น|必填
Paid|Nabayaran|भुगतान किया|পরিশোধিত|Dibayar|Đã trả|ชำระแล้ว|已還款
Balance|Balanse|शेष|বাকি|Saldo|Số dư|ยอดคงเหลือ|餘額
Remaining|Natitira|बाकी|অবশিষ্ট|Tersisa|Còn lại|คงเหลือ|尚餘
Total received|Kabuuang natanggap|कुल प्राप्त|মোট আদায়|Total diterima|Tổng đã nhận|ยอดรับรวม|實收總額
Principal repayment|Bayad sa prinsipal|मूलधन भुगतान|মূলধন পরিশোধ|Pembayaran pokok|Trả gốc|ชำระเงินต้น|本金還款
Savings contribution|Hulog na ipon|बचत अंशदान|সঞ্চয় জমা|Setoran tabungan|Đóng góp tiết kiệm|เงินออมที่ฝาก|儲蓄供款
Search by name or member ID…|Hanapin sa pangalan o ID…|नाम या सदस्य ID से खोजें…|নাম বা সদস্য ID দিয়ে খুঁজুন…|Cari nama atau ID anggota…|Tìm theo tên hoặc mã thành viên…|ค้นหาชื่อหรือรหัสสมาชิก…|按姓名或成員編號搜尋…
All members|Lahat ng miyembro|सभी सदस्य|সব সদস্য|Semua anggota|Tất cả thành viên|สมาชิกทั้งหมด|所有成員
Weekly|Lingguhan|साप्ताहिक|সাপ্তাহিক|Mingguan|Hằng tuần|รายสัปดาห์|每週
Fortnightly|Kada dalawang linggo|हर दो सप्ताह|প্রতি দুই সপ্তাহ|Dua mingguan|Hai tuần một lần|ทุกสองสัปดาห์|每兩週
Monthly|Buwanan|मासिक|মাসিক|Bulanan|Hằng tháng|รายเดือน|每月
No loan payment|Walang bayad sa pautang|ऋण भुगतान नहीं|ঋণ পরিশোধ নেই|Tanpa pembayaran pinjaman|Không trả khoản vay|ไม่มีการชำระเงินกู้|沒有貸款還款
No payment|Walang bayad|भुगतान नहीं|কোনো পরিশোধ নেই|Tanpa pembayaran|Không thanh toán|ไม่มีการชำระ|沒有還款
Principal|Prinsipal|मूलधन|মূলধন|Pokok|Tiền gốc|เงินต้น|本金
Installment|Hulog|किस्त|কিস্তি|Angsuran|Kỳ trả nợ|เงินงวด|每期還款
Partial|Bahagya|आंशिक|আংশিক|Sebagian|Một phần|บางส่วน|部分還款
Overdue|Lampas sa takdang petsa|अतिदेय|মেয়াদোত্তীর্ণ|Terlambat|Quá hạn|เกินกำหนด|逾期
Upcoming|Paparating|आगामी|আসন্ন|Mendatang|Sắp tới|ที่กำลังจะมาถึง|即將到期
Active|Aktibo|सक्रिय|সক্রিয়|Aktif|Đang hoạt động|ใช้งาน|有效
Disabled|Hindi aktibo|निष्क्रिय|নিষ্ক্রিয়|Nonaktif|Đã vô hiệu hóa|ปิดใช้งาน|已停用
Verified|Napatunayan|सत्यापित|যাচাইকৃত|Terverifikasi|Đã xác minh|ตรวจสอบแล้ว|已核實
Income|Kita|आय|আয়|Pendapatan|Thu nhập|รายได้|收入
Expenses|Gastos|खर्च|ব্যয়|Pengeluaran|Chi tiêu|รายจ่าย|支出
Contributions|Mga hulog|अंशदान|জমা|Setoran|Khoản đóng góp|เงินสมทบ|供款
Needs review|Kailangang suriin|समीक्षा आवश्यक|পর্যালোচনা প্রয়োজন|Perlu ditinjau|Cần xem xét|ต้องตรวจสอบ|需要檢視
Up to date|Napapanahon|अद्यतन|হালনাগাদ|Terkini|Đã cập nhật|เป็นปัจจุบัน|已更新
View schedule|Tingnan ang iskedyul|अनुसूची देखें|সময়সূচি দেখুন|Lihat jadwal|Xem lịch|ดูกำหนดการ|查看時間表
Open follow-up list|Buksan ang listahan ng follow-up|अनुवर्ती सूची खोलें|ফলোআপ তালিকা খুলুন|Buka daftar tindak lanjut|Mở danh sách theo dõi|เปิดรายการติดตาม|開啟跟進清單
`;
export const dictionaries={en:{},fil:{},hi:{},bn:{},id:{},vi:{},th:{},'zh-Hant':{}};
for(const line of rows.trim().split('\n')) {
  const cells=line.split('|');if(cells.length!==8)throw new Error('Invalid translation row: '+cells[0]);
  for(const [index,code] of ['en','fil','hi','bn','id','vi','th','zh-Hant'].entries())dictionaries[code][cells[0]]=cells[index];
}
