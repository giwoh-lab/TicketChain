# Đánh giá Phân tích Tĩnh — ConcertTicket

## Tổng quan

Đánh giá mã nguồn `Ticket.sol` sau khi hoàn thiện thiết kế vòng đời 3 trạng thái (`Valid`, `Invalid`, `Used`) với cơ chế commitment mật mã và quyền RTB (Right to Buy).

## Các kiểm tra chính

| Tiêu chí | Trạng thái | Đánh giá chi tiết |
|---|---|---|
| Enum Definition | PASS | `enum Status { Valid, Invalid, Used }` — 3 trạng thái rõ ràng, không mơ hồ. |
| Access Control | PASS | `onlyOwner`, `onlyCheckIn`, `onlyTicketOwner`, `onlyValidTicket` — phân tách quyền đúng vai trò. |
| Guard Conditions | PASS | Chặn chuyển đổi trạng thái không hợp lệ; chặn thao tác trên ticket không tồn tại (ticketId = 0). |
| Terminal State Protection | PASS | `Used` và `Invalid` không thể restore; `invalidateTicket` chặn vé đã `Used`. |
| Commitment Scheme | PASS | `keccak256(secretKey)` lưu on-chain; secret key không bao giờ lộ; commitment thay mới khi transfer. |
| Transfer Security | PASS | Người nhận phải chưa có vé; sender bắt buộc cung cấp `newCommitment` — chủ cũ mất quyền dùng secret cũ. |
| Verification Logic | PASS | `verifyTicket` trả về `false` nếu sai secret, vé Invalid, hoặc vé không tồn tại. |
| Payment Guard | PASS | `require(msg.value == ticketPrice)` — chặn thanh toán sai giá trị. |
| Event Completeness | PASS | Đầy đủ events: `TicketCreated`, `TicketTransferred`, `TicketUsed`, `TicketInvalidated`, `RTBUpdated`, `CheckInOperatorChanged`, `OwnerTransferred`, `TicketPriceChanged`, `MaxTicketsChanged`. |
| Fallback Protection | PASS | `receive()` và `fallback()` đều revert với message rõ ràng — ngăn ETH gửi nhầm. |
| Withdrawal | PASS | `onlyOwner` + CEI pattern + kiểm tra return value của low-level call. |
| RTB Lifecycle | PASS | RTB tự động bị thu hồi sau khi mua vé thành công (`hasRTB[msg.sender] = false`). |

## Kết quả Unit Test

| Nhóm test | Số lượng | Kết quả |
|---|---|---|
| Happy path (mua, chuyển, check-in) | 8 | PASS |
| Negative (revert đúng message) | 28 | PASS |
| State machine (sale open/close) | 3 | PASS |
| Admin functions | 6 | PASS |
| **Tổng** | **45** | **45/45 PASS** |

Các negative test đáng chú ý:

| Test | Revert message |
|---|---|
| Mua vé trước khi sale mở | `"Official sale closed"` |
| Mua vé sau khi sale đóng | `"Official sale closed"` |
| Mua vé khi đã có vé | `"Already owns ticket"` |
| RTB không có quyền | `"RTB not granted"` |
| RTB sau khi sale mở | `"RTB only before opening time"` |
| RTB dùng 2 lần | `"RTB not granted"` |
| Thanh toán sai giá | `"Incorrect ETH amount"` |
| Sold out | `"Sold out"` |
| Check-in không phải operator | `"Only check-in operator"` |
| Dùng vé đã dùng | `"Ticket not valid"` |
| Dùng vé đã thu hồi | `"Ticket not valid"` |
| Thu hồi vé đã dùng | `"Used tickets cannot be invalidated"` |
| Transfer vé không phải chủ | `"Not ticket owner"` |
| Transfer vé đã thu hồi | `"Ticket not valid"` |
| Transfer cho người đã có vé | `"Recipient already has ticket"` |
| Non-owner grantRTB | `"Only owner"` |
| Non-owner invalidate | `"Only owner"` |
| Non-owner withdraw | `"Only owner"` |
| Gửi ETH trực tiếp | `"Send ETH via purchase functions"` |
| Rút khi balance = 0 | `"Nothing to withdraw"` |

## Kết luận

Mã nguồn đáp ứng toàn bộ các yêu cầu an toàn. Không có lỗ hổng bảo mật nghiêm trọng. Tất cả 45 unit test pass, E2E demo trên Sepolia thành công. Slither không phát hiện vấn đề HIGH hoặc MEDIUM.
