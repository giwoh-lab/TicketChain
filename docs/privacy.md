### 5.3. Quyền riêng tư và dữ liệu

Hệ thống Concert Ticket được thiết kế theo nguyên tắc **data minimization**, trong đó blockchain chỉ lưu các dữ liệu cần thiết để thực thi quyền sở hữu, trạng thái vé và xác minh tính hợp lệ. Các dữ liệu nhận diện cá nhân và dữ liệu bí mật không được ghi trực tiếp lên public blockchain.

### 5.3.1. Dữ liệu không được đưa lên blockchain

Smart contract `ConcertTicket` không lưu trực tiếp các thông tin nhận diện cá nhân như:

* Họ và tên.
* Số điện thoại.
* Email.
* Số căn cước/CCCD.
* Địa chỉ nhà.
* Thông tin thanh toán cá nhân.
* Hồ sơ hoặc tài liệu cá nhân.
* Plaintext secret key dùng để tạo QR.

Thay vào đó, contract chỉ sử dụng địa chỉ ví (`address`) làm định danh blockchain của người dùng.

Ví dụ:

```solidity
struct Ticket {
    address owner;
    Status currStatus;
    bytes32 commitment;
}
```

Trong đó:

```text
owner       → địa chỉ ví hiện tại
currStatus  → trạng thái vé
commitment  → hash của secret key
```

Do đó, smart contract không cần biết trực tiếp danh tính thật của người mua để thực hiện các quy tắc sở hữu và sử dụng vé.

---

### 5.3.2. Secret key và Commitment

Một điểm quan trọng của hệ thống là secret key không được lưu plaintext trên blockchain.

Khi mua vé, frontend tạo một secret key và tính:

```solidity
keccak256(abi.encodePacked(secretKey))
```

Sau đó chỉ giá trị hash được gửi vào contract dưới dạng:

```solidity
bytes32 commitment;
```

Contract lưu:

```solidity
t.commitment = commitment;
```

Khi cần xác minh, người dùng cung cấp secret key cho frontend. Frontend/contract tính lại commitment và so sánh với giá trị đã lưu:

```solidity
bytes32 providedCommit =
    keccak256(abi.encodePacked(secretKey));

if (providedCommit != t.commitment) {
    return (false, bytes32(0));
}
```

Kiến trúc này tạo ra mô hình:

```text
Secret Key
    │
    │ keccak256
    ▼
Commitment
    │
    ▼
Public Blockchain

Secret Key ───────────────► Off-chain / User
```

Do đó, người quan sát blockchain có thể nhìn thấy commitment nhưng không trực tiếp lấy được plaintext secret từ storage của contract.

Tuy nhiên, `keccak256` là **hash function, không phải encryption**. Nếu secret có entropy thấp hoặc có thể đoán được, attacker có thể thực hiện brute-force/offline dictionary attack để tìm secret tương ứng với commitment. Vì vậy secret phải được tạo bằng nguồn random đủ mạnh và không được sử dụng lại giữa các hệ thống.

---

### 5.3.3. Phân loại dữ liệu

Hệ thống phân chia dữ liệu thành ba nhóm:

| Nhóm dữ liệu             | Ví dụ                                               | Vị trí                   | Quyền truy cập                            |
| ------------------------ | --------------------------------------------------- | ------------------------ | ----------------------------------------- |
| Public on-chain          | Ticket ID, ticket owner address, status, commitment | Smart contract           | Bất kỳ blockchain observer nào            |
| Conditional / verifiable | Secret key, QR data                                 | User/frontend/off-chain  | Ticket owner hoặc verifier theo nghiệp vụ |
| Private personal data    | Họ tên, email, phone, payment information           | Backend/database nếu cần | Authorized backend/admin                  |

#### Public on-chain data

Blockchain là public ledger, vì vậy các dữ liệu sau được xem là công khai:

```text
ticketId
owner wallet address
ticket status
commitment
contract events
transaction history
```

Người dùng cần được giả định rằng các dữ liệu này có thể được đọc bởi bất kỳ blockchain observer nào.

#### Conditional data

Secret key không được đưa lên chain.

Chỉ người sở hữu hoặc hệ thống verifier được phép sử dụng secret để thực hiện quy trình xác minh vé theo thiết kế của ứng dụng.

#### Private data

Nếu hệ thống cần thu thập thông tin cá nhân cho mục đích vận hành concert, các dữ liệu này phải được lưu **off-chain** và không được đưa trực tiếp vào smart contract.

Database/backend cần áp dụng:

* authentication;
* authorization;
* encryption at rest;
* encryption in transit;
* access logging;
* retention policy;
* deletion policy.

---

### 5.3.4. Liên kết wallet với danh tính thật

Mặc dù contract không lưu tên hoặc email, địa chỉ ví không nên được xem là hoàn toàn anonymous.

Ví dụ:

```text
Real identity
     │
     │ KYC / account registration
     ▼
User account
     │
     ▼
Wallet address
     │
     ▼
Blockchain
```

Nếu backend của hệ thống biết rằng:

```text
user@example.com → 0xABC...
```

thì các transaction liên quan đến `0xABC...` có thể được liên kết ngược với người dùng.

Ngoài ra, blockchain transaction và event logs là public và immutable. Vì vậy, một khi một wallet đã được liên kết với danh tính thật thông qua hệ thống hoặc nguồn bên ngoài, lịch sử blockchain tương ứng có thể trở thành dữ liệu có khả năng nhận diện gián tiếp.

Do đó, hệ thống không coi wallet address là dữ liệu hoàn toàn anonymous mà coi đây là một **pseudonymous identifier**.

---

### 5.3.5. Data minimization

Smart contract chỉ lưu dữ liệu cần thiết cho việc thực thi business logic:

```text
Ticket
├── owner
├── currStatus
└── commitment
```

Không lưu:

```text
name
email
phone
CCCD
payment information
plaintext secret
QR image
personal documents
```

Việc này giảm lượng dữ liệu nhạy cảm tồn tại trên public immutable ledger.

Đặc biệt, QR code không cần được lưu dưới dạng image hoặc document trên blockchain. Contract chỉ cung cấp dữ liệu cần thiết để frontend tạo/kiểm tra giá trị QR.

---

### 5.3.6. Immutability và quyền chỉnh sửa/xóa dữ liệu

Public blockchain có đặc tính append-only và immutable. Đây tạo ra một xung đột quan trọng:

```text
Privacy / deletion requirement
              ↕
Blockchain immutability
```

Một dữ liệu đã được ghi trực tiếp lên blockchain rất khó hoặc không thể xóa khỏi toàn bộ lịch sử blockchain.

Vì vậy, hệ thống áp dụng nguyên tắc:

> **Không đưa dữ liệu cá nhân hoặc dữ liệu cần xóa/chỉnh sửa trực tiếp lên blockchain.**

Thay vào đó:

```text
Sensitive data
      │
      ▼
Encrypted off-chain storage
      │
      ├── update
      ├── delete
      └── retention control

Blockchain
      │
      └── minimal reference / commitment / state
```

Đối với ticket lifecycle, thay vì cố gắng xóa ticket khỏi blockchain, contract sử dụng state transition:

```text
Valid
  │
  ├──────► Used
  │
  └──────► Invalid
```

Ví dụ:

```solidity
tickets[ticketId].currStatus = Status.Invalid;
```

Điều này cho phép hệ thống **thu hồi hiệu lực** của ticket mà không cần xóa lịch sử transaction.

---

### 5.3.7. Revocation thay cho deletion

Do dữ liệu blockchain không thể dễ dàng bị xóa, hệ thống sử dụng cơ chế revocation cho các đối tượng blockchain cần vô hiệu hóa.

Ví dụ:

```text
Ticket #123
Status = Valid
      │
      │ invalidateTicket()
      ▼
Status = Invalid
```

Sau khi ticket bị invalid:

```solidity
onlyValidTicket(ticketId)
```

sẽ ngăn ticket tiếp tục được sử dụng.

Tương tự, RTB có thể được revoke:

```solidity
hasRTB[account] = false;
```

Như vậy, hệ thống không cần xóa lịch sử cấp RTB mà thay đổi trạng thái hiện tại để làm mất hiệu lực quyền.

---

### 5.3.8. Versioning và off-chain data

Đối với những dữ liệu cần thay đổi thường xuyên hoặc có yêu cầu xóa, kiến trúc phù hợp là lưu dữ liệu off-chain.

Ví dụ:

```text
Blockchain
    │
    └── ticket state / commitment

Backend
    │
    ├── user profile
    ├── contact information
    └── encrypted documents
```

Nếu cần thay đổi dữ liệu cá nhân, backend có thể cập nhật hoặc xóa dữ liệu theo retention policy mà không cần thay đổi blockchain history.

Nếu cần chứng minh tính toàn vẹn của một phiên bản dữ liệu, hệ thống có thể lưu hash/commitment của phiên bản đó lên blockchain thay vì lưu raw document.

---

### 5.3.9. Privacy Risk và Residual Risk

Mặc dù contract không lưu trực tiếp PII, vẫn tồn tại một số residual risks:

| Risk                                            | Mức độ      | Giải pháp                              |
| ----------------------------------------------- | ----------- | -------------------------------------- |
| Wallet bị liên kết với danh tính thật           | Medium      | Minimize on-chain identity information |
| Secret có entropy thấp                          | High        | Cryptographically secure random secret |
| Blockchain transaction history bị phân tích     | Medium      | Không đưa PII lên chain                |
| Commitment có thể bị brute-force nếu secret yếu | Medium/High | Secret đủ dài và random                |
| PII bị lộ từ backend                            | Medium/High | Encryption + access control            |
| Không thể xóa blockchain history                | High        | Không lưu raw personal data on-chain   |
| Ticket cần thu hồi                              | Low         | On-chain revocation/status             |
| Off-chain data retention quá lâu                | Medium      | Explicit retention/deletion policy     |

---

### 5.3.10. Kết luận

Thiết kế hiện tại tuân theo nguyên tắc **data minimization** bằng cách chỉ lưu những thông tin cần thiết cho ticket ownership, lifecycle và verification trên blockchain.

Đặc biệt:

* Không lưu trực tiếp PII trên public blockchain.
* Không lưu plaintext secret key.
* Chỉ lưu `keccak256(secretKey)` dưới dạng commitment.
* Ticket lifecycle được quản lý bằng trạng thái `Valid`, `Used`, `Invalid`.
* Revocation được sử dụng thay cho việc cố gắng xóa dữ liệu blockchain.
* Dữ liệu cá nhân và dữ liệu cần chỉnh sửa/xóa được định hướng lưu off-chain.
* Wallet address được xem là pseudonymous identifier thay vì anonymous identity.

Thiết kế này giảm đáng kể privacy exposure của blockchain, đồng thời giữ được khả năng kiểm chứng và tính bất biến cần thiết của hệ thống ticketing.
