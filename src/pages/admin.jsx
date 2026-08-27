import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "../hooks/use-auth";
import { useWallet } from "../hooks/use-wallet";
import {
  ethers,
  readOwner,
  readIsSaleOpen,
  readOpeningTime,
  readClosingTime,
  readTicketPrice,
  readMaxTickets,
  readNextTicketId,
  readCheckInOperator,
  getContract,
  shortAddress,
  adminSetOpeningTime,
  adminSetClosingTime,
  adminSetTicketPrice,
  adminSetMaxTickets,
  adminGrantRTB,
  adminBatchGrantRTB,
  adminRevokeRTB,
  adminInvalidateTicket,
  adminWithdraw,
  adminTransferOwnership,
  adminSetCheckInOperator,
} from "../lib/contract";

export default function AdminPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const { account, connect, connecting } = useWallet();

  const [isOwner, setIsOwner] = useState(false);
  const [checking, setChecking] = useState(true);
  const [contractData, setContractData] = useState(null);
  const [txStatus, setTxStatus] = useState("");

  // Form states
  const [openTime, setOpenTime] = useState("");
  const [closeTime, setCloseTime] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newMax, setNewMax] = useState("");
  const [rtbAddr, setRtbAddr] = useState("");
  const [batchRtbAddrs, setBatchRtbAddrs] = useState("");
  const [invalidateId, setInvalidateId] = useState("");
  const [newOwnerAddr, setNewOwnerAddr] = useState("");
  const [newOperatorAddr, setNewOperatorAddr] = useState("");

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  // Check ownership
  useEffect(() => {
    if (!account || !getContract()) {
      setChecking(false);
      return;
    }
    readOwner()
      .then((ownerAddr) => {
        const normalised = ethers.getAddress(ownerAddr);
        setIsOwner(normalised === account);
        setChecking(false);
      })
      .catch((err) => {
        console.error("Owner check failed:", err);
        setChecking(false);
      });
  }, [account]);

  // Load contract data
  const loadData = useCallback(async () => {
    if (!account || !getContract() || !isOwner) return;
    try {
      const [owner, saleOpen, opening, closing, price, max, nextId, operator] = await Promise.all([
        readOwner(),
        readIsSaleOpen(),
        readOpeningTime(),
        readClosingTime(),
        readTicketPrice(),
        readMaxTickets(),
        readNextTicketId(),
        readCheckInOperator(),
      ]);
      setContractData({
        owner,
        saleOpen,
        openingTime: opening,
        closingTime: closing,
        price,
        priceEth: ethers.formatEther(price),
        maxTickets: max,
        totalTicketsSold: nextId > 0 ? nextId - 1 : 0,
        operator,
      });
    } catch (err) {
      console.error("Failed to load contract data:", err);
    }
  }, [account, isOwner]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function runAdminTx(label, fn) {
    setTxStatus(`⏳ ${label}…`);
    try {
      await fn();
      setTxStatus(`✅ ${label} – success!`);
      await loadData();
    } catch (err) {
      console.error(err);
      const reason = err?.reason || err?.shortMessage || err?.message || "Transaction failed.";
      setTxStatus(`❌ ${label} – ${reason}`);
    }
  }

  if (authLoading) return null;
  if (!user) return null;

  return (
    <>
      <Head>
        <title>Admin – Concert Ticket DApp</title>
      </Head>
      <div className="admin-page">
        <header className="header">
          <div className="header-left">
            <h1 className="concert-name">Admin Dashboard</h1>
          </div>
          <div className="header-right">
            {account ? (
              <span className="wallet-display">Connected: {shortAddress(account)}</span>
            ) : (
              <button className="btn connect" onClick={connect} disabled={connecting}>
                {connecting ? "Connecting…" : "Connect Wallet"}
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => { logout(); router.push("/login"); }} style={{ marginLeft: "0.5rem" }}>
              Logout
            </button>
          </div>
        </header>

        <main style={{ padding: "var(--spacing-lg)" }}>
          {!account && (
            <div className="section">
              <p>Please connect your wallet to verify admin access.</p>
            </div>
          )}

          {account && checking && (
            <div className="section"><p>Verifying contract ownership…</p></div>
          )}

          {account && !checking && !isOwner && (
            <div className="section">
              <h2>Access Denied</h2>
              <p>Your connected wallet (<strong>{shortAddress(account)}</strong>) is not the contract owner.</p>
              <button className="btn" onClick={() => router.push("/")} style={{ marginTop: "1rem" }}>Back to Dashboard</button>
            </div>
          )}

          {account && !checking && isOwner && contractData && (
            <>
              {/* Contract Info */}
              <section className="section">
                <h2>Contract State</h2>
                <pre className="code-block">
{`Owner:              ${shortAddress(contractData.owner)}
Your Wallet:        ${shortAddress(account)}
Official Sale:      ${contractData.saleOpen ? "OPEN" : "CLOSED"}
Opening Time:       ${new Date(contractData.openingTime * 1000).toLocaleString()}
Closing Time:       ${new Date(contractData.closingTime * 1000).toLocaleString()}
Ticket Price:       ${contractData.priceEth} ETH
Max Tickets:        ${contractData.maxTickets}
Tickets Sold:       ${contractData.totalTicketsSold}
Check-in Operator:  ${shortAddress(contractData.operator)}`}
                </pre>
              </section>

              {/* Status Message */}
              {txStatus && (
                <section className="section">
                  <p className="msg">{txStatus}</p>
                </section>
              )}

              {/* Sale Configuration */}
              <section className="section admin-section">
                <h2>Sale Configuration</h2>
                <div className="admin-box">
                  <label>
                    Opening Time:
                    <input type="datetime-local" value={openTime} onChange={(e) => setOpenTime(e.target.value)} />
                  </label>
                  <button className="btn small" onClick={() => {
                    if (!openTime) return;
                    const ts = Math.floor(new Date(openTime).getTime() / 1000);
                    runAdminTx("Set opening time", () => adminSetOpeningTime(ts));
                  }}>Set Opening Time</button>
                </div>
                <div className="admin-box">
                  <label>
                    Closing Time:
                    <input type="datetime-local" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
                  </label>
                  <button className="btn small" onClick={() => {
                    if (!closeTime) return;
                    const ts = Math.floor(new Date(closeTime).getTime() / 1000);
                    runAdminTx("Set closing time", () => adminSetClosingTime(ts));
                  }}>Set Closing Time</button>
                </div>
                <div className="admin-box">
                  <label>
                    Ticket Price (ETH):
                    <input type="text" placeholder="0.05" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
                  </label>
                  <button className="btn small" onClick={() => {
                    if (!newPrice) return;
                    const wei = ethers.parseEther(newPrice);
                    runAdminTx("Set ticket price", () => adminSetTicketPrice(wei));
                  }}>Set Price</button>
                </div>
                <div className="admin-box">
                  <label>
                    Max Tickets:
                    <input type="number" placeholder="100" value={newMax} onChange={(e) => setNewMax(e.target.value)} />
                  </label>
                  <button className="btn small" onClick={() => {
                    if (!newMax) return;
                    runAdminTx("Set max tickets", () => adminSetMaxTickets(Number(newMax)));
                  }}>Set Max</button>
                </div>
              </section>

              {/* RTB Management */}
              <section className="section admin-section">
                <h2>RTB Management</h2>
                <div className="admin-box">
                  <label>
                    Wallet Address:
                    <input type="text" placeholder="0x..." value={rtbAddr} onChange={(e) => setRtbAddr(e.target.value)} />
                  </label>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                    <button className="btn small" onClick={() => {
                      if (!rtbAddr) return;
                      runAdminTx("Grant RTB", () => adminGrantRTB(rtbAddr));
                    }}>Grant RTB</button>
                    <button className="btn small" onClick={() => {
                      if (!rtbAddr) return;
                      runAdminTx("Revoke RTB", () => adminRevokeRTB(rtbAddr));
                    }}>Revoke RTB</button>
                  </div>
                </div>
                <div className="admin-box">
                  <label>
                    Batch Grant RTB (one address per line):
                    <textarea
                      rows={5}
                      placeholder={"0xabc...\n0xdef...\n0x123..."}
                      value={batchRtbAddrs}
                      onChange={(e) => setBatchRtbAddrs(e.target.value)}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "var(--spacing-xs) var(--spacing-sm)",
                        marginTop: "0.25rem",
                        border: "1px solid #555",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--color-bg)",
                        color: "var(--color-text)",
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.9rem",
                        resize: "vertical",
                        boxSizing: "border-box",
                      }}
                    />
                  </label>
                  <button className="btn small" style={{ marginTop: "0.5rem" }} onClick={async () => {
                    const lines = batchRtbAddrs
                      .split("\n")
                      .map((l) => l.trim())
                      .filter((l) => l.length > 0);
                    if (lines.length === 0) return;
                    setTxStatus(`⏳ Batch Grant RTB – 0/${lines.length}…`);
                    const results = await adminBatchGrantRTB(lines, (i, total, addr) => {
                      setTxStatus(`⏳ Batch Grant RTB – ${i + 1}/${total} (${addr.slice(0, 8)}…)`);
                    });
                    const ok = results.filter((r) => r.success).length;
                    const fail = results.filter((r) => !r.success);
                    let msg = `✅ Batch Grant RTB – ${ok}/${results.length} succeeded.`;
                    if (fail.length > 0) {
                      msg += "\n❌ Failed: " + fail.map((f) => `${f.addr.slice(0, 10)}… (${f.error})`).join(", ");
                    }
                    setTxStatus(msg);
                    setBatchRtbAddrs("");
                    await loadData();
                  }}>Batch Grant RTB</button>
                </div>
              </section>

              {/* Ticket Management */}
              <section className="section admin-section">
                <h2>Ticket Management</h2>
                <div className="admin-box">
                  <label>
                    Ticket ID:
                    <input type="number" placeholder="1" value={invalidateId} onChange={(e) => setInvalidateId(e.target.value)} />
                  </label>
                  <button className="btn small" onClick={() => {
                    if (!invalidateId) return;
                    runAdminTx("Invalidate ticket", () => adminInvalidateTicket(Number(invalidateId)));
                  }}>Invalidate Ticket</button>
                </div>
              </section>

              {/* Ownership & Operator */}
              <section className="section admin-section">
                <h2>Ownership & Operator</h2>
                <div className="admin-box">
                  <label>
                    New Owner Address:
                    <input type="text" placeholder="0x..." value={newOwnerAddr} onChange={(e) => setNewOwnerAddr(e.target.value)} />
                  </label>
                  <button className="btn small" onClick={() => {
                    if (!newOwnerAddr) return;
                    runAdminTx("Transfer ownership", () => adminTransferOwnership(newOwnerAddr));
                  }}>Transfer Ownership</button>
                </div>
                <div className="admin-box">
                  <label>
                    New Check-in Operator:
                    <input type="text" placeholder="0x..." value={newOperatorAddr} onChange={(e) => setNewOperatorAddr(e.target.value)} />
                  </label>
                  <button className="btn small" onClick={() => {
                    if (!newOperatorAddr) return;
                    runAdminTx("Set check-in operator", () => adminSetCheckInOperator(newOperatorAddr));
                  }}>Set Operator</button>
                </div>
              </section>

              {/* Withdraw */}
              <section className="section admin-section">
                <h2>Withdraw Funds</h2>
                <button className="btn" onClick={() => runAdminTx("Withdraw", adminWithdraw)}>Withdraw All Funds</button>
              </section>
            </>
          )}
        </main>
      </div>
    </>
  );
}
