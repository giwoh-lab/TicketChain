import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "../hooks/use-auth";
import { useWallet } from "../hooks/use-wallet";
import { ethers } from "ethers";
import {
  getContract,
  shortAddress,
  readOwner,
  readIsSaleOpen,
  readOpeningTime,
  readClosingTime,
  readTicketPrice,
  readMaxTickets,
  readNextTicketId,
  readHasTicket,
  readGetRTB,
  readMyTicket,
  readOwnerTicket,
  transferTicket,
} from "../lib/contract";
import { QRCodeCanvas } from "qrcode.react";

function statusToString(s) {
  if (s === 0) return "VALID";
  if (s === 1) return "INVALID";
  if (s === 2) return "USED";
  return "UNKNOWN";
}

export default function DashboardPage() {


  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const { account, connect, connecting, error: walletError } = useWallet();

  const [saleData, setSaleData] = useState(null);
  const [userTicket, setUserTicket] = useState(null);
  const [hasTicket, setHasTicket] = useState(false);
  const [rtb, setRtb] = useState(false);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState("--:--:--");
  const [buyError, setBuyError] = useState("");
  const [isOwner, setIsOwner] = useState(false);

  const [transferModal, setTransferModal] = useState(null);

  const handleTransfer = async () => {
    if (!account) {
      setTransferMessage("Wallet not connected");
      return;
    }
    if (!transferRecipient) {
      setTransferMessage("Recipient address required");
      return;
    }

    let recipientAddr;
    try {
      recipientAddr = ethers.getAddress(transferRecipient.trim());
    } catch {
      setTransferMessage("Invalid recipient address");
      return;
    }

    if (recipientAddr === ethers.ZeroAddress) {
      setTransferMessage("Recipient address cannot be zero");
      return;
    }

    try {
      const already = await readHasTicket(recipientAddr);
      if (already) {
        setTransferMessage("Recipient already owns a ticket");
        return;
      }
    } catch (e) {
      console.error(e);
      setTransferMessage("Failed to verify recipient");
      return;
    }

    setTransferLoading(true);
    setTransferMessage("");

    try {
      // 1. Generate secret key cho recipient
      const newSecret = generateSecret();

      // 2. Tính commitment — phải dùng toUtf8Bytes để khớp với contract
      const newCommitment = ethers.keccak256(ethers.toUtf8Bytes(newSecret));

      // 3. Tính QR hash cho recipient (họ sẽ cần cái này)
      const newQrHash = ethers.keccak256(
        ethers.solidityPacked(
          ["uint256", "string"],
          [userTicket.id, newSecret]
        )
      );

      // 4. Gọi contract với commitment mới
      const txHash = await transferTicket(recipientAddr, userTicket.id, newCommitment);

      // 5. Xóa secret cũ của sender khỏi localStorage
      localStorage.removeItem(`${account.toLowerCase()}_${userTicket.id}`);

      // 6. Hiển thị secret cho sender để họ gửi cho recipient
      setTransferModal({
        secret: newSecret,
        qrHash: newQrHash,
        txHash,
        recipientAddr,
        ticketId: userTicket.id,
      });

      // 7. Refresh data
      await loadData();
    } catch (err) {
      console.error(err);
      const reason = err?.reason || err?.error?.message || err?.message || "Transfer failed";
      setTransferMessage(reason);
    } finally {
      setTransferLoading(false);
    }
  };

  // Transfer UI state
  const [transferRecipient, setTransferRecipient] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferMessage, setTransferMessage] = useState("");

  // ---------- Secret key management ----------
  const generateSecret = () => {
    // 32‑byte random secret, hex encoded (64 chars)
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  };

  const handleGenerateSecret = async () => {
    if (!account || !userTicket) return;
    const newSecret = generateSecret();
    const hash = ethers.keccak256(
      ethers.solidityPacked(["uint256", "string"], [userTicket.id, newSecret])
    );
    setSecretKey(newSecret);
    setQrHash(hash);
    localStorage.setItem(
      `${account.toLowerCase()}_${userTicket.id}`,
      JSON.stringify({ secretKey: newSecret, qrHash: hash })
    );
    setSecretMessage("Secret key generated and saved locally.");
  };

  const handleChangeSecret = async () => {
    if (!account || !userTicket) return;
    const newSecret = generateSecret();
    const hash = ethers.keccak256(
      ethers.solidityPacked(["uint256", "string"], [userTicket.id, newSecret])
    );
    setSecretKey(newSecret);
    setQrHash(hash);
    localStorage.setItem(
      `${account.toLowerCase()}_${userTicket.id}`,
      JSON.stringify({ secretKey: newSecret, qrHash: hash })
    );
    setSecretMessage("Secret key rotated successfully.");
  };

  // Secret key handling for the owned ticket
  const [secretKey, setSecretKey] = useState("");
  const [qrHash, setQrHash] = useState("");
  const [secretMessage, setSecretMessage] = useState("");

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  // Load contract data when wallet is connected
  const loadData = useCallback(async () => {
    if (!account || !getContract()) return;
    setLoading(true);
    try {
      const [isSaleOpen, openingTime, closingTime, price, maxTickets, nextId, owns, rtbStatus] =
        await Promise.all([
          readIsSaleOpen(),
          readOpeningTime(),
          readClosingTime(),
          readTicketPrice(),
          readMaxTickets(),
          readNextTicketId(),
          readHasTicket(account),
          readGetRTB(account),
        ]);

      setSaleData({
        isSaleOpen,
        openingTime,
        closingTime,
        priceEth: ethers.formatEther(price),
        priceWei: price,
        maxTickets,
        ticketsSold: nextId > 0 ? nextId - 1 : 0,
      });
      setHasTicket(owns);
      setRtb(rtbStatus);

      // Load user's ticket if they own one
          if (owns) {
            try {
              const ticket = await readMyTicket();
              const ticketId = await readOwnerTicket(account);

              if (!ticketId || ticketId === 0) {
                console.error("Could not resolve ticketId for", account);
                // không return — để finally chạy bình thường
              } else {
                setUserTicket({ ...ticket, id: ticketId });
                const stored = localStorage.getItem(`${account.toLowerCase()}_${ticketId}`);
                if (stored) {
                  const parsed = JSON.parse(stored);
                  setSecretKey(parsed.secretKey || "");
                  setQrHash(parsed.qrHash || "");
                }
              }

              setUserTicket({ ...ticket, id: ticketId });
              // Load any locally stored secret for this ticket.
              const stored = localStorage.getItem(`${account.toLowerCase()}_${ticketId}`);
              if (stored) {
                const parsed = JSON.parse(stored);
                setSecretKey(parsed.secretKey || "");
                setQrHash(parsed.qrHash || "");
              }
            } catch (err) {
              console.error("Failed to read user ticket:", err);
            }
          } else {
            setUserTicket(null);
            setSecretKey("");
            setQrHash("");
          }
    } catch (err) {
      console.error("Failed to load contract data:", err);
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Countdown timer
  useEffect(() => {
    if (!saleData || saleData.isSaleOpen) {
      setCountdown(saleData?.isSaleOpen ? "SALE OPEN" : "--:--:--");
      return;
    }
    function tick() {
      const now = Math.floor(Date.now() / 1000);
      const diff = saleData.openingTime - now;
      if (diff <= 0) {
        setCountdown("00:00:00");
        return;
      }
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setCountdown(
        `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
      );
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [saleData]);

  // Access decision
  function getAccessDecision() {
    if (!account) return { canBuy: false, reason: "Wallet not connected." };
    if (!saleData) return { canBuy: false, reason: "Loading contract data…" };
    if (hasTicket) return { canBuy: false, reason: "Your wallet already owns a ticket." };
    if (saleData.isSaleOpen) return { canBuy: true, reason: "Official sale is open. You can buy a ticket." };
    if (rtb) return { canBuy: true, reason: "You have RTB permission. You can buy a ticket." };
    return { canBuy: false, reason: "Sale is closed and RTB is unavailable." };
  }

  function handleBuy() {
    setBuyError("");
    const decision = getAccessDecision();
    if (!decision.canBuy) {
      setBuyError(decision.reason);
      return;
    }
    // Prompt for secret key
    const secretKey = prompt("Enter a secret key (keep it safe – you will need it later for verification):");
    if (!secretKey) {
      setBuyError("Secret key is required to create your ticket.");
      return;
    }
    // Store purchase params and redirect to payment
    sessionStorage.setItem("ctm_purchase", JSON.stringify({ secretKey }));
    router.push("/payment");
  }

  if (authLoading) return null;
  if (!user) return null;

  const decision = getAccessDecision();

  return (
    <>
      <Head>
        <title>Dashboard – Concert Ticket DApp</title>
      </Head>

      {/* Header */}
      <header className="header">
        <div className="header-left">
          <h1 className="concert-name">Example Concert 2026</h1>
        </div>
        <nav className="nav">
          <a href="#sale" className="nav-link">Sale</a>
          <a href="#ticket" className="nav-link">My Ticket</a>
          <a href="/admin" className="nav-link admin-link">Admin</a>
        </nav>
        <div className="header-right">
          {account ? (
            <span className="wallet-display">Connected: {shortAddress(account)}</span>
          ) : (
            <button className="btn connect" onClick={connect} disabled={connecting}>
              {connecting ? "Connecting…" : "Connect Wallet"}
            </button>
          )}
          <button
            className="btn btn-secondary"
            onClick={() => { logout(); router.push("/login"); }}
            style={{ marginLeft: "0.5rem" }}
          >
            Logout
          </button>
        </div>
      </header>

      <main style={{ padding: "var(--spacing-lg)" }}>
        {/* User info */}
        <section className="section">
          <h2>Welcome, {user.username}!</h2>
          <p style={{ opacity: 0.7 }}>{user.email}</p>
          {walletError && <p className="auth-error">{walletError}</p>}
        </section>

        {/* Wallet prompt */}
        {!account && (
          <section className="section">
            <h2>Connect Your Wallet</h2>
            <p>Connect MetaMask to interact with the smart contract on Sepolia.</p>
            <button className="btn connect" onClick={connect} disabled={connecting}>
              {connecting ? "Connecting…" : "Connect Wallet"}
            </button>
          </section>
        )}

        {/* Sale Status */}
        {account && saleData && (
          <section className="section" id="sale">
            <h2>Sale Status</h2>
            <div className="hero">
              <div className="hero-content">
                <h3 className="hero-title">Example Concert 2026</h3>
                <p className="hero-meta">June 12, 2026 • Grand Hall • New York City</p>
                <p className="hero-price">
                  Ticket price: <strong>{saleData.priceEth} ETH</strong>
                </p>
                <div className="hero-status-row">
                  <span className="status-label">Official Sale:</span>
                  <span className={`status-value ${saleData.isSaleOpen ? "open" : "closed"}`}>
                    {saleData.isSaleOpen ? "OPEN" : "CLOSED"}
                  </span>
                  <span className="countdown">{countdown}</span>
                </div>
                <div className="hero-status-row">
                  <span className="status-label">RTB:</span>
                  <span className="status-value">{rtb ? "AVAILABLE" : "UNAVAILABLE"}</span>
                </div>
                <div className="hero-status-row">
                  <span className="status-label">Tickets Sold:</span>
                  <span className="status-value">
                    {saleData.ticketsSold} / {saleData.maxTickets}
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Access Decision & Buy */}
        {account && saleData && (
          <section className="section">
            <h2>Can I Buy?</h2>
            <pre className="code-block">
{`Wallet:              ${shortAddress(account)}
Already owns ticket: ${hasTicket ? "YES" : "NO"}
Official sale:       ${saleData.isSaleOpen ? "OPEN" : "CLOSED"}
RTB:                 ${rtb ? "AVAILABLE" : "UNAVAILABLE"}
----------------------------------------
${decision.reason}`}
            </pre>
            {!hasTicket && (
              <div style={{ marginTop: "1rem" }}>
                <button
                  className="btn primary-cta"
                  onClick={handleBuy}
                  disabled={!decision.canBuy}
                >
                  Buy Ticket
                </button>
                {buyError && <p className="auth-error" style={{ marginTop: "0.5rem" }}>{buyError}</p>}
              </div>
            )}
          </section>
        )}

        {/* My Ticket */}
        <section className="section" id="ticket">
          <h2>My Ticket</h2>
          {!account && <p>Connect your wallet to view your ticket.</p>}
          {account && loading && <p>Loading…</p>}
          {account && !loading && !hasTicket && <p>You do not own a ticket yet.</p>}
          {account && !loading && hasTicket && userTicket && (
            <div className="ticket-card">
              <div className="ticket-header">
                <h3 className="ticket-event">Example Concert 2026</h3>
                <p className="ticket-id">Ticket #{userTicket.id}</p>
              </div>
              <div className="ticket-body">
                <p>
                  <strong>Owner:</strong> {shortAddress(userTicket.owner)}
                </p>
                <p>
                  <strong>Status:</strong> {statusToString(userTicket.status)}
                </p>
                <p>
                  <strong>Commitment:</strong>{" "}
                  <span className="mono" style={{ fontSize: "0.8rem" }}>
                    {userTicket.commitment}
                  </span>
                </p>
                {/* Secret key and QR handling */}
                {secretKey ? (
                  <>
                    <p><strong>Secret Key:</strong> <em>Stored locally</em></p>
                    <p><strong>QR Hash:</strong> <span className="mono" style={{ fontSize: "0.8rem" }}>{qrHash}</span></p>
                    <div style={{ marginTop: "0.5rem" }}>
                      <QRCodeCanvas value={qrHash} size={180} />
                    </div>
                    <button className="btn btn-secondary" onClick={handleChangeSecret} disabled={transferLoading}>Change Secret Key</button>
                    {secretMessage && <p style={{ marginTop: "0.5rem" }}>{secretMessage}</p>}
                  </>
                ) : (
                  <>
                    <p>Ticket security setup required.</p>
                    <button className="btn primary-cta" onClick={handleGenerateSecret}>Generate Secret Key</button>
                    {secretMessage && <p style={{ marginTop: "0.5rem" }}>{secretMessage}</p>}
                  </>
                )}
              </div>
              {/* Transfer UI – only for VALID tickets */}
              {statusToString(userTicket.status) === "VALID" && (
                <div className="transfer-section" style={{ marginTop: "1rem" }}>
                  <h4>Transfer Ticket</h4>
                  <input
                    type="text"
                    placeholder="Recipient wallet address"
                    value={transferRecipient}
                    onChange={(e) => setTransferRecipient(e.target.value)}
                    style={{ width: "100%", marginBottom: "0.5rem" }}
                  />
                  <button
                    className="btn primary-cta"
                    onClick={handleTransfer}
                    disabled={transferLoading}
                  >
                    {transferLoading ? "Transferring…" : "Confirm Transfer"}
                  </button>
                  {transferMessage && <p style={{ marginTop: "0.5rem" }}>{transferMessage}</p>}
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {transferModal && (
        <div style={{
          position:"fixed", inset:0, background:"rgba(0,0,0,0.45)",
          display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000
        }}>
          <div style={{
            background: "#ffffffff",
            border: "0.5px solid var(--border)",
            borderRadius: 12,
            padding: "1.5rem",
            width: "100%",
            maxWidth: 480,
            margin: "1rem",
            color: "#111827"
          }}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem"}}>
              <p style={{
                margin: 0,
                fontWeight: 600,
                color: "#111827"
              }}>
                ✅ Transfer complete
              </p>
              <button onClick={() => setTransferModal(null)} style={{background:"none", border:"none", cursor:"pointer", color:"var(--text-secondary)", fontSize:20}}>✕</button>
            </div>

            <div style={{background:"var(--bg-warning)", border:"0.5px solid var(--border-warning)", borderRadius:"var(--radius)", padding:"10px 14px", marginBottom:"1.25rem", fontSize:13, color:"var(--text-warning)"}}>
              ⚠️ Gửi secret key dưới đây cho recipient qua kênh an toàn. Không có nó, họ không thể check-in.
            </div>

            {[
              { label: "Ticket", value: `#${transferModal.ticketId} → ${transferModal.recipientAddr.slice(0,6)}...${transferModal.recipientAddr.slice(-4)}` },
              { label: "Secret key", value: transferModal.secret, mono: true },
              { label: "QR hash", value: transferModal.qrHash, mono: true },
              { label: "Transaction", value: `${transferModal.txHash.slice(0,10)}...` },
            ].map(({ label, value, mono }) => (
              <div key={label} style={{marginBottom:"1rem"}}>
                <p style={{
                  fontSize: 12,
                  color: "#6b7280",
                  margin: "0 0 4px",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em"
                }}>{label}</p>
                <div style={{display:"flex", gap:8, alignItems:"center"}}>
                  <div style={{
                      flex: 1,
                      background: "#f3f4f6",
                      border: "1px solid #d1d5db",
                      borderRadius: "var(--radius)",
                      padding: "8px 12px",
                      color: "#111827",
                      fontFamily: mono ? "var(--font-mono)" : "inherit",
                      fontSize: 13,
                      wordBreak: "break-all"
                    }}>{value}
                  </div>
                  {mono && (
                    <button onClick={() => navigator.clipboard.writeText(value)}
                      style={{padding:"8px 12px", borderRadius:"var(--radius)", border:"0.5px solid var(--border-strong)", background:"none", cursor:"pointer", fontSize:13, whiteSpace:"nowrap", color: "#111827"}}>
                      Copy
                    </button>
                  )}
                </div>
              </div>
            ))}

            <button onClick={() => setTransferModal(null)}
              style={{width:"100%", marginTop:"0.5rem", padding:10, borderRadius:"var(--radius)", border:"0.5px solid var(--border-strong)", background:"none", cursor:"pointer", fontSize:14, fontWeight:500, color:"var(--text-primary)"}}>
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
