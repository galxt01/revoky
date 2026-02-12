# Multi-Chain Token Revoker 🔐

A lightweight, mobile-friendly Web3 application that allows users to scan and revoke ERC-20 token approvals across multiple EVM chains.

This tool helps users reduce wallet risk by identifying unlimited token approvals and revoking them in batch.

---

## 🌐 Supported Networks

- Ethereum Mainnet  
- Base  
- Binance Smart Chain (BSC)  
- Arbitrum  
- Optimism  
- Polygon  

Powered by the Covalent API for approvals indexing.

---

## 🚀 Features

- 🔎 Scan any wallet address for ERC-20 approvals  
- 🔗 Multi-chain support  
- 🔐 Batch revoke approvals  
- 🚨 Detect unlimited allowances  
- 💰 Show value at risk (USD)  
- 📅 Show approval age  
- 🎨 Risk indicator (Low / Medium / High)  
- 📱 Fully mobile responsive  
- 🛑 Stops revoking if transaction is cancelled  

---

## 🛠 Tech Stack

- React (Vite)
- ethers.js (v6)
- Covalent API
- MetaMask / Injected Web3 Wallet

---

## 📦 Installation & Setup

### 1️⃣ Clone the repository

```bash
git clone https://github.com/yourusername/multi-chain-token-revoker.git
cd multi-chain-token-revoker
```

### 2️⃣ Install dependencies

```bash
npm install
```

This installs all required packages including React, Vite, and ethers.js.

### 3️⃣ Create environment file

Create a `.env` file in the root directory:

```env
VITE_COVALENT_KEY=your_covalent_api_key_here
```

You can get your API key from:

https://www.covalenthq.com/

⚠️ Important:
- The variable must start with `VITE_`
- Restart the dev server after adding the key

### 4️⃣ Run development server

```bash
npm run dev
```
The app will start at:

```
http://localhost:5173
```

Open this URL in your browser.

---