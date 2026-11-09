# Sen Hosting — Cuộc thi Vibe Coding 2026

Website chatbot FAQ và đặt lịch tư vấn tiếng Việt của đội **WIS**, dự thi **Bảng A — Công nghệ**, **Đề 4: Chatbot FAQ & đặt lịch tư vấn**.

README được điền theo `MAUREADME.md`. Các mục ghi **Chưa bổ sung** cần hoàn tất trước khi nộp. Source ZIP được gắn với phiên bản `v1.0.0` để tải đúng bản bàn giao.

## 1. Thông tin chung

| Hạng mục | Nội dung |
|---|---|
| Tên sản phẩm | Sen Hosting |
| Tên đội thi | WIS |
| Bảng thi | Bảng A — Công nghệ |
| Đề bài bốc thăm | Đề 4: Chatbot FAQ & đặt lịch tư vấn |
| Demo online | [sen-hosting-faq.netlify.app](https://sen-hosting-faq.netlify.app) |
| Mã nguồn | [Wis-olle/Chatbot_FAQ](https://github.com/Wis-olle/Chatbot_FAQ) |
| Video demo (≤ 02 phút) | **Chưa bổ sung — mục 03** |
| Source ZIP | [Tải sen-hosting-v1.0.0-source.zip](https://github.com/Wis-olle/Chatbot_FAQ/releases/download/v1.0.0/sen-hosting-v1.0.0-source.zip) · [Release v1.0.0](https://github.com/Wis-olle/Chatbot_FAQ/releases/tag/v1.0.0) |
| Minh chứng dùng AI | **Chưa bổ sung — mục 04**, xem mục 10 bên dưới |
| Bảng kiểm thử | Có trong mục 11 của README này; mã kiểm thử kèm trong `test/` và `e2e/` |

## 2. Tính năng chính

1. **Hỏi đáp FAQ:** hỏi bằng tiếng Việt, chọn nhóm dịch vụ hoặc câu hỏi có sẵn; câu trả lời kiến thức có liên kết tới trang nguồn nội bộ Sen Hosting.
2. **Tư vấn theo nhu cầu:** Gemini sử dụng nội dung hội thoại và danh mục để gợi ý hosting, tên miền, VPS hoặc email. Thẻ sản phẩm lấy tên, cấu hình và giá từ dữ liệu đã lưu; tên miền gợi ý ghi rõ chưa kiểm tra còn trống.
3. **Gợi ý hỏi tiếp:** mỗi lượt có 3 câu hỏi liên quan có thể bấm, có kiểm tra trùng/rỗng và bổ sung gợi ý dự phòng.
4. **Đặt lịch tư vấn:** nhập họ tên, điện thoại, chủ đề, ngày và khung giờ; kiểm tra đầu vào và khung giờ trùng trên trình duyệt hiện tại.
5. **Xem và xóa lịch hẹn:** mục Lịch hẹn (`#admin`) hiển thị các lịch đã lưu bằng localStorage, cho phép xóa từng lịch.

Giao diện có chế độ sáng/tối, hội thoại toàn chiều cao, ô nhập phía dưới và menu dịch vụ trên mobile. Lựa chọn giao diện lưu tại `hosting-demo.theme.v1`; dữ liệu lịch hẹn dùng khóa riêng `hosting-demo.appointments.v1`.

## 3. Công nghệ sử dụng

| Lớp | Công nghệ thực tế |
|---|---|
| Giao diện | HTML5, CSS, JavaScript ES modules thuần; không dùng framework frontend hoặc Tailwind |
| Backend local | Node.js 24+, HTTP server tích hợp sẵn; API `/api/chat`, `/api/status`, `/api/knowledge` |
| AI | Google Gemini REST API qua backend; dùng `fetch` của Node.js |
| Kho kiến thức local | JSON và SQLite/FTS qua `node:sqlite`; server tự dựng chỉ mục từ dữ liệu đã chuẩn bị |
| Lịch hẹn | localStorage trên trình duyệt; không lưu lịch trong SQLite |
| Icon | Tabler Icons dạng SVG; giấy phép MIT trong `icons-LICENSE.txt` |
| Kiểm thử | `node:test`; `@playwright/test` 1.64.1 theo `package-lock.json` |
| Triển khai | Netlify, Netlify Functions; serverless nạp snapshot JSON trong bộ nhớ, không ghi SQLite |
| Công cụ dữ liệu tùy chọn | Python crawler/importer và dependencies khai báo trong `faq/requirements*.txt`; không cần để chạy demo từ snapshot |

## 4. Tích hợp AI

- **Có tích hợp API thật:** chế độ `CHAT_MODE=gemini` gọi Gemini khi server có `GEMINI_API_KEY`. Model mẫu trong `.env.example` là `gemini-3.5-flash-lite`; cần tài khoản có quyền truy cập model và hạn mức phù hợp.
- **Chế độ tra cứu cục bộ:** `CHAT_MODE=retrieval` trả nội dung từ kho kiến thức, không gọi Gemini. `CHAT_MODE=mock` là alias tương thích của chế độ này. Khi thiếu API key, backend tự dùng `retrieval`.
- **Kiểm tra chế độ thực tế:** mở `/api/status` trên server đang chạy và xem `mode` (`gemini` hoặc `retrieval`). Chế độ mẫu trong tệp cấu hình không chứng minh API thật đang hoạt động; lượt kiểm thử ghi ở mục 11 không gọi Gemini thật.
- **Mục đích:** trả lời câu hỏi chung theo ngữ cảnh và tư vấn dựa trên danh mục. Câu về kinh doanh cần bằng chứng Sen Hosting; thiếu chính sách thì hỏi rõ hoặc đề nghị xác nhận.
- **Bảo mật khóa:** key chỉ ở `.env` trên server hoặc biến môi trường secret của Netlify; không đưa vào frontend, ZIP, Git hoặc chat.

Cấu hình mẫu đã có trong `.env.example`:

```env
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
CHAT_MODE=gemini
```

Câu hỏi và tối đa 20 tin nhắn lịch sử có thể được gửi tới Gemini. Form lịch hẹn không tự gửi họ tên/số điện thoại tới mô hình; thông tin người dùng tự gõ trong chat có thể nằm trong nội dung gửi đi.

Nội dung nguồn, câu hỏi và lịch sử được coi là dữ liệu không đáng tin. Backend đối chiếu ID nguồn và một số số liệu/đơn vị/phạm vi sản phẩm; các kiểm tra này chưa chứng minh toàn bộ tính đúng ngữ nghĩa của câu trả lời. Lỗi provider được hiển thị rõ, không báo đã liên hệ nhân viên hoặc hoàn tất giao dịch.

## 5. Cài đặt và chạy local

Yêu cầu: **Node.js 24 trở lên có `node:sqlite`**, npm và trình duyệt hiện đại. Giải nén ZIP, mở terminal trong thư mục `sen-hosting-v1.0.0-source` chứa `package.json`.

### Chạy tra cứu không cần API key

Các lệnh dưới dùng PowerShell trên Windows:

```powershell
npm ci
Copy-Item .env.example .env
```

Mở `.env`, để trống `GEMINI_API_KEY` và đổi `CHAT_MODE=retrieval`, sau đó chạy:

```powershell
npm run prepare:knowledge
npm start
```

Mở [http://localhost:5173](http://localhost:5173). Server local chỉ lắng nghe tại `127.0.0.1`. Không mở trực tiếp `index.html` hoặc chỉ chạy server tĩnh vì giao diện cần API backend.

`npm ci` cần Internet để tải dependencies. Sau khi cài, chế độ retrieval dùng dữ liệu có sẵn, không cần Gemini hoặc chạy lại crawler. Có thể bỏ qua bước copy nếu đã có `.env`; không ghi đè cấu hình đang dùng.

### Chạy Gemini thật

Dừng server bằng `Ctrl+C`, chỉnh `.env` với key của bạn và model được tài khoản hỗ trợ, đặt `CHAT_MODE=gemini`, rồi chạy lại `npm start`. Kiểm tra `/api/status` và thử gửi câu hỏi. Khi không kết nối được provider hoặc hết hạn mức, giao diện sẽ báo lỗi.

Nếu cổng đang bận, dừng server cũ hoặc chọn cổng khác trước khi khởi động:

```powershell
$env:PORT = '5175'
npm start
```

### Triển khai Netlify

`netlify.toml` dùng Node.js 24, chạy `npm run build:netlify`, xuất bản `dist/`. Build chỉ chép 10 tệp giao diện; `.env`, backend, SQLite và dữ liệu crawl không nằm trong thư mục công khai. Hai Functions phục vụ `/api/chat`, `/api/status`, `/api/knowledge` và `/knowledge/SEN-...`.

Đặt `GEMINI_API_KEY` dạng secret trong Netlify cùng `GEMINI_MODEL`, `CHAT_MODE=gemini` và runtime Functions `AWS_LAMBDA_JS_RUNTIME=nodejs24.x`. Không có key thì API dùng retrieval. Giới hạn Functions theo IP/domain: 20 yêu cầu chat/phút và 240 yêu cầu tra cứu/phút.

Sau khi cài Netlify CLI và liên kết đúng site, có thể kiểm tra build và triển khai:

```powershell
netlify build --offline
netlify deploy --prod
```

Bản demo đang được quản lý qua CLI; cấu hình trong repo không tự thiết lập liên kết GitHub. Cần triển khai lại khi đổi mã hoặc snapshot.

## 6. Cấu trúc thư mục

```text
sen-hosting-v1.0.0-source/
├── index.html, styles.css, app.js     # giao diện
├── booking.js, appointments.js       # đặt lịch và localStorage
├── server.js, ai.js                  # HTTP API và Gemini
├── knowledge*.js, chat-router.js     # truy xuất và trang nguồn
├── consultation*.js, catalog-knowledge.js, suggestions.js
├── sen-hosting/
│   ├── content/                     # FAQ, hồ sơ doanh nghiệp, danh mục, ca đánh giá
│   ├── prepared/                    # JSON đã chuẩn bị và xuất xứ danh mục
│   └── build-knowledge.js           # chuẩn hóa kiến thức Sen Hosting
├── faq/                             # mã và snapshot tham khảo/crawler
├── netlify/                         # backend serverless và Functions
├── scripts/build-netlify.js         # build giao diện public
├── test/, e2e/                      # unit/integration và Playwright
├── package.json, package-lock.json, playwright.config.js
├── netlify.toml, .env.example
├── MAUREADME.md                     # mẫu gốc, giữ để đối chiếu
└── README.md                        # hướng dẫn đã điền của đội WIS
```

Dữ liệu công khai đang dùng là kho **Sen Hosting**; `faq/` giữ nguồn tham khảo cũ, không phải chính sách kinh doanh đang hoạt động. `faq/README.md` mô tả thêm quy trình cũ. Không xóa `faq/prepared/knowledge.json`: builder Sen Hosting cần đọc tệp này để tạo tài liệu đối chiếu nội bộ.

| Tệp dữ liệu | Vai trò |
|---|---|
| `sen-hosting/content/faqs.json` | 40 FAQ kiến thức chung được biên soạn |
| `sen-hosting/content/business-profile.json` | Hồ sơ thương hiệu/chính sách chờ chủ sở hữu bổ sung |
| `sen-hosting/content/catalog.json` | 74 mục: 26 đuôi tên miền, 23 hosting, 13 VPS, 12 email |
| `sen-hosting/prepared/knowledge.json` | Nội dung công khai đã chuẩn hóa |
| `sen-hosting/prepared/catalog-provenance.json` | Xuất xứ bản crawl để đối chiếu |
| `sen-hosting/content/evaluation.json` | Tình huống đánh giá truy xuất cục bộ |

SQLite không kèm trong ZIP; server dựng lại từ JSON khi chạy. Sau khi sửa FAQ/hồ sơ, chạy `npm run prepare:knowledge`, kiểm tra kết quả và khởi động lại server. Runtime giữ snapshot trong bộ nhớ.

`npm run import:catalog` là workflow tùy chọn để nhập lại HTML crawl đã lưu, không gọi mạng; cần Python và dependencies crawler. `npm run prepare:reference` chuẩn bị lại kho tham khảo. Source ZIP giữ mã và snapshot liên quan; không kèm Python venv. Xem `sen-hosting/README.md` và `faq/README.md` nếu cần xử lý lại dữ liệu.

## 7. Truy cập và phân quyền

- Không yêu cầu tài khoản hoặc mật khẩu demo.
- Mở mục **Lịch hẹn** hoặc `http://localhost:5173/#admin` để xem/xóa lịch trong cùng origin và hồ sơ trình duyệt.
- Màn hình này là quản trị demo, chưa có xác thực/phân quyền. Người dùng trên thiết bị khác không nhìn thấy lịch đã đặt ở máy bạn.
- Lịch trên localhost và domain Netlify tách biệt; không tự chuyển dữ liệu giữa hai nơi.

## 8. Giới hạn hiện tại

- Lịch hẹn chỉ lưu localStorage, chưa gửi nhân viên, chưa có email/SMS, backend lịch dùng chung hoặc đồng bộ thiết bị. Xóa dữ liệu trình duyệt sẽ mất lịch; chống trùng chỉ áp dụng cục bộ.
- Chưa có đăng nhập/phân quyền, giao dịch thanh toán hoặc kết nối CRM.
- Danh mục là snapshot từ nguồn tham khảo được nhập theo yêu cầu chủ dự án. Giá, thuế, chu kỳ, ưu đãi và thông số cần đối chiếu trước giao dịch; chưa tích hợp API kiểm tra tên miền còn trống.
- `sen_published` xác nhận nội dung kiến thức chung trong ứng dụng, không xác nhận giá, SLA, backup, hoàn tiền, tài khoản ngân hàng hay thông tin liên hệ doanh nghiệp. Chính sách chưa được khai báo không tự trở thành cam kết Sen Hosting.
- Gemini có thể sai và phụ thuộc mạng, quyền model, API key, hạn mức. Chế độ retrieval không đại diện khả năng trò chuyện sinh tự nhiên của Gemini.
- Kiểm thử provider sử dụng phản hồi giả, không thay thế đánh giá chất lượng AI thật hoặc kiểm tra production.

## 9. Nguồn tham khảo

- [Google Gemini API](https://ai.google.dev/gemini-api/docs) — dịch vụ AI qua backend.
- [Node.js](https://nodejs.org/) — HTTP server và SQLite tích hợp.
- [Netlify](https://docs.netlify.com/) — triển khai giao diện và Functions.
- [Playwright](https://playwright.dev/) — kiểm thử trình duyệt.
- [Tabler Icons](https://tabler.io/icons) — SVG theo MIT, kèm `icons-LICENSE.txt`.
- Snapshot các trang công khai [VinaHost](https://vinahost.vn/) trong `faq/`; URL, thời điểm và xuất xứ nằm ở dữ liệu nguồn và `sen-hosting/prepared/catalog-provenance.json`. Đây là nguồn tham khảo, không tự xác nhận chính sách của Sen Hosting.
- `MAUREADME.md` — mẫu README dùng để điền hồ sơ nộp bài.

## 10. Minh chứng dùng AI để xây dựng sản phẩm

**Chưa bổ sung — thực hiện ở mục 04 của hồ sơ.** Minh chứng theo mẫu: tối đa 1 trang, kèm tối đa 5 ảnh/đoạn hội thoại chọn lọc, ghi mục tiêu → yêu cầu cho AI → vấn đề khi thử → yêu cầu sửa → kết quả kiểm tra lại.

Cần đính kèm tệp hoặc đường dẫn minh chứng thực tế trước khi nộp. Tích hợp Gemini ở mục 4 không thay thế minh chứng quá trình xây dựng sản phẩm.

## 11. Bảng kiểm thử

Đã chạy ngày **09/11/2026**, Node.js **v24.18.0**. Kiểm thử offline dùng retrieval/provider giả, không gọi Gemini thật và không tiêu thụ hạn mức API.

```powershell
npm test
npm run test:coverage
npm run test:coverage:netlify
npx playwright install chromium
npm run test:e2e
```

`npm run test:coverage` đã bao gồm toàn bộ suite của `npm test`. Lệnh cài Chromium chỉ cần khi máy chưa có browser phù hợp; Linux có thể cần `npx playwright install --with-deps chromium`. Playwright tự khởi động server kiểm thử ở cổng 5174 với chế độ mock/retrieval.

Kết quả lượt xác minh hồ sơ:

| Nhóm | Kết quả thực tế |
|---|---|
| Unit/integration (`test:coverage`) | 237/237 đạt; line coverage 99,38% trong tập tệp cấu hình đo coverage |
| Netlify (`test:coverage:netlify`) | 69/69 đạt, đã nằm trong suite 237 ở trên; line coverage riêng 97,54% |
| E2E desktop/mobile | 34 ca đạt, 2 ca chỉ áp dụng mobile bỏ qua trên desktop; không có ca lỗi |

Các ca dưới được chọn từ mã kiểm thử đã chạy, có ít nhất 2 bình thường, 2 đầu vào không hợp lệ và 2 biên/sự cố cho Bảng A:

| Mã ca | Loại ca | Dữ liệu và bước thử | Kỳ vọng | Kết quả thực tế | Đạt/Chưa đạt |
|---|---|---|---|---|---|
| TC01 | Bình thường | Chạy `test/server.test.js`: khởi động server, đọc `/api/knowledge`, mở URL nguồn của FAQ đầu tiên | Trả dữ liệu Sen Hosting và trang nguồn HTTP 200 | API có danh mục; nguồn trả 200, đúng kho Sen Hosting | Đạt |
| TC02 | Bình thường | Chạy `test/appointments.test.js`: tạo 2 lịch, đọc lại, xóa 1 lịch | Giữ dữ liệu sau khi đọc; chỉ xóa lịch được chọn | Còn đúng ID của lịch thứ hai | Đạt |
| TC03 | Đầu vào không hợp lệ | Chạy `test/ai.test.js`: câu hỏi rỗng, dài 1.001 ký tự, lịch sử có role `system` hoặc hơn 20 lượt | Từ chối trước truy xuất/provider | Các đầu vào đều bị từ chối | Đạt |
| TC04 | Đầu vào không hợp lệ | Chạy `test/appointments.test.js`: tên rỗng, số `123`, ngày không hợp lệ, giờ `09:15` | Báo lỗi, không ghi lịch sai | Dữ liệu lưu vẫn rỗng cho các đầu vào sai | Đạt |
| TC05 | Biên | Chạy `test/appointments.test.js`: đặt hai lần cùng ngày/khung giờ | Chặn lịch trùng cục bộ | Lần hai báo đã được đặt; còn đúng 1 lịch | Đạt |
| TC06 | Sự cố | Chạy `test/ai.test.js`: provider giả trả 429/400/401/403/500 hoặc lỗi mạng | Báo lỗi phù hợp, không giả câu trả lời thành công | Promise bị từ chối đúng nhánh lỗi đã kiểm tra | Đạt |
| TC07 | Sự cố | Chạy `test/appointments.test.js`: localStorage hỏng hoặc bị chặn đọc/ghi | Báo lỗi và giữ dữ liệu cũ | Dữ liệu hỏng không bị xóa; lỗi đọc/ghi được báo | Đạt |
| TC08 | Biên/bảo mật | Chạy `test/netlify.test.js`: truy cập tệp riêng, origin lạ, JSON sai, body quá lớn | Không lộ tệp/key, từ chối đầu vào | Các phản hồi 404/403/400/413 theo trường hợp | Đạt |

Để đánh giá AI thật trước khi nộp, cần thử thêm bằng key/model thực tế và ghi kết quả thực tế riêng. Không dùng số liệu offline này để khẳng định Gemini đã được kiểm thử live.

## 12. Hồ sơ bàn giao

- Source ZIP chứa mã nguồn, dữ liệu snapshot cần chạy, README đã điền, lockfile và `.env.example`.
- Loại `.env`, `.git`, `.netlify`, `node_modules`, Python venv, SQLite sinh tự động, backup, `dist` và kết quả kiểm thử máy cá nhân khỏi gói.
- Source ZIP đính kèm tại [Release v1.0.0](https://github.com/Wis-olle/Chatbot_FAQ/releases/tag/v1.0.0), kèm `SHA256SUMS.txt` để đối chiếu checksum. Dùng link tải trực tiếp theo phiên bản trong mục 1 cho bài nộp.
- **Chưa hoàn tất:** video ≤ 2 phút thể hiện đủ 5 tính năng, minh chứng AI và đánh giá Gemini thật.
- Không cần tài khoản demo; người chạy tự cung cấp API key nếu dùng Gemini.
- Giữ nguyên phiên bản nộp trước hạn; thay đổi sau đó cần phiên bản riêng.
