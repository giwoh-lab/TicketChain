import { useState, useEffect, useCallback } from "react";
import { SEPOLIA_CHAIN_ID_HEX } from "../lib/constants";

/**
 * React hook for MetaMask wallet connection on Sepolia.
 * Handles connect, account/chain changes, and Sepolia enforcement.
 */
export function useWallet() {
  const [account, setAccount] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  // Auto-connect on mount if MetaMask already has an authorised account
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    window.ethereum
      .request({ method: "eth_accounts" })
      .then(async (accounts) => {
        if (accounts.length > 0) {
          // Verify chain before accepting the account
          const chainId = await window.ethereum.request({ method: "eth_chainId" });
          if (chainId === SEPOLIA_CHAIN_ID_HEX) {
            const { ethers } = await import("ethers");
            setAccount(ethers.getAddress(accounts[0]));
          }
        }
      })
      .catch(() => {});

    // Listen for account / chain changes
    function onAccountsChanged(accounts) {
      if (accounts.length === 0) {
        setAccount(null);
      } else {
        import("ethers").then(({ ethers }) => {
          setAccount(ethers.getAddress(accounts[0]));
        });
      }
    }

    function onChainChanged() {
      // Reload – simplest way to reset all provider state
      window.location.reload();
    }

    window.ethereum.on("accountsChanged", onAccountsChanged);
    window.ethereum.on("chainChanged", onChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", onAccountsChanged);
      window.ethereum.removeListener("chainChanged", onChainChanged);
    };
  }, []);

  const connect = useCallback(async () => {
    setError("");
    if (typeof window === "undefined" || !window.ethereum) {
      setError("MetaMask is not installed.");
      return;
    }

    setConnecting(true);
    try {
      // Check / switch network
      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      if (chainId !== SEPOLIA_CHAIN_ID_HEX) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
          });
        } catch (switchErr) {
          setError("Please switch MetaMask to Sepolia.");
          setConnecting(false);
          return;
        }
      }

      // Request accounts
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (!accounts || accounts.length === 0) {
        setError("No accounts returned from MetaMask.");
        setConnecting(false);
        return;
      }

      const { ethers } = await import("ethers");
      setAccount(ethers.getAddress(accounts[0]));
    } catch (err) {
      if (err.code === 4001) {
        setError("You rejected the wallet connection.");
      } else if (err.code === -32002) {
        setError("A MetaMask request is already pending. Open MetaMask and finish it first.");
      } else {
        setError(err?.shortMessage || err?.message || "Wallet connection failed.");
      }
    } finally {
      setConnecting(false);
    }
  }, []);

  return { account, connect, connecting, error };
}
