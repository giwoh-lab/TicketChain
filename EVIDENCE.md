# BẰNG CHỨNG — TicketChain MVP

Bằng chứng triển khai và giao dịch cho hợp đồng ConcertTicket trên Ethereum Sepolia Testnet.

---

## Thông tin triển khai hợp đồng

| Trường | Giá trị |
|---|---|
| Tên hợp đồng | `ConcertTicket` |
| Mạng | Ethereum Sepolia Testnet (Chain ID: 11155111) |
| Địa chỉ hợp đồng | `0x73337ADA0F4ab56B36CFe62B88Cfd9e6DD70053f` |
| Trình biên dịch | Solidity v0.8.34 |
| Giấy phép | MIT |
| Xác minh | Mã nguồn đã được xác minh (Exact Match) trên Etherscan |
| Etherscan | https://sepolia.etherscan.io/address/0x73337ada0f4ab56b36cfe62b88cfd9e6dd70053f#code |

---

## Các giao dịch on-chain

### 1. Triển khai hợp đồng
| Trường | Giá trị |
|---|---|
| Người triển khai | `0xD6595383821F3f2BBF8c117546ee19De01920eA3` |
| Tx Hash | https://sepolia.etherscan.io/tx/0x078c54a4b2ab7a99d13facb2217d6ee00b17d390fda9d63fed8ef5afd19796eb |

---

### 2. Cấp quyền RTB
Admin cấp quyền RTB cho ví `0xa9766b8605D1d657552B9F78fE25765bdB81917e`.

| Trường | Giá trị |
|---|---|
| Phương thức | `grantRTB(address)` |
| Tx Hash | https://sepolia.etherscan.io/tx/0xda8ef0bfb696e1e869ebe85b155ba4640e2c7c0bd52be847f13bfb63773b9dbd |

---

### 3. Mua vé (RTB)
Ví `0xa9766b8605D1d657552B9F78fE25765bdB81917e` mua vé #1 qua quyền RTB trước khi sale chính thức mở.

| Trường | Giá trị |
|---|---|
| Phương thức | `buyTicketRTB(bytes32 commitment)` |
| ETH gửi | 0.1 ETH |
| Tx Hash | https://sepolia.etherscan.io/tx/0xcf980b9167dacf2bbf440c1e17acb4d4365599d48005516ca8ff6801da0faced |

---

### 4. Mua vé (Sale chính thức)
Ví `0xb8Ee7cbD1e1e4fEd9957555670077B8Ba6813Caf` mua vé trong cửa sổ sale chính thức.

| Trường | Giá trị |
|---|---|
| Phương thức | `buyTicketOfficial(bytes32 commitment)` |
| ETH gửi | 0.1 ETH |
| Tx Hash | https://sepolia.etherscan.io/tx/0x68b3ab3e4c5a008b15f0d70d345254e8bb77991f4cc5aacedcd644166ae538f2 |

---

### 5. Chuyển nhượng vé (lần 1)
Vé #1 được chuyển từ `0xa9766b...` sang `0x44a36b3dBc971efEe1c748b549985a976131A81C` kèm commitment mới.

| Trường | Giá trị |
|---|---|
| Phương thức | `transferTicket(address to, uint256 ticketId, bytes32 newCommitment)` |
| Tx Hash | https://sepolia.etherscan.io/tx/0x27064e505158a80ab181cda0059c18768ddb849f049d4fb96c61ee5b29c00f12 |

---

### 6. Chuyển nhượng vé (lần 2)
Vé #1 được chuyển lại từ `0x44a36b...` sang `0xa9766b...` kèm commitment mới.

| Trường | Giá trị |
|---|---|
| Phương thức | `transferTicket(address to, uint256 ticketId, bytes32 newCommitment)` |
| Tx Hash | https://sepolia.etherscan.io/tx/0x2874c0c9fedee64445969825e42fff276f1b6c077003a03a4b545f32af95694d |

---

## Các quyết định thiết kế quan trọng

### Cơ chế Commitment
Hợp đồng không bao giờ lưu secret key dưới dạng plaintext. Thay vào đó:
1. Người mua tạo secret key ngẫu nhiên 32 byte tại trình duyệt
2. `commitment = keccak256(secretKey)` được gửi lên on-chain khi mua vé
3. Khi check-in, nhân viên gọi `verifyTicket(ticketId, secretKey)` — hợp đồng hash key được cung cấp và so sánh với commitment đã lưu
4. Mã QR mã hóa `keccak256(ticketId ‖ secretKey)` — lộ QR không lộ secret key

### Bảo mật khi chuyển nhượng
Khi chuyển nhượng vé, người gửi phải cung cấp commitment mới cho người nhận. Điều này đảm bảo:
- Chủ cũ không thể tái sử dụng secret key sau khi chuyển nhượng
- Chủ mới nhận được secret key mới (trao đổi ngoài chuỗi)

### Không dùng ERC-721
Hợp đồng cố tình không dùng ERC-721 để giữ codebase tối giản và mang tính giáo dục. Quyền sở hữu được theo dõi qua `mapping(address => uint256)`.

### Mỗi ví chỉ có 1 vé
Được kiểm soát bởi modifier `noTicket` trên cả hai hàm mua. Chuyển nhượng cũng kiểm tra người nhận chưa có vé.

---

## Bằng chứng Frontend

| Trang | Đường dẫn | Mô tả |
|---|---|---|
| Dashboard | `/` | Xem trạng thái sale, mua vé, quản lý secret key, chuyển nhượng |
| Thanh toán | `/payment` | Mô phỏng thanh toán + mint on-chain |
| Admin | `/admin` | Bảng điều khiển quản trị hợp đồng |
| Đăng nhập | `/login` | Xác thực demo |
| Đăng ký | `/register` | Đăng ký tài khoản demo |

---

## Các địa chỉ ví đã sử dụng

| Vai trò | Địa chỉ |
|---|---|
| Chủ hợp đồng / Người triển khai | `0xD6595383821F3f2BBF8c117546ee19De01920eA3` |
| Người mua vé (RTB) | `0xa9766b8605D1d657552B9F78fE25765bdB81917e` |
| Người mua vé (Sale chính thức) | `0xb8Ee7cbD1e1e4fEd9957555670077B8Ba6813Caf` |
| Người nhận chuyển nhượng | `0x44a36b3dBc971efEe1c748b549985a976131A81C` |
