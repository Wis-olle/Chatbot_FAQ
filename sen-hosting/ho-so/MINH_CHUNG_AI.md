# Minh chứng sử dụng AI xây dựng Sen Hosting

Đội WIS | Bảng A Công nghệ | Đề 4 Chatbot FAQ và đặt lịch tư vấn

## Mục tiêu và công cụ

Xây dựng chatbot tiếng Việt trả lời FAQ, gợi ý 3 câu hỏi liên quan, đề xuất đặt lịch khi thiếu thông tin và lưu lịch bằng localStorage. Nhóm dùng Codex hỗ trợ phân tích, sửa mã và kiểm thử; Gemini là AI tích hợp trong sản phẩm.

## Yêu cầu cho AI

Đoạn hội thoại 1, trích yêu cầu thật: “đồng thời câu trả lời tự nhiên gen bằng gemini, không nhất thiết lúc nào cũng trả lời bằng câu có sẵn, khi nào khách hàng hỏi các câu cần sử dụng dữ liệu của sen hosting mới cần đến các câu trả lời có sẵn và data, backend”.

## Vấn đề phát hiện và yêu cầu sửa

Khi đối chiếu yêu cầu số 2 của đề, nhóm phát hiện thiếu gợi ý hỏi tiếp. Đoạn hội thoại 2, trích yêu cầu thật ngày 09/11/2026: “đề như sau chưa thấy AI gợi ý 3 câu hỏi liên quan sau mỗi lượt trả lời”.

## Thay đổi sau phản hồi

Đoạn hội thoại 3, trích phản hồi Codex cùng lượt: “Đã sửa để sau mỗi lượt trả lời hiển thị **“3 câu hỏi liên quan”**:” và “Tự bổ sung khi thiếu, loại câu rỗng hoặc trùng.” Mã hiện tại tạo gợi ý theo ngữ cảnh, bổ sung dự phòng và cho phép bấm để hỏi tiếp.

## Kết quả kiểm tra lại

Ngày 09/11/2026, kiểm thử lại toàn bộ: 241/241 ca Node.js đạt; E2E 34 đạt, 2 ca chỉ dành mobile bỏ qua trên desktop; Python FAQ 66/66 và nhập danh mục 3/3 đạt. Line coverage Node.js 99,39% trên các tệp cấu hình đo. Các ca suggestions, AI và E2E xác nhận đủ 3 gợi ý, xử lý thiếu hoặc trùng và thao tác hỏi tiếp.

## Đối chiếu minh chứng

Có 3 đoạn trích văn bản, không kèm ảnh. Nguồn: chat “Crawl dữ liệu FAQ Vinahost”, lượt 01a1b59b-cb0f-7b03-9f35-91b957ca5aec; chat “Add AI-suggested related questions”, lượt 01a1bf81-bb91-7e32-9d9f-46c4fafa7ae9. Kết quả lần này là kiểm thử offline bằng retrieval/provider giả, chưa đánh giá Gemini thật. Xem bảng và log kiểm thử đi kèm.
