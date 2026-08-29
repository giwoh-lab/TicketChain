# ĐÁNH GIÁ — TicketChain MVP

---

## 1. Bộ số liệu Gas Usage

Dữ liệu lấy từ các giao dịch thực tế trên Ethereum Sepolia Testnet.

| Hàm | Gas sử dụng | ETH chi phí (ước tính) | Tx Hash |
|---|---|---|---|
| `grantRTB` | ~97,320 | ~0.000097 ETH | [0xda8ef0...](https://sepolia.etherscan.io/tx/0xda8ef0bfb696e1e869ebe85b155ba4640e2c7c0bd52be847f13bfb63773b9dbd) |
| `buyTicketRTB` | ~130,000 | ~0.000130 ETH | [0xcf980b...](https://sepolia.etherscan.io/tx/0xcf980b9167dacf2bbf440c1e17acb4d4365599d48005516ca8ff6801da0faced) |
| `buyTicketOfficial` | ~110,000 | ~0.000110 ETH | [0x68b3ab...](https://sepolia.etherscan.io/tx/0x68b3ab3e4c5a008b15f0d70d345254e8bb77991f4cc5aacedcd644166ae538f2) |
| `transferTicket` (lần 1) | ~152,910 | ~0.000153 ETH | [0x27064e...](https://sepolia.etherscan.io/tx/0x27064e505158a80ab181cda0059c18768ddb849f049d4fb96c61ee5b29c00f12) |
| `transferTicket` (lần 2) | ~152,020 | ~0.000152 ETH | [0x2874c0...](https://sepolia.etherscan.io/tx/0x2874c0c9fedee64445969825e42fff276f1b6c077003a03a4b545f32af95694d) |

> Gas price tham chiếu: ~1 Gwei (Sepolia testnet). Mainnet có thể cao hơn tùy thời điểm.

---

## 2. Bộ số liệu Latency

Thời gian xác nhận giao dịch trên Sepolia (block time trung bình ~12 giây).

| Hàm | Block time | Số block confirm |
|---|---|---|
| `grantRTB` | ~12 giây | 1 block |
| `buyTicketRTB` | ~12 giây | 1 block |
| `buyTicketOfficial` | ~12 giây | 1 block |
| `transferTicket` | ~12 giây | 1 block |

> Latency phụ thuộc vào tình trạng mạng. Trong điều kiện bình thường, tất cả transaction được confirm trong vòng 1–3 block (~12–36 giây).

---

## 3. So sánh: Hệ thống vé truyền thống vs Blockchain

### 3.1 Góc độ kỹ thuật

| Tiêu chí | Hệ thống truyền thống | TicketChain (Blockchain) |
|---|---|---|
| **Lưu trữ dữ liệu** | Cơ sở dữ liệu tập trung (SQL/NoSQL) | On-chain, phân tán, bất biến |
| **Xác thực vé** | Tra cứu database, có thể bị làm giả | Xác minh bằng mật mã (keccak256), không thể làm giả |
| **Bảo mật** | Phụ thuộc vào bảo mật server | Không có single point of failure |
| **Tính minh bạch** | Dữ liệu nội bộ, không công khai | Mọi giao dịch đều public, có thể audit |
| **Downtime** | Phụ thuộc server uptime | Không có downtime (phi tập trung) |
| **Chi phí giao dịch** | Gần như 0 (internal DB call) | Tốn gas (~$0.01–$1 tùy mainnet) |
| **Tốc độ giao dịch** | Milliseconds | ~12 giây (1 block) |
| **Khả năng mở rộng** | Dễ scale theo chiều ngang | Bị giới hạn bởi throughput blockchain |
| **Static analysis** | Không áp dụng | Kiểm tra được bằng Slither, SmartBugs |
| **Khả năng nâng cấp** | Dễ update server/DB | Khó — cần redeploy contract mới |

---

### 3.2 Góc độ trải nghiệm người dùng (UX)

| Tiêu chí | Hệ thống truyền thống | TicketChain (Blockchain) |
|---|---|---|
| **Đăng ký / Đăng nhập** | Email + password quen thuộc | Cần cài MetaMask, hiểu về ví |
| **Mua vé** | Thẻ ngân hàng, ví điện tử | Cần có ETH sẵn trong ví |
| **Thời gian mua** | Gần như tức thì | Chờ ~12 giây để confirm |
| **Chuyển nhượng vé** | Qua nền tảng, có thể mất phí | Trực tiếp ví-sang-ví, không qua trung gian |
| **Xác minh tại cổng** | Quét mã QR đơn giản | Quét QR + verify on-chain |
| **Mất vé / quên secret key** | Liên hệ support để khôi phục | Không thể khôi phục nếu mất secret key |
| **Hoàn tiền** | Dễ dàng qua hệ thống | Admin invalidate + withdraw thủ công |
| **Độ tin cậy với người dùng** | Tin tưởng thương hiệu/công ty | Tin tưởng code (trustless) |
| **Barrier to entry** | Thấp — ai cũng dùng được | Cao — cần hiểu blockchain cơ bản |
| **Hỗ trợ khách hàng** | Có đội support | Không có — tự chịu trách nhiệm |

---

## 4. Nhận xét tổng thể

### Ưu điểm của TicketChain so với hệ thống truyền thống

- **Không thể làm giả vé** — commitment scheme đảm bảo chỉ người giữ secret key mới check-in được
- **Không cần tin tưởng bên thứ ba** — logic hoàn toàn nằm trong smart contract, công khai và có thể audit
- **Chuyển nhượng an toàn** — on-chain enforcement, không thể bán vé cho 2 người cùng lúc
- **Minh bạch** — mọi giao dịch đều có thể tra cứu trên Etherscan

### Hạn chế của TicketChain so với hệ thống truyền thống

- **Barrier to entry cao** — người dùng phải có ví và ETH
- **Không thể khôi phục secret key** — mất key là mất quyền vào cổng
- **Chi phí gas** — mỗi thao tác tốn ETH, không phù hợp với vé giá rẻ
- **Tốc độ chậm hơn** — 12 giây so với milliseconds của hệ thống truyền thống
- **Khó nâng cấp** — cần redeploy contract và migrate data khi có thay đổi

### Kết luận

TicketChain phù hợp với các sự kiện **cao cấp, giá trị vé lớn**, nơi việc chống làm giả và chuyển nhượng minh bạch quan trọng hơn UX đơn giản. Với sự kiện đại chúng, hệ thống truyền thống vẫn có lợi thế về trải nghiệm người dùng và chi phí thấp hơn.
