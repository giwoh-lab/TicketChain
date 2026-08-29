# TicketChain — Ứng dụng Quản lý Vé Concert trên Blockchain

Hệ thống quản lý vé concert dựa trên blockchain Ethereum (Sepolia testnet). Vé được mint dưới dạng bản ghi on-chain với cơ chế commitment mật mã để check-in bằng QR code an toàn.

## Công nghệ sử dụng

| Tầng | Công nghệ |
|---|---|
| Smart Contract | Solidity ^0.8.24, triển khai trên Sepolia |
| Framework test | Foundry (forge) |
| Frontend | Next.js 16, React 19 |
| Blockchain SDK | ethers.js v6 |
| QR Code | qrcode.react v4 |
| Xác thực | localStorage (demo) |
| Ví | MetaMask (BrowserProvider) |

## Hợp đồng thông minh

- **Mạng:** Ethereum Sepolia Testnet
- **Địa chỉ:** `0xD3CB1b9A39a14753A92d869EEC1E45237C1e5Ae4`
- **Đã xác minh:** [Etherscan](https://sepolia.etherscan.io/address/0xD3CB1b9A39a14753A92d869EEC1E45237C1e5Ae4#code)

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
├── contracts/                      # Foundry project
│   ├── src/
│   │   └── concertTicket.sol       # Hợp đồng ConcertTicket
│   ├── test/
│   │   └── concertTicket.t.sol     # 45 unit tests
│   ├── script/
│   │   ├── Deploy.s.sol            # Script deploy
│   │   └── Demo.s.sol              # Script E2E demo
│   ├── foundry.toml
│   └── .env.example
├── abi.json                        # ABI của hợp đồng
└── src/                            # Next.js frontend
    ├── pages/
    │   ├── index.jsx               # Dashboard
    │   ├── payment.jsx             # Thanh toán + mint
    │   ├── admin.jsx               # Admin panel
    │   ├── login.jsx
    │   └── register.jsx
    ├── lib/
    │   ├── contract.js             # ethers.js helpers
    │   ├── constants.js            # CONTRACT_ADDRESS, CHAIN_ID
    │   └── auth.js
    ├── hooks/
    │   ├── use-auth.js
    │   └── use-wallet.js
    └── styles/
        └── style.css
```

## Hướng dẫn cài đặt

### Yêu cầu

- Node.js 18+
- [Foundry](https://getfoundry.sh/) (`forge`, `cast`, `anvil`)
- Tiện ích mở rộng MetaMask trên trình duyệt
- ETH Sepolia testnet ([faucet](https://sepoliafaucet.com))

### 1. Clone repo

```bash
git clone <repo-url>
cd concert-tickets-management
```

### 2. Cài đặt frontend

```bash
npm install
```

### 3. Cài đặt Foundry dependencies

```bash
cd contracts
forge install
```

### 4. Cấu hình biến môi trường

```bash
cp contracts/.env.example contracts/.env
```

Điền vào `contracts/.env`:

```dotenv
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
PRIVATE_KEY=<private key của admin/owner>
USER_PRIVATE_KEY=<private key của user mua vé>
```

> ⚠️ Không bao giờ commit file `.env` lên Git.

### 5. Chạy unit test

```bash
cd contracts
forge test -vv
```

Kết quả mong đợi: **45 tests passed, 0 failed**.

### 6. Deploy contract (tuỳ chọn)

```bash
cd contracts
forge script script/Deploy.s.sol:DeployConcertTicket \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --broadcast
```

Sau khi deploy, cập nhật `src/lib/constants.js`:

```js
export const CONTRACT_ADDRESS = "<địa chỉ contract mới>";
export const SEPOLIA_CHAIN_ID = 11155111;
```

Và cập nhật `abi.json` từ `contracts/out/ConcertTicket.sol/ConcertTicket.json`.

### 7. Chạy E2E demo script

```bash
cd contracts
forge script script/Demo.s.sol:DemoConcertTicket \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --broadcast
```

Script sẽ tự động: grant RTB → mua vé → verify → check-in và in kết quả ra console.

### 8. Chạy frontend

```bash
# Từ thư mục root
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

### 9. Hướng dẫn sử dụng

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
| `getTicketIdByOwner(addr)` | ID vé theo địa chỉ |
| `verifyTicket(ticketId, secretKey)` | Xác minh vé và tính QR hash |
| `getRTB(addr)` | Địa chỉ có quyền RTB không |

## Lưu ý

- Xác thực là demo (localStorage). Môi trường production cần backend thực sự.
- Secret key lưu trong `localStorage` — người dùng nên tự sao lưu thủ công.
- Hợp đồng không có khả năng nâng cấp theo thiết kế (MVP giáo dục).
