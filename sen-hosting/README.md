# Kho kiến thức Sen Hosting

## Danh mục đã nhập để tư vấn

`content/catalog.json` hiện gồm 74 mục từ bản crawl đã có: 26 đuôi tên miền, 23 gói hosting, 13 VPS và 12 email. Chủ dự án đã yêu cầu sử dụng danh mục này cho Sen Hosting; `reviewMethod: owner-requested-crawl-import` ghi nhận lần nhập đó, không phải xác minh giá hiện tại.

Runtime ghép danh mục vào SQLite và ngữ cảnh tư vấn. Model chỉ chọn ID sản phẩm; tên, giá, cấu hình và liên kết được lấy lại từ dữ liệu gốc của từng mục. Nguồn công khai là `/knowledge/SEN-CATALOG-*`; xuất xứ bản crawl nằm riêng ở `prepared/catalog-provenance.json`.

Chạy `npm run import:catalog` từ thư mục dự án để nhập lại HTML đã lưu. Giá giữ nguyên bản chụp và điều kiện cần đối chiếu, không tự suy ra VAT hoặc chu kỳ. Tên miền được gợi ý luôn chưa kiểm tra còn trống vì chưa tích hợp API availability.

`content/faqs.json` chứa 40 FAQ kiến thức chung được biên soạn riêng. Các mục có `companySpecific: false`; chúng không xác nhận giá, cấu hình, lịch sao lưu hay cam kết dịch vụ của Sen Hosting.

`content/business-profile.json` là nơi nhập dữ liệu doanh nghiệp. Các trường giá, hoàn tiền, sao lưu, SLA và liên hệ hiện để `null`; `entries` hiện rỗng. Việc đổi tên thương hiệu không tự kích hoạt chính sách của nguồn tham khảo.

## Thêm thông tin kinh doanh đã xác nhận

Thêm từng FAQ vào mảng `entries`, ví dụ bản nháp sau:

```json
{
  "id": "SEN-BUSINESS-001",
  "question": "Gói dịch vụ này có giá và chu kỳ như thế nào?",
  "answer": "Nhập giá thực tế, chu kỳ, VAT và điều kiện áp dụng do Sen Hosting xác nhận.",
  "service": "hosting-gia-re",
  "serviceLabel": "Tên gói thực tế",
  "category": "hosting",
  "topic": "pricing",
  "sourceUrl": "/knowledge/SEN-BUSINESS-001",
  "updatedAt": "2026-11-07T00:00:00Z",
  "ownerConfirmed": false,
  "reviewStatus": "draft",
  "companySpecific": true
}
```

Thay câu trả lời và thời điểm bằng dữ liệu thật. Chỉ sau khi chủ dự án xác nhận nội dung mới đặt đồng thời `ownerConfirmed: true` và `reviewStatus: "sen_approved"`, giữ `companySpecific: true`. Cả ba điều kiện đều bắt buộc để công bố. ID phải bắt đầu bằng `SEN-`, dùng chữ hoa/số/dấu gạch ngang và duy nhất; URL phải đúng `/knowledge/<id>`.

Các mục chưa đủ điều kiện ở lại bản nháp trong `prepared/pending-business-review.json`. Mục được xác nhận xuất hiện trong `prepared/knowledge.json` với `knowledgeType: "business"`, `reviewStatus: "sen_approved"`. Builder không tự phê duyệt bảng giá, không suy ra chính sách từ các trường `null` và không tự sao chép cam kết cũ.

Từ thư mục dự án, chạy:

```powershell
node sen-hosting/build-knowledge.js
```

Sau đó chạy kiểm thử và khởi động lại web để nạp dữ liệu. Giữ giá/điều kiện mới nhất trong FAQ đã xác nhận; dữ liệu không còn đúng cần đưa về `draft` trước khi build lại.

`prepared/pending-sen-review.json` chứa tài liệu tham khảo cũ cùng xuất xứ nội bộ để đối chiếu. Tệp này không phải chính sách của Sen Hosting và không được dùng làm bằng chứng trả lời khách. Dữ liệu crawl gốc được giữ nguyên, tách khỏi dữ liệu đang công bố.
