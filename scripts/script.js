/*
  frontend.js – mock logic for the Web3 Concert Ticket prototype.
  It mirrors the Solidity storage layout using plain JavaScript objects.

  [Future Solidity: storage variable] contractState
  [Future Solidity: storage variable] tickets
  [Future Solidity: storage variable] ownerTicket
*/

// Utility: format address (short)
function shortAddress(addr) {
  return addr ? addr.slice(0, 6) + '...' + addr.slice(-4) : '';
}

// Mock wallet generation
function generateMockAddress() {
  const hex = [...Array(40)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
  return '0x' + hex;
}

// Global state
const state = {
  // Contract-wide configuration
  contractState: {
    openTime: null, // timestamp (ms)
    closedTime: null,
    rtbAvailable: false,
    totalTickets: 0,
  },
  // Sale state machine
  saleState: 'NOT_STARTED', // NOT_STARTED | OPEN | CLOSED
  // RTB state machine
  rtbState: 'UNAVAILABLE', // AVAILABLE | UNAVAILABLE
  // Mappings
  tickets: {}, // ticketId => {owner, status, nonce, purchaseTime}
  ownerTicket: {}, // wallet => ticketId
  // Current user wallet (mock)
  wallet: null,
  // Transaction log array of strings
  txLog: [],
};

/*** UI Helper Functions ***/
function log(msg) {
  const time = new Date().toLocaleTimeString();
  state.txLog.push(`[${time}] ${msg}`);
  document.getElementById('logDisplay').textContent = state.txLog.join('\n');
}

function updateContractStateDisplay() {
  const cs = state.contractState;
  const txt = `CONTRACT STATE\n\nopenTime: ${cs.openTime ? new Date(cs.openTime).toLocaleString() : 'unset'}\nclosedTime: ${cs.closedTime ? new Date(cs.closedTime).toLocaleString() : 'unset'}\nRTB: ${cs.rtbAvailable ? 'AVAILABLE' : 'UNAVAILABLE'}\nTotal Tickets: ${cs.totalTickets}\n`;
  document.getElementById('stateDisplay').textContent = txt;
}

function updateSaleStatusUI() {
  const now = Date.now();
  const cs = state.contractState;
  // Determine saleState based on timestamps
  if (!cs.openTime) {
    state.saleState = 'NOT_STARTED';
  } else if (now < cs.openTime) {
    state.saleState = 'NOT_STARTED';
  } else if (now >= cs.openTime && (!cs.closedTime || now <= cs.closedTime)) {
    state.saleState = 'OPEN';
  } else {
    state.saleState = 'CLOSED';
  }

  // Update UI elements
  const officialEl = document.getElementById('officialState');
  officialEl.textContent = state.saleState;
  // Simple countdown to openTime if not started
  const countdownEl = document.getElementById('countdown');
  if (state.saleState === 'NOT_STARTED' && cs.openTime) {
    const diff = cs.openTime - now;
    const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
    const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
    const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
    countdownEl.textContent = `${h}:${m}:${s}`;
  } else {
    countdownEl.textContent = '--:--:--';
  }

  // RTB state
  state.rtbState = state.contractState.rtbAvailable ? 'AVAILABLE' : 'UNAVAILABLE';
  document.getElementById('rtbState').textContent = state.rtbState;
}

function updateAccessDecision() {
  const wallet = state.wallet;
  const owns = wallet && state.ownerTicket[wallet];
  const officialOpen = state.saleState === 'OPEN';
  const rtbAvail = state.rtbState === 'AVAILABLE';

  document.getElementById('walletAddrDisplay').textContent = wallet ? shortAddress(wallet) : '-';
  document.getElementById('ownsTicket').textContent = owns ? 'YES' : 'NO';
  document.getElementById('officialSaleStatus').textContent = officialOpen ? 'OPEN' : 'NOT OPEN';
  document.getElementById('rtbStatus').textContent = rtbAvail ? 'AVAILABLE' : 'UNAVAILABLE';

  const resultEl = document.getElementById('accessResult');
  let result = '';
  if (!wallet) {
    result = 'CANNOT BUY – wallet not connected';
  } else if (owns) {
    result = 'CANNOT BUY – wallet already owns a ticket';
  } else if (officialOpen) {
    result = 'YOU ARE ALLOWED TO BUY – Official sale is open.';
  } else if (rtbAvail) {
    result = 'YOU ARE ALLOWED TO BUY – RTB is available.';
  } else {
    result = 'CANNOT BUY – sale closed and RTB unavailable.';
  }
  resultEl.textContent = result;
}

function updateWalletDisplay() {
  const btn = document.getElementById('connectBtn');
  const display = document.getElementById('walletDisplay');
  if (state.wallet) {
    btn.textContent = 'Change Mock Wallet';
    display.textContent = `Connected: ${shortAddress(state.wallet)}`;
  } else {
    btn.textContent = 'Connect Wallet';
    display.textContent = '';
  }
}

function renderMyTicket() {
  const container = document.getElementById('ticketInfo');
  const wallet = state.wallet;
  const ticketId = wallet && state.ownerTicket[wallet];
  if (ticketId) {
    const t = state.tickets[ticketId];
    container.classList.remove('hidden');
    document.getElementById('ticketId').textContent = ticketId;
    document.getElementById('ticketOwner').textContent = shortAddress(t.owner);
    document.getElementById('ticketStatus').textContent = t.status;
    document.getElementById('ticketNonce').textContent = t.nonce;
    document.getElementById('ticketTime').textContent = new Date(t.purchaseTime).toLocaleString();
  } else {
    container.classList.add('hidden');
  }
}

/*** Action Handlers ***/
function handleConnect() {
  state.wallet = generateMockAddress();
  log('Wallet connected');
  updateWalletDisplay();
  updateAccessDecision();
  renderMyTicket();
}

function handleBuy() {
  const wallet = state.wallet;
  if (!wallet) { alert('Connect wallet first'); return; }
  if (state.ownerTicket[wallet]) { alert('Wallet already owns a ticket'); return; }
  const canBuy = (state.saleState === 'OPEN') || (state.rtbState === 'AVAILABLE');
  if (!canBuy) { alert('Sale not open and RTB unavailable'); return; }

  // Simulate payment & mint
  const ticketId = ++state.contractState.totalTickets;
  const nonce = Math.floor(Math.random() * 1_000_000);
  const now = Date.now();
  const ticket = { owner: wallet, status: 'VALID', nonce, purchaseTime: now };
  state.tickets[ticketId] = ticket;
  state.ownerTicket[wallet] = ticketId;
  log('Payment successful');
  log(`Ticket #${ticketId} created`);
  document.getElementById('buyMessage').textContent = `Ticket #${ticketId} purchased!`;
  renderMyTicket();
  updateContractStateDisplay();
  updateAccessDecision();
}

function handleCheckIn() {
  const wallet = state.wallet;
  const ticketId = state.ownerTicket[wallet];
  if (!ticketId) return;
  const t = state.tickets[ticketId];
  if (t.status === 'VALID') {
    t.status = 'USED';
    log(`Ticket #${ticketId} checked in (USED)`);
    renderMyTicket();
  }
}

function handleInvalidate() {
  const wallet = state.wallet;
  const ticketId = state.ownerTicket[wallet];
  if (!ticketId) return;
  const t = state.tickets[ticketId];
  if (t.status === 'VALID') {
    t.status = 'INVALID';
    log(`Ticket #${ticketId} invalidated`);
    renderMyTicket();
  }
}

function handleVerify() {
  const id = Number(document.getElementById('verifyInput').value);
  const resultDiv = document.getElementById('verifyResult');
  const ticket = state.tickets[id];
  if (!ticket) {
    resultDiv.textContent = `✕ Ticket #${id} does NOT exist`;
    return;
  }
  if (ticket.status !== 'VALID') {
    resultDiv.textContent = `✕ Ticket #${id} is ${ticket.status}`;
    return;
  }
  resultDiv.textContent = `✓ Ticket #${id} is VALID (owner ${shortAddress(ticket.owner)})`;
}

function handleAdminUpdateSale() {
  const openVal = document.getElementById('openInput').value;
  const closeVal = document.getElementById('closeInput').value;
  const rtbVal = document.getElementById('rtbSelect').value;
  if (openVal) state.contractState.openTime = new Date(openVal).getTime();
  if (closeVal) state.contractState.closedTime = new Date(closeVal).getTime();
  state.contractState.rtbAvailable = rtbVal === 'AVAILABLE';
  log('Admin updated sale configuration');
  updateSaleStatusUI();
  updateContractStateDisplay();
}

function handleAdminInvalidate() {
  const id = Number(document.getElementById('adminTicketId').value);
  const ticket = state.tickets[id];
  if (!ticket) { alert('Ticket not found'); return; }
  if (ticket.status !== 'VALID') { alert('Ticket not in VALID state'); return; }
  ticket.status = 'INVALID';
  log(`Admin invalidated Ticket #${id}`);
  renderMyTicket();
}

function handleAdminRestore() {
  const id = Number(document.getElementById('adminTicketId').value);
  const ticket = state.tickets[id];
  if (!ticket) { alert('Ticket not found'); return; }
  if (ticket.status !== 'INVALID') { alert('Can only restore from INVALID'); return; }
  ticket.status = 'VALID';
  log(`Admin restored Ticket #${id}`);
  renderMyTicket();
}

/*** Initialization ***/
document.addEventListener('DOMContentLoaded', () => {
  // Button listeners
  document.getElementById('connectBtn').addEventListener('click', handleConnect);
  document.getElementById('buyBtn').addEventListener('click', handleBuy);
  document.getElementById('checkInBtn').addEventListener('click', handleCheckIn);
  document.getElementById('invalidateBtn').addEventListener('click', handleInvalidate);
  document.getElementById('verifyBtn').addEventListener('click', handleVerify);
  document.getElementById('updateSaleBtn').addEventListener('click', handleAdminUpdateSale);
  document.getElementById('invalidateAdminBtn').addEventListener('click', handleAdminInvalidate);
  document.getElementById('restoreAdminBtn').addEventListener('click', handleAdminRestore);

  // Show admin section only if wallet is flagged as admin (for prototype we treat first wallet as admin)
  const adminSection = document.getElementById('adminDashboard');
  // We'll toggle visibility when wallet connects
  const observer = new MutationObserver(() => {
    if (state.wallet && state.wallet.endsWith('admin')) {
      adminSection.classList.remove('hidden');
    } else {
      adminSection.classList.add('hidden');
    }
  });
  observer.observe(document.getElementById('walletDisplay'), { childList: true });

  // Initial UI state
  updateWalletDisplay();
  updateSaleStatusUI();
  updateAccessDecision();
  updateContractStateDisplay();
});

