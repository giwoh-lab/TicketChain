# TX & Event Evidence — ConcertTicket

Bằng chứng giao dịch on-chain xuất từ Etherscan cho contract `0xD3CB1b9A39a14753A92d869EEC1E45237C1e5Ae4` trên Ethereum Sepolia Testnet.

---

## Tổng quan giao dịch

| # | Phương thức | Thời gian (UTC) | Block | Từ | ETH | Tx Hash |
|---|---|---|---|---|---|---|
| 1 | Deploy | 2026-08-28 08:03:36 | 11583540 | `0xD6595...eA3` | 0 | [0x6790a3...](https://sepolia.etherscan.io/tx/0x6790a3f59b48442ec441fe53862cb934e90f7195f401eb65797353fe6dd63a03) |
| 2 | Grant RTB | 2026-08-29 05:41:48 | 11589849 | `0xD6595...eA3` | 0 | [0x43eb39...](https://sepolia.etherscan.io/tx/0x43eb39debcbc548960f4d583b461e593d909df57bf46911c11527c717bc9a9eb) |
| 3 | Buy Ticket RTB | 2026-08-29 05:42:00 | 11589850 | `0xa9766b...7e` | 0.1 | [0xbcda3d...](https://sepolia.etherscan.io/tx/0xbcda3dac9cd399d8127bc7552443f6aa46b7067c272d30d254827197eb2a81d5) |
| 4 | Use Ticket | 2026-08-29 05:42:12 | 11589851 | `0xD6595...eA3` | 0 | [0xa15f24...](https://sepolia.etherscan.io/tx/0xa15f2460981c131ed2bb598c8e9f885844c90ef6b0679558a705c9094e5aaa8b) |

> Các giao dịch 2, 3, 4 được broadcast liên tiếp trong 24 giây — chứng minh E2E demo script chạy thành công trên Sepolia.

---

## Chi tiết từng giao dịch

### TX 1 — Deploy Contract
| Trường | Giá trị |
|---|---|
| Tx Hash | `0x6790a3f59b48442ec441fe53862cb934e90f7195f401eb65797353fe6dd63a03` |
| Block | 11583540 |
| Thời gian | 2026-08-28 08:03:36 UTC |
| Từ (Deployer) | `0xD6595383821F3f2BBF8c117546ee19De01920eA3` |
| Contract tạo ra | `0xD3CB1b9A39a14753A92d869EEC1E45237C1e5Ae4` |
| Gas fee | 0.00319393154165017 ETH |
| Event | _(không có event trong constructor)_ |
| Etherscan | https://sepolia.etherscan.io/tx/0x6790a3f59b48442ec441fe53862cb934e90f7195f401eb65797353fe6dd63a03 |

---

### TX 2 — Grant RTB
| Trường | Giá trị |
|---|---|
| Tx Hash | `0x43eb39debcbc548960f4d583b461e593d909df57bf46911c11527c717bc9a9eb` |
| Block | 11589849 |
| Thời gian | 2026-08-29 05:41:48 UTC |
| Từ (Admin) | `0xD6595383821F3f2BBF8c117546ee19De01920eA3` |
| Đến | `0xD3CB1b9A39a14753A92d869EEC1E45237C1e5Ae4` |
| Gas fee | 0.000049974528598452 ETH |
| Gas used | 47,981 |
| Event emit | `RTBUpdated(account: 0xa9766b..., available: true)` |
| Etherscan | https://sepolia.etherscan.io/tx/0x43eb39debcbc548960f4d583b461e593d909df57bf46911c11527c717bc9a9eb |

---

### TX 3 — Buy Ticket RTB
| Trường | Giá trị |
|---|---|
| Tx Hash | `0xbcda3dac9cd399d8127bc7552443f6aa46b7067c272d30d254827197eb2a81d5` |
| Block | 11589850 |
| Thời gian | 2026-08-29 05:42:00 UTC |
| Từ (User) | `0xa9766b8605D1d657552B9F78fE25765bdB81917e` |
| Đến | `0xD3CB1b9A39a14753A92d869EEC1E45237C1e5Ae4` |
| ETH gửi | 0.1 ETH (giá vé) |
| Gas fee | 0.000105309355580695 ETH |
| Gas used | 105,007 |
| Event emit | `TicketCreated(buyer: 0xa9766b..., ticketId: 1, commitment: 0xe0cf6c...)` |
| Event emit | `RTBUpdated(account: 0xa9766b..., available: false)` |
| Etherscan | https://sepolia.etherscan.io/tx/0xbcda3dac9cd399d8127bc7552443f6aa46b7067c272d30d254827197eb2a81d5 |

---

### TX 4 — Use Ticket (Check-in)
| Trường | Giá trị |
|---|---|
| Tx Hash | `0xa15f2460981c131ed2bb598c8e9f885844c90ef6b0679558a705c9094e5aaa8b` |
| Block | 11589851 |
| Thời gian | 2026-08-29 05:42:12 UTC |
| Từ (Check-in operator) | `0xD6595383821F3f2BBF8c117546ee19De01920eA3` |
| Đến | `0xD3CB1b9A39a14753A92d869EEC1E45237C1e5Ae4` |
| Gas fee | 0.000031770244733196 ETH |
| Gas used | 32,766 |
| Event emit | `TicketUsed(ticketId: 1)` |
| Etherscan | https://sepolia.etherscan.io/tx/0xa15f2460981c131ed2bb598c8e9f885844c90ef6b0679558a705c9094e5aaa8b |

---

## Các giao dịch thủ công (ngoài E2E script)

| # | Phương thức | Tx Hash | Ghi chú |
|---|---|---|---|
| 5 | Grant RTB | [0xda8ef0...](https://sepolia.etherscan.io/tx/0xda8ef0bfb696e1e869ebe85b155ba4640e2c7c0bd52be847f13bfb63773b9dbd) | Cấp RTB thủ công trước khi có script |
| 6 | Buy Ticket RTB | [0xcf980b...](https://sepolia.etherscan.io/tx/0xcf980b9167dacf2bbf440c1e17acb4d4365599d48005516ca8ff6801da0faced) | Mua vé RTB thủ công |
| 7 | Buy Ticket Official | [0x68b3ab...](https://sepolia.etherscan.io/tx/0x68b3ab3e4c5a008b15f0d70d345254e8bb77991f4cc5aacedcd644166ae538f2) | Mua vé official qua frontend |
| 8 | Transfer Ticket | [0x27064e...](https://sepolia.etherscan.io/tx/0x27064e505158a80ab181cda0059c18768ddb849f049d4fb96c61ee5b29c00f12) | Chuyển nhượng lần 1 |
| 9 | Transfer Ticket | [0x2874c0...](https://sepolia.etherscan.io/tx/0x2874c0c9fedee64445969825e42fff276f1b6c077003a03a4b545f32af95694d) | Chuyển nhượng lần 2 |

---

## Tổng gas sử dụng (E2E Script)

| Giao dịch | Gas used | ETH paid |
|---|---|---|
| Grant RTB | 47,981 | 0.000049974528598452 |
| Buy Ticket RTB | 105,007 | 0.000105309355580695 |
| Use Ticket | 32,766 | 0.000031770244733196 |
| **Tổng** | **185,754** | **0.000187054128912343** |

---

## Xác nhận tính nhất quán

- Block 11589849 → 11589850 → 11589851: **3 block liên tiếp, cách nhau 12 giây** — đúng block time Sepolia
- Toàn bộ E2E flow (grant → buy → use) hoàn thành trong **24 giây**
- Contract address nhất quán xuyên suốt tất cả giao dịch
