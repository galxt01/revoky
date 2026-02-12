# 🔐 Ethereum Token Revoker

A mobile-friendly Ethereum Mainnet token approval scanner powered by Covalent API with batch revoke functionality.

This tool allows users to:

- 🔍 Scan any Ethereum wallet for active ERC-20 approvals  
- ⚠️ Detect risky / unlimited approvals  
- 💰 View value at risk (USD)  
- 🧠 Filter by risk level  
- 🔗 Connect wallet  
- ❌ Batch revoke selected approvals  
- 📱 Use seamlessly on mobile  

---

## 🚀 Features

### ✅ Ethereum Mainnet Support
Uses Covalent’s `eth-mainnet` approval endpoint.

### ✅ Scan Any Address
No wallet connection required to scan.

### ✅ Auto-Fetch on Wallet Connect
If you connect your wallet without manually scanning, approvals are fetched automatically.

### ✅ Risk Engine
Approvals are categorized as:
- 🟢 Low
- 🟠 Medium
- 🔴 High

Based on Covalent’s `risk_factor`.

### ✅ Value at Risk
Displays estimated USD value at risk for each approval.

### ✅ Unlimited Approval Detection
Detects `"UNLIMITED"` approvals returned by Covalent.

### ✅ Batch Revoke
Users can:
- Select multiple approvals
- Revoke all in sequence
- Track revoke progress live

### ✅ Empty State Detection
Displays a success message when no approvals are found.

### ✅ Mobile Optimized
- No horizontal overflow
- Safe long address wrapping
- Centered responsive layout

---

# 🛠 Tech Stack

- React (Vite)
- Ethers.js v6
- Covalent API
- Ethereum Mainnet

---

# 📦 Installation

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
```

Install dependencies:

```bash
npm install
```

---

# 🔑 Environment Setup

Create a `.env` file in the root directory:

```
VITE_COVALENT_KEY=your_covalent_api_key_here
```

Important:
- Must start with `VITE_`
- Restart dev server after editing `.env`

---

# ▶️ Run Development Server

```bash
npm run dev
```

Then open:

```
http://localhost:5173
```

---

# 🔗 Covalent API Used

Endpoint:

```
GET /v1/eth-mainnet/approvals/{walletAddress}/
```

Documentation:
https://goldrush.dev/docs/api-reference

---

# ⚠️ Security Notes

- API key is exposed client-side (for development/demo use only).
- For production deployment, use a backend proxy to protect your API key.
- Always verify transactions before confirming revokes in MetaMask.

---

# 🔮 Future Improvements

- 🔥 Revoke All High-Risk Button
- 📊 Dashboard Summary (Total Value at Risk)
- 🌍 Multi-chain selector (Arbitrum, Base, etc.)
- ✂ Address truncation + Copy button
- 🎨 Modern UI styling upgrade
- 🔐 Backend API proxy for production security

---

# 🧠 Why This Tool Matters

Unlimited token approvals are one of the biggest attack vectors in DeFi.

This tool helps users:
- See hidden risks
- Understand exposure
- Revoke unnecessary permissions
- Improve wallet security

---

# 📜 License

MIT License