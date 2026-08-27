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
  return (await rc()).owner();
}

export async function readCheckInOperator() {
  return (await rc()).checkInOperator();
}

export async function readIsSaleOpen() {
  return (await rc()).isSaleOpen();
}

export async function readOpeningTime() {
  return Number(await (await rc()).openingTime());
}

export async function readClosingTime() {
  return Number(await (await rc()).closingTime());
}

export async function readTicketPrice() {
  return (await rc()).ticketPrice();
}

export async function readMaxTickets() {
  return Number(await (await rc()).maxTickets());
}

export async function readNextTicketId() {
  return Number(await (await rc()).nextTicketId());
}

export async function readHasTicket(addr) {
  return (await rc()).hasTicket(addr);
}

export async function readGetRTB(addr) {
  return (await rc()).getRTB(addr);
}

export async function readMyTicket() {
  // getMyTicket() uses msg.sender, so it needs the signer
  await ensureSigner();
  const t = await contractRW.getMyTicket();
  return { owner: t.owner, status: Number(t.currStatus), commitment: t.commitment };
}

/**
 * Attempt to find the ticket ID owned by `addr`.
 * The contract may expose a public `ownerTicket(address)` mapping.
 * If not available in the ABI, fall back to iterating tickets.
 */
export async function readOwnerTicket(addr) {
  const c = await rc();
  // Try calling ownerTicket directly (public mapping getter)
  if (c.ownerTicket) {
    try {
      return Number(await c.ownerTicket(addr));
    } catch {
      // fall through to iteration
    }
  }
  // Fallback: iterate tickets 1..nextTicketId to find the one owned by addr
  const nextId = await readNextTicketId();
  const normalised = ethers.getAddress(addr);
  for (let i = 1; i < nextId; i++) {
    try {
      const t = await c.getTicket(i);
      if (ethers.getAddress(t.owner) === normalised) return i;
    } catch {
      continue;
    }
  }
  return 0;
}

// ── Write helpers (ticket purchase) ──────────────────────────────────

export async function buyTicketOfficial(commitment, priceWei) {
  await ensureSigner();
  const tx = await contractRW.buyTicketOfficial(commitment, { value: priceWei });
  const receipt = await tx.wait();
  return parsePurchaseReceipt(receipt, tx.hash);
}

export async function buyTicketRTB(commitment, priceWei) {
  await ensureSigner();
  const tx = await contractRW.buyTicketRTB(commitment, { value: priceWei });
  const receipt = await tx.wait();
  return parsePurchaseReceipt(receipt, tx.hash);
}

function parsePurchaseReceipt(receipt, txHash) {
  let ticketId;
  const iface = new ethers.Interface(ABI);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed && parsed.name === "TicketCreated") {
        ticketId = Number(parsed.args.ticketId);
        break;
      }
    } catch {
      // Ignore logs from other contracts
    }
  }
  return { ticketId, txHash };
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
