# Bảng kiểm thử đầy đủ Sen Hosting

Đội WIS | Bảng A Công nghệ | Đề 4 Chatbot FAQ và đặt lịch tư vấn | Kiểm thử 09/11/2026 23:13 (UTC+7).

Tổng cộng 346 lượt kiểm thử hiện có: 344 đạt, 0 lỗi, 2 bỏ qua. Gồm 241 ca Node.js, 18 kịch bản E2E chạy trên 2 cấu hình thành 36 lượt, 66 ca Python FAQ và 3 ca nhập danh mục. Hai lượt bỏ qua trên desktop chỉ áp dụng mobile; bản mobile của cả hai đều đạt.

Netlify có 69 ca nằm trong 241 ca Node.js; lượt đo coverage riêng không tạo ca mới. Các ca truy xuất theo dữ liệu được giữ đủ từng ID; ca cha của Node được giữ theo cách đếm của runner. Assertion và biến thể trong cùng một ca không tách thành ca mới. Bộ dữ liệu tham khảo cũ không tự tính là ca đã chạy.

Môi trường: Windows; Node.js v24.18.0; Playwright Chromium với Desktop Chrome và Pixel 7; Python 3.9 trong faq/.venv. E2E tự chạy server 127.0.0.1:5174 với CHAT_MODE=mock (alias retrieval). Node dùng provider giả hoặc tra cứu cục bộ; Python dùng fixture, HTTP giả lập hoặc server local. Không gọi Gemini thật hoặc website crawl trong lượt kiểm thử này.

Coverage: Node.js line 99,39%, branch 90,60%, functions 97,51% trên 12 tệp cấu hình đo; Netlify line 97,54% trên 3 tệp cấu hình đo. Chưa đo coverage toàn frontend hoặc Python trong lượt này.

## Lệnh tái lập

```powershell
npm run test:coverage
npm run test:coverage:netlify
npm run test:e2e -- --reporter=list
# Trong thư mục faq
./.venv/bin/python.exe -m unittest discover -s tests -v
# Trong thư mục gốc
./faq/.venv/bin/python.exe -m unittest discover -s sen-hosting/tests -v
```

## Đối chiếu yêu cầu đề bài

| Yêu cầu | Tệp kiểm thử đối chiếu |
|---|---|
| FAQ 8 đến 10 câu | test/ai-faq.test.js; test/sen-knowledge.test.js; e2e/chatbot.spec.js; e2e/vinahost.spec.js |
| Diễn đạt và 3 câu hỏi liên quan | test/ai.test.js; test/suggestions.test.js; test/ai-consultation.test.js; e2e/chatbot.spec.js |
| Thiếu thông tin đề xuất đặt lịch | test/ai.test.js; test/retrieval-eval.test.js; e2e/chatbot.spec.js; e2e/vinahost.spec.js |
| Form đặt lịch và lưu localStorage | test/appointments.test.js; e2e/chatbot.spec.js |
| Quản trị xem và xóa lịch | test/appointments.test.js; e2e/chatbot.spec.js |

## Các thao tác chi tiết theo mẫu Bảng A

Các dòng dưới minh họa nhánh trong các ca đã có, không cộng thêm vào 346 lượt. Mã ca đối chiếu danh mục đầy đủ.

| Mã ca | Loại ca | Dữ liệu và bước thử | Kỳ vọng | Kết quả thực tế | Đạt hoặc chưa đạt |
|---|---|---|---|---|---|
| TC238 | Bình thường | Hosting và tên miền khác nhau thế nào?; gửi /api/chat ở retrieval. | Trả answer, nguồn Sen Hosting và 3 gợi ý. | Đúng các assertion tương ứng | Đạt |
| TC036 | Bình thường | Nguyễn An, +84 912 345 678; 04/11/2026 09:00 và 09:30; đồng hồ giả 03/11/2026. Tạo 2 lịch, đọc lại, xóa lịch đầu. | Số chuẩn hóa 0912345678; còn đúng lịch thứ hai. | Đúng các assertion tương ứng | Đạt |
| TC014 | Không hợp lệ | Câu hỏi rỗng hoặc dài 1.001 ký tự; history có role system hoặc 21 tin. | Từ chối trước truy xuất hoặc gọi provider. | Đúng các assertion tương ứng | Đạt |
| TC037 | Không hợp lệ | Tên trắng; số 123; ngày 2026-02-30; giờ 09:15. Thử từng đầu vào sai. | Báo lỗi, không ghi lịch sai. | Đúng các assertion tương ứng | Đạt |
| TC037 | Biên hoặc sự cố | Đặt 2 lịch cùng 04/11/2026 lúc 09:00 với đồng hồ giả như trên. | Chặn lần đặt thứ hai; chỉ còn 1 lịch cục bộ. | Đúng các assertion tương ứng | Đạt |
| TC033 | Biên hoặc sự cố | Provider giả trả 429, 400, 401, 403, 500 hoặc lỗi mạng. | Báo lỗi phù hợp; không lộ chi tiết và không giả trả lời thành công. | Đúng các assertion tương ứng | Đạt |
| TC038 | Biên hoặc sự cố | Storage có broken, {}, [{}], hoặc bị chặn đọc/ghi. | Báo lỗi; dữ liệu hỏng không bị xóa. | Đúng các assertion tương ứng | Đạt |
| TC151, TC153, TC154, TC155 | Không hợp lệ | Netlify: truy cập /.env, origin lạ, JSON sai và body UTF-8 quá 192.000 byte. | Từ chối tương ứng 404, 403, 400, 413. | Đúng các assertion tương ứng | Đạt |

## Toàn bộ ca kiểm thử

Mỗi dòng giữ tên test gốc để tra trực tiếp mã nguồn; các tên tiếng Anh mô tả hành vi kỳ vọng. Cột loại ca là nhãn tổng hợp, một ca có thể kiểm tra nhiều nhánh. CSV ghi dữ liệu đầu vào trực tiếp hoặc vị trí fixture trong mã nguồn, lệnh chạy, kỳ vọng, kết quả, tệp và dòng mã.

### Node.js

| Mã ca | Tệp và dòng | Tên test gốc | Kết quả |
|---|---|---|---|
| TC001 | test/ai-consultation.test.js:32 | recommendation follows the customer purpose and approved catalog instead of stopping at a missing FAQ | Đạt |
| TC002 | test/ai-consultation.test.js:54 | empty catalog still permits useful generated advice and asks a relevant next question | Đạt |
| TC003 | test/ai-consultation.test.js:72 | the same consultation generation works for VPS automation beyond the domain-shopping example | Đạt |
| TC004 | test/ai-consultation.test.js:90 | unlisted recommended products cannot be presented as confirmed Sen inventory | Đạt |
| TC005 | test/ai-consultation.test.js:98 | a generated full domain name remains unverified even when its extension is offered | Đạt |
| TC006 | test/ai-consultation.test.js:108 | recommendation metadata comes from approved catalog records rather than model-supplied prices and links | Đạt |
| TC007 | test/ai-consultation.test.js:117 | conversation validation retains enough turns for advice and rejects an excessive history | Đạt |
| TC008 | test/ai-consultation.test.js:123 | consultation always fills missing invalid or duplicate model follow-ups to three | Đạt |
| TC009 | test/ai-consultation.test.js:135 | mentioning a chosen plan does not turn a concrete policy question into open-ended advice | Đạt |
| TC010 | test/ai-faq.test.js:11 | known FAQ questions, aliases and selected FAQ buttons give Gemini retrieved answers before paraphrasing | Đạt |
| TC011 | test/ai-faq.test.js:33 | all eight video FAQ questions retain retrieved sources throughout the same conversation | Đạt |
| TC012 | test/ai-faq.test.js:54 | an unrelated question cannot use a supplied FAQ ID to authorize retrieved evidence | Đạt |
| TC013 | test/ai-faq.test.js:67 | business questions still require approved company data even when supplied a published general FAQ ID | Đạt |
| TC014 | test/ai.test.js:32 | validates question and history before retrieval or provider use | Đạt |
| TC015 | test/ai.test.js:41 | Gemini receives only retrieved knowledge, context, and untrusted-data boundaries | Đạt |
| TC016 | test/ai.test.js:71 | retrieval precedes generation with validated question and history | Đạt |
| TC017 | test/ai.test.js:84 | clarification fallback and booking avoid provider use and need no API key | Đạt |
| TC018 | test/ai.test.js:96 | greetings and ordinary technical questions use Gemini naturally without knowledge retrieval | Đạt |
| TC019 | test/ai.test.js:119 | general Gemini chat needs credentials instead of silently using a fixed FAQ | Đạt |
| TC020 | test/ai.test.js:124 | general and business answers expose three contextual model follow-ups | Đạt |
| TC021 | test/ai.test.js:141 | retrieval fallback and booking also provide three questions when knowledge suggestions are sparse | Đạt |
| TC022 | test/ai.test.js:151 | Gemini can request company data after a general question without publishing a guessed policy | Đạt |
| TC023 | test/ai.test.js:168 | source-only mode returns actual evidence with the shared source contract | Đạt |
| TC024 | test/ai.test.js:177 | prices needing confirmation return source-linked fallback without provider use | Đạt |
| TC025 | test/ai.test.js:189 | unretrieved or absent source IDs cannot authorize generated answers | Đạt |
| TC026 | test/ai.test.js:198 | unsupported numeric promises are replaced with deterministic source text | Đạt |
| TC027 | test/ai.test.js:205 | generated answer cannot transfer verified backup facts to another named product | Đạt |
| TC028 | test/ai.test.js:211 | verified numbers cannot change backup frequency denominator | Đạt |
| TC029 | test/ai.test.js:218 | source metadata comes from entries rather than model-supplied URLs | Đạt |
| TC030 | test/ai.test.js:227 | invalid suggestion IDs are replaced with three unique trusted suggestions | Đạt |
| TC031 | test/ai.test.js:234 | business follow-ups without FAQ IDs retain all contextual fallback questions | Đạt |
| TC032 | test/ai.test.js:245 | grounded generation still requires credentials | Đạt |
| TC033 | test/ai.test.js:249 | provider status and network failures return safe errors instead of hidden mock answers | Đạt |
| TC034 | test/ai.test.js:258 | malformed blocked and incomplete provider output never becomes an answer | Đạt |
| TC035 | test/ai.test.js:267 | retrieval failure differs from a legitimate no-evidence fallback | Đạt |
| TC036 | test/appointments.test.js:12 | booking survives reading and deleting only the selected appointment | Đạt |
| TC037 | test/appointments.test.js:25 | invalid inputs and duplicate slot never change saved data | Đạt |
| TC038 | test/appointments.test.js:36 | storage corruption and write denial are reported without erasing data | Đạt |
| TC039 | test/appointments.test.js:49 | slots obey Vietnam timezone, working hours, future times and occupied slots | Đạt |
| TC040 | test/branding.test.js:9 | public Sen Hosting catalog uses authored brand data and internal source links | Đạt |
| TC041 | test/branding.test.js:17 | service navigation comes from all seven product groups rather than FAQ headings | Đạt |
| TC042 | test/branding.test.js:31 | general education answers carry Sen Hosting internal knowledge provenance | Đạt |
| TC043 | test/branding.test.js:42 | unconfirmed business claims are not inherited from an external provider | Đạt |
| TC044 | test/branding.test.js:58 | imported catalog is available for recommendations while prices remain snapshot-qualified | Đạt |
| TC045 | test/branding.test.js:67 | greeting and suggestions consistently introduce Sen Hosting | Đạt |
| TC046 | test/branding.test.js:82 | one approved company record cannot authorize unrelated general or pending business evidence | Đạt |
| TC047 | test/branding.test.js:98 | a specifically approved Sen Hosting price can be answered from its own record | Đạt |
| TC048 | test/chat-router.test.js:5 | ordinary conversation and general technical explanations route directly to Gemini | Đạt |
| TC049 | test/chat-router.test.js:13 | company offers promises prices and customer account operations use business knowledge | Đạt |
| TC050 | test/chat-router.test.js:22 | business follow-up retains route but model assertions cannot invent company context | Đạt |
| TC051 | test/consultation-safety.test.js:16 | a valid recommended product ID does not authorize invented backup, SLA or refund promises | Đạt |
| TC052 | test/consultation-safety.test.js:30 | another unselected plan price cannot be quoted for the selected product | Đạt |
| TC053 | test/consultation-safety.test.js:38 | short-form invented prices cannot bypass catalog price validation | Đạt |
| TC054 | test/consultation-safety.test.js:45 | another unselected plan specifications cannot be assigned to the selected product | Đạt |
| TC055 | test/consultation-safety.test.js:53 | user workload numbers remain allowed in ordinary recommendation reasoning | Đạt |
| TC056 | test/consultation-safety.test.js:59 | domain availability cannot be asserted in free text or domain-idea reasons | Đạt |
| TC057 | test/consultation.test.js:20 | domain advice carries the clothing shop purpose and brand from earlier user turns | Đạt |
| TC058 | test/consultation.test.js:32 | hosting recommendations retain another industry rather than assuming clothing shops | Đạt |
| TC059 | test/consultation.test.js:42 | VPS advice keeps the automation workload across dialogue turns | Đạt |
| TC060 | test/consultation.test.js:52 | email advice uses the company email need and only email catalog products | Đạt |
| TC061 | test/consultation.test.js:62 | the current request changes the service family without losing the stated business need | Đạt |
| TC062 | test/consultation.test.js:71 | an empty catalog still creates advice context instead of a dead-end business fallback | Đạt |
| TC063 | test/consultation.test.js:83 | draft and unconfirmed products never appear as offers | Đạt |
| TC064 | test/consultation.test.js:90 | catalog prices are preserved exactly and no missing price is fabricated | Đạt |
| TC065 | test/consultation.test.js:97 | offered extensions do not establish availability of suggested complete domain names | Đạt |
| TC066 | test/consultation.test.js:104 | previous model assertions cannot invent catalog inventory or replace the user need | Đạt |
| TC067 | test/consultation.test.js:114 | a request for a concrete policy remains factual rather than a recommendation | Đạt |
| TC068 | test/consultation.test.js:119 | consultation construction does not mutate input, profile or previous results | Đạt |
| TC069 | test/knowledge-page.test.js:6 | published knowledge pages use the Sen brand and source update date | Đạt |
| TC070 | test/knowledge-page.test.js:13 | knowledge page treats malicious author text as text rather than executable markup | Đạt |
| TC071 | test/knowledge-repository.test.js:21 | repository persists linked source metadata and retrieves accentless scoped evidence | Đạt |
| TC072 | test/knowledge-repository.test.js:33 | repeat build is idempotent and changed snapshot removes stale entries | Đạt |
| TC073 | test/knowledge-repository.test.js:45 | invalid source import preserves existing database | Đạt |
| TC074 | test/knowledge-repository.test.js:54 | search treats FTS punctuation and SQL payloads as data | Đạt |
| TC075 | test/knowledge.test.js:46 | catalog exposes source-checked knowledge and excludes unreviewed records | Đạt |
| TC076 | test/knowledge.test.js:53 | exact FAQ retains product-specific evidence and provenance | Đạt |
| TC077 | test/knowledge.test.js:63 | no-accent backup paraphrases map to the requested product | Đạt |
| TC078 | test/knowledge.test.js:73 | Windows and cheap hosting aliases never borrow WordPress backup claims | Đạt |
| TC079 | test/knowledge.test.js:86 | ambiguous hosting backup asks for service rather than choosing a plan | Đạt |
| TC080 | test/knowledge.test.js:96 | follow-up retention inherits last user product | Đạt |
| TC081 | test/knowledge.test.js:107 | current explicit service overrides conversation history | Đạt |
| TC082 | test/knowledge.test.js:114 | explicit multi-service comparison does not silently inherit one earlier product | Đạt |
| TC083 | test/knowledge.test.js:121 | switching to a different service family does not reuse previous hosting evidence | Đạt |
| TC084 | test/knowledge.test.js:128 | model history alone cannot choose the product for an ambiguous question | Đạt |
| TC085 | test/knowledge.test.js:134 | global support documents do not make an explicit product question appear multi-service | Đạt |
| TC086 | test/knowledge.test.js:144 | unreviewed exact matches and unrelated questions produce fallback | Đạt |
| TC087 | test/knowledge.test.js:154 | a known product name does not make an unsupported technical capability answerable | Đạt |
| TC088 | test/knowledge.test.js:162 | prices requiring confirmation never automatically quote snapshot amounts | Đạt |
| TC089 | test/knowledge.test.js:170 | cheap hosting service qualifier does not turn backup frequency into a pricing question | Đạt |
| TC090 | test/knowledge.test.js:178 | cheap hosting free SSL question remains about an included feature rather than a price | Đạt |
| TC091 | test/knowledge.test.js:186 | greetings and booking work without commercial claims | Đạt |
| TC092 | test/knowledge.test.js:202 | retrieval does not mutate caller data or earlier results | Đạt |
| TC093 | test/netlify.test.js:19 | serverless knowledge has all public FAQ and catalog data without creating SQLite files | Đạt |
| TC094 | test/netlify.test.js:36 | serverless knowledge preserves the existing SQLite catalog | Đạt |
| TC095 | test/netlify.test.js:40 | serverless retrieval passes the existing offline acceptance cases | Đạt |
| TC096 | test/netlify.test.js:43 | backup-policy | Đạt |
| TC097 | test/netlify.test.js:43 | booking | Đạt |
| TC098 | test/netlify.test.js:43 | contact-policy | Đạt |
| TC099 | test/netlify.test.js:43 | domain-hosting-paraphrase | Đạt |
| TC100 | test/netlify.test.js:43 | free-ssl-policy | Đạt |
| TC101 | test/netlify.test.js:43 | greeting | Đạt |
| TC102 | test/netlify.test.js:43 | payment-policy | Đạt |
| TC103 | test/netlify.test.js:43 | price-policy | Đạt |
| TC104 | test/netlify.test.js:43 | refund-policy | Đạt |
| TC105 | test/netlify.test.js:43 | sen-backup-definition | Đạt |
| TC106 | test/netlify.test.js:43 | sen-backup-restore | Đạt |
| TC107 | test/netlify.test.js:43 | sen-domain-cname | Đạt |
| TC108 | test/netlify.test.js:43 | sen-domain-definition | Đạt |
| TC109 | test/netlify.test.js:43 | sen-domain-dns | Đạt |
| TC110 | test/netlify.test.js:43 | sen-domain-external | Đạt |
| TC111 | test/netlify.test.js:43 | sen-domain-mx | Đạt |
| TC112 | test/netlify.test.js:43 | sen-domain-nameserver | Đạt |
| TC113 | test/netlify.test.js:43 | sen-domain-record-a | Đạt |
| TC114 | test/netlify.test.js:43 | sen-domain-transfer | Đạt |
| TC115 | test/netlify.test.js:43 | sen-email-auth | Đạt |
| TC116 | test/netlify.test.js:43 | sen-email-client | Đạt |
| TC117 | test/netlify.test.js:43 | sen-email-definition | Đạt |
| TC118 | test/netlify.test.js:43 | sen-email-imap-pop | Đạt |
| TC119 | test/netlify.test.js:43 | sen-email-migration | Đạt |
| TC120 | test/netlify.test.js:43 | sen-hosting-definition | Đạt |
| TC121 | test/netlify.test.js:43 | sen-hosting-domain | Đạt |
| TC122 | test/netlify.test.js:43 | sen-migration-prepare | Đạt |
| TC123 | test/netlify.test.js:43 | sen-renewal-check | Đạt |
| TC124 | test/netlify.test.js:43 | sen-shared-hosting | Đạt |
| TC125 | test/netlify.test.js:43 | sen-ssl-definition | Đạt |
| TC126 | test/netlify.test.js:43 | sen-ssl-https | Đạt |
| TC127 | test/netlify.test.js:43 | sen-ssl-mixed-content | Đạt |
| TC128 | test/netlify.test.js:43 | sen-ssl-multi-domain | Đạt |
| TC129 | test/netlify.test.js:43 | sen-ssl-wildcard | Đạt |
| TC130 | test/netlify.test.js:43 | sen-storage-bandwidth | Đạt |
| TC131 | test/netlify.test.js:43 | sen-vps-admin | Đạt |
| TC132 | test/netlify.test.js:43 | sen-vps-definition | Đạt |
| TC133 | test/netlify.test.js:43 | sen-vps-os | Đạt |
| TC134 | test/netlify.test.js:43 | sen-vps-security | Đạt |
| TC135 | test/netlify.test.js:43 | sen-vps-vs-hosting | Đạt |
| TC136 | test/netlify.test.js:43 | sen-windows-aspnet | Đạt |
| TC137 | test/netlify.test.js:43 | sen-windows-compatibility | Đạt |
| TC138 | test/netlify.test.js:43 | sen-windows-definition | Đạt |
| TC139 | test/netlify.test.js:43 | sen-wp-beginner | Đạt |
| TC140 | test/netlify.test.js:43 | sen-wp-cache | Đạt |
| TC141 | test/netlify.test.js:43 | sen-wp-definition | Đạt |
| TC142 | test/netlify.test.js:43 | sen-wp-migration | Đạt |
| TC143 | test/netlify.test.js:43 | sen-wp-themes-plugins | Đạt |
| TC144 | test/netlify.test.js:43 | sen-wp-update | Đạt |
| TC145 | test/netlify.test.js:43 | sla-policy | Đạt |
| TC146 | test/netlify.test.js:43 | ssl-definition-noaccents | Đạt |
| TC147 | test/netlify.test.js:43 | wordpress-definition-noaccents | Đạt |
| TC148 | test/netlify.test.js:55 | status reports runtime mode and public counts without exposing credentials | Đạt |
| TC149 | test/netlify.test.js:74 | knowledge API returns the same seven services and forty FAQs | Đạt |
| TC150 | test/netlify.test.js:80 | source pages support GET and HEAD with strict source IDs and security headers | Đạt |
| TC151 | test/netlify.test.js:98 | API rejects unknown routes, private files, and unsupported methods | Đạt |
| TC152 | test/netlify.test.js:108 | HTTPS same-origin requests and requests without Origin work in retrieval mode | Đạt |
| TC153 | test/netlify.test.js:119 | chat rejects foreign origins before invoking the provider | Đạt |
| TC154 | test/netlify.test.js:130 | chat validates JSON content type, malformed JSON, and all input boundaries | Đạt |
| TC155 | test/netlify.test.js:143 | body limits count UTF-8 bytes rather than JavaScript characters | Đạt |
| TC156 | test/netlify.test.js:151 | configured chat injects runtime credentials, model, validated input, and serverless knowledge | Đạt |
| TC157 | test/netlify.test.js:167 | explicit retrieval mode bypasses an available provider key | Đạt |
| TC158 | test/netlify.test.js:175 | provider failures return JSON, preserve known status, and hide unexpected internal errors | Đạt |
| TC159 | test/netlify.test.js:191 | Netlify function entrypoints declare separate IP and domain limits | Đạt |
| TC160 | test/netlify.test.js:205 | static build publishes only the ten frontend files and removes stale output | Đạt |
| TC161 | test/netlify.test.js:223 | static build refuses to replace a directory whose basename is not dist | Đạt |
| TC162 | test/prepare-knowledge.test.js:17 | normalization retains service-specific source metadata and honest review status | Đạt |
| TC163 | test/prepare-knowledge.test.js:30 | selected FAQ whose answer is absent from the source remains pending | Đạt |
| TC164 | test/prepare-knowledge.test.js:36 | changed FAQ answer remains quarantined even when updated source contains it until its pin is reviewed | Đạt |
| TC165 | test/prepare-knowledge.test.js:50 | unchanged FAQ hash activates; missing pin in an enabled pin set never activates silently | Đạt |
| TC166 | test/prepare-knowledge.test.js:61 | a changed FAQ cannot reuse its old content_hash field to pass the pinned-hash gate | Đạt |
| TC167 | test/prepare-knowledge.test.js:70 | literal FAQ content present in matching saved raw HTML can verify a truncated text extraction | Đạt |
| TC168 | test/prepare-knowledge.test.js:78 | same-service duplicates are grouped; another service remains distinct | Đạt |
| TC169 | test/prepare-knowledge.test.js:89 | unselected records are placed in a review queue and never activated | Đạt |
| TC170 | test/prepare-knowledge.test.js:95 | symbol-only, isolated table cells, short UI and numeric fragments are removed | Đạt |
| TC171 | test/prepare-knowledge.test.js:103 | cleaned chunks are not silently enabled as chatbot knowledge | Đạt |
| TC172 | test/prepare-knowledge.test.js:112 | official policy document preserves all selected conditions and is marked confirmation-required | Đạt |
| TC173 | test/prepare-knowledge.test.js:123 | curated document pin covers the normalized selected answer and blocks newly changed source content | Đạt |
| TC174 | test/prepare-knowledge.test.js:141 | curated section boundaries distinguish repeated inline text from a heading and preserve complete sentences | Đạt |
| TC175 | test/prepare-knowledge.test.js:152 | money amounts and pricing intent require confirmation instead of old demo prices | Đạt |
| TC176 | test/prepare-knowledge.test.js:159 | invalid source linkage and unsafe sources fail validation | Đạt |
| TC177 | test/prepare-knowledge.test.js:164 | exports carry snapshot provenance and preserve the old files on invalid input | Đạt |
| TC178 | test/retrieval-eval.test.js:11 | retrieval acceptance: backup-policy | Đạt |
| TC179 | test/retrieval-eval.test.js:11 | retrieval acceptance: booking | Đạt |
| TC180 | test/retrieval-eval.test.js:11 | retrieval acceptance: contact-policy | Đạt |
| TC181 | test/retrieval-eval.test.js:11 | retrieval acceptance: domain-hosting-paraphrase | Đạt |
| TC182 | test/retrieval-eval.test.js:11 | retrieval acceptance: free-ssl-policy | Đạt |
| TC183 | test/retrieval-eval.test.js:11 | retrieval acceptance: greeting | Đạt |
| TC184 | test/retrieval-eval.test.js:11 | retrieval acceptance: payment-policy | Đạt |
| TC185 | test/retrieval-eval.test.js:11 | retrieval acceptance: price-policy | Đạt |
| TC186 | test/retrieval-eval.test.js:11 | retrieval acceptance: refund-policy | Đạt |
| TC187 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-backup-definition | Đạt |
| TC188 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-backup-restore | Đạt |
| TC189 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-domain-cname | Đạt |
| TC190 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-domain-definition | Đạt |
| TC191 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-domain-dns | Đạt |
| TC192 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-domain-external | Đạt |
| TC193 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-domain-mx | Đạt |
| TC194 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-domain-nameserver | Đạt |
| TC195 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-domain-record-a | Đạt |
| TC196 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-domain-transfer | Đạt |
| TC197 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-email-auth | Đạt |
| TC198 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-email-client | Đạt |
| TC199 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-email-definition | Đạt |
| TC200 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-email-imap-pop | Đạt |
| TC201 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-email-migration | Đạt |
| TC202 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-hosting-definition | Đạt |
| TC203 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-hosting-domain | Đạt |
| TC204 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-migration-prepare | Đạt |
| TC205 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-renewal-check | Đạt |
| TC206 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-shared-hosting | Đạt |
| TC207 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-ssl-definition | Đạt |
| TC208 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-ssl-https | Đạt |
| TC209 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-ssl-mixed-content | Đạt |
| TC210 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-ssl-multi-domain | Đạt |
| TC211 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-ssl-wildcard | Đạt |
| TC212 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-storage-bandwidth | Đạt |
| TC213 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-vps-admin | Đạt |
| TC214 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-vps-definition | Đạt |
| TC215 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-vps-os | Đạt |
| TC216 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-vps-security | Đạt |
| TC217 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-vps-vs-hosting | Đạt |
| TC218 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-windows-aspnet | Đạt |
| TC219 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-windows-compatibility | Đạt |
| TC220 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-windows-definition | Đạt |
| TC221 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-wp-beginner | Đạt |
| TC222 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-wp-cache | Đạt |
| TC223 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-wp-definition | Đạt |
| TC224 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-wp-migration | Đạt |
| TC225 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-wp-themes-plugins | Đạt |
| TC226 | test/retrieval-eval.test.js:11 | retrieval acceptance: sen-wp-update | Đạt |
| TC227 | test/retrieval-eval.test.js:11 | retrieval acceptance: sla-policy | Đạt |
| TC228 | test/retrieval-eval.test.js:11 | retrieval acceptance: ssl-definition-noaccents | Đạt |
| TC229 | test/retrieval-eval.test.js:11 | retrieval acceptance: wordpress-definition-noaccents | Đạt |
| TC230 | test/sen-knowledge.test.js:8 | Sen knowledge publishes authored general FAQ with internal provenance only | Đạt |
| TC231 | test/sen-knowledge.test.js:32 | unconfirmed Sen business profile and old provider claims are quarantined | Đạt |
| TC232 | test/sen-knowledge.test.js:47 | content metadata and hashes are stable across repeat preparation | Đạt |
| TC233 | test/sen-knowledge.test.js:57 | builder rejects foreign brand references, unsafe links and business-specific assertions | Đạt |
| TC234 | test/sen-knowledge.test.js:67 | explicitly known brand is Sen Hosting while commercial profile stays pending | Đạt |
| TC235 | test/sen-knowledge.test.js:88 | only owner-confirmed approved business entries supplement general knowledge | Đạt |
| TC236 | test/sen-knowledge.test.js:105 | missing approval flags keep proposed company data out of active knowledge | Đạt |
| TC237 | test/sen-knowledge.test.js:115 | approved company entries still require valid local provenance and unique IDs | Đạt |
| TC238 | test/server.test.js:6 | server rejects malformed URLs and private files then continues serving | Đạt |
| TC239 | test/suggestions.test.js:5 | keeps model questions first and fills to exactly three distinct questions | Đạt |
| TC240 | test/suggestions.test.js:12 | rejects invalid questions, duplicates and the current question before filling | Đạt |
| TC241 | test/suggestions.test.js:22 | empty or malformed lists still supply three questions and untrusted IDs are discarded | Đạt |

### E2E desktop

| Mã ca | Tệp và dòng | Tên test gốc | Kết quả |
|---|---|---|---|
| TC242 | e2e/chatbot.spec.js:26 | Netlify non-JSON rate limit shows a useful message and allows retry | Đạt |
| TC243 | e2e/chatbot.spec.js:40 | source URLs, provenance and API conversation history are displayed safely | Đạt |
| TC244 | e2e/chatbot.spec.js:74 | catalog loads FAQ topics and fills empty API suggestions after every answer | Đạt |
| TC245 | e2e/chatbot.spec.js:103 | related questions are distinct clickable prompts on successive turns | Đạt |
| TC246 | e2e/chatbot.spec.js:129 | source URL and source markup cannot inject navigation or HTML | Đạt |
| TC247 | e2e/chatbot.spec.js:145 | FAQ fallback, booking persistence and admin deletion | Đạt |
| TC248 | e2e/chatbot.spec.js:187 | corrupted storage is preserved and chat displays untrusted input as text | Đạt |
| TC249 | e2e/consultation.spec.js:8 | shop conversation flows into real catalog recommendations and unchecked name ideas | Đạt |
| TC250 | e2e/consultation.spec.js:44 | VPS automation advice uses the same needs and catalog composition | Đạt |
| TC251 | e2e/grok-layout.spec.js:13 | desktop keeps service navigation visible while mobile uses a menu button | Đạt |
| TC252 | e2e/grok-layout.spec.js:28 | mobile drawer blocks background interaction and restores focus after closing | Bỏ qua |
| TC253 | e2e/grok-layout.spec.js:51 | selecting a service closes the mobile menu and sends its consultation prompt | Bỏ qua |
| TC254 | e2e/grok-layout.spec.js:66 | theme selection persists across reloads and can return to light | Đạt |
| TC255 | e2e/grok-layout.spec.js:80 | service and FAQ choices from appointments return to the visible conversation | Đạt |
| TC256 | e2e/grok-layout.spec.js:100 | composer remains in the viewport after long replies and reset restores the welcome screen | Đạt |
| TC257 | e2e/vinahost.spec.js:4 | Sen Hosting service navigation displays the requested list and starts consultation | Đạt |
| TC258 | e2e/vinahost.spec.js:30 | live Sen Hosting explains hosting and domain using its own knowledge page | Đạt |
| TC259 | e2e/vinahost.spec.js:58 | Sen Hosting does not adopt another provider backup promises and unknown requests fall back | Đạt |

### E2E mobile

| Mã ca | Tệp và dòng | Tên test gốc | Kết quả |
|---|---|---|---|
| TC260 | e2e/chatbot.spec.js:26 | Netlify non-JSON rate limit shows a useful message and allows retry | Đạt |
| TC261 | e2e/chatbot.spec.js:40 | source URLs, provenance and API conversation history are displayed safely | Đạt |
| TC262 | e2e/chatbot.spec.js:74 | catalog loads FAQ topics and fills empty API suggestions after every answer | Đạt |
| TC263 | e2e/chatbot.spec.js:103 | related questions are distinct clickable prompts on successive turns | Đạt |
| TC264 | e2e/chatbot.spec.js:129 | source URL and source markup cannot inject navigation or HTML | Đạt |
| TC265 | e2e/chatbot.spec.js:145 | FAQ fallback, booking persistence and admin deletion | Đạt |
| TC266 | e2e/chatbot.spec.js:187 | corrupted storage is preserved and chat displays untrusted input as text | Đạt |
| TC267 | e2e/consultation.spec.js:8 | shop conversation flows into real catalog recommendations and unchecked name ideas | Đạt |
| TC268 | e2e/consultation.spec.js:44 | VPS automation advice uses the same needs and catalog composition | Đạt |
| TC269 | e2e/grok-layout.spec.js:13 | desktop keeps service navigation visible while mobile uses a menu button | Đạt |
| TC270 | e2e/grok-layout.spec.js:28 | mobile drawer blocks background interaction and restores focus after closing | Đạt |
| TC271 | e2e/grok-layout.spec.js:51 | selecting a service closes the mobile menu and sends its consultation prompt | Đạt |
| TC272 | e2e/grok-layout.spec.js:66 | theme selection persists across reloads and can return to light | Đạt |
| TC273 | e2e/grok-layout.spec.js:80 | service and FAQ choices from appointments return to the visible conversation | Đạt |
| TC274 | e2e/grok-layout.spec.js:100 | composer remains in the viewport after long replies and reset restores the welcome screen | Đạt |
| TC275 | e2e/vinahost.spec.js:4 | Sen Hosting service navigation displays the requested list and starts consultation | Đạt |
| TC276 | e2e/vinahost.spec.js:30 | live Sen Hosting explains hosting and domain using its own knowledge page | Đạt |
| TC277 | e2e/vinahost.spec.js:58 | Sen Hosting does not adopt another provider backup promises and unknown requests fall back | Đạt |

### Python FAQ

| Mã ca | Tệp và dòng | Tên test gốc | Kết quả |
|---|---|---|---|
| TC278 | faq/tests/test_api.py:63 | test_server_binds_loopback_only | Đạt |
| TC279 | faq/tests/test_api.py:66 | test_health_reports_imported_counts | Đạt |
| TC280 | faq/tests/test_api.py:74 | test_search_returns_citable_evidence_without_accents | Đạt |
| TC281 | faq/tests/test_api.py:85 | test_no_matches_is_successful_empty_result | Đạt |
| TC282 | faq/tests/test_api.py:91 | test_faq_pagination_and_category | Đạt |
| TC283 | faq/tests/test_api.py:101 | test_category_filter_has_no_cross_category_results | Đạt |
| TC284 | faq/tests/test_api.py:107 | test_missing_and_blank_search_are_invalid | Đạt |
| TC285 | faq/tests/test_api.py:112 | test_search_limit_must_be_bounded_integer | Đạt |
| TC286 | faq/tests/test_api.py:117 | test_faq_pagination_is_validated | Đạt |
| TC287 | faq/tests/test_api.py:123 | test_malformed_query_encoding_is_rejected | Đạt |
| TC288 | faq/tests/test_api.py:128 | test_unknown_path_is_json_404 | Đạt |
| TC289 | faq/tests/test_api.py:131 | test_post_is_rejected_without_writing | Đạt |
| TC290 | faq/tests/test_api.py:138 | test_responses_do_not_allow_wildcard_cors_or_credentials | Đạt |
| TC291 | faq/tests/test_api.py:143 | test_rate_limit_covers_every_route | Đạt |
| TC292 | faq/tests/test_core.py:30 | test_relative_url_is_canonical_https | Đạt |
| TC293 | faq/tests/test_core.py:33 | test_rejects_offsite_and_private_hosts | Đạt |
| TC294 | faq/tests/test_core.py:39 | test_excludes_noncontent_routes | Đạt |
| TC295 | faq/tests/test_core.py:48 | test_main_article_content_beats_unrelated_popup_entry_content | Đạt |
| TC296 | faq/tests/test_core.py:60 | test_service_main_faq_beats_unrelated_popup_entry_content | Đạt |
| TC297 | faq/tests/test_core.py:68 | test_malformed_jsonld_does_not_hide_visible_faq | Đạt |
| TC298 | faq/tests/test_core.py:72 | test_empty_or_missing_main_is_invalid | Đạt |
| TC299 | faq/tests/test_core.py:79 | test_tables_preserve_column_headers_and_cell_boundaries | Đạt |
| TC300 | faq/tests/test_core.py:86 | test_main_content_omits_site_chrome_and_scripts | Đạt |
| TC301 | faq/tests/test_core.py:96 | test_accordion_question_and_answer_have_provenance | Đạt |
| TC302 | faq/tests/test_core.py:105 | test_jsonld_faqpage_graph_and_html_answer | Đạt |
| TC303 | faq/tests/test_core.py:119 | test_duplicate_faq_markup_is_deduplicated | Đạt |
| TC304 | faq/tests/test_core.py:125 | test_empty_accordion_answer_is_not_faq | Đạt |
| TC305 | faq/tests/test_core.py:128 | test_ids_and_hash_do_not_change_with_crawl_timestamp | Đạt |
| TC306 | faq/tests/test_core.py:136 | test_changed_body_changes_hash_and_chunks_have_sources | Đạt |
| TC307 | faq/tests/test_core.py:161 | test_database_contains_linked_data | Đạt |
| TC308 | faq/tests/test_core.py:167 | test_reimport_is_idempotent | Đạt |
| TC309 | faq/tests/test_core.py:173 | test_invalid_import_preserves_existing_database | Đạt |
| TC310 | faq/tests/test_core.py:181 | test_vietnamese_search_without_diacritics | Đạt |
| TC311 | faq/tests/test_core.py:192 | test_unknown_query_returns_no_evidence | Đạt |
| TC312 | faq/tests/test_core.py:196 | test_search_punctuation_and_sql_are_data | Đạt |
| TC313 | faq/tests/test_core.py:202 | test_empty_search_query_is_invalid | Đạt |
| TC314 | faq/tests/test_crawl.py:33 | test_service_policy_and_support_routes_are_in_scope | Đạt |
| TC315 | faq/tests/test_crawl.py:41 | test_generic_editorial_and_account_routes_are_out_of_scope | Đạt |
| TC316 | faq/tests/test_crawl.py:48 | test_scope_never_accepts_other_hosts_or_url_credentials | Đạt |
| TC317 | faq/tests/test_crawl.py:63 | test_exports_exist_and_preserve_unicode_and_source_links | Đạt |
| TC318 | faq/tests/test_crawl.py:95 | test_csv_formula_defense_keeps_json_literal | Đạt |
| TC319 | faq/tests/test_crawl.py:108 | test_reimport_replaces_snapshot_without_duplicates_or_stale_records | Đạt |
| TC320 | faq/tests/test_crawl.py:124 | test_invalid_export_preserves_all_existing_exports_byte_for_byte | Đạt |
| TC321 | faq/tests/test_crawl.py:136 | test_reextract_rebuilds_from_gzip_and_preserves_crawl_report | Đạt |
| TC322 | faq/tests/test_fetch.py:53 | test_success_sets_user_agent_and_utf8_and_disables_auto_redirect | Đạt |
| TC323 | faq/tests/test_fetch.py:62 | test_robots_disallow_prevents_network_request | Đạt |
| TC324 | faq/tests/test_fetch.py:69 | test_unsafe_initial_target_prevents_network_request | Đạt |
| TC325 | faq/tests/test_fetch.py:76 | test_relative_redirect_is_followed_explicitly | Đạt |
| TC326 | faq/tests/test_fetch.py:82 | test_external_redirect_is_blocked_before_follow | Đạt |
| TC327 | faq/tests/test_fetch.py:88 | test_redirect_checks_target_robots_permission | Đạt |
| TC328 | faq/tests/test_fetch.py:96 | test_too_many_redirects_is_bounded | Đạt |
| TC329 | faq/tests/test_fetch.py:102 | test_429_retries_with_backoff_then_succeeds | Đạt |
| TC330 | faq/tests/test_fetch.py:109 | test_repeated_server_errors_stop_after_three_attempts | Đạt |
| TC331 | faq/tests/test_fetch.py:118 | test_client_http_error_is_not_retried | Đạt |
| TC332 | faq/tests/test_fetch.py:124 | test_network_timeout_is_propagated | Đạt |
| TC333 | faq/tests/test_fetch.py:129 | test_response_size_is_bounded | Đạt |
| TC334 | faq/tests/test_fetch.py:142 | test_discovery_records_inventory_respects_delay_and_scopes_menu | Đạt |
| TC335 | faq/tests/test_fetch.py:169 | test_sitemap_parse_and_network_errors_are_reported_without_losing_seeds | Đạt |
| TC336 | faq/tests/test_fetch.py:204 | test_success_exports_database_and_reproducible_raw_snapshot | Đạt |
| TC337 | faq/tests/test_fetch.py:220 | test_second_run_uses_cached_page_without_fetch | Đạt |
| TC338 | faq/tests/test_fetch.py:229 | test_refresh_fetches_and_replaces_cached_content | Đạt |
| TC339 | faq/tests/test_fetch.py:239 | test_redirect_aliases_do_not_duplicate_source_records | Đạt |
| TC340 | faq/tests/test_fetch.py:246 | test_page_failures_are_manifested_while_success_is_exported | Đạt |
| TC341 | faq/tests/test_fetch.py:262 | test_failed_run_preserves_previous_exports | Đạt |
| TC342 | faq/tests/test_fetch.py:272 | test_crawl_limit_bounds_attempts_but_retains_discovery_count | Đạt |
| TC343 | faq/tests/test_fetch.py:279 | test_corrupt_cached_page_is_logged_instead_of_silently_imported | Đạt |

### Python catalog

| Mã ca | Tệp và dòng | Tên test gốc | Kết quả |
|---|---|---|---|
| TC344 | sen-hosting/tests/test_import_catalog.py:14 | test_domain_cards_preserve_separate_registration_and_renewal | Đạt |
| TC345 | sen-hosting/tests/test_import_catalog.py:25 | test_plan_grid_keeps_columns_aligned_and_ignores_comparison_table | Đạt |
| TC346 | sen-hosting/tests/test_import_catalog.py:36 | test_generated_snapshot_has_real_sources_unique_records_and_no_public_foreign_brand | Đạt |

## Minh chứng chạy kiểm thử

Log: kiem-thu-unit.log, kiem-thu-netlify.log, kiem-thu-e2e.log, kiem-thu-python-faq.log, kiem-thu-python-catalog.log. Dữ liệu có cấu trúc: ket-qua-kiem-thu.json. Kết quả áp dụng trên mã nguồn tại thời điểm chạy; thay đổi mã sau đó cần xác minh lại.
