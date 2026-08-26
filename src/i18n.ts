/**
 * Every user-facing string in the collector app, Vietnamese first.
 *
 * LOC-01: the collector app is in Vietnamese, P0. English is P2 and rides
 * along because the catalogue pattern needs a second locale to prove the
 * completeness check does anything — same mechanism as
 * `packages/api/src/i18n.ts`, which this file deliberately mirrors: a flat
 * map of dotted keys, every locale holding every key, asserted by a test.
 *
 * Vietnamese is the BASE locale: `MessageKey` derives from `vi`, so a key
 * added in English only does not typecheck, and a key missing from English
 * fails the parity test.
 */

export const LOCALES = ['vi', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'vi';

const vi = {
  'app.name': 'Player One',

  'common.back': 'Quay lại',
  'common.cancel': 'Hủy',
  'common.loading': 'Đang tải…',
  'common.language': 'English',
  'common.retry': 'Thử lại',
  'common.loadFailed': 'Không tải được dữ liệu. Kiểm tra kết nối rồi thử lại.',
  'common.actionFailed': 'Không thực hiện được. Vui lòng thử lại.',

  'register.title': 'Đăng ký',
  'register.intro': 'Tạo tài khoản người thu thập để nhận nhiệm vụ và được trả công theo phút hiệu quả.',
  'register.name': 'Họ và tên',
  'register.phone': 'Số điện thoại',
  'register.submit': 'Tạo tài khoản',
  'register.missing': 'Điền đầy đủ họ tên và số điện thoại.',

  'agreements.title': 'Sáu thỏa thuận',
  'agreements.intro':
    'Đăng ký chỉ hoàn tất khi bạn đồng ý cả sáu thỏa thuận. Mỗi lần đồng ý được ghi lại kèm phiên bản và thời điểm.',
  'agreements.version': 'Phiên bản',
  'agreements.submit': 'Đồng ý cả sáu',
  'agreements.incomplete': 'Cần đồng ý cả sáu thỏa thuận.',
  'agreement.user': 'Thỏa thuận người dùng',
  'agreement.privacy': 'Thỏa thuận quyền riêng tư',
  'agreement.data_collection': 'Ủy quyền thu thập dữ liệu',
  'agreement.commercial_use': 'Ủy quyền sử dụng dữ liệu thương mại',
  'agreement.manual_review': 'Mô tả quy trình duyệt thủ công',
  'agreement.offline_settlement': 'Mô tả thanh toán thủ công ngoại tuyến',

  'training.title': 'Đào tạo',
  'training.body':
    'Nội dung đào tạo do PaXini cung cấp và được VNG bản địa hóa: cách đeo thiết bị, thu thập ngoại tuyến và thẻ TF, đổi Wi-Fi và điểm phát sóng, hàng đợi tải lên, quyền chạy nền, pin và bộ nhớ, không gián đoạn công việc thật để tải lên, ủy quyền bối cảnh và người xung quanh, báo cáo sự cố.',
  'training.placeholder': 'Phần khung — nội dung thật sẽ thay thế khi PaXini bàn giao.',
  'training.done': 'Hoàn thành đào tạo',

  'exam.title': 'Bài kiểm tra',
  'exam.intro': 'Chưa đạt bài kiểm tra thì chưa thể nhận nhiệm vụ. Máy chủ cũng kiểm tra điều này.',
  'exam.q1': 'Tôi đã hiểu cách đeo thiết bị và ghi hình đúng.',
  'exam.q2': 'Tôi sẽ xin phép trước khi ghi hình người khác hoặc địa điểm riêng.',
  'exam.q3': 'Tôi hiểu rằng dữ liệu chỉ được tải lên khi tôi tự xác nhận.',
  'exam.submit': 'Nộp bài',
  'exam.passed': 'Đạt. Bạn có thể nhận nhiệm vụ.',
  'exam.failed': 'Chưa đạt. Xem lại phần đào tạo rồi thử lại.',

  'home.tasks': 'Sảnh nhiệm vụ',
  'home.myTasks': 'Nhiệm vụ của tôi',
  'home.devices': 'Thiết bị của tôi',
  'home.session': 'Tạo phiên thu thập',
  'home.uploads': 'Tải lên',
  'home.income': 'Thu nhập',
  'home.training': 'Đào tạo & kiểm tra',
  'home.gateExam': 'Chưa đạt bài kiểm tra — chưa thể nhận nhiệm vụ.',
  'home.gateDevice': 'Chưa liên kết thiết bị — chưa thể tạo phiên thu thập.',

  'hall.title': 'Sảnh nhiệm vụ',
  'hall.perMinute': 'đ/phút hiệu quả',
  'hall.progress': 'Tiến độ',
  'hall.slots': 'Người nhận',
  'hall.full': 'Đã đủ người',
  'hall.open': 'Có thể nhận',

  'scenario.home': 'Tại nhà',
  'scenario.office': 'Văn phòng',
  'scenario.shop': 'Cửa hàng',
  'scenario.warehouse': 'Kho hàng',

  'detail.title': 'Chi tiết nhiệm vụ',
  'detail.instructions': 'Hướng dẫn',
  'detail.privacy': 'Lưu ý quyền riêng tư',
  'detail.payment': 'Quy tắc thanh toán',
  'detail.target': 'Mục tiêu',
  'detail.minutes': 'phút',
  'detail.claim': 'Nhận nhiệm vụ',
  'detail.claimed': 'Đã nhận nhiệm vụ này',
  'detail.needExam': 'Cần đạt bài kiểm tra trước khi nhận nhiệm vụ.',
  'detail.full': 'Nhiệm vụ đã đủ người nhận.',
  'detail.claiming': 'Đang nhận…',
  'detail.needAgreements': 'Cần đồng ý cả sáu thỏa thuận trước khi nhận nhiệm vụ.',
  'detail.needTraining': 'Cần hoàn thành đào tạo trước khi nhận nhiệm vụ.',

  'mine.title': 'Nhiệm vụ của tôi',
  'mine.empty': 'Chưa nhận nhiệm vụ nào.',
  'mine.claimedAt': 'Nhận lúc',

  'devices.title': 'Thiết bị của tôi',
  'devices.empty': 'Chưa liên kết thiết bị nào.',
  'devices.serial': 'Số sê-ri',
  'devices.scanQr': 'Quét mã QR',
  'devices.qrMock': 'Máy quét giả lập — trả về số sê-ri mẫu.',
  'devices.typed': 'Hoặc nhập số sê-ri in trên thiết bị',
  'devices.bind': 'Liên kết thiết bị',
  'devices.boundAt': 'Liên kết lúc',
  'devices.provision': 'Cấu hình Wi-Fi qua Bluetooth',

  'prov.title': 'Cấu hình thiết bị',
  'prov.hint':
    'Điện thoại gửi Wi-Fi của bạn cho thiết bị qua Bluetooth; thiết bị trả về địa chỉ IP để tải dữ liệu về máy.',
  'prov.scan': 'Tìm thiết bị',
  'prov.connect': 'Kết nối',
  'prov.connected': 'Đã kết nối',
  'prov.ssid': 'Tên Wi-Fi (SSID)',
  'prov.password': 'Mật khẩu Wi-Fi',
  'prov.send': 'Gửi cấu hình Wi-Fi',
  'prov.sent': 'Đã gửi cấu hình',
  'prov.readIp': 'Đọc địa chỉ IP',
  'prov.ip': 'Địa chỉ IP thiết bị',
  'prov.failed': 'Chưa đọc được IP',
  'prov.rssi': 'RSSI',

  'session.title': 'Tạo phiên thu thập',
  'session.intro': 'Một phiên gắn nhiệm vụ + người thu thập + thiết bị + bối cảnh, trước khi ghi hình.',
  'session.task': 'Nhiệm vụ',
  'session.device': 'Thiết bị',
  'session.scenario': 'Bối cảnh',
  'session.declare': 'Hai khai báo bắt buộc trước khi ghi hình:',
  'session.othersTitle': 'Có thể có người khác trong khung hình?',
  'session.sensitiveTitle': 'Có thể xuất hiện thông tin nhạy cảm?',
  'session.yes': 'Có',
  'session.no': 'Không',
  'session.needClaim': 'Cần nhận một nhiệm vụ trước.',
  'session.needDevice': 'Cần liên kết thiết bị trước.',
  'session.needDeclarations': 'Cần trả lời cả hai khai báo.',
  'session.create': 'Tạo phiên',
  'session.created': 'Đã tạo phiên',
  'session.id': 'Mã phiên',
  'session.noRecord':
    'Ứng dụng không bao giờ bắt đầu hay dừng ghi hình. Nút ghi hình nằm trên thiết bị, trong tay bạn.',

  'uploads.title': 'Tải lên',
  'uploads.size': 'Dung lượng',
  'uploads.upload': 'Tải lên',
  'uploads.confirmTitle': 'Xác nhận tải lên?',
  'uploads.confirmBody':
    'Dữ liệu chỉ rời máy của bạn khi bạn xác nhận. Không bao giờ tự động, không bao giờ âm thầm.',
  'uploads.reason': 'Lý do',
  'uploads.empty': 'Chưa có tập dữ liệu nào.',

  'state.pending_upload': 'Chờ tải lên',
  'state.uploading': 'Đang tải lên',
  'state.uploaded': 'Đã tải lên',
  'state.under_review': 'Đang duyệt',
  'state.review_passed': 'Duyệt đạt',
  'state.review_failed': 'Duyệt không đạt',

  'income.title': 'Thu nhập',
  'income.estimated': 'Ước tính',
  'income.confirmed': 'Đã xác nhận',
  'income.minutes': 'Phút hiệu quả',
  'income.amount': 'Số tiền',
  'income.settlement': 'Thanh toán',
  'income.estimatedHint': 'Ước tính — con số cuối cùng do máy chủ quyết định sau khi duyệt.',
  'income.empty': 'Chưa có thu nhập nào.',
  'settlement.pending_review': 'Chờ duyệt',
  'settlement.pending_settlement': 'Chờ thanh toán',
  'settlement.bill_generated': 'Đã lập bảng kê',
  'settlement.manually_paid': 'Đã trả thủ công',
  'settlement.exception': 'Có vấn đề, đang xử lý',

  'home.payout': 'Tài khoản nhận tiền',

  'payout.title': 'Nhận tiền',
  'payout.intro':
    'Thu nhập được chi trả qua ZaloPay: vào ví ZaloPay, tài khoản ngân hàng hoặc thẻ ATM. Khai báo một lần; máy chủ xác minh với ZaloPay và cho bạn biết kết quả.',
  'payout.none': 'Chưa khai báo tài khoản nhận tiền.',
  'payout.declare': 'Khai báo tài khoản nhận tiền',
  'payout.change': 'Đổi tài khoản nhận tiền',
  'payout.viewResult': 'Xem kết quả xác minh',
  'payout.income': 'Bảng kê thu nhập theo kỳ',
  'payout.current': 'Tài khoản hiện tại',
  'payout.method': 'Hình thức',
  'payout.method.WALLET': 'Ví ZaloPay',
  'payout.method.BANK_ACCOUNT': 'Tài khoản ngân hàng',
  'payout.method.BANK_CARD': 'Thẻ ATM',
  'payout.phone': 'Số điện thoại ví ZaloPay',
  'payout.bank': 'Ngân hàng',
  'payout.accountNo': 'Số tài khoản',
  'payout.cardNo': 'Số thẻ',
  'payout.holderName': 'Tên chủ tài khoản (như trên giấy tờ)',
  'payout.last4': 'Số cuối',
  'payout.declaredName': 'Tên bạn khai',
  'payout.verifiedName': 'Tên ZaloPay ghi nhận',
  'payout.verifiedAt': 'Xác minh lúc',
  'payout.noStore':
    'Số tài khoản chỉ được gửi lên máy chủ để xác minh, không lưu trên điện thoại. Sau đó ứng dụng chỉ hiển thị 4 số cuối.',
  'payout.submit': 'Gửi xác minh',
  'payout.submitting': 'Đang gửi…',
  'payout.offline':
    'Không có kết nối. Khai báo chưa được gửi và sẽ không tự gửi lại — kết nối mạng rồi bấm gửi lần nữa.',
  'payout.refused': 'Máy chủ không nhận khai báo này. Kiểm tra lại thông tin rồi gửi lại.',
  'payout.invalid.name': 'Nhập tên chủ tài khoản.',
  'payout.invalid.phone':
    'Số di động Việt Nam gồm 10 chữ số, bắt đầu bằng 0 (ví dụ 090…). Máy chủ sẽ kiểm tra lại.',
  'payout.invalid.bank': 'Chọn ngân hàng.',
  'payout.invalid.number': 'Nhập số tài khoản hoặc số thẻ, chỉ gồm chữ số.',
  'payout.banksLoading': 'Đang tải danh sách ngân hàng…',
  'payout.banksFailed': 'Không tải được danh sách ngân hàng.',

  'payout.result.title': 'Kết quả xác minh',
  'payout.result.none': 'Chưa có tài khoản nào để xác minh.',
  'payout.result.verifiedTitle': 'ZaloPay xác nhận tài khoản này thuộc về',
  'payout.result.verifiedBody': 'Thu nhập của bạn sẽ được chi trả vào tài khoản này.',
  'payout.result.mismatchTitle': 'Hai tên chưa khớp',
  'payout.result.mismatchBody':
    'Tên bạn khai và tên ZaloPay ghi nhận cho tài khoản này khác nhau. Để tránh trả nhầm người, tiền chưa được chi cho đến khi hai tên khớp. Bạn có thể sửa tên đã khai, hoặc khai báo tài khoản đứng tên bạn.',
  'payout.result.fixName': 'Sửa tên đã khai',
  'payout.result.noWalletTitle': 'Số này chưa có ví ZaloPay',
  'payout.result.noWalletBody':
    'Tạo ví ZaloPay bằng đúng số điện thoại này trên trang của ZaloPay, rồi quay lại khai báo lần nữa.',
  'payout.result.openOnboarding': 'Mở ZaloPay để tạo ví',
  'payout.result.kycTitle': 'Ví đã chạm hạn mức nhận tiền',
  'payout.result.kycBody':
    'ZaloPay giới hạn số tiền một ví có thể nhận cho đến khi nâng cấp xác thực. Nâng cấp trên trang của ZaloPay, rồi khai báo lại.',
  'payout.result.openReform': 'Nâng hạn mức trên ZaloPay',
  'payout.result.lockedTitle': 'Ví ZaloPay đang bị khóa',
  'payout.result.lockedBody':
    'ZaloPay đang khóa ví này nên ví không thể nhận tiền. Thu nhập của bạn vẫn được ghi nhận đầy đủ; tiền sẽ được chi khi ví hoạt động lại, hoặc khi bạn khai báo một tài khoản khác đứng tên bạn. Việc mở khóa do ZaloPay xử lý — liên hệ ZaloPay từ trong ứng dụng ZaloPay.',
  'payout.result.unverifiedTitle': 'Ví chưa xác thực danh tính',
  'payout.result.unverifiedBody':
    'ZaloPay chưa xác thực danh tính (KYC) của ví này. Hoàn tất xác thực trong ứng dụng ZaloPay, rồi khai báo lại.',
  'payout.result.errorTitle': 'Chưa xác minh được',
  'payout.result.errorBody':
    'ZaloPay không nhận ra thông tin này. Kiểm tra lại ngân hàng và số tài khoản hoặc số thẻ, rồi khai báo lại.',
  'payout.result.redeclare': 'Khai báo lại',
  'payout.result.other': 'Khai báo tài khoản khác',
  'payout.result.contact': 'Liên hệ hỗ trợ',

  'payout.verify.unverified': 'Chưa xác thực',
  'payout.verify.verified': 'Đã xác minh',
  'payout.verify.name_mismatch': 'Tên chưa khớp',
  'payout.verify.no_wallet': 'Chưa có ví',
  'payout.verify.locked': 'Ví bị khóa',
  'payout.verify.kyc_limit': 'Chạm hạn mức',
  'payout.verify.error': 'Chưa xác minh được',

  'payout.income.title': 'Bảng kê thu nhập',
  'payout.income.intro':
    'Mỗi kỳ là một bảng kê do máy chủ lập. Mọi con số ở đây là của máy chủ; ứng dụng không tính lại.',
  'payout.income.empty': 'Chưa có kỳ nào.',
  'payout.income.period': 'Kỳ',
  'payout.income.validMinutes': 'Phút hợp lệ',
  'payout.income.gross': 'Tổng',
  'payout.income.withheld': 'Thuế khấu trừ',
  'payout.income.net': 'Thực nhận',
  'payout.income.paidAt': 'Chi trả lúc',
  'payout.income.updatedAt': 'Cập nhật lúc',
  'payout.income.stale': 'Không kết nối được máy chủ — đang hiển thị bảng kê đã lưu lần trước.',
  'payout.status.pending_review': 'Chờ duyệt',
  'payout.status.approved': 'Đã duyệt, chờ chi trả',
  'payout.status.paid': 'Đã chi trả',
  'payout.status.on_hold': 'Đang xem xét',
  'payout.status.unknown': 'Đang xử lý',
  'payout.status.onHoldHint': 'Kỳ này cần thêm thời gian xem xét. Bạn không cần làm gì; kết quả sẽ hiện tại đây.',
};

export type MessageKey = keyof typeof vi;

const en: Record<MessageKey, string> = {
  'app.name': 'Player One',

  'common.back': 'Back',
  'common.cancel': 'Cancel',
  'common.loading': 'Loading…',
  'common.language': 'Tiếng Việt',
  'common.retry': 'Try again',
  'common.loadFailed': 'Could not load this. Check the connection and try again.',
  'common.actionFailed': 'That did not go through. Please try again.',

  'register.title': 'Register',
  'register.intro': 'Create a collector account to claim tasks and be paid per effective minute.',
  'register.name': 'Full name',
  'register.phone': 'Phone number',
  'register.submit': 'Create account',
  'register.missing': 'Enter both your full name and phone number.',

  'agreements.title': 'The six agreements',
  'agreements.intro':
    'Registration completes only when you accept all six agreements. Each acceptance is recorded with its version and a timestamp.',
  'agreements.version': 'Version',
  'agreements.submit': 'Accept all six',
  'agreements.incomplete': 'All six agreements must be accepted.',
  'agreement.user': 'User Agreement',
  'agreement.privacy': 'Privacy Agreement',
  'agreement.data_collection': 'Data Collection Authorisation',
  'agreement.commercial_use': 'Data Commercial Use Authorisation',
  'agreement.manual_review': 'Manual Review Description',
  'agreement.offline_settlement': 'Offline Manual Settlement Description',

  'training.title': 'Training',
  'training.body':
    'Training content is supplied by PaXini and localised by VNG: wearing the device, offline collection and TF cards, Wi-Fi and hotspot switching, the upload queue, background permissions, battery and storage, not interrupting real work to upload, scenario authorisation and bystanders, exception reporting.',
  'training.placeholder': 'Shell only — the real content replaces this when PaXini delivers it.',
  'training.done': 'Complete training',

  'exam.title': 'Exam',
  'exam.intro': 'No exam pass, no task claiming. The server checks this too.',
  'exam.q1': 'I understand how to wear the device and record correctly.',
  'exam.q2': 'I will ask permission before filming other people or private places.',
  'exam.q3': 'I understand that data is uploaded only when I confirm it myself.',
  'exam.submit': 'Submit',
  'exam.passed': 'Passed. You can now claim tasks.',
  'exam.failed': 'Not passed. Review the training and try again.',

  'home.tasks': 'Task hall',
  'home.myTasks': 'My tasks',
  'home.devices': 'My devices',
  'home.session': 'Create collection session',
  'home.uploads': 'Uploads',
  'home.income': 'Income',
  'home.training': 'Training & exam',
  'home.gateExam': 'Exam not passed yet — tasks cannot be claimed.',
  'home.gateDevice': 'No device bound yet — a collection session cannot be created.',

  'hall.title': 'Task hall',
  'hall.perMinute': 'VND/effective minute',
  'hall.progress': 'Progress',
  'hall.slots': 'Claimants',
  'hall.full': 'At capacity',
  'hall.open': 'Claimable',

  'scenario.home': 'At home',
  'scenario.office': 'Office',
  'scenario.shop': 'Shop',
  'scenario.warehouse': 'Warehouse',

  'detail.title': 'Task detail',
  'detail.instructions': 'Instructions',
  'detail.privacy': 'Privacy notice',
  'detail.payment': 'Payment rule',
  'detail.target': 'Target',
  'detail.minutes': 'minutes',
  'detail.claim': 'Claim task',
  'detail.claimed': 'Already claimed',
  'detail.needExam': 'Pass the exam before claiming a task.',
  'detail.full': 'This task is at claimant capacity.',
  'detail.claiming': 'Claiming…',
  'detail.needAgreements': 'Accept all six agreements before claiming a task.',
  'detail.needTraining': 'Finish the training before claiming a task.',

  'mine.title': 'My tasks',
  'mine.empty': 'No tasks claimed yet.',
  'mine.claimedAt': 'Claimed at',

  'devices.title': 'My devices',
  'devices.empty': 'No device bound yet.',
  'devices.serial': 'Serial number',
  'devices.scanQr': 'Scan QR code',
  'devices.qrMock': 'Mock scanner — returns a sample serial.',
  'devices.typed': 'Or type the serial printed on the device',
  'devices.bind': 'Bind device',
  'devices.boundAt': 'Bound at',
  'devices.provision': 'Configure Wi-Fi over Bluetooth',

  'prov.title': 'Device setup',
  'prov.hint':
    'The phone sends your Wi-Fi to the device over Bluetooth; the device answers with the IP address used to pull data.',
  'prov.scan': 'Scan for devices',
  'prov.connect': 'Connect',
  'prov.connected': 'Connected',
  'prov.ssid': 'Wi-Fi name (SSID)',
  'prov.password': 'Wi-Fi password',
  'prov.send': 'Send Wi-Fi configuration',
  'prov.sent': 'Configuration sent',
  'prov.readIp': 'Read IP address',
  'prov.ip': 'Device IP address',
  'prov.failed': 'Could not read an IP',
  'prov.rssi': 'RSSI',

  'session.title': 'Create collection session',
  'session.intro': 'A session binds task + collector + device + scenario, before recording.',
  'session.task': 'Task',
  'session.device': 'Device',
  'session.scenario': 'Scenario',
  'session.declare': 'Two declarations, required before recording:',
  'session.othersTitle': 'Might other people appear in frame?',
  'session.sensitiveTitle': 'Might sensitive information appear?',
  'session.yes': 'Yes',
  'session.no': 'No',
  'session.needClaim': 'Claim a task first.',
  'session.needDevice': 'Bind a device first.',
  'session.needDeclarations': 'Answer both declarations.',
  'session.create': 'Create session',
  'session.created': 'Session created',
  'session.id': 'Session ID',
  'session.noRecord':
    'The app never starts or stops recording. The record control is on the device, in your hands.',

  'uploads.title': 'Uploads',
  'uploads.size': 'Size',
  'uploads.upload': 'Upload',
  'uploads.confirmTitle': 'Confirm upload?',
  'uploads.confirmBody':
    'Data leaves your phone only when you confirm it. Never automatically, never silently.',
  'uploads.reason': 'Reason',
  'uploads.empty': 'No episodes yet.',

  'state.pending_upload': 'Pending upload',
  'state.uploading': 'Uploading',
  'state.uploaded': 'Uploaded',
  'state.under_review': 'Under review',
  'state.review_passed': 'Review passed',
  'state.review_failed': 'Review failed',

  'income.title': 'Income',
  'income.estimated': 'Estimated',
  'income.confirmed': 'Confirmed',
  'income.minutes': 'Effective minutes',
  'income.amount': 'Amount',
  'income.settlement': 'Settlement',
  'income.estimatedHint': 'An estimate — the final figure is the server’s, after review.',
  'income.empty': 'No income yet.',
  'settlement.pending_review': 'Awaiting review',
  'settlement.pending_settlement': 'Awaiting settlement',
  'settlement.bill_generated': 'On a bill',
  'settlement.manually_paid': 'Paid manually',
  'settlement.exception': 'Held — being looked at',

  'home.payout': 'Payout account',

  'payout.title': 'Getting paid',
  'payout.intro':
    'Income is paid out through ZaloPay: to a ZaloPay wallet, a bank account or an ATM card. Declare it once; the server verifies it with ZaloPay and tells you the result.',
  'payout.none': 'No payout account declared yet.',
  'payout.declare': 'Declare a payout account',
  'payout.change': 'Change payout account',
  'payout.viewResult': 'View verification result',
  'payout.income': 'Income statements by period',
  'payout.current': 'Current account',
  'payout.method': 'Method',
  'payout.method.WALLET': 'ZaloPay wallet',
  'payout.method.BANK_ACCOUNT': 'Bank account',
  'payout.method.BANK_CARD': 'ATM card',
  'payout.phone': 'ZaloPay wallet phone number',
  'payout.bank': 'Bank',
  'payout.accountNo': 'Account number',
  'payout.cardNo': 'Card number',
  'payout.holderName': 'Account holder name (as on your ID)',
  'payout.last4': 'Ending in',
  'payout.declaredName': 'Name you declared',
  'payout.verifiedName': 'Name ZaloPay has on file',
  'payout.verifiedAt': 'Verified at',
  'payout.noStore':
    'The account number is sent to the server for verification only and is not stored on this phone. Afterwards the app shows the last 4 digits only.',
  'payout.submit': 'Submit for verification',
  'payout.submitting': 'Submitting…',
  'payout.offline':
    'No connection. The declaration was not sent and will not be sent on its own — connect to the network and tap submit again.',
  'payout.refused': 'The server did not accept this declaration. Check the details and submit again.',
  'payout.invalid.name': 'Enter the account holder name.',
  'payout.invalid.phone':
    'A Vietnamese mobile number has 10 digits and starts with 0 (for example 090…). The server checks it again.',
  'payout.invalid.bank': 'Choose a bank.',
  'payout.invalid.number': 'Enter the account or card number, digits only.',
  'payout.banksLoading': 'Loading the bank list…',
  'payout.banksFailed': 'Could not load the bank list.',

  'payout.result.title': 'Verification result',
  'payout.result.none': 'No account to verify yet.',
  'payout.result.verifiedTitle': 'ZaloPay confirms this account belongs to',
  'payout.result.verifiedBody': 'Your income will be paid to this account.',
  'payout.result.mismatchTitle': 'The two names do not match',
  'payout.result.mismatchBody':
    'The name you declared and the name ZaloPay has on file for this account differ. To avoid paying the wrong person, nothing is paid until the two match. You can correct the declared name, or declare an account that is in your name.',
  'payout.result.fixName': 'Correct the declared name',
  'payout.result.noWalletTitle': 'This number has no ZaloPay wallet',
  'payout.result.noWalletBody':
    'Create a ZaloPay wallet with exactly this phone number on ZaloPay’s page, then come back and declare again.',
  'payout.result.openOnboarding': 'Open ZaloPay to create a wallet',
  'payout.result.kycTitle': 'The wallet has reached its receiving limit',
  'payout.result.kycBody':
    'ZaloPay limits how much a wallet can receive until its verification is upgraded. Upgrade on ZaloPay’s page, then declare again.',
  'payout.result.openReform': 'Raise the limit on ZaloPay',
  'payout.result.lockedTitle': 'The ZaloPay wallet is locked',
  'payout.result.lockedBody':
    'ZaloPay has locked this wallet, so it cannot receive money. Your income is still recorded in full; it is paid once the wallet is active again, or once you declare another account in your name. Unlocking is ZaloPay’s to do — contact ZaloPay from inside the ZaloPay app.',
  'payout.result.unverifiedTitle': 'The wallet’s identity is not verified',
  'payout.result.unverifiedBody':
    'ZaloPay has not verified the identity (KYC) behind this wallet. Complete verification in the ZaloPay app, then declare again.',
  'payout.result.errorTitle': 'Could not be verified',
  'payout.result.errorBody':
    'ZaloPay did not recognise these details. Check the bank and the account or card number, then declare again.',
  'payout.result.redeclare': 'Declare again',
  'payout.result.other': 'Declare a different account',
  'payout.result.contact': 'Contact support',

  'payout.verify.unverified': 'Not verified',
  'payout.verify.verified': 'Verified',
  'payout.verify.name_mismatch': 'Name mismatch',
  'payout.verify.no_wallet': 'No wallet',
  'payout.verify.locked': 'Wallet locked',
  'payout.verify.kyc_limit': 'At receiving limit',
  'payout.verify.error': 'Could not verify',

  'payout.income.title': 'Income statements',
  'payout.income.intro':
    'Each period is a statement the server drew up. Every figure here is the server’s; the app does not recompute anything.',
  'payout.income.empty': 'No periods yet.',
  'payout.income.period': 'Period',
  'payout.income.validMinutes': 'Valid minutes',
  'payout.income.gross': 'Gross',
  'payout.income.withheld': 'Tax withheld',
  'payout.income.net': 'Net',
  'payout.income.paidAt': 'Paid at',
  'payout.income.updatedAt': 'Last updated',
  'payout.income.stale': 'Could not reach the server — showing the statements saved last time.',
  'payout.status.pending_review': 'Awaiting review',
  'payout.status.approved': 'Approved, awaiting payout',
  'payout.status.paid': 'Paid',
  'payout.status.on_hold': 'Under review',
  'payout.status.unknown': 'In progress',
  'payout.status.onHoldHint': 'This period needs more time to review. Nothing is needed from you; the result appears here.',
};

export const MESSAGES: Record<Locale, Record<MessageKey, string>> = { vi, en };

/** Every locale holds every key. Asserted by a test, not hoped for. */
export function missingKeys(locale: Locale): MessageKey[] {
  const keys = Object.keys(vi) as MessageKey[];
  return keys.filter((k) => {
    const value = MESSAGES[locale][k];
    return typeof value !== 'string' || value.trim() === '';
  });
}

export const t = (locale: Locale, key: MessageKey): string => MESSAGES[locale][key];
