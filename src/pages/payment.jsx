import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "../hooks/use-auth";
import { useWallet } from "../hooks/use-wallet";
import {
  ethers,
  readTicketPrice,
  readIsSaleOpen,
  readGetRTB,
  readHasTicket,
  buyTicketOfficial,
  buyTicketRTB,
} from "../lib/contract";

const STEPS = {
  READY: "ready",
  PROCESSING: "processing",
  PAID: "paid",
  MINTING: "minting",
  SUCCESS: "success",
  ERROR: "error",
};

export default function PaymentPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { account } = useWallet();
  const [step, setStep] = useState(STEPS.READY);
  const [priceEth, setPriceEth] = useState("...");
  const [priceWei, setPriceWei] = useState(null);
  const [ticketResult, setTicketResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [secretKey, setSecretKey] = useState("");

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  // Read purchase params from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem("ctm_purchase");
    if (!stored) {
      router.replace("/");
      return;
    }
    try {
      const data = JSON.parse(stored);
      setSecretKey(data.secretKey || "");
    } catch {
      router.replace("/");
    }
  }, [router]);

  // Load ticket price
  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    async function loadPrice() {
      try {
        const p = await readTicketPrice();
        if (!cancelled) {
          setPriceWei(p);
          setPriceEth(ethers.formatEther(p));
        }
      } catch (err) {
        console.error("Failed to load ticket price:", err);
      }
    }
    loadPrice();
    return () => { cancelled = true; };
  }, [account]);

  async function handlePay() {
    if (!account) {
      setErrorMsg("Wallet not connected.");
      setStep(STEPS.ERROR);
      return;
    }

    // Step 1: Simulated payment processing
    setStep(STEPS.PROCESSING);
    await new Promise((r) => setTimeout(r, 2000));

    // Step 2: Payment "succeeded"
    setStep(STEPS.PAID);
    await new Promise((r) => setTimeout(r, 800));

    // Step 3: Mint ticket on-chain
    setStep(STEPS.MINTING);
    try {
      // Ensure the price is loaded before sending the transaction.
      let finalPriceWei = priceWei;
      if (!finalPriceWei) {
        finalPriceWei = await readTicketPrice();
        setPriceWei(finalPriceWei);
        setPriceEth(ethers.formatEther(finalPriceWei));
      }

      const [isSaleOpen, hasTicket, rtb] = await Promise.all([
        readIsSaleOpen(),
        readHasTicket(account),
        readGetRTB(account),
      ]);

      if (hasTicket) throw new Error("Your wallet already owns a ticket.");
      if (!isSaleOpen && !rtb) throw new Error("Sale is closed and RTB is unavailable.");

      const commitment = ethers.keccak256(ethers.toUtf8Bytes(secretKey));
      let result;
      if (isSaleOpen) {
        result = await buyTicketOfficial(commitment, finalPriceWei);
      } else {
        result = await buyTicketRTB(commitment, finalPriceWei);
      }

      console.log("=== TICKET RESULT FROM CONTRACT ===");
      console.log(result);
      console.log("ticketId:", result?.ticketId);
      console.log("txHash:", result?.txHash);

      setTicketResult(result);
      setStep(STEPS.SUCCESS);

      // Clean up sessionStorage
      sessionStorage.removeItem("ctm_purchase");
    } catch (err) {
      console.error("Ticket creation failed:", err);
      const reason = err?.reason || err?.shortMessage || err?.message || "Transaction failed.";
      setErrorMsg(reason);
      setStep(STEPS.ERROR);
    }
  }

  if (authLoading) return null;
  if (!user) return null;

  return (
    <>
      <Head>
        <title>Payment – Concert Ticket DApp</title>
      </Head>
      <div className="auth-page">
        <div className="auth-card payment-card">
          <h2>Payment</h2>

          {step === STEPS.READY && (
            <div className="payment-body">
              <div className="payment-row">
                <span className="payment-label">Ticket Price:</span>
                <strong>{priceEth} ETH</strong>
              </div>
              <div className="payment-row">
                <span className="payment-label">Payment Method:</span>
                <span className="payment-badge">Demo Payment</span>
              </div>
              <div className="payment-row">
                <span className="payment-label">Wallet:</span>
                <span className="mono">{account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Not connected"}</span>
              </div>
              <button className="btn auth-btn" onClick={handlePay} disabled={!priceWei}>
                Pay Now
              </button>
            </div>
          )}

          {step === STEPS.PROCESSING && (
            <div className="payment-status">
              <div className="spinner" />
              <p>Processing payment…</p>
            </div>
          )}

          {step === STEPS.PAID && (
            <div className="payment-status">
              <p className="auth-success">Payment Successful ✓</p>
              <p>Creating your ticket…</p>
            </div>
          )}

          {step === STEPS.MINTING && (
            <div className="payment-status">
              <div className="spinner" />
              <p>Sending transaction to Sepolia…</p>
              <p className="payment-hint">Please confirm the transaction in MetaMask.</p>
            </div>
          )}

          {step === STEPS.SUCCESS && ticketResult && (
            <div className="payment-status">
              <p className="auth-success">🎉 Ticket Created Successfully!</p>
              <div className="ticket-card">
                <div className="ticket-header">
                  <h3 className="ticket-event">Example Concert 2026</h3>
                  <p className="ticket-id">Ticket #{ticketResult.ticketId}</p>
                </div>
                <div className="ticket-body">
                  <p><strong>Owner:</strong> {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : ""}</p>
                  <p><strong>Status:</strong> VALID</p>
                  <p><strong>Transaction:</strong> <a href={`https://sepolia.etherscan.io/tx/${ticketResult.txHash}`} target="_blank" rel="noreferrer" className="tx-link">{ticketResult.txHash.slice(0, 10)}…{ticketResult.txHash.slice(-8)}</a></p>
                </div>
              </div>
              <button className="btn auth-btn" onClick={() => router.push("/")}>
                Go to Dashboard
              </button>
            </div>
          )}

          {step === STEPS.ERROR && (
            <div className="payment-status">
              <p className="auth-error">{errorMsg}</p>
              <button className="btn auth-btn" onClick={() => setStep(STEPS.READY)}>
                Try Again
              </button>
              <button className="btn btn-secondary" onClick={() => router.push("/")} style={{ marginTop: "0.5rem" }}>
                Back to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
