import React, { useState } from "react";
import axios from "axios";

export function Signup({ onSignup }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [wallet, setWallet] = useState("");
  const [error, setError] = useState("");

  const handleConnectWallet = async () => {
    if (window.ethereum) {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setWallet(accounts[0]);
    } else {
      setError("Please install MetaMask");
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    if (!wallet) return setError("Connect your wallet first");
    try {
      await axios.post("http://localhost:4000/signup", { email, password, name, wallet });
      onSignup();
    } catch (err) {
      setError(err.response?.data?.error || "Signup failed");
    }
  };

  return (
    <form onSubmit={handleSignup} className="card" style={{ maxWidth: 340, margin: "24px auto" }}>
      <h2>Sign Up</h2>
      <input className="input" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
      <input className="input" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input className="input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
      <div className="row" style={{ alignItems: "center", margin: "8px 0" }}>
        <button type="button" className="btn secondary" onClick={handleConnectWallet} style={{ marginRight: 8 }}>Connect Wallet</button>
        {wallet && <span className="badge mono">{wallet.slice(0, 6)}…{wallet.slice(-4)}</span>}
      </div>
      {error && <div style={{ color: "#b91c1c", marginBottom: 8 }}>{error}</div>}
      <button className="btn" type="submit">Sign Up</button>
    </form>
  );
}

export function Signin({ onSignin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [wallet, setWallet] = useState("");
  const [error, setError] = useState("");

  const handleConnectWallet = async () => {
    if (window.ethereum) {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setWallet(accounts[0]);
    } else {
      setError("Please install MetaMask");
    }
  };

  const handleSignin = async (e) => {
    e.preventDefault();
    setError("");
    if (!wallet) return setError("Connect your wallet first");
    try {
      const res = await axios.post("http://localhost:4000/signin", { email, password, wallet });
      localStorage.setItem("token", res.data.token);
      onSignin(res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || "Signin failed");
    }
  };

  return (
    <form onSubmit={handleSignin} className="card" style={{ maxWidth: 340, margin: "24px auto" }}>
      <h2>Sign In</h2>
      <input className="input" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input className="input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
      <div className="row" style={{ alignItems: "center", margin: "8px 0" }}>
        <button type="button" className="btn secondary" onClick={handleConnectWallet} style={{ marginRight: 8 }}>Connect Wallet</button>
        {wallet && <span className="badge mono">{wallet.slice(0, 6)}…{wallet.slice(-4)}</span>}
      </div>
      {error && <div style={{ color: "#b91c1c", marginBottom: 8 }}>{error}</div>}
      <button className="btn" type="submit">Sign In</button>
    </form>
  );
}
