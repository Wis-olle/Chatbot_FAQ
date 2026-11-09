# <Tên sản phẩm> — Cuộc thi Vibe Coding 2026

> Các mục dạng `<...>` là thông tin cần đội điền trước khi nộp bài.

## 1. Thông tin chung

| Hạng mục | Nội dung |
|---|---|
| Tên đội thi | `<Tên đội>` |
| Bảng thi | `<Bảng A - Công nghệ \| Bảng B - Kinh tế>` (chọn một) |
| Đề bài bốc thăm | Đề số `<số>` — `<Tên đề, ví dụ: AI tư vấn chọn gói Hosting/Domain>` |
| Demo online | `<URL nếu có; bảng B có thể chạy từ source>` |
| Video demo (≤ 02 phút) | `<URL>` |
| Source ZIP | `<URL tải gói mã nguồn ZIP>` |
| Minh chứng dùng AI | `<Kèm trong ZIP hoặc URL riêng>` |
| Bảng kiểm thử | `<Kèm trong ZIP hoặc URL riêng>` |

> Tiêu chí vòng loại: https://vibecoding.info.vn/tieu-chi-cham-thi
> Bảng A: ít nhất 6 ca kiểm thử; chỉ dùng Mock thì nhóm A3 tối đa 4/15 điểm.
> Bảng B: ít nhất 3 ca kiểm thử; AI thật hoặc Mock minh bạch đều có thể đạt 100/100 theo chuẩn bảng B.
> Không đưa khóa API hoặc mật khẩu vào bài nộp.

## 2. Tính năng chính

- `<Tính năng 1: nhập dữ liệu đầu vào>`
- `<Tính năng 2: AI phân tích và gợi ý>`
- `<Tính năng 3: lưu / xem / xoá lịch sử>`
- `<Tính năng 4 theo đề>`
- `<Tính năng 5 theo đề>`

## 3. Công nghệ sử dụng

| Lớp | Công nghệ (ghi đúng thứ đã dùng) |
|---|---|
| Giao diện | `<HTML/CSS/JS thuần \| React \| Vue>` + `<Tailwind CSS hoặc không>` |
| Thư viện | `<Chart.js, Lucide Icons, ...>` (kèm phiên bản) |
| Lưu trữ | localStorage (phía trình duyệt, không có backend) |
| Triển khai | `<Vercel \| Netlify \| GitHub Pages>` |

## 4. Tích hợp AI

- **Chế độ đang dùng**: `<API thật | Mock>` (chọn một)
  - API thật: `<Tên model, ví dụ gpt-4o-mini / gemini-1.5-flash>`
  - Mock: giao diện hiển thị dòng *"Bản demo vòng loại - Dữ liệu mô phỏng AI"*
- **Mục đích**: phân tích dữ liệu người dùng nhập và trả về gợi ý theo ngữ cảnh đề bài.
- **Bảo mật khoá API**: không ghi khoá trong mã nguồn phía client. Đặt trong biến môi trường (`.env`, không commit) và gọi qua serverless function / proxy; nếu chỉ dùng Mock thì không cần khoá.

Biến môi trường (nếu dùng API thật):

```env
AI_API_KEY=<khoá của bạn>
AI_MODEL=<tên model>
```

## 5. Cài đặt và chạy local

Yêu cầu: trình duyệt hiện đại; Node.js ≥ 18 nếu dùng React/Vue/Vite.

**Cách A — HTML/CSS/JS thuần**

1. Giải nén file ZIP.
2. Mở trực tiếp `index.html` trên trình duyệt, hoặc chạy server tĩnh: `npx serve .`

**Cách B — React/Vue (Vite)**

```bash
npm install
npm run dev      # chạy dev, mặc định http://localhost:5173
npm run build    # build production ra thư mục dist/
```

> Chỉ giữ lại cách phù hợp với dự án của đội, xoá cách còn lại.

## 6. Cấu trúc thư mục

```text
<tên-dự-án>/
├── index.html
├── src/            # mã nguồn
├── public/         # tài nguyên tĩnh
├── .env.example    # mẫu biến môi trường (nếu có)
└── README.md
```

## 7. Truy cập và phân quyền

- Không yêu cầu đăng nhập; chuyển đổi giữa màn hình người dùng và màn hình quản trị ngay trên giao diện.
- Màn hình quản trị: xem và xoá danh sách bản ghi trong localStorage.

## 8. Giới hạn hiện tại

- Dữ liệu chỉ lưu trên trình duyệt hiện tại; xoá dữ liệu trình duyệt hoặc đổi thiết bị sẽ mất dữ liệu.
- Không có xác thực, nên màn hình quản trị không bảo mật.
- Tính năng AI ở mức demo phục vụ vòng loại (nếu dùng Mock, dữ liệu trả về không phải kết quả thật).

## 9. Nguồn tham khảo

- Google Fonts, Lucide Icons
- Bộ thông số dịch vụ mẫu do Ban tổ chức cung cấp


## 10. Minh chứng dùng AI để xây dựng sản phẩm

Tối đa 1 trang kèm tối đa 5 ảnh/đoạn hội thoại chọn lọc. Ghi mục tiêu → yêu cầu cho AI → vấn đề phát hiện khi thử → yêu cầu sửa → kết quả kiểm tra lại.

- `<Tên tệp minh chứng hoặc liên kết>`
- `<Tóm tắt một vòng thử và cải thiện>`

## 11. Bảng kiểm thử

Bảng A: ít nhất 6 ca, gồm 2 bình thường, 2 đầu vào không hợp lệ, 2 ca biên/sự cố. Bảng B: ít nhất 3 ca, gồm bình thường, nhập thiếu/sai và một ca biên. Chấp nhận kiểm tra thủ công; ghi kết quả thực tế.

| Mã ca | Loại ca | Dữ liệu và bước thử | Kỳ vọng | Kết quả thực tế | Đạt/Chưa đạt |
|---|---|---|---|---|---|
| TC01 | `<Bình thường>` | `<Điền>` | `<Điền>` | `<Điền sau khi thử>` | `<Điền>` |

## 12. Hồ sơ bàn giao

- Source ZIP chứa mã nguồn và README này; chỉ kèm cấu hình mẫu.
- Video tối đa 2 phút thể hiện thao tác thực tế và đủ 5 tính năng.
- Minh chứng dùng AI và bảng kiểm thử nằm trong ZIP hoặc có liên kết riêng.
- Ghi rõ tài khoản/dữ liệu demo nếu có.
- Bản nộp trước hạn là căn cứ chấm; không sửa tính năng sau hạn nộp.
