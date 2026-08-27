import { useEffect } from 'react';
import Head from 'next/head';

/**
 * This page mirrors the original static `index.html` while running inside
 * the Next.js Pages Router. All HTML structure, IDs, and CSS classes are
 * preserved so the existing `src/scripts/index.js` can manipulate the DOM
 * unchanged.
 */
export default function Home() {
  // Load the original script after the component mounts – this registers the
  // DOM event listeners and UI logic that the prototype relies on.
  useEffect(() => {
    // Dynamically import the original script (it runs in the global scope).
    // The script registers a `DOMContentLoaded` listener, but by the time
    // this effect runs the event has already fired.  To ensure the init
    // code runs we manually dispatch the event after the import.
    import('../scripts/script.js').then(() => {
      // If the script has already attached the listener it will run now.
      // If the listener missed the original DOMContentLoaded, we trigger it.
      const evt = new Event('DOMContentLoaded');
      document.dispatchEvent(evt);
    });
  }, []);

  return (
    <>
      <Head>
        <title>Concert Ticket DApp Prototype</title>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {/* Font link retained from original HTML */}
        {/* Font link moved to _document.jsx */}
      </Head>
      {/* Header – navigation & wallet connection */}
      <header className="header">
        <div className="header-left">
          <h1 className="concert-name">Example Concert 2026</h1>
        </div>
        <nav className="nav">
          <a href="#hero" className="nav-link">
            Home
          </a>
          <a href="#events" className="nav-link">
            Events
          </a>
          <a href="#my" className="nav-link">
            My Ticket
          </a>
          <a href="#admin" className="nav-link admin-link">
            Admin
          </a>
        </nav>
        <div className="header-right">
          <button id="connectBtn" className="btn connect">
            Connect Wallet
          </button>
          <span id="walletDisplay" className="wallet-display" />
        </div>
      </header>

      <main>
        {/* Event Discovery – list of upcoming events */}
        <section className="section" id="events">
          <h2>Upcoming Events</h2>
          <div className="events-grid" id="eventsGrid" />
        </section>

        {/* Event Detail – populated when a card is clicked */}
        <section className="section hidden" id="eventDetail">
          <h2 id="detailTitle" />
          <div className="detail-image">
            <img id="detailImg" src="/assets/images/images.jpeg" alt="Event image" />
          </div>
          <p id="detailDate" />
          <p id="detailLocation" />
          <p id="detailDesc" />
          <div className="sale-info">
            <div className="hero-status-row">
              <span className="status-label">Official Sale:</span>
              <span id="detailOfficialState" className="status-value" />
              <span className="countdown" id="detailCountdown" />
            </div>
            <div className="hero-status-row">
              <span className="status-label">RTB:</span>
              <span id="detailRtbState" className="status-value" />
            </div>
          </div>
          <button id="detailBuyBtn" className="btn primary-cta">
            Buy Ticket
          </button>
          <div id="detailBuyMessage" className="msg" />
        </section>

        {/* Hero – main info block */}
        <section className="hero" id="hero">
          <div className="hero-content">
            <h2 className="hero-title">Example Concert 2026</h2>
            <p className="hero-meta">June 12, 2026 • Grand Hall • New York City</p>
            <p className="hero-price">
              Ticket price: <strong>0.05 ETH</strong>
            </p>
            <div className="hero-status-row">
              <span className="status-label">Official Sale:</span>
              <span id="officialState" className="status-value">
                NOT_STARTED
              </span>
              <span className="countdown" id="countdown">
                --:--:--
              </span>
            </div>
            <div className="hero-status-row">
              <span className="status-label">RTB:</span>
              <span id="rtbState" className="status-value">
                UNAVAILABLE
              </span>
            </div>
            <button id="buyBtn" className="btn primary-cta">
              Buy Ticket
            </button>
            <div id="buyMessage" className="msg" />
          </div>
          <div className="hero-image">
            <img src="/assets/images/images.jpeg" alt="Concert venue illustration" />
          </div>
        </section>

        {/* Access Decision – concise info block */}
        <section className="section" id="accessDecision">
          <h2>Can I Buy?</h2>
          <pre className="code-block" id="accessInfo">
            Wallet: <span id="walletAddrDisplay">-</span>
            Already owns ticket: <span id="ownsTicket">NO</span>
            Official sale: <span id="officialSaleStatus">NOT_OPEN</span>
            RTB: <span id="rtbStatus">UNAVAILABLE</span>
            ----------------------------------------
            <span id="accessResult" />
          </pre>
        </section>

        {/* My Ticket – visual ticket card */}
        <section className="section" id="myTicket">
          <h2>My Ticket</h2>
          <div id="ticketInfo" className="ticket-card hidden">
            <div className="ticket-header">
              <h3 className="ticket-event">Example Concert 2026</h3>
              <p className="ticket-id">
                Ticket #<span id="ticketId" />
              </p>
            </div>
            <div className="ticket-body">
              <p>
                <strong>Owner:</strong> <span id="ticketOwner" />
              </p>
              <p>
                <strong>Status:</strong> <span id="ticketStatus" />
              </p>
              <p>
                <strong>Nonce:</strong> <span id="ticketNonce" />
              </p>
              <p>
                <strong>Purchase time:</strong>{' '}
                <span id="ticketTime" />
              </p>
            </div>
            <div className="ticket-actions">
              <button id="checkInBtn" className="btn small">
                Simulate Check‑in
              </button>
              <button id="invalidateBtn" className="btn small">
                Simulate Invalidation
              </button>
            </div>
          </div>
        </section>

        {/* Ticket Verification */}
        <section className="section" id="verifyTicket">
          <h2>Ticket Verification</h2>
          <div className="verify-group">
            <input type="number" id="verifyInput" placeholder="Enter Ticket ID" />
            <button id="verifyBtn" className="btn small">
              VERIFY TICKET
            </button>
          </div>
          <div id="verifyResult" className="msg" />
        </section>

        {/* Admin Dashboard */}
        <section className="section admin-section hidden" id="adminDashboard">
          <h2>Admin Dashboard</h2>
          <div className="admin-box">
            <h3>Sale Configuration</h3>
            <label>
              Open time:{' '}
              <input type="datetime-local" id="openInput" />
            </label>
            <label>
              Close time:{' '}
              <input type="datetime-local" id="closeInput" />
            </label>
            <label>
              RTB:{' '}
              <select id="rtbSelect">
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="UNAVAILABLE">UNAVAILABLE</option>
              </select>
            </label>
            <button id="updateSaleBtn" className="btn small">
              Update Sale Time
            </button>
          </div>
          <div className="admin-box">
            <h3>Ticket Management</h3>
            <label>
              Ticket ID:{' '}
              <input type="number" id="adminTicketId" />
            </label>
            <button id="invalidateAdminBtn" className="btn small">
              Invalidate Ticket
            </button>
            <button id="restoreAdminBtn" className="btn small">
              Restore Ticket
            </button>
          </div>
        </section>

        {/* Smart Contract State */}
        <section className="section" id="contractState">
          <h2>Smart Contract State</h2>
          <pre className="code-block" id="stateDisplay" />
        </section>

        {/* Transaction Log */}
        <section className="section" id="txLog">
          <h2>Transaction Log</h2>
          <pre className="code-block" id="logDisplay" />
        </section>
      </main>
    </>
  );
}
