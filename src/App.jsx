// Multi-Chain Token Revoker

import { useState } from "react";
import * as ethers from "ethers";

const API_KEY = import.meta.env.VITE_COVALENT_KEY;

const CHAINS = {
  ethereum: { name: "Ethereum", covalentName: "eth-mainnet", chainId: "0x1" },
  base: { name: "Base", covalentName: "base-mainnet", chainId: "0x2105" },
  bsc: {
    name: "BSC",
    covalentName: "bsc-mainnet",
    chainId: "0x38",
    rpc: "https://bsc-dataseed.binance.org/",
    symbol: "BNB",
  },
  arbitrum: {
    name: "Arbitrum",
    covalentName: "arbitrum-mainnet",
    chainId: "0xa4b1",
  },
  optimism: {
    name: "Optimism",
    covalentName: "optimism-mainnet",
    chainId: "0xa",
  },
  polygon: {
    name: "Polygon",
    covalentName: "matic-mainnet",
    chainId: "0x89",
    symbol: "MATIC",
  },
};

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
];

export default function App() {
  const [selectedChain, setSelectedChain] = useState("ethereum");
  const [connectedAddress, setConnectedAddress] = useState(null);
  const [scanAddress, setScanAddress] = useState("");
  const [approvals, setApprovals] = useState([]);
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState("");
  const [hasScanned, setHasScanned] = useState(false);

  async function switchNetwork() {
    const chain = CHAINS[selectedChain];

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chain.chainId }],
      });
    } catch (switchError) {
      if (switchError.code === 4902 && chain.rpc) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: chain.chainId,
              chainName: chain.name,
              rpcUrls: [chain.rpc],
              nativeCurrency: {
                name: chain.name,
                symbol: chain.symbol || "ETH",
                decimals: 18,
              },
            },
          ],
        });
      }
    }
  }

  async function connectWallet() {
    if (!window.ethereum) {
      alert("No Web3 Wallet Detected🥺");
      return;
    }

    await switchNetwork();

    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    const normalized = ethers.getAddress(accounts[0]);

    setConnectedAddress(normalized);
    setScanAddress(normalized);
    await fetchApprovalsForAddress(normalized);
  }

async function fetchApprovalsForAddress(address) {
  try {
    if (!API_KEY) throw new Error("Missing API Key");

    setLoading(true);
    setError("");
    setApprovals([]);
    setSelected({});
    setHasScanned(false); // IMPORTANT

    const chain = CHAINS[selectedChain];

    const response = await fetch(
      `https://api.covalenthq.com/v1/${chain.covalentName}/approvals/${address}/`,
      { headers: { Authorization: `Bearer ${API_KEY}` } }
    );

    if (!response.ok) {
      throw new Error("Invalid wallet or API error");
    }

    const json = await response.json();

    // 🔥 CRITICAL FIX
    if (!json.data || !Array.isArray(json.data.items)) {
      throw new Error("Invalid or empty wallet address");
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
          valueAtRisk: spender.value_at_risk_quote
            ? Number(spender.value_at_risk_quote)
            : 0,
          daysOld: spender.block_signed_at
            ? Math.floor(
                (Date.now() -
                  new Date(spender.block_signed_at).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            : 0,
          risk: normalizeRisk(spender.risk_factor),
        });
      }
    }

    // Only now mark as successfully scanned
    setHasScanned(true);
    setApprovals(flattened);

  } catch (err) {
    console.error(err);
    setError(err.message || "Failed to fetch approvals");
    setHasScanned(false); // 🔥 prevents empty-state message
  } finally {
    setLoading(false);
  }
}

  function normalizeRisk(riskFactor) {
    if (!riskFactor) return "Low";
    if (riskFactor.includes("REVOKING")) return "High";
    if (riskFactor.includes("MEDIUM")) return "Medium";
    return "Low";
  }

  function riskColor(risk) {
    if (risk === "High") return "red";
    if (risk === "Medium") return "orange";
    return "green";
  }

  async function batchRevoke() {
  try {
    if (connectedAddress?.toLowerCase() !== scanAddress?.toLowerCase()) {
      alert("Connect the wallet you're scanning to revoke.");
      return;
    }

    await switchNetwork();

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

      try {
        setProgress({ current: i + 1, total: targets.length });

        const token = new ethers.Contract(
          a.tokenAddress,
          ERC20_ABI,
          signer
        );

        const tx = await token.approve(a.spender, 0);
        await tx.wait();

        // Remove successfully revoked item
        setApprovals((prev) =>
          prev.filter(
            (x) =>
              !(
                x.tokenAddress === a.tokenAddress &&
                x.spender === a.spender
              )
          )
        );

      } catch (txError) {
        console.error("Transaction failed or cancelled:", txError);

        alert("Transaction cancelled. Revoking stopped.");

        break; // 🔥 STOP ENTIRE LOOP
      }
    }

    setSelected({});
  } catch (err) {
    console.error(err);
    alert("Batch revoke failed.");
  } finally {
    setRevoking(false);
    setProgress({ current: 0, total: 0 });
  }
}

  return (
    <div
      style={{
        padding: 20,
        maxWidth: 480,
        margin: "0 auto",
        fontFamily: "sans-serif",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <h2
        style={{
          textAlign: "center",
          marginBottom: 20,
          fontWeight: "bold",
          fontSize: 22,
        }}
      >
        Multi-chain Token Revoker 🔐
      </h2>

      <select
        value={selectedChain}
        onChange={(e) => setSelectedChain(e.target.value)}
        style={{
          width: "100%",
          marginBottom: 12,
          padding: 12,
          borderRadius: 10,
          boxSizing: "border-box",
        }}
      >
        {Object.keys(CHAINS).map((key) => (
          <option key={key} value={key}>
            {CHAINS[key].name}
          </option>
        ))}
      </select>

      {/* MOBILE PERFECT INPUT */}
      <input
        value={scanAddress}
        onChange={(e) => setScanAddress(e.target.value)}
        placeholder="Enter wallet address"
        style={{
          width: "100%",
          padding: "14px 16px",
          borderRadius: 12,
          border: "1px solid #ddd",
          fontSize: 16,
          boxSizing: "border-box",
          outline: "none",
        }}
      />

      <button
        onClick={() => fetchApprovalsForAddress(scanAddress)}
        style={{
          width: "100%",
          marginTop: 12,
          padding: 14,
          borderRadius: 12,
          fontSize: 16,
          boxSizing: "border-box",
        }}
      >
        Scan Wallet
      </button>

      <hr style={{ margin: "24px 0" }} />

      {!connectedAddress ? (
        <button
          onClick={connectWallet}
          style={{
            width: "100%",
            padding: 14,
            borderRadius: 12,
            boxSizing: "border-box",
          }}
        >
          Connect Wallet
        </button>
      ) : (
        <p style={{ wordBreak: "break-all" }}>
          Connected: {connectedAddress}
        </p>
      )}

      {loading && <p>Fetching approvals...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && hasScanned && approvals.length === 0 && (
        <div
          style={{
            marginTop: 20,
            padding: 20,
            borderRadius: 14,
            background: "#f4f4f4",
            textAlign: "center",
          }}
        >
          <h3>No token approvals found 🎉</h3>
          <p>This wallet has no active ERC-20 approvals.</p>
        </div>
      )}

      {connectedAddress?.toLowerCase() ===
        scanAddress?.toLowerCase() &&
        approvals.length > 0 && (
          <button
            onClick={batchRevoke}
            disabled={revoking}
            style={{
              background: "#e50914",
              color: "white",
              marginTop: 20,
              padding: 16,
              width: "100%",
              borderRadius: 14,
              border: "none",
              fontWeight: "bold",
              fontSize: 16,
              boxSizing: "border-box",
            }}
          >
            {revoking
              ? `Revoking ${progress.current}/${progress.total}`
              : "Revoke Selected"}
          </button>
        )}

      {approvals.map((a) => {
        const key = `${a.tokenAddress}-${a.spender}`;

        return (
          <div
            key={key}
            style={{
              border: "1px solid #ddd",
              padding: 18,
              marginTop: 18,
              borderRadius: 18,
              background: "#fafafa",
              boxSizing: "border-box",
            }}
          >
            <input
              type="checkbox"
              checked={!!selected[key]}
              onChange={() =>
                setSelected((s) => ({
                  ...s,
                  [key]: !s[key],
                }))
              }
              style={{ marginBottom: 12 }}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {a.tokenLogo && (
                <img
                  src={a.tokenLogo}
                  alt=""
                  width="40"
                  style={{ borderRadius: "50%" }}
                />
              )}
              <strong style={{ fontSize: 18 }}>
                {a.name} ({a.symbol})
              </strong>
            </div>

            <p style={{ marginTop: 12, wordBreak: "break-all" }}>
              Spender: {a.spenderLabel || a.spender}
            </p>

            <p>
              Allowance: {a.isUnlimited ? "Unlimited 🚨" : a.allowance}
            </p>

            <p>Value at Risk: ${a.valueAtRisk.toFixed(2)}</p>
            <p>Age: {a.daysOld} days</p>

            <p>
              Risk:{" "}
              <span style={{ color: riskColor(a.risk), fontWeight: "bold" }}>
                {a.risk}
              </span>
            </p>
          </div>
        );
      })}
    </div>
  );
}