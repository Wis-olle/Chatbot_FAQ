# Kịch bản video demo Sen Hosting — 1 phút 55 giây

**Đội WIS · Bảng A · Đề 4: Chatbot FAQ & đặt lịch tư vấn**

Mục tiêu: thể hiện đủ 5 chức năng bằng thao tác thực tế, xuất video dài 01:55 để còn 5 giây dự phòng so với giới hạn 02:00.

## Điều kiện trước khi quay

**Đã xử lý trong bản quay cục bộ ngày 09/11/2026:** ở Release `v1.0.0`, câu hỏi kiến thức chung đi thẳng vào Gemini, chưa đưa đáp án FAQ vào luồng diễn đạt. Bản dùng để quay đã bổ sung truy xuất FAQ trước Gemini cho câu hỏi/alias khớp kho và hướng dẫn model diễn đạt tự nhiên, giữ nguồn. Đã quay thật cả 8 câu trong cùng hội thoại: 8 phản hồi `source=gemini`, giữ đúng nguồn, khác nguyên văn đáp án mẫu và có 3 gợi ý mỗi lượt. Bản sửa được đưa vào Release `v2.0.0`; Release `v1.0.0` giữ nguyên.

Khi quay lại, xác nhận backend lấy đúng nội dung nguồn, Gemini diễn đạt từ nội dung đó và giao diện có 3 câu liên quan. Chỉ có `mode=gemini` hoặc câu trả lời trôi chảy chưa đủ chứng minh bước lấy đáp án từ FAQ. Không đổi sang retrieval giữa video rồi thuyết minh rằng AI đã diễn đạt.

Các điểm đã kiểm tra offline khi soạn kịch bản:

- 8 câu ở danh sách bên dưới đều có trong kho Sen Hosting; retrieval trả `answer`, có nguồn và đúng 3 gợi ý cho từng câu khi kiểm tra độc lập.
- Câu về bồi thường ở mốc 01:02 trả `fallback` trong kho hiện tại; giao diện có nút **Đặt lịch tư vấn ↗** cho loại phản hồi này.
- Form có ngày/giờ, tên, điện thoại; trang quản trị có nút **Xóa lịch đã xử lý**. Lịch hẹn chỉ lưu localStorage, chưa gửi nhân viên.
- Phiên quay đã xác minh cả chuỗi 8 câu và câu fallback cùng hội thoại với Gemini thật. Cảnh chờ mạng được rút gọn khi dựng; có một lần thử lại lỗi provider 502 trong bản ghi thô.

## Chuẩn bị cảnh quay

- Dùng một domain và một hồ sơ trình duyệt xuyên suốt, ví dụ bản demo Netlify hoặc localhost; trang chat và quản trị phải cùng origin để đọc được lịch hẹn.
- Mở sẵn ứng dụng ở màn hình chat, cửa sổ đủ lớn để đọc rõ câu trả lời và cả 3 gợi ý. Mở sẵn `sen-hosting/content/faqs.json` trong trình soạn thảo ở tab/cửa sổ khác, chỉ vùng câu hỏi/đáp án.
- Dùng Gemini thật đã cấu hình ở backend. Kiểm tra trạng thái trước khi quay; không mở `.env`, trang quản lý API key hoặc màn hình có thông tin riêng.
- Chuẩn bị 8 câu để dán lần lượt, tránh mất thời gian gõ. Các câu tương ứng với nội dung đã có trong kho, không cần hỏi kiến thức mới.
- Dùng dữ liệu minh họa: tên **Khách Demo WIS**, số điện thoại **0912345678** (chỉ nhập để minh họa kiểm tra định dạng; không gọi/SMS), chủ đề **Tư vấn chính sách bồi thường khi website gián đoạn**. Chọn **ngày mai, 09:00**, hoặc một khung giờ tương lai còn trống.
- Dùng hồ sơ trình duyệt demo không có lịch thật. Nếu có lịch thử cũ, dọn từng lịch thử bằng giao diện trước khi quay; không xóa toàn bộ dữ liệu trình duyệt.
- Quay thao tác thật rồi cắt thời gian gõ/chờ mạng. Ở đoạn dựng nhanh ghi **“Đã rút gọn thao tác và thời gian chờ”**; giữ rõ câu hỏi, câu trả lời và đủ 3 gợi ý của từng lượt. Không thay phản hồi API bằng ảnh hoặc nội dung dựng sẵn.

## Timeline và lời thoại

| Thời gian | Hình ảnh/thao tác thực tế | Lời thuyết minh |
|---|---|---|
| **00:00–00:06** | Mở chat Sen Hosting. Chữ góc màn hình: **WIS · Bảng A · Đề 4**. | “Đội WIS giới thiệu Sen Hosting: chatbot FAQ kết hợp đặt lịch tư vấn.” |
| **00:06–00:12** | Chuyển sang `faqs.json`, cho thấy các trường `question`, `answer`, rồi trở lại ứng dụng. | “Đội xây dựng bộ FAQ mẫu. Sau đây là tám câu hỏi có trong bộ kiến thức.” |
| **00:12–00:20** | Gửi câu 1 “Hosting là gì?”. Giữ câu trả lời và đủ 3 gợi ý khoảng 3 giây. Phụ đề **1/8 — Hosting**. | “Chatbot trả lời từ nội dung đã chuẩn bị và gợi ý ba câu hỏi liên quan.” |
| **00:20–00:48** | Dựng 7 lượt trả lời câu 2–8, mỗi lượt 4 giây. Mỗi lượt thấy câu hỏi, câu trả lời và cả 3 gợi ý. Phụ đề **2/8…8/8**; hiện chú thích rút gọn thời gian chờ. | “Bộ câu hỏi bao phủ tên miền, Shared Hosting, dung lượng, WordPress, DNS, VPS và SSL. Mỗi lượt đều có ba hướng hỏi tiếp.” |
| **00:48–01:02** | Giữ lại đáp án câu 8, chỉ con trỏ vào 3 gợi ý. Bấm một gợi ý, chờ câu trả lời thật rồi giữ cả 3 gợi ý mới. Chọn gợi ý có nội dung trong kho khi chạy thử trước. | **Chỉ dùng sau khi đã sửa và kiểm tra luồng FAQ → AI:** “Gemini diễn đạt lại đáp án FAQ cho tự nhiên, giữ nội dung nguồn và đề xuất ba câu hỏi tiếp theo. Người dùng có thể bấm để tiếp tục.” |
| **01:02–01:16** | Dán câu ngoài dữ liệu: **“Sen Hosting cam kết bồi thường bao nhiêu nếu website ngừng hoạt động 3 giờ?”**. Hiện phản hồi thiếu thông tin và nút **Đặt lịch tư vấn ↗**; bấm nút. | “Khi chưa có thông tin xác nhận về bồi thường, chatbot nói rõ giới hạn và chủ động đề xuất đặt lịch với nhân viên.” |
| **01:16–01:34** | Chọn ngày mai và 09:00; nhập tên, số điện thoại, chủ đề. Bấm **Xác nhận đặt lịch**. Giữ thông báo **Lịch hẹn đã sẵn sàng** cùng tên/ngày giờ. | “Khách chọn ngày, giờ, nhập tên và số điện thoại, rồi xác nhận. Lịch được lưu trên trình duyệt bằng localStorage; bản demo chưa gửi đến nhân viên.” |
| **01:34–01:49** | Bấm **Xem lịch hẹn**. Hiện lịch vừa tạo, tải lại trang để chứng minh còn lưu. Bấm **Xóa lịch đã xử lý**, xác nhận hộp thoại; tải lại, hiện **Chưa có lịch hẹn nào**. | “Trang quản trị hiển thị lịch đã đặt. Tải lại vẫn còn dữ liệu. Khi xử lý xong, có thể xóa lịch; tải lại xác nhận lịch đã được xóa.” |
| **01:49–01:55** | Giữ ứng dụng hoặc hình kết. Chữ: **FAQ · AI + 3 gợi ý · Chuyển tư vấn · Đặt lịch · Quản trị**. | “Sen Hosting hỗ trợ xuyên suốt từ hỏi đáp đến đặt lịch và quản lý lịch tư vấn. Cảm ơn ban giám khảo.” |

## 8 câu FAQ — sao chép để quay

Giữ nguyên các câu này khi chuẩn bị cảnh quay. Hai câu đầu và câu 8 nên cho người xem đủ thời gian đọc; những lượt còn lại có thể rút gọn thời gian nhập/chờ.

| STT | Câu hỏi | Nội dung chính cần thấy trong đáp án | ID trong kho |
|---|---|---|---|
| 1 | Hosting là gì? | Nơi lưu trữ, môi trường vận hành website | `SEN-HOSTING-DEFINITION` |
| 2 | Hosting và tên miền khác nhau thế nào? | Tên miền là địa chỉ; hosting lưu trữ/vận hành nội dung | `SEN-HOSTING-DOMAIN` |
| 3 | Shared Hosting là gì? | Nhiều website dùng tài nguyên của một máy chủ | `SEN-SHARED-HOSTING` |
| 4 | Dung lượng hosting và băng thông khác nhau thế nào? | Không gian lưu trữ và lượng/khả năng truyền dữ liệu | `SEN-STORAGE-BANDWIDTH` |
| 5 | WordPress Hosting là gì? | Môi trường được chọn hoặc cấu hình để chạy WordPress | `SEN-WP-DEFINITION` |
| 6 | DNS là gì? | Phân giải tên miền, bản ghi cho website/email | `SEN-DOMAIN-DNS` |
| 7 | VPS là gì? | Máy chủ ảo, có tài nguyên và môi trường quản lý riêng | `SEN-VPS-DEFINITION` |
| 8 | SSL là gì? | Mã hóa kết nối bằng SSL/TLS; không đồng nghĩa website tuyệt đối an toàn | `SEN-SSL-DEFINITION` |

Không yêu cầu AI nói nguyên văn cột nội dung; kiểm tra không làm sai ý hoặc thêm cam kết kinh doanh chưa có.

## Đối chiếu 5 chức năng

| Yêu cầu | Cảnh chứng minh |
|---|---|
| 1. Trả lời 08–10 FAQ từ dữ liệu đội xây dựng | 00:06–00:48: mở dữ liệu và 8 lượt hỏi đáp; cần kiểm tra luồng dùng đúng FAQ trước quay |
| 2. AI diễn đạt tự nhiên + 03 gợi ý sau mỗi lượt | 00:12–01:02: giữ gợi ý của mọi lượt, bấm một gợi ý; cần nối/kiểm tra FAQ → Gemini trước khi khẳng định đầy đủ |
| 3. Không trả lời được thì đề xuất đặt lịch | 01:02–01:16: câu bồi thường chưa có dữ liệu → nút đặt lịch |
| 4. Form ngày/giờ, tên/điện thoại, lưu localStorage | 01:16–01:34 và lần tải lại đầu tiên ở 01:34–01:49 |
| 5. Quản trị xem/xóa lịch | 01:34–01:49: xem, xóa, tải lại |

## Khi dựng bản cuối

- Giữ tổng thời lượng **01:55**, không để intro/logo dài lấn phần thao tác.
- Nếu thiếu thời gian, cắt phần di chuyển chuột/gõ/chờ; giữ đủ 8 lượt, 3 gợi ý, kết quả lưu, kết quả tải lại và xác nhận xóa.
- Không đọc toàn bộ 8 đáp án. Lời thoại giải thích cơ chế, màn hình chứng minh kết quả.
- Giữ một nhịp dừng để đọc thông báo thiếu dữ liệu và nút chuyển sang đặt lịch.
- Trang quản trị demo không có đăng nhập/phân quyền. Không thuyết minh đây là hệ thống quản trị bảo mật hoặc lịch đã được nhân viên tiếp nhận.
- Chỉ gắn nhãn **AI thật — Gemini** cho cảnh có gọi provider thật thành công. Nếu quay retrieval, phải ghi rõ không có AI sinh diễn đạt trong cảnh đó.
- Kịch bản này thuộc mục 03; không tự cập nhật ZIP/Release `v1.0.0`. Bản quay đã sửa luồng AI cục bộ; cần chuẩn bị phiên bản source tương ứng trước khi nộp.

## Bản video đã sản xuất ngày 09/11/2026

- Tệp dựng: `dist/video/Sen-Hosting-WIS-Demo.mp4`; phụ đề rời cùng tên `.srt`. Bản bàn giao còn được xuất sang vùng lưu artifact của chat để tránh bị lệnh build xóa cùng `dist/`.
- MP4 H.264/AAC, 1920 × 1080, 30 fps, thời lượng chính xác 115 giây (01:55).
- Giọng đọc tiếng Việt tổng hợp cục bộ, có phụ đề gắn vào hình. Không sử dụng giọng của thành viên đội.
- Quay thao tác thật trên ứng dụng local, dùng Gemini thật. Đã đối chiếu 8/8 FAQ với nguồn, 8/8 đáp án khác nguyên văn và đúng 3 gợi ý mỗi lượt. Phần chờ mạng được rút gọn khi dựng.
- Đã thể hiện fallback → mở form → lưu localStorage → tải lại còn lịch → xóa → tải lại không còn lịch.
- Kiểm thử bản source cục bộ: 241/241 unit/integration đạt, line coverage 99,39%; E2E 34 đạt, 2 ca chỉ dành cho mobile bỏ qua trên desktop.
- Chưa upload video, commit/push bản sửa hoặc cập nhật Release. Video và source nộp bài cần đồng bộ trước khi chốt hồ sơ.

## Bản bổ sung v3 theo yêu cầu của đội

- Đội cho phép vượt nhẹ 2 phút. Bản v3 dài **02:19**, giữ nguyên 27 đoạn hình của bản 01:55 và thêm 24 giây tư vấn theo nhu cầu ở mốc 01:02–01:26. Hai tiêu đề lớn giữa màn hình đã bỏ từ v2 không xuất hiện lại.
- Lời đọc mới giải thích rõ cơ chế truy xuất FAQ → Gemini, 3 gợi ý, nguồn đối chiếu, ngữ cảnh hội thoại, giới hạn dữ liệu, fallback, kiểm tra form và lưu/xóa lịch. Phụ đề đã thay theo lời đọc mới và chia ngắn để dễ đọc.
- Cảnh quay bổ sung dùng Gemini thật với hai lượt: khách mở shop quần áo, cần website WordPress và chi phí tiết kiệm; sau đó bổ sung ưu tiên dễ quản lý. Bot giữ ngữ cảnh và gợi ý WPH-Start/LH1 từ danh mục. Cả hai phản hồi là `route=consultation`, `source=gemini`, có 3 gợi ý.
- Cách diễn đạt trong video là **“không giới hạn ở câu hỏi mẫu”**: bot vẫn dùng FAQ cho câu đã có trong kho, đồng thời hiểu mô tả nhu cầu tự do để tư vấn theo ngữ cảnh. Giá/cấu hình trên thẻ lấy từ snapshot và cần đối chiếu trước giao dịch.
- Tệp dựng mới: `dist/video/v3/Sen-Hosting-WIS-Demo-v3.mp4`, kèm phụ đề `.srt`; bản bàn giao xuất riêng vào vùng artifact của chat. Bản v2 vẫn được giữ lại.

## Bản giọng Giang — ElevenLabs

- Theo yêu cầu đội, thay giọng đọc bằng **Giang - Northern female Narrator**, voice ID `f5q6kePPoQAjCPYG6moa`. Đã dùng plugin ElevenLabs để tạo lời đọc hoàn chỉnh bằng `eleven_v4`.
- MP3 gốc dài 145,44 giây. Đã kiểm tra bằng bản nhận dạng lời nói: khớp đủ 496 từ của thuyết minh, không có lời quảng cáo thêm vào.
- Căn riêng 16 đoạn vào các cảnh cũ, điều chỉnh tốc độ giữ cao độ và chuẩn hóa âm lượng; video cuối giữ nguyên 139 giây (02:19). Phụ đề được căn bằng mốc từng từ.
- Tệp xuất: `dist/video/elevenlabs/Sen-Hosting-WIS-Demo-Giang.mp4`, `Sen-Hosting-WIS-Thuyet-minh-Giang.mp3` và `Sen-Hosting-WIS-Demo-Giang.srt`; có bản bàn giao riêng trong vùng artifact của chat.
- Giữ nguyên cảnh hình, cảnh tư vấn mở rộng và việc đã bỏ hai khối tiêu đề lớn giữa màn hình. Các bản video trước vẫn được giữ lại.
