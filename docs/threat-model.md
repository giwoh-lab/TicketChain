## 5.1. Threat Model

### 5.1.1. Phạm vi và mục tiêu

Hệ thống Concert Ticket Management sử dụng smart contract `ConcertTicket` triển khai trên Ethereum Sepolia để quản lý quyền sở hữu, mua, chuyển nhượng, xác minh và sử dụng vé concert.

Threat model tập trung vào các tài sản, tác nhân, trust boundary và abuse case có khả năng ảnh hưởng đến tính toàn vẹn của ticket, quyền truy cập, thanh toán và quá trình check-in.

Mục tiêu bảo mật chính của hệ thống:

* Chỉ người dùng hợp lệ mới có thể mua và sở hữu ticket.
* Một wallet chỉ được sở hữu tối đa một ticket.
* Chỉ owner hợp lệ mới có thể chuyển ticket.
* RTB chỉ được sử dụng bởi tài khoản được cấp quyền và chỉ trước thời điểm mở bán chính thức.
* Ticket đã sử dụng không thể được sử dụng lại.
* Chỉ check-in operator được ủy quyền mới có thể đánh dấu ticket là `Used`.
* Chỉ admin mới có thể thực hiện các chức năng quản trị.
* Secret key không được lưu trực tiếp trên blockchain.
* Các thao tác quan trọng có thể được truy vết thông qua transaction và event log.

---

### 5.1.2. Assets cần bảo vệ

| Asset                | Vị trí                        | Giá trị bảo vệ                                      | Rủi ro                                                         |
| -------------------- | ----------------------------- | --------------------------------------------------- | -------------------------------------------------------------- |
| Ticket ownership     | `Ticket.owner`, `ownerTicket` | Xác định wallet sở hữu vé                           | Chiếm quyền sở hữu hoặc chuyển nhượng trái phép                |
| Ticket status        | `Ticket.currStatus`           | Xác định vé còn hợp lệ, đã dùng hoặc bị vô hiệu hóa | Double redemption hoặc bypass lifecycle                        |
| RTB permission       | `hasRTB`                      | Quyền mua vé trước official sale                    | Cấp quyền trái phép hoặc sử dụng RTB sai thời điểm             |
| Ticket commitment    | `Ticket.commitment`           | Xác minh secret key mà không lưu plaintext          | Giả mạo credential nếu secret bị lộ                            |
| Secret key           | Frontend/off-chain            | Dùng để tạo và xác minh QR                          | Rò rỉ secret dẫn đến giả mạo QR                                |
| Contract ETH balance | Smart contract                | Tiền thanh toán từ người mua                        | Unauthorized withdrawal                                        |
| Admin authority      | `owner`                       | Quyền quản trị contract                             | Admin key compromise                                           |
| Check-in authority   | `checkInOperator`             | Quyền sử dụng ticket                                | Unauthorized check-in                                          |
| Audit information    | Blockchain events             | Truy vết các hoạt động                              | Mất khả năng kiểm toán nếu frontend không ghi nhận transaction |
| Contract state       | Ethereum Sepolia              | Tính toàn vẹn của hệ thống                          | Unauthorized state modification                                |

---

### 5.1.3. Các tác nhân

#### 1. Buyer / User

Người dùng thông thường của hệ thống.

Quyền nghiệp vụ:

* Mua ticket official.
* Mua ticket thông qua RTB nếu được cấp quyền.
* Xem ticket của mình.
* Transfer ticket.
* Verify ticket bằng secret key.

Người dùng được xem là **untrusted** đối với hệ thống smart contract. Frontend không được coi là nguồn đáng tin cậy để quyết định quyền truy cập.

#### 2. Admin / Contract Owner

Account triển khai contract và được gán vào biến `owner`.

Admin có quyền:

* Grant/revoke RTB.
* Thay đổi thời gian mở/đóng bán.
* Thay đổi ticket price.
* Thay đổi maximum ticket supply.
* Thay đổi check-in operator.
* Invalidate ticket.
* Withdraw ETH.
* Transfer ownership.

Đây là privileged actor và private key của account này là tài sản có giá trị cao.

#### 3. Check-in Operator

Account được lưu trong `checkInOperator`.

Có quyền:

```solidity
useTicket(ticketId)
```

Operator không có quyền thực hiện các chức năng quản trị khác.

#### 4. Malicious User

Người dùng cố tình vi phạm business rules, ví dụ:

* Mua nhiều ticket.
* Dùng RTB không được cấp.
* Dùng RTB sau thời điểm mở bán.
* Transfer ticket không thuộc sở hữu.
* Dùng ticket đã `Used`.
* Gọi chức năng admin.
* Giả mạo QR hoặc secret.

#### 5. External Attacker

Attacker không nhất thiết sở hữu tài khoản hợp lệ của hệ thống nhưng có thể quan sát blockchain, transaction hoặc cố khai thác frontend/backend/RPC infrastructure.

Các mục tiêu có thể bao gồm:

* Đánh cắp secret.
* Đánh cắp private key.
* Theo dõi transaction.
* Thực hiện front-running đối với các transaction phù hợp.
* Khai thác lỗi authorization ở frontend/backend.

---

### 5.1.4. Trust Boundaries

Kiến trúc hệ thống được chia thành các trust boundary sau:

```text
                UNTRUSTED
        ┌──────────────────────┐
        │      Browser/UI      │
        └──────────┬───────────┘
                   │
                   │ User interaction
                   ▼
        ┌──────────────────────┐
        │        Wallet        │
        └──────────┬───────────┘
                   │
                   │ Signed transaction
                   ▼
══════════════════════════════════════════
             TRUST BOUNDARY
══════════════════════════════════════════
                   │
                   ▼
        ┌──────────────────────┐
        │   ConcertTicket      │
        │   Smart Contract     │
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │ Ethereum Sepolia     │
        │ Blockchain           │
        └──────────────────────┘
```

Frontend và user input được xem là **untrusted**.

Smart contract là lớp enforce chính đối với các business rule quan trọng. Do đó, frontend không được dùng làm cơ chế authorization duy nhất.

Ví dụ, frontend có thể ẩn nút `Grant RTB` đối với user thông thường, nhưng điều này không đủ để bảo vệ chức năng. Smart contract vẫn phải kiểm tra:

```solidity
onlyOwner
```

Tương tự, frontend có thể chỉ hiển thị chức năng check-in cho operator, nhưng contract vẫn enforce:

```solidity
onlyCheckIn
```

---

### 5.1.5. Abuse Cases

#### Abuse Case 1 — Mua nhiều ticket bằng cùng một wallet

**Mục tiêu:** Một user cố mua nhiều ticket để tích trữ hoặc đầu cơ.

**Attack:**

```text
User
 ↓
buyTicketOfficial()
 ↓
buyTicketOfficial()
```

**Biện pháp bảo vệ:**

Contract sử dụng:

```solidity
modifier noTicket() {
    require(ownerTicket[msg.sender] == 0, "Already owns ticket");
    _;
}
```

Sau khi ticket đầu tiên được tạo:

```solidity
ownerTicket[msg.sender] = ticketId;
```

Lần mua thứ hai sẽ bị revert.

**Residual risk:** Quy tắc này giới hạn một ticket trên mỗi wallet, không phải một ticket trên mỗi người thật. Một người vẫn có thể sử dụng nhiều wallet.

---

#### Abuse Case 2 — Người dùng tự cấp RTB cho chính mình

**Mục tiêu:** Bypass cơ chế early purchase.

**Attack:**

```text
User
 ↓
grantRTB(user)
```

**Biện pháp bảo vệ:**

`grantRTB()` yêu cầu:

```solidity
onlyOwner
```

Do đó transaction từ user thông thường bị revert.

**Residual risk:** Nếu private key của admin bị compromise, attacker có thể cấp RTB trái phép.

---

#### Abuse Case 3 — Sử dụng RTB sau khi official sale mở

**Mục tiêu:** Tiếp tục sử dụng quyền RTB sau thời điểm mở bán chính thức.

**Biện pháp bảo vệ:**

```solidity
require(
    block.timestamp < openingTime,
    "RTB only before opening time"
);
```

Do đó RTB không thể được sử dụng sau `openingTime`.

**Residual risk:** Logic dựa trên blockchain timestamp và không giải quyết được vấn đề transaction bị delay trong mempool.

---

#### Abuse Case 4 — Transfer ticket không thuộc sở hữu

**Mục tiêu:** User cố chuyển ticket của người khác.

**Biện pháp bảo vệ:**

```solidity
onlyTicketOwner(ticketId)
```

với:

```solidity
require(
    tickets[ticketId].owner == msg.sender,
    "Not ticket owner"
);
```

Transaction trái phép bị revert.

---

#### Abuse Case 5 — Double redemption / sử dụng ticket nhiều lần

**Mục tiêu:** Một ticket được sử dụng nhiều lần tại venue.

**Attack:**

```text
Valid
 ↓
useTicket()
 ↓
Used
 ↓
useTicket() again
```

**Biện pháp bảo vệ:**

`useTicket()` yêu cầu:

```solidity
onlyValidTicket(ticketId)
```

Sau lần sử dụng đầu tiên:

```solidity
tickets[ticketId].currStatus = Status.Used;
```

Lần sử dụng tiếp theo bị revert.

Đây là một business rule quan trọng nhằm chống double redemption.

**Residual risk:** Nếu check-in operator hoặc thiết bị sử dụng private key của operator bị compromise, attacker có thể thực hiện các thao tác mà operator được phép thực hiện.

---

#### Abuse Case 6 — Người dùng tự check-in ticket

**Mục tiêu:** User gọi `useTicket()` mà không phải nhân viên check-in.

**Biện pháp bảo vệ:**

```solidity
modifier onlyCheckIn() {
    require(
        msg.sender == checkInOperator,
        "Only check-in operator"
    );
    _;
}
```

Chỉ account được cấu hình làm `checkInOperator` mới có quyền sử dụng ticket.

---

#### Abuse Case 7 — Sử dụng ticket đã bị invalidate

**Mục tiêu:** Sử dụng ticket đã bị admin vô hiệu hóa.

**Biện pháp bảo vệ:**

Ticket chuyển sang:

```text
Valid → Invalid
```

và `onlyValidTicket` ngăn không cho ticket tiếp tục được sử dụng.

**Residual risk:** Việc invalidate không xóa transaction hoặc event lịch sử khỏi blockchain vì blockchain có tính bất biến.

---

#### Abuse Case 8 — Gửi sai số lượng ETH

**Mục tiêu:** User cố mua ticket bằng số ETH khác giá quy định.

**Biện pháp bảo vệ:**

```solidity
require(
    msg.value == ticketPrice,
    "Incorrect ETH amount"
);
```

Transaction không đúng giá bị revert.

---

#### Abuse Case 9 — Giả mạo secret / QR

**Mục tiêu:** Attacker tạo QR hoặc credential giả.

Contract không lưu plaintext secret. Thay vào đó, contract lưu:

```solidity
bytes32 commitment;
```

Commitment được tạo bằng:

```solidity
keccak256(abi.encodePacked(secretKey))
```

Khi verify, hệ thống tính lại commitment từ secret được cung cấp và so sánh với commitment on-chain.

Điều này ngăn plaintext secret khỏi việc được lưu trực tiếp trên blockchain.

**Residual risk:** Commitment không bảo vệ secret nếu secret bị đánh cắp ở frontend, browser, device hoặc quá trình truyền off-chain. Attacker sở hữu secret hợp lệ có thể tạo lại QR tương ứng.

---

#### Abuse Case 10 — Unauthorized withdrawal

**Mục tiêu:** Attacker cố rút ETH từ contract.

**Biện pháp bảo vệ:**

```solidity
function withdraw() external onlyOwner
```

Chỉ owner mới được gọi chức năng withdrawal.

**Residual risk:** Đây là single privileged account. Nếu private key của owner bị lộ, attacker có thể thực hiện các thao tác quản trị và rút tiền.

---

### 5.1.6. Biện pháp phát hiện và phục hồi

Các thao tác quan trọng phát sinh event trên blockchain, bao gồm:

* `TicketCreated`
* `TicketTransferred`
* `TicketUsed`
* `RTBUpdated`
* `TicketInvalidated`
* `OwnerTransferred`
* `CheckInOperatorChanged`
* `TicketPriceChanged`
* `MaxTicketsChanged`

Các event này được sử dụng để audit và phát hiện hoạt động bất thường.

Ví dụ:

```text
TicketCreated
      ↓
Ticket ownership recorded

TicketTransferred
      ↓
Ownership changed

TicketUsed
      ↓
Ticket redeemed

TicketInvalidated
      ↓
Ticket revoked
```

Khi phát hiện account quản trị hoặc operator bị compromise, hệ thống có thể thay đổi:

* `owner` thông qua ownership transfer.
* `checkInOperator` thông qua `setCheckInOperator()`.
* RTB permission thông qua `grantRTB()` / `revokeRTB()`.

Đối với secret key bị lộ, commitment hiện tại không thể thay đổi trực tiếp bởi user. Trong trường hợp cần thu hồi credential, admin có thể invalidate ticket và cấp ticket mới theo quy trình nghiệp vụ phù hợp.

---

### 5.1.7. Residual Risks

Một số rủi ro không thể được giải quyết hoàn toàn bởi smart contract:

1. **Compromised private key:** Smart contract không thể ngăn owner hoặc operator thực hiện hành động hợp lệ nếu private key của họ bị đánh cắp.

2. **Multiple wallets:** Quy tắc một ticket trên mỗi wallet không đồng nghĩa với một ticket trên mỗi con người.

3. **Secret leakage:** Commitment bảo vệ secret trên-chain nhưng không bảo vệ secret nếu secret bị lộ off-chain.

4. **Frontend compromise:** Attacker kiểm soát frontend có thể thay đổi giao diện hoặc hướng user tới transaction không mong muốn. Người dùng vẫn phải xác nhận transaction bằng wallet.

5. **RPC availability:** Blockchain interaction có thể bị gián đoạn nếu RPC provider không khả dụng.

6. **Blockchain immutability:** Transaction và event lịch sử không thể bị xóa. Việc revoke ticket chỉ thay đổi trạng thái hiện tại.

7. **Mempool/front-running:** Các transaction public trước khi được xác nhận có thể bị quan sát. Hệ thống không coi transaction đang pending là trạng thái đã hoàn tất.

8. **Physical check-in security:** Smart contract chỉ xác nhận trạng thái on-chain. Nó không thể tự xác minh rằng người cầm QR thực sự là người được phép vào venue nếu quy trình check-in vật lý không được thiết kế đúng.

| Threat                | Security control  | Automated test                      |
| --------------------- | ----------------- | ----------------------------------- |
| Double purchase       | `noTicket`        | `test_Revert...Second...`           |
| Unauthorized RTB      | `onlyOwner`       | `test_AdminCan...` / non-owner test |
| Unauthorized transfer | `onlyTicketOwner` | transfer access test                |
| Double redemption     | `onlyValidTicket` | second `useTicket` revert           |
| Unauthorized check-in | `onlyCheckIn`     | non-operator test                   |
| RTB after opening     | timestamp check   | RTB timing test                     |
| Wrong payment         | `msg.value` check | incorrect payment test              |
| Invalid ticket        | `Status.Invalid`  | invalidation test                   |