# ChainPass — Ứng dụng Quản lý Vé Concert trên Blockchain

Hệ thống quản lý vé concert dựa trên blockchain Ethereum (Sepolia testnet). Vé được mint dưới dạng bản ghi on-chain với cơ chế commitment mật mã để check-in bằng QR code an toàn.

## Công nghệ sử dụng

| Tầng | Công nghệ |
|---|---|
| Smart Contract | Solidity ^0.8.24, triển khai trên Sepolia |
| Frontend | Next.js 16, React 19 |
| Blockchain SDK | ethers.js v6 |
| QR Code | qrcode.react v4 |
| Xác thực | localStorage (demo) |
| Ví | MetaMask (BrowserProvider) |

## Hợp đồng thông minh

- **Mạng:** Ethereum Sepolia Testnet
- **Địa chỉ:** `0x73337ADA0F4ab56B36CFe62B88Cfd9e6DD70053f`
- **Đã xác minh:** [Etherscan](https://sepolia.etherscan.io/address/0x73337ada0f4ab56b36cfe62b88cfd9e6dd70053f#code)

## Tính năng

### Mua vé
- **Bán chính thức** — mở cho tất cả ví trong cửa sổ thời gian (`openingTime` → `closingTime`)
- **RTB (Right to Buy)** — mua sớm được admin cấp phép trước khi sale mở
- Mỗi ví chỉ được sở hữu tối đa 1 vé, được kiểm soát on-chain

### Xác minh QR bằng mật mã
- Người mua tạo secret key ngẫu nhiên 32 byte tại trình duyệt
- `commitment = keccak256(secretKey)` được lưu on-chain khi mua
- Mã QR hiển thị `keccak256(ticketId, secretKey)` — không bao giờ lộ secret key
- Nhân viên check-in gọi `verifyTicket(ticketId, secretKey)` để xác thực

### Vòng đời vé
```
VALID → USED      (nhân viên check-in quét QR)
VALID → INVALID   (admin thu hồi, ví dụ hoàn tiền)
```

### Chuyển nhượng vé
- Chủ vé chuyển cho ví khác kèm commitment mới
- Người gửi tạo secret key mới cho người nhận
- Secret key cũ của người gửi bị vô hiệu hóa tự động

### Bảng điều khiển Admin (`/admin`)
- Đặt thời gian mở/đóng sale
- Đặt giá vé và số lượng tối đa
- Cấp/thu hồi quyền RTB (bao gồm cấp hàng loạt)
- Thu hồi vé
- Rút ETH đã thu
- Chuyển quyền sở hữu hợp đồng
- Đặt nhân viên check-in

## Cấu trúc dự án

```
concert-tickets-management/
├── contracts/
│   └── Ticket.sol              # Hợp đồng ConcertTicket
├── abi.json                    # ABI của hợp đồng
└── src/
    ├── pages/
    │   ├── index.jsx           # Dashboard — mua, xem, chuyển nhượng vé
    │   ├── payment.jsx         # Luồng thanh toán + mint on-chain
    │   ├── admin.jsx           # Bảng điều khiển admin
    │   ├── login.jsx           # Trang đăng nhập
    │   └── register.jsx        # Trang đăng ký
    ├── lib/
    │   ├── contract.js         # Các hàm đọc/ghi ethers.js
    │   ├── constants.js        # CONTRACT_ADDRESS, SEPOLIA_CHAIN_ID
    │   └── auth.js             # Xác thực demo (localStorage)
    ├── hooks/
    │   ├── use-auth.js         # Hook quản lý trạng thái auth
    │   └── use-wallet.js       # Hook kết nối MetaMask
    └── styles/
        └── style.css
```

## Hướng dẫn cài đặt

### Yêu cầu
- Node.js 18+
- Tiện ích mở rộng MetaMask trên trình duyệt
- ETH Sepolia testnet ([faucet](https://sepoliafaucet.com))

### Cài đặt

```bash
git clone <repo>
cd concert-tickets-management
npm install
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

### Hướng dẫn sử dụng

1. Đăng ký tài khoản và đăng nhập
2. Kết nối MetaMask (chuyển sang mạng Sepolia)
3. Mua vé trong cửa sổ thời gian sale
4. Tạo secret key trên dashboard
5. Xuất trình mã QR khi check-in

## Các hàm hợp đồng thông minh

### Ghi (yêu cầu ETH / chữ ký ví)
| Hàm | Quyền truy cập | Mô tả |
|---|---|---|
| `buyTicketOfficial(commitment)` | Công khai | Mua trong cửa sổ sale chính thức |
| `buyTicketRTB(commitment)` | Người có RTB | Mua trước khi sale mở |
| `transferTicket(to, ticketId, newCommitment)` | Chủ vé | Chuyển nhượng cho ví khác |
| `useTicket(ticketId)` | Nhân viên check-in | Đánh dấu vé đã sử dụng |
| `invalidateTicket(ticketId)` | Admin | Thu hồi vé |
| `withdraw()` | Admin | Rút ETH đã thu |

### Đọc (miễn phí, không tốn gas)
| Hàm | Mô tả |
|---|---|
| `isSaleOpen()` | Kiểm tra sale đang mở không |
| `hasTicket(addr)` | Địa chỉ có vé không |
| `getMyTicket()` | Dữ liệu vé của người gọi |
| `getMyTicketId()` | ID vé của người gọi |
| `verifyTicket(ticketId, secretKey)` | Xác minh vé và tính QR hash |
| `getRTB(addr)` | Địa chỉ có quyền RTB không |

## Lưu ý

- Xác thực là demo (localStorage). Môi trường production cần backend thực sự.
- Secret key lưu trong `localStorage` — người dùng nên tự sao lưu thủ công.
- Hợp đồng không có khả năng nâng cấp theo thiết kế (MVP giáo dục).
