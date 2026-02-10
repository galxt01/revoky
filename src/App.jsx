import { useState, useEffect } from "react";
import * as ethers from "ethers";

/* -------------------- */
/* CONSTANTS & ABI     */
/* -------------------- */

const ERC20_ABI = [
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

const MAX_UINT =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

/* -------------------- */
/* APP                 */
/* -------------------- */

export default function App() {
  const [connectedAddress, setConnectedAddress] = useState(null);
  const [scanAddress, setScanAddress] = useState("");
  const [activeAddress, setActiveAddress] = useState(null);
  const [lastFetchedAddress, setLastFetchedAddress] = useState(null);

  const [approvals, setApprovals] = useState([]);
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState("");

  /* -------------------- */
  /* CONNECT WALLET      */
  /* -------------------- */

  async function connectWallet() {
    if (!window.ethereum) {
      alert("Open this app in the MetaMask browser");
      return;
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    const addr = accounts[0];

    setConnectedAddress(addr);
    setScanAddress(addr);
    setActiveAddress(addr);

    // ❗ Do NOT reset if already fetched for same address
    if (addr.toLowerCase() !== lastFetchedAddress?.toLowerCase()) {
      resetState();
    }
  }

  /* -------------------- */
  /* SCAN INPUT ADDRESS  */
  /* -------------------- */

  function scanInputAddress() {
    try {
      const checksummed = ethers.getAddress(scanAddress.trim());
      setActiveAddress(checksummed);

      if (
        checksummed.toLowerCase() !==
        lastFetchedAddress?.toLowerCase()
      ) {
        resetState();
      }
    } catch {
      alert("Invalid wallet address");
    }
  }

  function resetState() {
    setApprovals([]);
    setSelected({});
    setError("");
  }

  /* -------------------- */
  /* AUTO-FETCH EFFECT   */
  /* -------------------- */

  useEffect(() => {
    if (
      activeAddress &&
      activeAddress.toLowerCase() !==
        lastFetchedAddress?.toLowerCase()
    ) {
      fetchApprovals(activeAddress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAddress]);

  /* -------------------- */
  /* FETCH APPROVALS     */
  /* -------------------- */

  async function fetchApprovals(addressToScan) {
    try {
      setLoading(true);
      setError("");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const approvalTopic = ethers.id(
        "Approval(address,address,uint256)"
      );

      const logs = await provider.getLogs({
        fromBlock: 0,
        toBlock: "latest",
        topics: [
          approvalTopic,
          ethers.zeroPadValue(addressToScan, 32),
        ],
      });

      const iface = new ethers.Interface(ERC20_ABI);
      const map = new Map();

      for (const log of logs) {
        const parsed = iface.parseLog(log);
        map.set(`${log.address}-${parsed.args.spender}`, {
          token: log.address,
          spender: parsed.args.spender,
          allowance: parsed.args.value.toString(),
        });
      }

      const result = [];

      for (const a of map.values()) {
        const token = new ethers.Contract(
          a.token,
          ERC20_ABI,
          provider
        );

        const name = await token.name().catch(() => "Unknown Token");
        const symbol = await token.symbol().catch(() => "");
        const decimals = await token.decimals().catch(() => 18);

        const isUnlimited = a.allowance === MAX_UINT;
        const formatted = isUnlimited
          ? "Unlimited"
          : ethers.formatUnits(a.allowance, decimals);

        if (!isUnlimited && Number(formatted) === 0) continue;

        result.push({
          ...a,
          name,
          symbol,
          isUnlimited,
          formatted,
        });
      }

      result.sort((a, b) => b.isUnlimited - a.isUnlimited);

      setApprovals(result);
      setLastFetchedAddress(addressToScan);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch approvals");
    } finally {
      setLoading(false);
    }
  }

  /* -------------------- */
  /* BATCH REVOKE        */
  /* -------------------- */

  async function batchRevoke() {
    if (
      connectedAddress?.toLowerCase() !==
      activeAddress?.toLowerCase()
    ) {
      alert("You can only revoke approvals for your own wallet");
      return;
    }

    const targets = approvals.filter(
      (a) => selected[`${a.token}-${a.spender}`]
    );

    if (targets.length === 0) {
      alert("No approvals selected");
      return;
    }

    try {
      setRevoking(true);
      setProgress({ current: 0, total: targets.length });

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      for (let i = 0; i < targets.length; i++) {
        const a = targets[i];
        setProgress({ current: i + 1, total: targets.length });

        const token = new ethers.Contract(
          a.token,
          ERC20_ABI,
          signer
        );

        const tx = await token.approve(a.spender, 0);
        await tx.wait();

        setApprovals((prev) =>
          prev.filter(
            (x) =>
              !(
                x.token === a.token &&
                x.spender === a.spender
              )
          )
        );
      }

      setSelected({});
    } catch {
      alert("Batch revoke interrupted or rejected");
    } finally {
      setRevoking(false);
      setProgress({ current: 0, total: 0 });
    }
  }

  /* -------------------- */
  /* UI                  */
  /* -------------------- */

  return (
    <div
      style={{
        height: "100dvh",
        width: "100vw",
        padding: 20,
        boxSizing: "border-box",
        fontFamily: "sans-serif",
      }}
    >
      <h2>Wallet Approval Tracker</h2>

      <input
        type="text"
        placeholder="Enter wallet address to scan"
        value={scanAddress}
        onChange={(e) => setScanAddress(e.target.value)}
        style={{ width: "100%", padding: 8 }}
      />
      <button onClick={scanInputAddress}>
        Scan Address
      </button>

      <hr />

      {!connectedAddress ? (
        <button onClick={connectWallet}>
          Connect Wallet(Manage)
        </button>
      ) : (
        <p>
          Connected wallet:
          <br />
          <strong>{connectedAddress}</strong>
        </p>
      )}

      {activeAddress && (
        <p>
          Viewing approvals for:
          <br />
          <strong>{activeAddress}</strong>
        </p>
      )}

      {loading && <p>Scanning blockchain…</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {revoking && (
        <p style={{ color: "orange" }}>
          Revoking {progress.current} / {progress.total}
        </p>
      )}

      {connectedAddress?.toLowerCase() ===
        activeAddress?.toLowerCase() &&
        approvals.length > 0 && (
          <button
            onClick={batchRevoke}
            disabled={revoking}
            style={{
              background: "crimson",
              color: "white",
              marginTop: 10,
              padding: "8px 14px",
              border: "none",
              borderRadius: 4,
            }}
          >
            {revoking ? "Revoking…" : "Revoke Selected"}
          </button>
        )}

      <div style={{ marginTop: 20 }}>
        {approvals.map((a, i) => {
          const key = `${a.token}-${a.spender}`;

          return (
            <div
              key={i}
              style={{
                marginBottom: 14,
                padding: 12,
                border: "1px solid #ccc",
                borderRadius: 6,
              }}
            >
              {connectedAddress?.toLowerCase() ===
                activeAddress?.toLowerCase() && (
                <input
                  type="checkbox"
                  checked={!!selected[key]}
                  onChange={() =>
                    setSelected((s) => ({
                      ...s,
                      [key]: !s[key],
                    }))
                  }
                />
              )}{" "}
              <strong>
                {a.name} {a.symbol && `(${a.symbol})`}
              </strong>

              <p style={{ fontSize: 12 }}>
                Spender: {a.spender}
              </p>

              <p>
                Allowance:{" "}
                {a.isUnlimited ? (
                  <span style={{ color: "red" }}>
                    Unlimited 🚨
                  </span>
                ) : (
                  a.formatted
                )}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}