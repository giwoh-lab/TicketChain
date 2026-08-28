/**
 * Contract interaction layer for the Concert Ticket DApp.
 * Uses ethers.js v6 with MetaMask's BrowserProvider.
 */
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, SEPOLIA_CHAIN_ID } from "./constants";
import ABI from "../../abi.json";

// Re-export ethers for convenience in pages
export { ethers };

// ── Module-level singletons ──────────────────────────────────────────
let provider = null;
let signer = null;
let contract = null; // read-only (provider)
let contractRW = null; // read-write (signer)

// -----------------------------------------------------------------
// Helper: retry wrapper for RPC calls that may be rate‑limited.
// -----------------------------------------------------------------
/**
 * Executes an async operation with exponential backoff retries when a JSON‑RPC
 * rate‑limit error (`code: -32005`) is encountered. Retries up to
 * `maxAttempts` (default 3) before re‑throwing the error.
 *
 * @param {() => Promise<any>} fn - The async function to execute.
 * @param {number} maxAttempts - Maximum retry attempts.
 * @param {number} baseDelayMs - Base delay in milliseconds for the first retry.
 * @returns {Promise<any>} The resolved value of `fn`.
 */
async function withRetry(fn, maxAttempts = 3, baseDelayMs = 500) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      const code = err?.error?.code ?? err?.code;
      if (code === -32005 && attempt < maxAttempts) {
        const delay = baseDelayMs * 2 ** attempt;
        console.warn(`Rate limited (attempt ${attempt + 1}/${maxAttempts}); retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        attempt += 1;
        continue;
      }
      throw err;
    }
  }
}

/**
 * Initialise (or re-initialise) the provider, signer, and contract
 * whenever the wallet/page state changes.
 * Called lazily by helpers below.
 */
async function ensureProvider() {
  if (!window.ethereum) throw new Error("MetaMask is not installed.");
  provider = new ethers.BrowserProvider(window.ethereum);
  contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
}

async function ensureSigner() {
  await ensureProvider();
  signer = await provider.getSigner();
  contractRW = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
}

// ── Public accessor ──────────────────────────────────────────────────

/** Returns the read-only contract instance (or null). */
export function getContract() {
  if (!contract && typeof window !== "undefined" && window.ethereum) {
    // Best-effort sync init; callers should await reads.
    ensureProvider().catch(() => {});
  }
  return contract;
}

// ── Utility ──────────────────────────────────────────────────────────

export function shortAddress(addr) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";
}

// ── Read helpers ─────────────────────────────────────────────────────

async function rc() {
  if (!contract) await ensureProvider();
  return contract;
}

export async function readOwner() {
  return withRetry(async () => {
    const c = await rc();
    return c.owner();
  });
}

export async function readCheckInOperator() {
  return withRetry(async () => {
    const c = await rc();
    return c.checkInOperator();
  });
}

export async function readIsSaleOpen() {
  return withRetry(async () => {
    const c = await rc();
    return c.isSaleOpen();
  });
}

export async function readOpeningTime() {
  return withRetry(async () => {
    const c = await rc();
    return Number(await c.openingTime());
  });
}

export async function readClosingTime() {
  return withRetry(async () => {
    const c = await rc();
    return Number(await c.closingTime());
  });
}

export async function readTicketPrice() {
  return withRetry(async () => {
    const c = await rc();
    return c.ticketPrice();
  });
}

export async function readMaxTickets() {
  return withRetry(async () => {
    const c = await rc();
    return Number(await c.maxTickets());
  });
}

export async function readNextTicketId() {
  return withRetry(async () => {
    const c = await rc();
    return Number(await c.nextTicketId());
  });
}

export async function readHasTicket(addr) {
  return withRetry(async () => {
    const c = await rc();
    return c.hasTicket(addr);
  });
}

export async function readGetRTB(addr) {
  return withRetry(async () => {
    const c = await rc();
    return c.getRTB(addr);
  });
}

// export async function readMyTicket() {
//   // getMyTicket() uses msg.sender, so it needs the signer
//   await ensureSigner();
//   const t = await contractRW.getMyTicket();

//   console.log(t);

//   return { owner: t.owner, status: Number(t.currStatus), commitment: t.commitment };
// }
export async function readMyTicket() {
  await ensureSigner();

  const ticketId = await contractRW.getMyTicketId();
  const t = await contractRW.getMyTicket();

  return {
    ticketId: ticketId.toString(),
    owner: t.owner,
    status: Number(t.currStatus),
    commitment: t.commitment
  };
}

/**
 * Attempt to find the ticket ID owned by `addr`.
 * The contract may expose a public `ownerTicket(address)` mapping.
 * If not available in the ABI, fall back to iterating tickets.
 */
// export async function readOwnerTicket(addr) {
//   const c = await rc();
//   // Try calling ownerTicket directly (public mapping getter)
//   if (c.ownerTicket) {
//     console.log("=== DASHBOARD TICKET ===");
//     console.log("wallet:", address);
//     console.log("ticket:", ticket);
//     console.log("ticketId:", ticketId);

//     try {
//       return Number(await c.ownerTicket(addr));
//     } catch {
//       // fall through to iteration
//     }
//   }
//   // Fallback: iterate tickets 1..nextTicketId to find the one owned by addr
//   const nextId = await readNextTicketId();

//   console.log("Iterating tickets, nextId:", nextId);

//   const normalised = ethers.getAddress(addr);
//   for (let i = 1; i < nextId; i++) {
//     try {
//       const t = await c.getTicket(i);

//       console.log(`Ticket ${i} owner:`, t.owner);

//       if (ethers.getAddress(t.owner) === normalised) return i;
//     } catch {
//       continue;
//     }
//   }
//   return 0;
// }
export async function readOwnerTicket(addr) {
  return withRetry(async () => {
    const c = await rc();
    return Number(await c.getTicketIdByOwner(addr));
  });
}


// ── Write helpers (ticket purchase) ──────────────────────────────────

/**
 * Pre-flight check: read on-chain state and throw a descriptive error
 * if a purchase would revert, because Sepolia RPC nodes often return
 * data=null on estimateGas failures.
 */
async function preflightPurchaseCheck(buyerAddress, priceWei, mode) {
  const c = await rc();
  const [isSaleOpen, hasTicket, onChainPrice, nextId, maxTickets, balance] =
    await Promise.all([
      c.isSaleOpen(),
      c.hasTicket(buyerAddress),
      c.ticketPrice(),
      c.nextTicketId(),
      c.maxTickets(),
      provider.getBalance(buyerAddress),
    ]);

  console.log("=== PREFLIGHT CHECK ===");
  console.log("mode:", mode);
  console.log("buyer:", buyerAddress);
  console.log("balance (ETH):", ethers.formatEther(balance));
  console.log("isSaleOpen:", isSaleOpen);
  console.log("hasTicket:", hasTicket);
  console.log("onChainPrice (wei):", onChainPrice.toString());
  console.log("priceWei sent:", priceWei?.toString());
  console.log("nextTicketId:", nextId.toString());
  console.log("maxTickets:", maxTickets.toString());

  // Check balance first – Sepolia RPC nodes return an opaque
  // "Internal JSON-RPC error" when the sender can't afford value + gas.
  if (BigInt(balance) < BigInt(onChainPrice)) {
    throw new Error(
      `Insufficient Sepolia ETH. You have ${ethers.formatEther(balance)} ETH ` +
      `but the ticket costs ${ethers.formatEther(onChainPrice)} ETH. ` +
      `Get testnet ETH from a Sepolia faucet.`
    );
  }

  if (hasTicket) {
    throw new Error("Your wallet already owns a ticket.");
  }
  if (BigInt(nextId) > BigInt(maxTickets)) {
    throw new Error("Tickets are sold out.");
  }
  if (mode === "official" && !isSaleOpen) {
    throw new Error("Official sale is not open (check opening/closing times).");
  }
  if (mode === "rtb") {
    const rtb = await c.getRTB(buyerAddress);
    if (!rtb) throw new Error("RTB not granted for this wallet.");
  }
  // Ensure the value matches the on-chain price exactly.
  if (priceWei == null || BigInt(priceWei) !== BigInt(onChainPrice)) {
    throw new Error(
      `Incorrect ETH amount. Contract expects ${ethers.formatEther(onChainPrice)} ETH ` +
      `(${onChainPrice.toString()} wei), but got ${priceWei?.toString() ?? "null"} wei.`
    );
  }
}

export async function buyTicketOfficial(commitment, priceWei) {
  await ensureSigner();
  const buyer = await signer.getAddress();
  await preflightPurchaseCheck(buyer, priceWei, "official");

  // Use staticCall first to surface the revert reason if estimateGas
  // would fail with data=null on this RPC endpoint.
  try {
    await contractRW.buyTicketOfficial.staticCall(commitment, { value: priceWei });
  } catch (simErr) {
    const reason = simErr?.reason || simErr?.revert?.args?.[0] || simErr?.shortMessage || simErr?.message;
    throw new Error(`Contract would revert: ${reason}`);
  }

  const tx = await contractRW.buyTicketOfficial(commitment, { value: priceWei });
  const receipt = await tx.wait();
  return parsePurchaseReceipt(receipt, tx.hash);
}


export async function buyTicketRTB(commitment, priceWei) {
  await ensureSigner();
  const buyer = await signer.getAddress();
  await preflightPurchaseCheck(buyer, priceWei, "rtb");

  try {
    await contractRW.buyTicketRTB.staticCall(commitment, { value: priceWei });
  } catch (simErr) {
    const reason = simErr?.reason || simErr?.revert?.args?.[0] || simErr?.shortMessage || simErr?.message;
    throw new Error(`Contract would revert: ${reason}`);
  }

  const tx = await contractRW.buyTicketRTB(commitment, { value: priceWei });
  const receipt = await tx.wait();
  return parsePurchaseReceipt(receipt, tx.hash);
}


// function parsePurchaseReceipt(receipt, txHash) {
//   let ticketId;
//   const iface = new ethers.Interface(ABI);
//   for (const log of receipt.logs) {
//     try {
//       const parsed = iface.parseLog(log);
//       if (parsed && parsed.name === "TicketCreated") {
//         ticketId = Number(parsed.args.ticketId);
//         break;
//       }
//     } catch {
//       // Ignore logs from other contracts
//     }
//   }
//   return { ticketId, txHash };
// }
function parsePurchaseReceipt(receipt, txHash) {
    const iface = new ethers.Interface(ABI);

    console.log("=== PARSING PURCHASE RECEIPT ===");
    console.log("Receipt:", receipt);
    console.log("Logs:", receipt.logs);

    for (const log of receipt.logs) {
        try {
            const parsed = iface.parseLog(log);

            if (parsed?.name === "TicketCreated") {
                const ticketId = parsed.args.ticketId;

                console.log(
                    "TicketCreated found:",
                    ticketId.toString()
                );

                return {
                    ticketId: ticketId.toString(),
                    txHash
                };
            }
        } catch {
            // Ignore unrelated logs
        }
    }

    throw new Error(
        "Transaction succeeded, but TicketCreated event was not found."
    );
}

// ── Write helper for ticket transfer ───────────────────────────────────────

// Transfer a ticket to another address. The caller does NOT provide a commitment.
export async function transferTicket(to, ticketId, newCommitment) {
  await ensureSigner();
  const tx = await contractRW.transferTicket(to, ticketId, newCommitment);
  await tx.wait();
  return tx.hash;
}

// Set or update the commitment for the caller's ticket.
export async function setTicketCommitment(ticketId, commitment) {
  await ensureSigner();
  const tx = await contractRW.setTicketCommitment(ticketId, commitment);
  await tx.wait();
  return tx.hash;
}

// ── Admin write helpers ──────────────────────────────────────────────

export async function adminSetOpeningTime(ts) {
  await ensureSigner();
  const tx = await contractRW.setOpeningTime(ts);
  await tx.wait();
}

export async function adminSetClosingTime(ts) {
  await ensureSigner();
  const tx = await contractRW.setClosingTime(ts);
  await tx.wait();
}

export async function adminSetTicketPrice(weiValue) {
  await ensureSigner();
  const tx = await contractRW.setTicketPrice(weiValue);
  await tx.wait();
}

export async function adminSetMaxTickets(newMax) {
  await ensureSigner();
  const tx = await contractRW.setMaxTickets(newMax);
  await tx.wait();
}

export async function adminGrantRTB(addr) {
  await ensureSigner();
  const tx = await contractRW.grantRTB(addr);
  await tx.wait();
}

export async function adminBatchGrantRTB(addresses, onProgress) {
  await ensureSigner();
  const results = [];
  for (let i = 0; i < addresses.length; i++) {
    const addr = addresses[i];
    if (onProgress) onProgress(i, addresses.length, addr);
    try {
      const tx = await contractRW.grantRTB(addr);
      await tx.wait();
      results.push({ addr, success: true });
    } catch (err) {
      const reason = err?.reason || err?.shortMessage || err?.message || "Failed";
      results.push({ addr, success: false, error: reason });
    }
  }
  return results;
}

export async function adminRevokeRTB(addr) {
  await ensureSigner();
  const tx = await contractRW.revokeRTB(addr);
  await tx.wait();
}

export async function adminInvalidateTicket(ticketId) {
  await ensureSigner();
  const tx = await contractRW.invalidateTicket(ticketId);
  await tx.wait();
}

export async function adminWithdraw() {
  await ensureSigner();
  const tx = await contractRW.withdraw();
  await tx.wait();
}

export async function adminTransferOwnership(newOwner) {
  await ensureSigner();
  const tx = await contractRW.transferOwnership(newOwner);
  await tx.wait();
}

export async function adminSetCheckInOperator(newOperator) {
  await ensureSigner();
  const tx = await contractRW.setCheckInOperator(newOperator);
  await tx.wait();
}
