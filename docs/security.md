### 5.2.1. Phạm vi và phương pháp đánh giá

Security assessment được thực hiện đối với smart contract `ConcertTicket`, sử dụng:

* Manual code review.
* Automated testing bằng Foundry: **45 tests passed, 0 failed**.
* Static analysis bằng Slither với **100 detectors**.
* Đối chiếu với OWASP Smart Contract Security Verification Standard (SCSVS) và Smart Contract Security Testing Guide (SCSTG).

OWASP SCSVS được tổ chức thành các control groups bao gồm Architecture, Code, Governance/Business Logic, Access Control, Communications, Cryptography, Arithmetic/Logic, DoS, Blockchain State Management, DeFi và Component Security. SCSTG cung cấp các test case để kiểm chứng các control tương ứng.

---

### 5.2.2. SCSVS-AUTH — Access Control và Authentication

#### SCSVS-AUTH-1 — Role-Based Access Control

Contract sử dụng ba nhóm quyền logic:

| Role              | Contract mechanism | Quyền                                                     |
| ----------------- | ------------------ | --------------------------------------------------------- |
| Owner             | `onlyOwner`        | Administrative operations, RTB, configuration, withdrawal |
| Check-in Operator | `onlyCheckIn`      | `useTicket()`                                             |
| Ticket Owner      | `onlyTicketOwner`  | Transfer ticket                                           |

OWASP SCSVS-AUTH-1 yêu cầu role-based access control và least privilege; đặc biệt yêu cầu authorization dựa trên `msg.sender` thay vì `tx.origin`.

Contract sử dụng:

```solidity
require(msg.sender == owner, "Only owner");
```

và:

```solidity
require(msg.sender == checkInOperator, "Only check-in operator");
```

Không sử dụng `tx.origin`.

**Assessment: PASS**

**Evidence:**

* `onlyOwner`
* `onlyCheckIn`
* `onlyTicketOwner`
* Negative authorization tests trong Foundry.

#### SCSTG-TEST-0004 — Test Access Control on Critical Functions

SCSTG-TEST-0004 yêu cầu kiểm tra rằng các chức năng quan trọng như withdrawal và privileged state changes chỉ được thực hiện bởi account có quyền.

Áp dụng vào contract:

* `withdraw()`
* `grantRTB()`
* `revokeRTB()`
* `setTicketPrice()`
* `setMaxTickets()`
* `invalidateTicket()`
* `transferOwnership()`
* `setCheckInOperator()`
* `useTicket()`

**Assessment: PASS**, dựa trên automated access-control tests.

---

### 5.2.3. SCSVS-AUTH-2 — Authorization Mechanisms

SCSVS-AUTH-2 yêu cầu các state-changing hoặc sensitive functions phải có authorization phù hợp. OWASP đặc biệt đề cập việc sử dụng `msg.sender` và bảo vệ các critical operations.

Contract đáp ứng bằng:

```solidity
modifier onlyOwner() {
    require(msg.sender == owner, "Only owner");
    _;
}
```

```solidity
modifier onlyCheckIn() {
    require(
        msg.sender == checkInOperator,
        "Only check-in operator"
    );
    _;
}
```

Ngoài ra, `transferTicket()` yêu cầu:

```solidity
onlyTicketOwner(ticketId)
```

và ticket phải tồn tại:

```solidity
ticketExists(ticketId)
```

**Assessment: PASS**

**Relevant SCWE:** OWASP hiện liệt kê `SCWE-016: Insufficient Authorization Checks` dưới `SCSVS-AUTH-2`. Contract đã có authorization checks cho các critical functions.

---

### 5.2.4. SCSTG-TEST-0003 — Least Privilege Principle

SCSTG-TEST-0003 kiểm tra việc sử dụng `msg.sender` thay vì `tx.origin` và việc phân quyền theo nguyên tắc least privilege.

Trong `ConcertTicket`:

```text
Owner
 ├── configure contract
 ├── manage RTB
 ├── invalidate ticket
 └── withdraw

Check-in Operator
 └── use ticket

Ticket Owner
 └── transfer own ticket
```

Check-in operator không có quyền withdraw và ticket owner không có quyền thay đổi contract configuration.

**Assessment: PASS**

**Residual risk:** Owner vẫn là một privileged EOA. Nếu private key của owner bị compromise, attacker có thể thực hiện các administrative operations. Đây là residual key-management risk chứ không phải authorization bypass trong contract.

---

### 5.2.5. SCSTG-TEST-0005 — Timed Permissions

SCSTG-TEST-0005 thuộc nhóm SCSVS-AUTH và kiểm tra các quyền phụ thuộc vào thời gian.

Contract có hai time-sensitive business rules:

```solidity
block.timestamp >= openingTime &&
block.timestamp < closingTime
```

cho official sale và:

```solidity
block.timestamp < openingTime
```

cho RTB.

**Assessment: PASS with Low-Risk Timestamp Dependency**

Slither phát hiện timestamp dependency. Đây là expected behavior vì sale schedule phụ thuộc vào blockchain time.

Timestamp không được sử dụng cho randomness hoặc cryptographic authentication.

---

## 5.2.6. SCSVS-GOV — Business Logic và Economic Security

### SCSVS-GOV-1 — Economic / Business Logic

SCSVS-GOV-1 thuộc nhóm Business Logic and Economic Security. SCSTG có test tương ứng:

**SCSTG-TEST-0015 — Testing Business Logic and Economic Security.**

Contract có các business invariants quan trọng:

#### Invariant 1 — One ticket per wallet

```solidity
require(
    ownerTicket[msg.sender] == 0,
    "Already owns ticket"
);
```

#### Invariant 2 — RTB consumed after successful purchase

```solidity
hasRTB[msg.sender] = false;
```

#### Invariant 3 — Ticket can only be used while Valid

```solidity
require(
    tickets[ticketId].currStatus == Status.Valid,
    "Ticket not valid"
);
```

#### Invariant 4 — Used ticket cannot be used again

State transition:

```text
Valid → Used
```

và `onlyValidTicket()` ngăn:

```text
Used → Used
```

#### Invariant 5 — Invalid ticket cannot be used

```text
Valid → Invalid
```

Sau đó `onlyValidTicket()` chặn việc sử dụng.

#### Invariant 6 — Recipient cannot already own another ticket

```solidity
require(
    ownerTicket[to] == 0,
    "Recipient already has ticket"
);
```

**Assessment: PASS**

**Evidence:** Foundry automated tests, 45/45 passed.

---

## 5.2.7. SCSVS-GOV-3 — Reentrancy và Logic Flaws

SCSVS-GOV-3 yêu cầu kiểm tra transaction flow, state transitions, low-level calls và các logic có khả năng dẫn tới reentrancy hoặc function-integrity problems. Đặc biệt S3.3.A4 yêu cầu xem xét Checks-Effects-Interactions và S3.3.A5 yêu cầu xử lý an toàn low-level calls.

`withdraw()` sử dụng:

```solidity
(bool ok, ) = owner.call{value: amount}("");
```

Slither đã phát hiện đây là `low-level-call`.

Tuy nhiên:

* Function được bảo vệ bằng `onlyOwner`.
* ETH amount được lấy từ current contract balance.
* Sau khi transfer, balance của contract giảm.
* Không có user-controlled recipient.
* Không có internal accounting balance cần cập nhật sau call.

Do đó chưa xác định được exploitable reentrancy path từ implementation hiện tại.

**Assessment: REVIEWED / LOW RISK**

Đây là finding cần ghi nhận trong report, nhưng không nên gọi là confirmed reentrancy vulnerability.

---

### SCWE mapping

OWASP SCWE catalog hiện tại liên kết các weakness như:

* `SCWE-046` — Reentrancy Attacks.
* `SCWE-048` — Unchecked Call Return Value.
* `SCWE-078` — Improper Handling of Ether Transfers.
* `SCWE-102` — Missing Checks-Effects-Interactions Pattern.

Contract kiểm tra return value:

```solidity
(bool ok, ) = owner.call{value: amount}("");
require(ok, "Withdraw failed");
```

và state/accounting hiện tại không cho thấy missing-CEI exploit.

Do đó các SCWE trên được xem là **review targets**, không phải confirmed vulnerabilities.

---

## 5.2.8. SCSVS-ORACLE-1 — Arithmetic và Logic Security

SCSVS-ORACLE-1 hiện được OWASP sử dụng cho **Preventing Overflow/Underflow**, bao gồm integer bounds, time-unit arithmetic và precision.

Contract sử dụng:

```solidity
pragma solidity ^0.8.24;
```

và không sử dụng `unchecked`.

Các phép toán chính:

```solidity
nextTicketId++;
```

```solidity
nextTicketId - 1
```

được compiler Solidity 0.8.x kiểm tra overflow/underflow.

Contract cũng không sử dụng fixed-point hoặc floating-point arithmetic.

**Assessment: PASS**

### SCSTG-TEST-0016 — Testing Arithmetic and Logic Security

SCSTG-TEST-0016 được map tới `SCSVS-ORACLE-1`.

Các logic cần kiểm tra gồm:

* Ticket ID progression.
* `maxTickets`.
* Ticket supply boundary.
* Sale-time arithmetic.
* Invalid maximum ticket values.

**Assessment: PASS**, dựa trên automated tests và Solidity checked arithmetic.

---

## 5.2.9. SCSVS-CODE-1 — Secure Development Policies

SCSVS-CODE-1 yêu cầu secure coding practices, compiler version và code review/static analysis. OWASP yêu cầu không sử dụng compiler outdated/deprecated functions và yêu cầu security review có static analysis.

Contract sử dụng:

```solidity
pragma solidity ^0.8.24;
```

Không sử dụng:

* `tx.origin`;
* `selfdestruct`;
* inline assembly;
* deprecated Solidity transfer patterns.

Slither được sử dụng trong security review.

**Assessment: PARTIAL / PASS WITH LIMITATION**

Static analysis đã được thực hiện, tuy nhiên yêu cầu **two independent developer reviews** của SCSVS-CODE-1 không thể được khẳng định chỉ từ test output hiện tại.

Trong report không nên ghi rằng requirement này đã hoàn toàn đạt nếu nhóm chưa thực sự có hai reviewer độc lập.

---

## 5.2.10. SCSVS-CODE-2 — Code Clarity

SCSVS-CODE-2 yêu cầu documentation, logical organization, naming conventions và code quality.

`ConcertTicket` được chia thành các section:

```text
Events
Enums & Structs
State Variables
Modifiers
Constructor
Administrative Functions
Purchase Logic
Transfer Logic
Ticket Usage
Verification / QR Logic
Read-only Helpers
Payment / Receive
Withdrawal
```

Các critical functions có comments mô tả mục đích và security assumptions.

**Assessment: PASS**

### SCSTG-TEST-0010

SCSTG-TEST-0010 kiểm tra compiler version và deprecated functions, thuộc `SCSVS-CODE-2`.

**Assessment: PASS**

---

## 5.2.11. SCSVS-CODE-3 — Test Coverage

SCSVS-CODE-3 yêu cầu comprehensive unit testing, integration testing, automated testing và security-specific tests. Các requirements bao gồm critical-function coverage, edge cases, automated execution và security tests.

Current evidence:

```text
45 tests passed
0 failed
0 skipped
```

Test suite bao phủ:

* deployment;
* administrative authorization;
* RTB;
* ticket purchase;
* payment validation;
* ownership;
* transfer;
* lifecycle;
* check-in;
* invalid states;
* withdrawal;
* negative/revert cases.

**Assessment: PASS for current unit/security test scope.**

**Limitation:** SCSVS-CODE-3 cũng đề cập integration testing, fuzz testing và coverage tooling. Nếu chưa có những artifact này thì không nên claim full compliance với toàn bộ CODE-3.

---

## 5.2.12. SCSVS-COMM-1 — Secure Contract Interactions

SCSVS-COMM-1 yêu cầu secure handling của external contract interactions, external calls và failure handling.

`ConcertTicket` có rất ít external interactions.

External ETH transfer duy nhất là:

```solidity
owner.call{value: amount}("");
```

Return value được kiểm tra:

```solidity
require(ok, "Withdraw failed");
```

Contract không sử dụng:

* oracle;
* bridge;
* external DeFi protocol;
* arbitrary external contract calls;
* delegatecall.

**Assessment: PASS with Low-Risk Review for withdrawal external call.**

### SCSTG-TEST-0011

SCSTG-TEST-0011 — **Test Contract Interactions** — được map tới `SCSVS-COMM-1`.

---

## 5.2.13. SCSVS-CRYPTO — Cryptographic Practices

Contract không thực hiện digital-signature verification hoặc ECDSA authentication.

Do đó các control liên quan đến:

* `ecrecover`;
* EIP-712;
* signature malleability;
* signature replay;

không áp dụng trực tiếp.

SCSVS-CRYPTO-2 và SCSTG-TEST-0013 tập trung vào **signature verification**, trong khi contract hiện tại sử dụng hash commitment thay vì chữ ký.

### Secret Commitment

Contract lưu:

```solidity
bytes32 commitment;
```

được tạo từ:

```solidity
keccak256(
    abi.encodePacked(secretKey)
)
```

Plaintext secret không được lưu on-chain.

Đây là một thiết kế phù hợp với mục tiêu tránh đưa secret trực tiếp lên public blockchain.

Tuy nhiên:

> `keccak256` không phải encryption.

Security của secret phụ thuộc vào entropy và cách secret được tạo/lưu trữ off-chain.

**Assessment: PASS WITH RESIDUAL OFF-CHAIN RISK**

Không claim `SCSTG-TEST-0013` là đã pass vì test đó dành cho signature verification, không phải commitment hashing.

---

## 5.2.14. SCSVS-BLOCK-1 — Denial of Service và Gas Limits

SCSVS-BLOCK-1 yêu cầu kiểm soát gas consumption, loops và DoS risks.

Các core operations của contract không sử dụng unbounded loops:

```text
buyTicket()
transferTicket()
useTicket()
verifyTicket()
```

đều có constant-time/state lookup behavior.

Không có function duyệt toàn bộ ticket collection để thực hiện một operation.

Do đó nguy cơ DoS do block gas limit được giảm đáng kể.

**Assessment: PASS for current architecture.**

### SCSTG-TEST-0008

SCSTG-TEST-0008 — **Efficient Loop and Function Design** — được map tới `SCSVS-BLOCK-1`.

Do contract không có unbounded loops trong business logic, test được đánh giá là **N/A / Low-risk by design**.

---

## 5.2.15. SCSVS-BRIDGE-1 — Blockchain State Management

SCSVS-BRIDGE-1 yêu cầu secure state handling, bao gồm việc payable functions xử lý ETH và có withdrawal mechanism để tránh ETH bị lock.

Purchase functions:

```solidity
buyTicketOfficial()
buyTicketRTB()
```

nhận ETH thông qua `msg.value`.

Contract cung cấp:

```solidity
withdraw()
```

để owner rút balance.

Contract cũng reject direct ETH transfer:

```solidity
receive() external payable {
    revert("Send ETH via purchase functions");
}
```

**Assessment: PASS**

### SCSTG-TEST-0009

SCSTG-TEST-0009 — **Blockchain Data and State Management** — được map tới `SCSVS-BRIDGE-1`.

State transitions của ticket:

```text
Valid
 ├──→ Used
 └──→ Invalid
```

được enforce bởi contract.

**Assessment: PASS**

---

## 5.2.16. SCSVS-ARCH-1 — Architecture và Design

SCSVS-ARCH-1 yêu cầu secure design patterns, modularity, separation of concerns và quản lý privilege transfers.

Contract hiện tại là một single-purpose contract:

```text
ConcertTicket
```

với các domain logic được phân tách rõ ràng bên trong contract.

Contract không sử dụng proxy hoặc upgradeability.

Điều này giảm attack surface liên quan đến:

* proxy initialization;
* delegatecall;
* storage collision;
* unauthorized upgrades.

Tuy nhiên `transferOwnership()` hiện là single-step ownership transfer:

```solidity
owner = newOwner;
```

OWASP có control liên quan đến two-step privilege transfer ở SCSVS-ARCH-1/S1.1.A5.

**Assessment: PARTIAL / DESIGN LIMITATION**

Đây là một điểm nên ghi rõ trong report.

Không phải bug khiến ticket buyer có thể attack contract, nhưng nếu owner nhập nhầm address hoặc transfer ownership tới address không kiểm soát được, administrative control có thể bị mất.

---

## 5.2.17. SCSVS-ARCH-2 — Upgradeability

SCSVS-ARCH-2 tập trung vào proxy và upgrade mechanisms.

`ConcertTicket` không sử dụng:

* proxy;
* delegatecall;
* implementation contract;
* initializer.

Contract được deploy trực tiếp bằng constructor:

```solidity
constructor() {
    owner = msg.sender;
    checkInOperator = msg.sender;
}
```

Do đó proxy-specific requirements không áp dụng.

**Assessment: N/A — Non-upgradeable architecture**

### SCSTG-TEST-0007

SCSTG-TEST-0007 kiểm tra modularity/upgradability.

**Assessment: N/A for proxy-specific checks.**

---

## 5.2.18. Consolidated OWASP Mapping

| Contract requirement / security property | SCSVS                         | SCSTG             | Evidence                           | Result          |
| ---------------------------------------- | ----------------------------- | ----------------- | ---------------------------------- | --------------- |
| Owner authorization                      | `SCSVS-AUTH-1/2`              | `SCSTG-TEST-0004` | Foundry negative tests             | PASS            |
| Check-in authorization                   | `SCSVS-AUTH-1/2`              | `SCSTG-TEST-0004` | `onlyCheckIn` + tests              | PASS            |
| Ticket-owner authorization               | `SCSVS-AUTH-1/2`              | `SCSTG-TEST-0004` | `onlyTicketOwner` + tests          | PASS            |
| `msg.sender` authorization               | `SCSVS-AUTH-1`                | `SCSTG-TEST-0003` | No `tx.origin`                     | PASS            |
| Least privilege                          | `SCSVS-AUTH-1`                | `SCSTG-TEST-0003` | Separate roles                     | PASS            |
| RTB timed permission                     | `SCSVS-AUTH-1`                | `SCSTG-TEST-0005` | `block.timestamp` rules            | PASS / LOW RISK |
| One-ticket-per-wallet                    | `SCSVS-GOV-1`                 | `SCSTG-TEST-0015` | `ownerTicket` invariant            | PASS            |
| Ticket lifecycle                         | `SCSVS-GOV-1/3`               | `SCSTG-TEST-0015` | `Valid/Used/Invalid`               | PASS            |
| Double-use prevention                    | `SCSVS-GOV-3`                 | `SCSTG-TEST-0015` | `onlyValidTicket`                  | PASS            |
| Withdrawal security                      | `SCSVS-GOV-3`, `SCSVS-COMM-1` | `SCSTG-TEST-0011` | `onlyOwner` + external-call review | LOW RISK        |
| Arithmetic safety                        | `SCSVS-ORACLE-1`              | `SCSTG-TEST-0016` | Solidity 0.8.24 + tests            | PASS            |
| Compiler/version policy                  | `SCSVS-CODE-1`                | `SCSTG-TEST-0010` | `pragma ^0.8.24`                   | PASS            |
| Code documentation                       | `SCSVS-CODE-2`                | `SCSTG-TEST-0010` | Comments/structure                 | PASS            |
| Automated testing                        | `SCSVS-CODE-3`                | —                 | 45/45 tests                        | PASS*           |
| External call handling                   | `SCSVS-COMM-1`                | `SCSTG-TEST-0011` | Checked return value               | PASS / REVIEW   |
| Secret commitment                        | `SCSVS-CRYPTO`                | —                 | `keccak256(secret)`                | PASS*           |
| Gas/loop safety                          | `SCSVS-BLOCK-1`               | `SCSTG-TEST-0008` | No unbounded loops                 | PASS            |
| ETH/state handling                       | `SCSVS-BRIDGE-1`              | `SCSTG-TEST-0009` | `receive()` + `withdraw()`         | PASS            |
| Non-upgradeable design                   | `SCSVS-ARCH-2`                | `SCSTG-TEST-0007` | No proxy/delegatecall              | N/A             |
| Ownership transfer                       | `SCSVS-ARCH-1`                | —                 | Single-step transfer               | PARTIAL         |

* "PASS" ở đây chỉ có nghĩa là control được address trong phạm vi hiện tại; không có nghĩa là toàn bộ SCSVS control group đã được chứng nhận.

---

## 5.2.19. Static Analysis Result

Slither được chạy trên `ConcertTicket.sol` với 100 detectors.

Kết quả:

```text
1 contract analyzed
100 detectors
5 results
```

Các findings:

### `timestamp`

Các vị trí:

* `setOpeningTime()`
* `setClosingTime()`
* `buyTicketRTB()`
* `isSaleOpen()`

**Risk:** Low.

**Reason:** timestamp được sử dụng cho sale scheduling, không dùng cho randomness hoặc cryptographic security.

**Status:** Accepted Risk.

### `low-level-calls`

Vị trí:

```solidity
owner.call{value: amount}("");
```

**Risk:** Requires Review / Low.

**Reason:** external call tồn tại trong withdrawal, nhưng caller bị giới hạn bởi `onlyOwner` và return value được kiểm tra.

**Status:** Reviewed; no demonstrated exploit in current implementation.

---

## 5.2.20. Overall Security Assessment

Dựa trên manual review, automated testing và static analysis:

```text
                    ConcertTicket
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   Access Control   Business Logic   State Security
        │                │                │
      PASS              PASS             PASS
        │                │                │
        └────────────────┼────────────────┘
                         │
                  Static Analysis
                         │
                ┌────────┴────────┐
                │                 │
             Timestamp        Low-level call
             Low Risk        Reviewed / Low
```

Không phát hiện trong assessment hiện tại các vấn đề trực tiếp liên quan đến:

* unauthorized ticket usage;
* unauthorized ticket transfer;
* duplicate ticket ownership;
* double ticket redemption;
* unauthorized withdrawal;
* integer overflow/underflow;
* unbounded-loop DoS trong core business functions;
* `tx.origin` authorization;
* proxy/upgrade initialization.

Các residual risks đáng chú ý:

1. **Single privileged owner key.**
2. **Single-step ownership transfer.**
3. **Timestamp boundary dependency.**
4. **Off-chain secret compromise.**
5. **Withdrawal external call.**
6. **Sybil/multiple-wallet abuse:** one-ticket-per-wallet không đồng nghĩa one-ticket-per-human.

Do đó, assessment phù hợp với phạm vi **MVP/educational blockchain ticketing system**, nhưng không nên được trình bày như một formal security audit hoặc chứng nhận full SCSVS compliance.


### Các nguồn OWASP trong report

* [OWASP SCSVS](https://scs.owasp.org/SCSVS/?utm_source=chatgpt.com) — standard verification cho smart contract. ([scs.owasp.org][1])
* [OWASP SCSTG](https://scs.owasp.org/SCSTG/?utm_source=chatgpt.com) — hướng dẫn testing và methodology. ([scs.owasp.org][6])
* [OWASP Smart Contract Top 10](https://scs.owasp.org/sctop10/?utm_source=chatgpt.com) — danh sách risk categories hiện tại. ([scs.owasp.org][7])

[1]: https://scs.owasp.org/SCSVS/?utm_source=chatgpt.com "OWASP SCSVS - OWASP Smart Contract Security"
[2]: https://scs.owasp.org/SCSVS/04-Assessment_and_Certification/?utm_source=chatgpt.com "Assessment and Certification - OWASP Smart Contract Security"
[3]: https://scs.owasp.org/sctop10/archive/2025/Top10%3A2025/?utm_source=chatgpt.com "Top10:2025 - OWASP Smart Contract Security"
[4]: https://scs.owasp.org/SCSTG/tests/?utm_source=chatgpt.com "SCSTG Tests - OWASP Smart Contract Security"
[5]: https://scs.owasp.org/SCSVS/controls/SCSVS-CODE-3/?utm_source=chatgpt.com "SCSVS-CODE-3 - OWASP Smart Contract Security"
[6]: https://scs.owasp.org/SCSTG/?utm_source=chatgpt.com "OWASP SCSTG - OWASP Smart Contract Security"
[7]: https://scs.owasp.org/sctop10/?utm_source=chatgpt.com "OWASP Smart Contract Top 10 : 2026 - OWASP Smart Contract Security"
