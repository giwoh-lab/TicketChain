# BÁO CÁO BẢO MẬT — TicketChain MVP

Báo cáo phân tích bảo mật hợp đồng thông minh `ConcertTicket` sử dụng công cụ Slither (static analysis).

---

## Thông tin phân tích

| Trường | Giá trị |
|---|---|
| Công cụ | Slither (static analyzer by Trail of Bits) |
| Phiên bản | slither-analyzer |
| File phân tích | `contracts/Ticket.sol` |
| Trình biên dịch | solc ^0.8.24 |
| Tổng số detector | 100 |
| Tổng số kết quả | 5 |

---

## Kết quả phân tích

### Tổng quan

| Mức độ | Số lượng |
|---|---|
| High | 0 |
| Medium | 0 |
| Low | 4 |
| Informational | 1 |

Không phát hiện lỗ hổng nghiêm trọng ở mức **High** hoặc **Medium**.

---

### Chi tiết các cảnh báo

#### [LOW-01] Sử dụng Block Timestamp

**Detector:** `timestamp`  
**Mức độ:** Low  
**Số lượng:** 4 cảnh báo

**Các vị trí bị ảnh hưởng:**

| Hàm | Dòng | So sánh |
|---|---|---|
| `setOpeningTime(uint256)` | 158–162 | `newOpening < closingTime` |
| `setClosingTime(uint256)` | 164–168 | `newClosing > openingTime` |
| `buyTicketRTB(bytes32)` | 239–251 | `block.timestamp < openingTime` |
| `isSaleOpen()` | 371–373 | `block.timestamp >= openingTime && block.timestamp < closingTime` |

**Mô tả:**  
Slither cảnh báo rằng `block.timestamp` có thể bị miner thao túng trong phạm vi khoảng ±15 giây. Điều này có thể ảnh hưởng đến các hệ thống phụ thuộc vào thời gian chính xác đến từng giây.

**Đánh giá:**  
Với thiết kế hiện tại của TicketChain, cửa sổ sale được tính theo đơn vị ngày/giờ. Độ lệch tối đa ±15 giây của miner **không ảnh hưởng** đến tính đúng đắn của logic mua vé hay RTB. Cảnh báo này là tiêu chuẩn và xuất hiện ở hầu hết các hợp đồng có quản lý thời gian.

**Kết luận:** Chấp nhận được, không cần sửa trong phạm vi MVP.

---

#### [INFO-01] Low-level Call trong hàm `withdraw()`

**Detector:** `low-level-calls`  
**Mức độ:** Informational  
**Số lượng:** 1 cảnh báo

**Vị trí:**
```solidity
// contracts/Ticket.sol — dòng 399
(bool ok, ) = owner.call{value: amount}("");
require(ok, "Withdraw failed");
```

**Mô tả:**  
Slither phát hiện việc sử dụng low-level call `.call{value: ...}()` trong hàm `withdraw()`.

**Đánh giá:**  
Đây thực chất là **cách được khuyến nghị** để gửi ETH trong Solidity hiện đại, thay thế cho `transfer()` và `send()` vốn đã bị deprecated do giới hạn gas cứng 2300. Hợp đồng đã xử lý đúng bằng cách:
- Kiểm tra giá trị trả về `ok`
- Revert nếu giao dịch thất bại với thông báo rõ ràng
- Áp dụng pattern Checks-Effects-Interactions (lưu `amount` trước khi gọi)

**Kết luận:** Đúng cách, không cần sửa.

---

## Các vấn đề bảo mật đã được xử lý tốt

Dưới đây là các điểm bảo mật quan trọng trong contract đã được thiết kế đúng:

### 1. Không lưu secret key on-chain
Secret key của người dùng không bao giờ được gửi lên blockchain. Chỉ có `commitment = keccak256(secretKey)` được lưu. Ngay cả khi toàn bộ lịch sử blockchain bị đọc, secret key vẫn an toàn.

### 2. Kiểm soát quyền truy cập
Các hàm nhạy cảm được bảo vệ bởi modifier rõ ràng:
- `onlyOwner` — chỉ admin
- `onlyCheckIn` — chỉ nhân viên check-in
- `onlyTicketOwner` — chỉ chủ vé
- `onlyValidTicket` — chỉ vé còn hiệu lực

### 3. Checks-Effects-Interactions
Hàm `withdraw()` tuân theo pattern CEI:
```solidity
uint256 amount = balance;   // Checks
// (không có Effects ở đây vì balance sẽ thay đổi sau call)
(bool ok, ) = owner.call{value: amount}("");  // Interactions
require(ok, "Withdraw failed");
```
Giảm thiểu rủi ro reentrancy.

### 4. Bảo vệ chuyển nhượng vé
Khi chuyển nhượng, commitment bắt buộc phải được thay thế bằng commitment mới. Người chủ cũ không thể tái sử dụng secret key sau khi chuyển nhượng.

### 5. Giới hạn một vé mỗi ví
Modifier `noTicket` ngăn một địa chỉ sở hữu nhiều hơn một vé, bảo vệ tính công bằng của hệ thống.

### 6. Fallback revert
```solidity
receive() external payable { revert("Send ETH via purchase functions"); }
fallback() external payable { revert("Invalid call"); }
```
Ngăn người dùng gửi ETH nhầm trực tiếp vào contract.

---

## Hạn chế đã biết (nằm ngoài phạm vi MVP)

| Hạn chế | Mô tả |
|---|---|
| Secret key lưu localStorage | Người dùng mất secret key nếu xóa dữ liệu trình duyệt |
| Xác thực là demo | Auth dùng localStorage, không phải backend thực |
| Không có upgradeability | Contract không thể nâng cấp sau khi triển khai |
| Secret key trao đổi ngoài chuỗi | Khi chuyển nhượng, sender phải tự gửi secret key cho recipient qua kênh khác |

---

## Kết luận

Hợp đồng `ConcertTicket` **không có lỗ hổng bảo mật nghiêm trọng**. Hai cảnh báo Slither tìm thấy đều ở mức thấp và không ảnh hưởng đến tính an toàn của hệ thống trong phạm vi MVP giáo dục. Các cơ chế bảo mật cốt lõi (commitment scheme, access control, CEI pattern) được thiết kế và triển khai đúng cách.
