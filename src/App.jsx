// Ethereum Mainnet

import { useState } from "react";
import * as ethers from "ethers";

/* -------------------- */
/* CONFIG               */
/* -------------------- */

const API_KEY = import.meta.env.VITE_COVALENT_KEY;
const CHAIN_NAME = "eth-mainnet";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
];

export default function App() {
  const [connectedAddress, setConnectedAddress] = useState(null);
  const [scanAddress, setScanAddress] = useState("");
  const [approvals, setApprovals] = useState([]);
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [hasManuallyScanned, setHasManuallyScanned] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);

  /* -------------------- */
  /* CONNECT WALLET       */
  /* -------------------- */

  async function connectWallet() {
    if (!window.ethereum) {
      alert("No Web3 Wallet Detected🥺");
      return;
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    const normalized = ethers.getAddress(accounts[0]);

    setConnectedAddress(normalized);

    if (!hasManuallyScanned) {
      setScanAddress(normalized);
      await fetchApprovalsForAddress(normalized);
    }
  }

  /* -------------------- */
  /* MANUAL FETCH         */
  /* -------------------- */

  async function fetchApprovals() {
    try {
      const normalized = ethers.getAddress(scanAddress.trim());
      setHasManuallyScanned(true);
      await fetchApprovalsForAddress(normalized);
    } catch {
      setError("Invalid wallet address");
    }
  }

  /* -------------------- */
  /* CORE FETCH FUNCTION  */
  /* -------------------- */

  async function fetchApprovalsForAddress(address) {
    try {
      if (!API_KEY) throw new Error("Missing API Key");

      setLoading(true);
      setError("");
      setApprovals([]);
      setSelected({});
      setHasScanned(true);

      const response = await fetch(
        `https://api.covalenthq.com/v1/${CHAIN_NAME}/approvals/${address}/`,
        {
          headers: {
            Authorization: `Bearer ${API_KEY}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const json = await response.json();
      if (json.error) {
        throw new Error(json.error_message || "API error");
      }

      const flattened = [];

      for (const token of json.data.items) {
        for (const spender of token.spenders) {
          flattened.push({
            tokenAddress: token.token_address,
            tokenLogo: token.logo_url,
            name: token.token_address_label || token.ticker_symbol,
            symbol: token.ticker_symbol,
            spender: spender.spender_address,
            spenderLabel: spender.spender_address_label,
            allowance: spender.allowance,
            isUnlimited: spender.allowance === "UNLIMITED",
            daysOld: spender.block_signed_at
              ? Math.floor(
                  (Date.now() -
                    new Date(spender.block_signed_at).getTime()) /
                    (1000 * 60 * 60 * 24)
                )
              : 0,
            risk: normalizeRisk(spender.risk_factor),
            valueAtRisk:
              spender.value_at_risk_quote != null
                ? Number(spender.value_at_risk_quote)
                : 0,
          });
        }
      }

      flattened.sort((a, b) => riskRank(b.risk) - riskRank(a.risk));
      setApprovals(flattened);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to fetch approvals");
    } finally {
      setLoading(false);
    }
  }

  function normalizeRisk(riskFactor) {
    if (!riskFactor) return "Low";
    if (riskFactor.includes("REVOKING")) return "High";
    if (riskFactor.includes("MEDIUM")) return "Medium";
    if (riskFactor.includes("LOW")) return "Low";
    return "Low";
  }

  function riskRank(level) {
    return level === "High" ? 2 : level === "Medium" ? 1 : 0;
  }

  /* -------------------- */
  /* BATCH REVOKE         */
  /* -------------------- */

  async function batchRevoke() {
    try {
      const normalizedScan = ethers.getAddress(scanAddress);

      if (
        connectedAddress?.toLowerCase() !==
        normalizedScan.toLowerCase()
      ) {
        alert("Connect the wallet you're scanning to revoke.");
        return;
      }

      const targets = approvals.filter(
        (a) => selected[`${a.tokenAddress}-${a.spender}`]
      );

      if (!targets.length) {
        alert("No approvals selected");
        return;
      }

      setRevoking(true);
      setProgress({ current: 0, total: targets.length });

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      for (let i = 0; i < targets.length; i++) {
        const a = targets[i];
        setProgress({ current: i + 1, total: targets.length });

        const token = new ethers.Contract(
          a.tokenAddress,
          ERC20_ABI,
          signer
        );

        const tx = await token.approve(a.spender, 0);
        await tx.wait();

        setApprovals((prev) =>
          prev.filter(
            (x) =>
              !(
                x.tokenAddress === a.tokenAddress &&
                x.spender === a.spender
              )
          )
        );
      }

      setSelected({});
      alert("Batch revoke completed");
    } catch (err) {
      console.error(err);
      alert("Batch revoke cancelled or failed");
    } finally {
      setRevoking(false);
      setProgress({ current: 0, total: 0 });
    }
  }

  /* -------------------- */
  /* FILTERED DATA        */
  /* -------------------- */

  const filtered =
    filter === "all"
      ? approvals
      : approvals.filter((a) => a.risk.toLowerCase() === filter);

  /* -------------------- */
  /* UI                   */
  /* -------------------- */

  return (
    <div
      style={{
        padding: 16,
        fontFamily: "sans-serif",
        maxWidth: 480,
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <h2 style={{ textAlign: "center" }}>
        Ethereum Token Revoker 🔐
      </h2>

      <input
        placeholder="Enter wallet address"
        value={scanAddress}
        onChange={(e) => setScanAddress(e.target.value)}
        style={{
          width: "100%",
          padding: 10,
          boxSizing: "border-box",
        }}
      />

      <button
        onClick={fetchApprovals}
        style={{ marginTop: 8, width: "100%" }}
      >
        Scan Wallet
      </button>

      <hr />

      {!connectedAddress ? (
        <button
          onClick={connectWallet}
          style={{ width: "100%" }}
        >
          Connect Wallet
        </button>
      ) : (
        <p
          style={{
            wordBreak: "break-all",
            fontSize: 14,
          }}
        >
          Connected: {connectedAddress}
        </p>
      )}

      {loading && <p>Fetching approvals...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading &&
        !error &&
        hasScanned &&
        approvals.length === 0 && (
          <div
            style={{
              marginTop: 20,
              padding: 16,
              borderRadius: 8,
              background: "#f4f4f4",
              textAlign: "center",
            }}
          >
            <strong>No token approvals found 🎉</strong>
            <p style={{ fontSize: 14 }}>
            This wallet has no active ERC-20 approvals.
            </p>
          </div>
        )}

      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{ width: "100%", marginTop: 10 }}
      >
        <option value="all">All</option>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>

      {connectedAddress?.toLowerCase() ===
        scanAddress?.toLowerCase() &&
        approvals.length > 0 && (
          <button
            onClick={batchRevoke}
            disabled={revoking}
            style={{
              background: "crimson",
              color: "white",
              marginTop: 12,
              padding: 12,
              width: "100%",
              borderRadius: 8,
              border: "none",
            }}
          >
            {revoking
              ? `Revoking ${progress.current}/${progress.total}`
              : "Revoke Selected"}
          </button>
        )}

      {filtered.map((a) => {
        const key = `${a.tokenAddress}-${a.spender}`;

        return (
          <div
            key={key}
            style={{
              border: "1px solid #ccc",
              padding: 14,
              marginTop: 14,
              borderRadius: 10,
              boxSizing: "border-box",
            }}
          >
            {connectedAddress?.toLowerCase() ===
              scanAddress?.toLowerCase() && (
              <input
                type="checkbox"
                checked={!!selected[key]}
                onChange={() =>
                  setSelected((s) => ({
                    ...s,
                    [key]: !s[key],
                  }))
                }
                style={{ marginBottom: 8 }}
              />
            )}

            <div style={{ display: "flex", alignItems: "center" }}>
              {a.tokenLogo && (
                <img
                  src={a.tokenLogo}
                  alt=""
                  width="24"
                  style={{ marginRight: 8 }}
                />
              )}
              <strong>
                {a.name} ({a.symbol})
              </strong>
            </div>

            <p style={{ wordBreak: "break-all" }}>
              Spender: {a.spenderLabel || a.spender}
            </p>

            <p style={{ wordBreak: "break-all" }}>
              Allowance:{" "}
              {a.isUnlimited ? "Unlimited 🚨" : a.allowance}
            </p>

            <p>Value at Risk: ${a.valueAtRisk.toFixed(2)}</p>
            <p>Age: {a.daysOld} days</p>

            <p>
              Risk:{" "}
              <span
                style={{
                  color:
                    a.risk === "High"
                      ? "red"
                      : a.risk === "Medium"
                      ? "orange"
                      : "green",
                }}
              >
                {a.risk}
              </span>
            </p>
          </div>
        );
      })}
    </div>
  );
}