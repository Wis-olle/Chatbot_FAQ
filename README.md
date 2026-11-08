# Sen Hosting

Website tư vấn và chatbot tiếng Việt mang thương hiệu **Sen Hosting**. Nội dung công khai, lời chào và liên kết kiến thức dùng tên Sen Hosting.

Chatbot có hai luồng:

- **Trò chuyện thường / kiến thức chung:** Gemini trả lời tự nhiên theo câu hỏi và lịch sử, không bắt buộc lấy một FAQ có sẵn.
- **Thông tin kinh doanh Sen Hosting:** backend tra cứu nội dung nội bộ và hồ sơ doanh nghiệp. Chưa có chính sách được khai báo thì chatbot hỏi rõ hoặc đề nghị xác nhận, không lấy thông số của nhà cung cấp khác làm cam kết của Sen Hosting.

Với hội thoại tư vấn lựa chọn, Gemini nhận nhu cầu khách đã nêu cùng các sản phẩm phù hợp trong danh mục. Bot đề xuất hướng chọn, một vài lựa chọn có thật và câu hỏi tiếp theo; không dừng ở thông báo thiếu FAQ. Cơ chế dùng chung cho tên miền, hosting, VPS, email và tư vấn tương tự. Lịch sử được giữ tối đa 20 tin nhắn gần nhất.

Danh mục hiện có **74 mục được nhập từ bản crawl theo yêu cầu chủ dự án**: 26 đuôi tên miền, 23 gói hosting, 13 gói VPS và 12 gói email. Giá, cấu hình và chu kỳ được lấy từ dữ liệu sản phẩm, hiển thị ở thẻ lựa chọn thay vì để model tự tạo. Giá là snapshot; cần đối chiếu chu kỳ, thuế và ưu đãi trước khi thanh toán. Đuôi tên miền có bán không đồng nghĩa với một tên miền đầy đủ còn trống.

## Chạy web

Cần Node.js 24 trở lên, có `node:sqlite`.

```powershell
npm run prepare:knowledge
npm start
```

Mở [Sen Hosting](http://localhost:5173). Server chỉ lắng nghe loopback. API key được đọc từ `.env` trên server; không đưa key vào mã frontend hoặc gửi vào chat.

Để dùng Gemini, điền `GEMINI_API_KEY`, giữ model phù hợp trong `GEMINI_MODEL` và đặt `CHAT_MODE=gemini`, sau đó khởi động lại server. Câu hỏi cùng tối đa 20 tin nhắn lịch sử có thể được gửi đến Gemini. Form lịch hẹn không gửi họ tên/số điện thoại tới mô hình.

Để kiểm tra dữ liệu cục bộ, không gọi Gemini:

```powershell
$env:CHAT_MODE = 'retrieval'
npm start
```

Khi chưa có API key, server dùng chế độ `retrieval`. `CHAT_MODE=mock` là alias tương thích. Chế độ này chỉ trả lời từ nội dung đã lưu; không đại diện trải nghiệm trò chuyện sinh tự nhiên của Gemini.

## Kiến thức của Sen Hosting

| Tệp | Mục đích |
|---|---|
| `sen-hosting/content/faqs.json` | FAQ kiến thức chung được biên soạn cho website |
| `sen-hosting/content/business-profile.json` | Hồ sơ thương hiệu và các chính sách cần chủ sở hữu cung cấp |
| `sen-hosting/content/catalog.json` | Danh mục đã nhập, gồm tên sản phẩm, thông số, giá và điều kiện snapshot |
| `sen-hosting/prepared/catalog-provenance.json` | Xuất xứ bản crawl và các giá trị đối chiếu; chỉ dùng nội bộ |
| `sen-hosting/prepared/knowledge.json` | Nội dung công khai đã chuẩn hóa |
| `sen-hosting/prepared/knowledge.sqlite` | Chỉ mục SQLite/FTS của nội dung Sen Hosting |
| `sen-hosting/content/evaluation.json` | Tình huống kiểm tra truy xuất cục bộ |
| `sen-hosting/prepared/evaluation-report.json` | Kết quả đánh giá gần nhất |

`sen_published` là trạng thái xuất bản nội dung kiến thức chung trong ứng dụng. Nó không xác nhận một giá bán, thời hạn hoàn tiền, tần suất backup, SLA, tài khoản ngân hàng hay địa chỉ liên hệ của doanh nghiệp.

Các chính sách và thông tin riêng chưa khai báo vẫn nằm trong `business-profile.json` để chủ sở hữu bổ sung. Giá và thông số sản phẩm đã có được đọc riêng từ `catalog.json`; chatbot không tự điền giá mới, tài khoản ngân hàng, liên hệ hay cam kết thiếu dữ liệu.

`npm run import:catalog` tái nhập từ HTML crawl đã lưu, không gọi mạng. Importer kiểm tra tên/thông số/giá trùng nguồn và tách xuất xứ khỏi dữ liệu công khai. Sau khi cập nhật danh mục, khởi động lại web để dựng lại chỉ mục. Importer cần môi trường Python crawler đã cài ở `vinahost-faq/.venv` hoặc Python có các dependencies tương ứng.

Nguồn hiển thị cho khách là các trang nội bộ `/knowledge/SEN-...`, có tên và nội dung Sen Hosting. Bản crawl tham khảo trước đây vẫn được giữ trong `vinahost-faq/` để đối chiếu nội bộ; dữ liệu và chính sách của nguồn tham khảo không tự chuyển thành nội dung kinh doanh đang hoạt động của Sen Hosting.

Sau khi sửa nội dung, chạy `npm run prepare:knowledge`, kiểm tra kết quả và khởi động lại server. Runtime giữ một snapshot trong bộ nhớ và dựng lại SQLite khi dữ liệu thay đổi.

## Quy tắc trả lời

- Câu hỏi chung có thể được Gemini giải thích tự nhiên mà không phải khớp một FAQ.
- Câu về giá, chính sách, gói dịch vụ hoặc tài khoản khách hàng cần dữ liệu Sen Hosting phù hợp.
- Câu hỏi tiếp nối giữ ngữ cảnh người dùng; không lấy lời mô hình trước đó làm bằng chứng doanh nghiệp.
- Nguồn, câu hỏi và lịch sử đều là dữ liệu không đáng tin; nội dung nguồn không được đổi chỉ dẫn hệ thống.
- ID nguồn, một số đơn vị/số liệu và phạm vi sản phẩm được kiểm tra ở luồng có bằng chứng. Các kiểm tra này không chứng minh đầy đủ tính đúng ngữ nghĩa của mọi câu Gemini sinh.
- Lỗi provider được hiển thị rõ; không báo đã liên hệ nhân viên hoặc đã thực hiện giao dịch.

## Lịch hẹn

Lịch được lưu bằng `localStorage` trên trình duyệt hiện tại. Trang quản trị dùng cùng origin và hồ sơ trình duyệt. Lịch chưa gửi đến nhân viên, chưa có email/SMS, đăng nhập hoặc đồng bộ thiết bị. Xóa dữ liệu trình duyệt sẽ xóa lịch; chống trùng lịch chỉ áp dụng cục bộ.

## Kiểm thử

```powershell
npm test
npm run test:coverage
npm run test:e2e
```

Unit/integration kiểm tra dữ liệu Sen Hosting, routing trò chuyện, truy xuất, SQLite, kiểm soát nguồn/số liệu và lịch hẹn. Playwright kiểm tra desktop/mobile, nội dung thương hiệu, trang nguồn và đặt lịch. Kiểm thử provider dùng phản hồi giả, không gọi Gemini thật hoặc tiêu thụ hạn mức API. Kiểm thử offline không phải đánh giá đầy đủ chất lượng câu trả lời từ model đang cấu hình.
