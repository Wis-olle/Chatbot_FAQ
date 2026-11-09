# Dữ liệu VinaHost cho chatbot FAQ

Bộ dữ liệu lấy từ các trang công khai tại [vinahost.vn](https://vinahost.vn/), làm nguồn tra cứu cho chatbot độc lập trong thư mục cha. Snapshot được thu thập ngày **07/11/2026**; từng nguồn có `fetched_at` (UTC). Phạm vi gồm các dịch vụ được liên kết từ menu/trang chủ, chính sách và hỗ trợ được chọn; không phải crawl toàn bộ domain.

## Hai lớp dữ liệu

`data/` giữ snapshot gốc: **114 nguồn, 951 FAQ và 9.867 chunks**. `prepared/` là lớp dữ liệu đã chuẩn bị cho chatbot: **75 mục gồm 69 FAQ và 6 đoạn tài liệu**, còn **882 FAQ chờ kiểm tra**. Số hiện tại sau mỗi lần chạy nằm trong các report.

FAQ gốc vẫn có `review_status: unreviewed`. Bước chuẩn bị chỉ gắn `reviewStatus: source_checked` cho nội dung được chọn và đối chiếu với snapshot. Trạng thái này xác nhận tính nhất quán với bản nguồn đã lưu, **không phải phê duyệt nghiệp vụ của VinaHost hoặc bảo đảm thông tin còn đúng hiện tại**.

| Tệp/thư mục | Mục đích |
|---|---|
| `data/sources.jsonl` | Nguồn: URL, tiêu đề, danh mục, nội dung, thời điểm và hash |
| `data/faqs.jsonl`, `data/faqs.csv` | Cặp hỏi–đáp từ FAQ HTML/JSON-LD, có nguồn và cách trích xuất |
| `data/chunks.jsonl` | Đoạn nội dung theo heading và liên kết nguồn |
| `data/vinahost.sqlite`, `schema.sql` | DB và schema của toàn bộ snapshot crawl gốc |
| `data/raw/*.html.gz`, `data/pages/*.json` | HTML nén và cache từng trang để đối chiếu/tái trích xuất |
| `data/knowledge.md` | Nội dung nguồn gộp để đọc |
| `data/report.json`, `data/crawl-manifest.jsonl` | Thống kê và kết quả từng URL được thử |
| `data/discovery.json`, robots/sitemap | URL phát hiện và bản lưu khảo sát website |
| `curation/selection.json` | FAQ ID/đoạn nguồn được chọn có chủ đích để kiểm tra |
| `prepared/knowledge.json` | Entry chuẩn hóa: sản phẩm, chủ đề, nội dung, nguồn, trạng thái và cờ cần xác nhận |
| `prepared/knowledge.sqlite` | DB/FTS mà chatbot Node dùng trực tiếp |
| `prepared/review-queue.csv`, `prepared/review-queue.json` | FAQ đang chờ xử lý và lý do |
| `prepared/cleaned-chunks.jsonl` | Chunks đã làm sạch, vẫn chờ duyệt, chưa tự kích hoạt |
| `prepared/preparation-report.json` | Kết quả chuẩn bị và ý nghĩa trạng thái |
| `prepared/evaluation-report.json` | Kết quả đánh giá retrieval offline |

JSONL dùng UTF-8. Dữ liệu gốc nối qua `source_id` và `sources.id`; entry chuẩn bị dùng camelCase (`sourceId`, `sourceUrl`, `fetchedAt`). CSV bảo vệ ô bắt đầu bằng ký hiệu công thức bằng dấu nháy đơn.

## Tích hợp hiện tại: Node đọc SQLite trực tiếp

Chatbot ở thư mục cha **đã tích hợp** lớp `prepared/`. Cần Node.js 24 trở lên có `node:sqlite`; không cần chạy Python API cho chatbot.

```powershell
cd 'E:\AI Agents\vibe coding'
npm run prepare:knowledge
$env:CHAT_MODE = 'retrieval'
npm start
```

Mở [chatbot](http://localhost:5173). `prepare:knowledge` tạo dữ liệu chuẩn bị; khi khởi động, server so hash của entry và dựng/đọc `prepared/knowledge.sqlite`. Chế độ `retrieval` trả nội dung nguồn, không gọi Gemini. Nếu chưa có API key, server tự dùng chế độ này. `CHAT_MODE=mock` hiện là alias của `retrieval`.

Để dùng Gemini, cấu hình `.env` ở thư mục cha với key/model của bạn và `CHAT_MODE=gemini`, rồi khởi động lại server. Tích hợp không thay model đã cấu hình. Xem [README ứng dụng](../README.md) để biết chế độ, lịch hẹn và kiểm thử.

Luồng xử lý: câu hỏi và lịch sử người dùng → xác định sản phẩm/chủ đề → tìm entry đã kiểm tra → chọn bằng chứng → trả nội dung hoặc Gemini diễn đạt → hiển thị nguồn. Câu hỏi thiếu phạm vi hoặc đề cập nhiều sản phẩm cần hỏi rõ. FAQ/đoạn nguồn khác sản phẩm không được dùng để mượn thông số.

Gemini chỉ nhận bằng chứng từng lượt; nội dung crawl, câu hỏi và lịch sử đều được coi là dữ liệu không đáng tin. Server đối chiếu ID nguồn và một số số liệu/đơn vị/phạm vi. Các guard này chưa xác minh toàn bộ ngữ nghĩa. Giá, ưu đãi và mục `requiresConfirmation` không tự trở thành báo giá hiện tại; kiểm tra URL gốc và điều kiện trước khi xác nhận cho khách.

## Chọn và cập nhật dữ liệu

Danh sách trong `curation/selection.json` là lựa chọn có chủ đích, không phải lệnh tự kích hoạt toàn bộ 951 FAQ. Muốn mở rộng kho, đọc nguồn, kiểm tra phạm vi/điều kiện, bổ sung FAQ ID hoặc đoạn tài liệu phù hợp cùng hash đã đối chiếu rồi chạy lại bước chuẩn bị. Đừng đổi trạng thái hàng loạt chỉ để tăng số câu trả lời.

Danh sách thực tế ghim `expectedFaqHashes` theo ID FAQ gốc và `expectedDocumentHashes` theo ID tài liệu. Hash FAQ đối chiếu với nội dung câu hỏi–đáp và hash của crawler; hash tài liệu áp dụng cho đoạn trả lời đã chuẩn hóa. Nội dung thay đổi, kể cả vẫn khớp nguồn mới, được đưa về hàng chờ với lý do `source-content-changed-needs-review`; mục được chọn nhưng thiếu pin cũng chưa được kích hoạt. Chỉ cập nhật pin sau khi kiểm tra lại văn bản và điều kiện áp dụng. Không tự tạo lại toàn bộ pin trong lần crawl/chuẩn bị thông thường.

Khi chuẩn bị, hệ thống kiểm tra liên kết nguồn, nội dung FAQ với snapshot/HTML, trùng trong cùng dịch vụ, rồi tạo review queue cho mục không đủ điều kiện. Những chunks ngắn, ô bảng thiếu ngữ cảnh và phần nhiễu bị lọc; phần còn lại vẫn cần duyệt trước khi sử dụng. Các giá trị nguồn cũ không nên được hiểu là dữ liệu đã xác nhận ở hiện tại.

Quy trình cập nhật:

1. Sao lưu snapshot nếu cần giữ lịch sử; crawl lại nội dung công khai.
2. Đối chiếu thay đổi với danh sách chọn và kiểm tra các mục cần xác nhận; kiểm tra lại nội dung thiếu/thay đổi/không khớp, rồi chỉ cập nhật pin cho mục được chấp nhận.
3. Từ thư mục cha chạy `npm run prepare:knowledge`, xem `prepared/preparation-report.json` và review queue.
4. Chạy kiểm thử/đánh giá, rồi khởi động lại server. Runtime giữ dữ liệu trong bộ nhớ cho tới lần khởi động lại; SQLite được dựng lại khi hash entry đổi.

Bước chuẩn bị đọc `data/` và ghi `prepared/`, không ghi đè snapshot crawl gốc. Bản mã trước tích hợp và bộ test FAQ demo cũ được giữ trong `backups/before-chatbot-integration-20261107/`.

## Crawler Python

Tại máy hiện tại, Python venv của MinGW nằm ở `.venv\bin\python.exe`. Venv chuẩn Windows thường dùng `.venv\Scripts\python.exe`; thay đường dẫn tương ứng khi cài mới.

```powershell
cd 'E:\AI Agents\vibe coding\faq'
$faqPython = '.\.venv\bin\python.exe'
& $faqPython -m faqdata.crawl --output data --limit 150 --delay 1
& $faqPython -m faqdata.crawl --output data --limit 150 --delay 1 --refresh
& $faqPython -m faqdata.crawl --output data --reextract
```

Nếu cần tạo môi trường mới, chạy `python -m venv .venv`, kích hoạt/chọn Python của môi trường đó, rồi `python -m pip install -r requirements-dev.txt`.

Crawler kiểm tra `robots.txt`, giới hạn cùng domain và chạy một worker có khoảng nghỉ. Lệnh thường dùng lại cache, nhưng vẫn gọi mạng để khảo sát URL; `--refresh` tải lại trang trong phạm vi chọn. `--reextract` chỉ đọc HTML nén đã lưu, không gọi website; giữ `fetched_at` ban đầu và ghi `reextracted_at` cho thời điểm xử lý lại. `--limit` là số URL được thử, không bảo đảm bằng số nguồn thành công. Kiểm tra report và manifest sau khi chạy.

## Python API độc lập, tùy chọn

API này phục vụ **toàn bộ snapshot gốc chưa duyệt**, hữu ích để khảo sát dữ liệu; không phải API retrieval đang dùng trong chatbot Node.

```powershell
& $faqPython -m faqdata.api --db data/vinahost.sqlite --port 8010
```

API chỉ lắng nghe `127.0.0.1:8010` và cho phép `GET`:

| Đường dẫn | Công dụng |
|---|---|
| `/health` | Đếm nguồn/FAQ/chunks |
| `/api/search?q=ssl&limit=5` | Tìm từ khóa; `q` 1–500 ký tự, `limit` 1–20 |
| `/api/faqs?limit=20&offset=0` | FAQ có phân trang; `limit` 1–100 |
| `/api/faqs?category=hosting&limit=20` | Lọc danh mục nguồn |

Response có dạng `{ "success": true, "data": ..., "meta": ... }`. Search trả nội dung, heading, URL, tiêu đề, danh mục, thời điểm crawl và điểm xếp hạng. Python API dùng FTS5 bỏ dấu và AND các token; chưa có embedding hay mô hình trả lời. Câu dài có thể không khớp; điểm tìm kiếm không phải xác suất đáp án đúng. API này là server phát triển có kiểm tra tham số và hạn mức cục bộ.

## Kiểm thử

Từ thư mục cha:

```powershell
npm test
npm run test:coverage
node --test test/retrieval-eval.test.js
npm run test:e2e
```

Từ thư mục dữ liệu, kiểm thử crawler/API Python riêng:

```powershell
& $faqPython -m unittest discover -s tests -v
& $faqPython -m coverage run --source=faqdata -m unittest discover -s tests
& $faqPython -m coverage report --fail-under=80
```

Các kiểm thử tích hợp dùng dữ liệu cục bộ và provider giả lập, không gọi Gemini trả phí. Bộ 48 câu đánh giá nằm trong `curation/retrieval-eval.json`, chỉ đo retrieval/câu trả lời deterministic. Dùng báo cáo và kết quả chạy hiện tại để xác nhận chất lượng; không coi kiểm thử offline là chứng minh toàn bộ câu trả lời của Gemini chính xác.
