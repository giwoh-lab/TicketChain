/*====================================================================
    ConcertTicket Web3 Integration (ethers.js v6)
    -------------------------------------------------
    • Connects to MetaMask / injected wallet
    • Loads ABI from ./abi.json
    • Wraps every public contract method
    • Updates the existing UI (IDs already present in index.html)
    • Handles UX states, errors and chain changes
  ====================================================================*/
// import { ethers } from "ethers"; // ethers is loaded via CDN, import not needed

/* -----------------------------------------------------------------
    1️⃣  Configuration
  ----------------------------------------------------------------- */
const CONTRACT_ADDRESS = "0x5b18578ee94786839cd4231a2ebf813d08adf805";
const EXPECTED_CHAIN_ID = "0xaa36a7"; // Sepolia – change if using another network

let provider;          // ethers BrowserProvider (MetaMask)
let signer;            // ethers Signer
let contract;          // ethers Contract instance
let currentAccount = null; // Normalised address string

/* -----------------------------------------------------------------
    2️⃣  Provider / wallet initialization (ethers v6)
  ----------------------------------------------------------------- */
async function initProvider() {
  if (!window.ethereum) {
    alert("MetaMask (or another injected wallet) not detected.");
    return false;
  }
  // BrowserProvider is the v6 way to wrap an injected provider.
  provider = new ethers.BrowserProvider(window.ethereum);
  // Verify we are on the expected network.
  const network = await provider.getNetwork();
  const chainIdHex = "0x" + network.chainId.toString(16);
  if (chainIdHex !== EXPECTED_CHAIN_ID) {
    alert(`Please switch MetaMask to the expected network (chain ${EXPECTED_CHAIN_ID}).`);
    return false;
  }
  return true;
}

/* -----------------------------------------------------------------
    3️⃣  Contract initialization (load ABI from ./abi.json)
  ----------------------------------------------------------------- */
async function initContract() {
  const resp = await fetch("./abi.json");
  const abi = await resp.json();
  // Use the signer as the contract's signer so write calls are signed.
  contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
}

/* -----------------------------------------------------------------
    4️⃣  Wallet connection & UI update
  ----------------------------------------------------------------- */
async function connectWallet() {
  if (!await initProvider()) return;
  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    if (!accounts || accounts.length === 0) {
      alert("No accounts returned from MetaMask.");
      return;
    }
    signer = await provider.getSigner();
    currentAccount = await signer.getAddress();
    // Normalise address for comparisons.
    currentAccount = ethers.getAddress(currentAccount);
    await initContract();
    // UI updates
    updateWalletDisplay();
    await refreshAllReadData();
    // Register contract event listeners (once per page load).
    setupContractEventListeners();
  } catch (err) {
    console.error("Wallet connection failed:", err);
    alert(err?.error?.message || err?.message || "Wallet connection failed");
  }
}

function updateWalletDisplay() {
  // Update wallet UI
  const walletEl = document.getElementById("walletDisplay");
  const btnEl = document.getElementById("connectBtn");
  if (walletEl) walletEl.textContent = `Connected: ${shortAddress(currentAccount)}`;
  if (btnEl) btnEl.textContent = "Change Wallet";
}

/* -----------------------------------------------------------------
    5️⃣  MetaMask event handling (single registration)
  ----------------------------------------------------------------- */
function handleAccountsChanged(accounts) {
  if (accounts.length === 0) {
    // Disconnected
    currentAccount = null;
    document.getElementById("walletDisplay").textContent = "";
    document.getElementById("connectBtn").textContent = "Connect Wallet";
    // Clear UI that depends on an account.
    clearAccountUI();
    return;
  }
  currentAccount = ethers.getAddress(accounts[0]);
  document.getElementById("walletDisplay").textContent = `Connected: ${shortAddress(currentAccount)}`;
  // Refresh all blockchain‑derived data for the new account.
  refreshAllReadData();
}

function handleChainChanged(_chainId) {
  // Reload the page to reset provider/contract with the new network.
  window.location.reload();
}

/**
 * Register MetaMask listeners only once.
 */
function setupWalletListeners() {
  if (!window.ethereum) return;
  // Remove any existing listeners (idempotent).
  window.ethereum.removeListener && window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
  window.ethereum.removeListener && window.ethereum.removeListener("chainChanged", handleChainChanged);
  window.ethereum.on("accountsChanged", handleAccountsChanged);
  window.ethereum.on("chainChanged", handleChainChanged);
}

/* -----------------------------------------------------------------
    6️⃣  Helper utilities
  ----------------------------------------------------------------- */
function shortAddress(addr) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";
}

// Clear UI elements that depend on a connected account
function clearAccountUI() {
  // Hide ticket card
  const ticketInfo = document.getElementById("ticketInfo");
  if (ticketInfo) ticketInfo.classList.add("hidden");
  // Reset access decision fields
  const ownsEl = document.getElementById("ownsTicket");
  if (ownsEl) ownsEl.textContent = "NO";
  const walletAddrEl = document.getElementById("walletAddrDisplay");
  if (walletAddrEl) walletAddrEl.textContent = "-";
  const accessResult = document.getElementById("accessResult");
  if (accessResult) accessResult.textContent = "CANNOT BUY – wallet not connected";
  // Reset sale/RTB state displays (optional)
  const officialEl = document.getElementById("officialState");
  if (officialEl) officialEl.textContent = "CLOSED";
  const rtbEl = document.getElementById("rtbState");
  if (rtbEl) rtbEl.textContent = "UNAVAILABLE";
}

function statusToString(s) {
  // enum Status { Valid, Invalid, Used }
  if (s === 0) return "VALID";
  if (s === 1) return "INVALID";
  if (s === 2) return "USED";
  return "UNKNOWN";
}

/* -----------------------------------------------------------------
    7️⃣  Read‑only contract wrappers
  ----------------------------------------------------------------- */
async function readOwner() { return await contract.owner(); }
async function readCheckInOperator() { return await contract.checkInOperator(); }
async function readOpeningTime() { return (await contract.openingTime()).toNumber(); }
async function readClosingTime() { return (await contract.closingTime()).toNumber(); }
async function readTicketPrice() { return await contract.ticketPrice(); }
async function readNextTicketId() { return (await contract.nextTicketId()).toNumber(); }
async function readMaxTickets() { return (await contract.maxTickets()).toNumber(); }
async function readIsSaleOpen() { return await contract.isSaleOpen(); }
async function readHasTicket(addr) { return await contract.hasTicket(addr); }
async function readGetRTB(addr) { return await contract.getRTB(addr); }
async function readMyTicket() {
  const t = await contract.getMyTicket();
  return { owner: t.owner, status: Number(t.currStatus), commitment: t.commitment };
}
async function readTicket(ticketId) {
  const t = await contract.getTicket(ticketId);
  return { owner: t.owner, status: Number(t.currStatus), commitment: t.commitment };
}

/* -----------------------------------------------------------------
    8️⃣  UI refresh – reads all relevant on‑chain data
  ----------------------------------------------------------------- */
async function refreshAllReadData() {
  try {
    // Sale information
    const [open, openingTime, price, maxTickets, hasTicket, rtb] = await Promise.all([
      readIsSaleOpen(),
      readOpeningTime(),
      readTicketPrice(),
      readMaxTickets(),
      currentAccount ? readHasTicket(currentAccount) : false,
      currentAccount ? readGetRTB(currentAccount) : false,
    ]);

    // Update sale UI
    document.getElementById("officialState").textContent = open ? "OPEN" : "CLOSED";
    document.getElementById("officialState").className = open ? "status-value open" : "status-value closed";

    // RTB UI
    document.getElementById("rtbState").textContent = rtb ? "AVAILABLE" : "UNAVAILABLE";

    // Update displayed ticket price (dynamic)
    const priceEth = ethers.formatEther(price);
    const priceElem = document.querySelector('.hero-price strong');
    if (priceElem) priceElem.textContent = `${priceEth} ETH`;

    // Log max tickets (could be displayed elsewhere if needed)
    console.log('Maximum tickets allowed:', maxTickets);

    // Access decision UI
    document.getElementById("ownsTicket").textContent = hasTicket ? "YES" : "NO";
    document.getElementById("walletAddrDisplay").textContent = currentAccount ? shortAddress(currentAccount) : "-";
    const accessResultEl = document.getElementById("accessResult");
    if (!currentAccount) {
      accessResultEl.textContent = "CANNOT BUY – wallet not connected";
    } else if (hasTicket) {
      accessResultEl.textContent = "CANNOT BUY – wallet already owns a ticket";
    } else if (open) {
      accessResultEl.textContent = "YOU ARE ALLOWED TO BUY – Official sale is open.";
    } else if (rtb) {
      accessResultEl.textContent = "YOU ARE ALLOWED TO BUY – RTB is available.";
    } else {
      accessResultEl.textContent = "CANNOT BUY – sale closed and RTB unavailable.";
    }

    // Ticket card UI (if the user owns a ticket)
    if (currentAccount && hasTicket) {
      const ticketId = await contract.ownerTicket(currentAccount);
      const ticket = await readTicket(ticketId);
      document.getElementById("ticketInfo").classList.remove("hidden");
      document.getElementById("ticketId").textContent = ticketId;
      document.getElementById("ticketOwner").textContent = shortAddress(ticket.owner);
      document.getElementById("ticketStatus").textContent = statusToString(ticket.status);
      // The contract does not expose nonce or purchase time – hide those fields.
      document.getElementById("ticketNonce").textContent = "—";
      document.getElementById("ticketTime").textContent = "—";
    } else {
      document.getElementById("ticketInfo").classList.add("hidden");
    }

    // Admin / check‑in visibility
    await updateAdminAndCheckInVisibility();

    // Countdown (time until opening if not yet opened)
    if (!open) {
      const now = Math.floor(Date.now() / 1000);
      const secondsToOpen = openingTime - now;
      if (secondsToOpen > 0) {
        const hrs = Math.floor(secondsToOpen / 3600);
        const mins = Math.floor((secondsToOpen % 3600) / 60);
        const secs = secondsToOpen % 60;
        document.getElementById("countdown").textContent = `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, 
"0")}:${secs.toString().padStart(2, "0")}`;
      } else {
        document.getElementById("countdown").textContent = "00:00:00";
      }
    } else {
      document.getElementById("countdown").textContent = "--:--:--";
    }
  } catch (e) {
    console.error(e);
  }
}

/* -----------------------------------------------------------------
    Admin / check‑in visibility helpers
  ----------------------------------------------------------------- */
async function updateAdminAndCheckInVisibility() {
  // Owner UI
  const ownerAddr = await readOwner();
  const isOwner = currentAccount && (ethers.getAddress(ownerAddr) === currentAccount);
  const adminDashboard = document.getElementById("adminDashboard");
  if (adminDashboard) adminDashboard.classList.toggle("hidden", !isOwner);

  // Check‑in operator UI
  const operatorAddr = await readCheckInOperator();
  const isOperator = currentAccount && (ethers.getAddress(operatorAddr) === currentAccount);
  const checkInBtn = document.getElementById("checkInBtn");
  if (checkInBtn) checkInBtn.style.display = isOperator ? "inline-block" : "none";
}

/* -----------------------------------------------------------------
    9️⃣ Transaction status helper
  ----------------------------------------------------------------- */
function setStatus(state, message) {
  const msgEl = document.getElementById("buyMessage") || document.getElementById("detailBuyMessage");
  if (msgEl) {
    msgEl.textContent = message;
    msgEl.className = state === "pending" ? "msg pending" : "msg confirmed";
  }
}

/* -----------------------------------------------------------------
    🔧 Generic error handling
  ----------------------------------------------------------------- */
function handleTxError(err) {
  console.error(err);
  const reason = err?.error?.message || err?.reason || err?.shortMessage || err?.message || "Transaction failed";
  alert(reason);
  setStatus("failed", reason);
}

/* -----------------------------------------------------------------
    🔁 Event‑based UI refresh (contract events)
  ----------------------------------------------------------------- */
function setupContractEventListeners() {
  if (!contract) return;
  // Helper to avoid duplicate listeners – remove first.
  const events = [
    "TicketCreated",
    "TicketTransferred",
    "TicketUsed",
    "RTBUpdated",
    "OpeningTimeChanged",
    "ClosingTimeChanged",
    "TicketPriceChanged",
    "MaxTicketsChanged",
    "TicketInvalidated",
    "OwnerTransferred",
    "CheckInOperatorChanged",
  ];
  events.forEach((ev) => {
    contract.removeAllListeners && contract.removeAllListeners(ev);
    contract.on(ev, async (...args) => {
      // Simple strategy: refresh everything after any relevant event.
      console.log(`Event ${ev} fired`, args);
      await refreshAllReadData();
    });
  });
}

/* -----------------------------------------------------------------
    🛒 Unified purchase flow (official or RTB)
  ----------------------------------------------------------------- */
async function handleBuy() {
  if (!currentAccount) return alert("Connect wallet first.");
  // Ensure we have the latest sale state.
  const [open, rtb, price, hasTicket] = await Promise.all([
    readIsSaleOpen(),
    readGetRTB(currentAccount),
    readTicketPrice(),
    readHasTicket(currentAccount),
  ]);

  if (hasTicket) return alert("Your wallet already owns a ticket.");
  if (!open && !rtb) return alert("Sale is closed and RTB is unavailable.");

  const secretKey = prompt("Enter a secret key (keep it safe, you will need it later):");
  if (!secretKey) return alert("Secret key is required.");

  const commitment = ethers.keccak256(ethers.toUtf8Bytes(secretKey));

  setStatus("pending", "Sending purchase transaction…");
  try {
    let tx;
    if (open) {
      tx = await contract.buyTicketOfficial(commitment, { value: price });
    } else {
      tx = await contract.buyTicketRTB(commitment, { value: price });
    }
    const receipt = await tx.wait();
    const ev = receipt.events.find((e) => e.event === "TicketCreated");
    const ticketId = ev?.args?.ticketId?.toNumber?.() ?? "unknown";
    // Generate QR hash (same encoding as Solidity)
    const qrHash = ethers.keccak256(ethers.solidityPacked(["uint256", "string"], [ticketId, secretKey]));
    setStatus("confirmed", `Ticket #${ticketId} purchased! QR hash: ${qrHash}`);
    await refreshAllReadData();
  } catch (err) {
    handleTxError(err);
  }
}

/* -----------------------------------------------------------------
    🔍 Verify ticket (client‑side secret key)
  ----------------------------------------------------------------- */
async function verifyTicket() {
  const idStr = document.getElementById("verifyInput").value;
  const secretKey = prompt("Enter the secret key for this ticket:");
  if (!secretKey) return alert("Secret key required.");
  const ticketId = Number(idStr);
  if (!ticketId) return alert("Invalid ticket ID.");
  try {
    const [valid, qrHash] = await contract.verifyTicket(ticketId, secretKey);
    const resultEl = document.getElementById("verifyResult");
    resultEl.textContent = valid ? `Ticket is VALID. QR hash: ${qrHash}` : "Ticket is INVALID or secret does not match.";
  } catch (err) {
    console.error(err);
    alert("Verification failed – see console for details.");
  }
}

/* -----------------------------------------------------------------
    🔁 Transfer ticket (owner → recipient)
  ----------------------------------------------------------------- */
async function transferTicket() {
  if (!currentAccount) return alert("Connect wallet first.");
  const ticketIdStr = prompt("Enter your ticket ID (numeric):");
  const ticketId = Number(ticketIdStr);
  if (!ticketId) return alert("Invalid ticket ID.");

  const to = prompt("Enter the recipient address:");
  if (!to) return alert("Recipient address required.");

  const newSecret = prompt("Enter a NEW secret key for the recipient (keep it safe):");
  if (!newSecret) return alert("New secret key required.");
  const newCommitment = ethers.keccak256(ethers.toUtf8Bytes(newSecret));

  setStatus("pending", `Transferring ticket #${ticketId}…`);
  try {
    const tx = await contract.transferTicket(to, ticketId, newCommitment);
    await tx.wait();
    setStatus("confirmed", `Ticket #${ticketId} transferred to ${shortAddress(to)}.`);
    await refreshAllReadData();
  } catch (err) {
    handleTxError(err);
  }
}

/* -----------------------------------------------------------------
    ✅ Check‑in (operator only)
  ----------------------------------------------------------------- */
async function useTicket() {
  if (!currentAccount) return alert("Connect wallet first.");
  const ticketIdStr = prompt("Enter the ticket ID to check‑in:");
  const ticketId = Number(ticketIdStr);
  if (!ticketId) return alert("Invalid ticket ID.");

  // Verify ticket is valid before sending transaction.
  const ticket = await readTicket(ticketId);
  if (ticket.status !== 0) {
    return alert("Ticket is not in a VALID state.");
  }

  setStatus("pending", `Submitting check‑in for ticket #${ticketId}…`);
  try {
    const tx = await contract.useTicket(ticketId);
    await tx.wait();
    setStatus("confirmed", `Ticket #${ticketId} marked as USED.`);
    await refreshAllReadData();
  } catch (err) {
    handleTxError(err);
  }
}

/* -----------------------------------------------------------------
    🛠️  Admin actions (owner only)
  ----------------------------------------------------------------- */
async function adminSetOpeningTime() {
  const iso = prompt("Enter new opening time (YYYY‑MM‑DDTHH:MM):");
  if (!iso) return;
  const ts = Math.floor(new Date(iso).getTime() / 1000);
  await sendAdminTx(contract.setOpeningTime, [ts], "Opening time updated");
}
async function adminSetClosingTime() {
  const iso = prompt("Enter new closing time (YYYY‑MM‑DDTHH:MM):");
  if (!iso) return;
  const ts = Math.floor(new Date(iso).getTime() / 1000);
  await sendAdminTx(contract.setClosingTime, [ts], "Closing time updated");
}
// Commented out unused admin helpers – keep for future if needed
// async function adminSetTicketPrice() { … }
// async function adminSetMaxTickets() { … }
// async function adminGrantRTB() { … }
// async function adminRevokeRTB() { … }

async function adminInvalidateTicket() {
  const id = prompt("Enter ticket ID to invalidate:");
  if (!id) return;
  await sendAdminTx(contract.invalidateTicket, [Number(id)], "Ticket invalidated");
}
async function adminWithdraw() {
  await sendAdminTx(contract.withdraw, [], "Funds withdrawn");
}
async function sendAdminTx(fn, args, successMsg) {
  setStatus("pending", "Sending admin transaction…");
  try {
    const tx = await fn(...args);
    await tx.wait();
    setStatus("confirmed", successMsg);
    await refreshAllReadData();
  } catch (e) {
    handleTxError(e);
  }
}

/* -----------------------------------------------------------------
    📦 Event listeners & initialization (page load)
  ----------------------------------------------------------------- */
window.addEventListener("load", async () => {
  // Register MetaMask listeners once.
  setupWalletListeners();

  // Connect button
  const connectBtn = document.getElementById("connectBtn");
  if (connectBtn) connectBtn.addEventListener("click", connectWallet);

  // Purchase buttons (both main and detail)
  const buyBtn = document.getElementById("buyBtn");
  if (buyBtn) buyBtn.addEventListener("click", handleBuy);
  const detailBuyBtn = document.getElementById("detailBuyBtn");
  if (detailBuyBtn) detailBuyBtn.addEventListener("click", handleBuy);

  // Verify button
  const verifyBtn = document.getElementById("verifyBtn");
  if (verifyBtn) verifyBtn.addEventListener("click", verifyTicket);

  // Transfer button (placeholder ID – only present if UI adds it)
  const transferBtn = document.getElementById("transferBtn");
  if (transferBtn) transferBtn.addEventListener("click", transferTicket);

  // Check‑in button (admin UI – only visible for operator)
  const checkInBtn = document.getElementById("checkInBtn");
  if (checkInBtn) checkInBtn.addEventListener("click", useTicket);

  // Admin UI buttons (only visible for contract owner)
  const updateSaleBtn = document.getElementById("updateSaleBtn");
  if (updateSaleBtn) {
    updateSaleBtn.addEventListener("click", async () => {
      const open = document.getElementById("openInput").value;
      const close = document.getElementById("closeInput").value;
      if (open) await adminSetOpeningTime(open);
      if (close) await adminSetClosingTime(close);
    });
  }
  const invalidateAdminBtn = document.getElementById("invalidateAdminBtn");
  if (invalidateAdminBtn) invalidateAdminBtn.addEventListener("click", adminInvalidateTicket);
  // const restoreAdminBtn = document.getElementById("restoreAdminBtn"); // placeholder – not implemented
  const withdrawBtn = document.getElementById("withdrawBtn");
  if (withdrawBtn) withdrawBtn.addEventListener("click", adminWithdraw);

  // Auto‑connect if MetaMask already injected and accounts available.
  if (window.ethereum && (await window.ethereum.request({ method: "eth_accounts" })).length) {
    await connectWallet();
  }
});