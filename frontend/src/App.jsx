import React, { useEffect, useMemo, useState } from "react";
import { Signup, Signin } from "./auth.jsx";
import { BrowserProvider, Contract, ethers } from "ethers";
import artifact from "./contracts/DocumentSender.json";
import { sha256Bytes32 } from "./utils/hash";
import { uploadDocument, getDocument } from "./utils/documentStorage";

function useWeb3() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState("");
  const [network, setNetwork] = useState(null);
  const [balance, setBalance] = useState("");

  useEffect(() => {
    const init = async () => {
      if (!window.ethereum) return;
      const p = new BrowserProvider(window.ethereum);
      const n = await p.getNetwork();
      setNetwork(n);
      setProvider(p);

      // Auto-connect if permissions exist
      const accs = await window.ethereum.request({ method: "eth_accounts" });
      if (accs.length) {
        const s = await p.getSigner();
        setSigner(s);
        const addr = accs[0];
        setAccount(addr);

        const bal = await p.getBalance(addr);
        setBalance(ethers.formatEther(bal));
      }

      window.ethereum.on("accountsChanged", async (accs) => {
        if (accs.length) {
          const s = await p.getSigner();
          setSigner(s);
          const addr = accs[0];
          setAccount(addr);
          const bal = await p.getBalance(addr);
          setBalance(ethers.formatEther(bal));
        } else {
          setSigner(null);
          setAccount("");
          setBalance("");
        }
      });
    };
    init();
  }, []);

  const connect = async () => {
    if (!window.ethereum) return alert("Please install MetaMask.");
    const p = new BrowserProvider(window.ethereum);
    await p.send("eth_requestAccounts", []);
    const s = await p.getSigner();
    const acc = await s.getAddress();
    const n = await p.getNetwork();
    const bal = await p.getBalance(acc);
    setProvider(p);
    setSigner(s);
    setAccount(acc);
    setNetwork(n);
    setBalance(ethers.formatEther(bal));
  };

  return { provider, signer, account, connect, network, balance };
}

function App() {
  const { provider, signer, account, connect, network, balance } = useWeb3();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [recipient, setRecipient] = useState("");
  const [file, setFile] = useState(null);
  const [uri, setUri] = useState("");
  const [sending, setSending] = useState(false);
  const [inbox, setInbox] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [user, setUser] = useState(null);
  const [showSignup, setShowSignup] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    setSearchResults([]);
    setSelectedUser(null);
    if (!searchTerm) return;
    try {
      const res = await fetch(`http://localhost:4000/users?query=${encodeURIComponent(searchTerm)}`);
      const users = await res.json();
      setSearchResults(users);
    } catch {
      setSearchResults([]);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!signer) return connect();
    if (!recipient) return alert("Recipient is required");
    if (!file) return alert("Please choose a file");

    try {
      setSending(true);
      // Upload file to MongoDB and get hash
      const hashString = await uploadDocument(file);
      // Convert the hex string to bytes32 for the smart contract
      const hash = ethers.zeroPadValue(hashString, 32);
      const tx = await contract.sendDocument(recipient, hash, "");
      await tx.wait();
      alert("Document uploaded and reference sent on-chain ✅");
      setFile(null);
      setUri("");
      (document.getElementById("fileInput") || {}).value = "";
    } catch (e) {
      console.error(e);
      alert(e?.reason || e?.shortMessage || e.message);
    } finally {
      setSending(false);
    }
  };

  const contract = useMemo(() => {
    if (!provider || !artifact.address || !artifact.abi?.length) return null;
    return new Contract(artifact.address, artifact.abi, signer || provider);
  }, [provider, signer]);

  // Load events
  useEffect(() => {
    if (!contract) return;

    let unsub;
    (async () => {
      try {
        const filter = contract.filters.DocumentSent();
        const logs = await contract.queryFilter(filter, 0, "latest");
        const items = logs.map((l) => ({
          id: Number(l.args.id),
          sender: l.args.sender,
          recipient: l.args.recipient,
          hash: l.args.hash,
          uri: l.args.uri,
          timestamp: Number(l.args.timestamp),
          txHash: l.transactionHash,
        }));
        setAllEvents(items);
        if (account) {
          setInbox(items.filter((it) => it.recipient.toLowerCase() === account.toLowerCase()));
        }

        unsub = contract.on(filter, (id, sender, recipient, hash, uri, timestamp, ev) => {
          const item = {
            id: Number(id),
            sender,
            recipient,
            hash,
            uri,
            timestamp: Number(timestamp),
            txHash: ev.log.transactionHash,
          };
          setAllEvents((prev) => [item, ...prev]);
          if (account && recipient.toLowerCase() === account.toLowerCase()) {
            setInbox((prev) => [item, ...prev]);
          }
        });
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      if (unsub && contract.off) {
        contract.off(contract.filters.DocumentSent(), unsub);
      }
    };
  }, [contract, account]);

  // Pick currency label
  let currencyLabel = "ETH";
  if (network?.chainId === 11155111) {
    currencyLabel = "SepoliaETH";
  }

  if (!user) {
    return (
      <div className="container">
        <div className="card" style={{ maxWidth: "400px", margin: "0 auto" }}>
          {showSignup ? (
            <Signup onSignup={() => setShowSignup(false)} />
          ) : (
            <Signin onSignin={u => setUser(u)} />
          )}
          <div style={{ textAlign: "center", marginTop: "1rem" }}>
            {showSignup ? (
              <button className="btn secondary" onClick={() => setShowSignup(false)}>Already have an account? Sign In</button>
            ) : (
              <button className="btn secondary" onClick={() => setShowSignup(true)}>New user? Sign Up</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Header */}
      <div className="card" style={{ marginBottom: "2rem" }}>
        <div className="row" style={{ alignItems: "center", justifyContent: "space-between", margin: 0 }}>
          <h1 style={{ margin: 0 }}>📄 Document Sender & Verifier</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {account ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span className="badge mono">Connected: {account.slice(0, 6)}…{account.slice(-4)}</span>
                  <span className="badge">{balance} {currencyLabel}</span>
                  <span className="badge" style={{ background: '#e0e7ff', color: '#3730a3' }}>
                    {user.name || user.email}
                  </span>
                </div>
                <button className="btn secondary" onClick={() => { setUser(null); localStorage.removeItem("token"); }}>
                  Sign Out
                </button>
              </>
            ) : (
              <button className="btn" onClick={connect}>Connect Wallet</button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="dashboard-grid">
        {/* Send Document Section */}
        <div className="card">
          <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
            <span style={{ fontSize: "1.5rem" }}>📤</span>
            Send Document
          </h2>
          <form onSubmit={handleSend}>
            <div className="row" style={{ margin: 0 }}>
              <input
                className="input mono"
                placeholder="Recipient address (0x...)"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value.trim())}
                disabled={!!selectedUser}
              />
            </div>
            <div className="row" style={{ margin: "1rem 0" }}>
              <input 
                id="fileInput" 
                className="input" 
                type="file" 
                onChange={(e) => setFile(e.target.files?.[0])}
                style={{ 
                  border: "2px dashed #cbd5e1",
                  background: "rgba(255,255,255,0.5)",
                  cursor: "pointer",
                  padding: "2rem",
                  textAlign: "center"
                }}
              />
            </div>
            <div className="row" style={{ margin: "0 0 1rem 0" }}>

            </div>
            <div className="row" style={{ justifyContent: "flex-end", margin: 0 }}>
              <button className="btn" disabled={sending}>
                {sending ? (
                  <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ opacity: 0.7 }}>Sending...</span>
                    <span className="spinner">⌛</span>
                  </span>
                ) : (
                  "Send Document"
                )}
              </button>
            </div>
          </form>
        </div>

        {/* User Search Section */}
        <div className="card">
          <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
            <span style={{ fontSize: "1.5rem" }}>🔍</span>
            Find User
          </h2>
          <form onSubmit={handleSearch} className="row" style={{ margin: 0 }}>
            <input 
              className="input" 
              placeholder="Search by email or name" 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              style={{ flex: 1 }} 
            />
            <button className="btn" type="submit">Search</button>
          </form>
          {searchResults.length > 0 && (
            <div style={{ marginTop: "1rem" }}>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {searchResults.map(u => (
                  <li key={u._id || u.email} style={{ marginBottom: "0.5rem" }}>
                    <button
                      className="btn secondary"
                      style={{ width: "100%", textAlign: "left" }}
                      onClick={() => {
                        setSelectedUser(u);
                        setRecipient(u.wallet || "");
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>{u.name || u.email}</span>
                        <span className="badge" style={{ margin: 0 }}>
                          {u.wallet
                            ? `${u.wallet.slice(0, 6)}…${u.wallet.slice(-4)}`
                            : "no wallet"}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {selectedUser && (
            <div style={{ marginTop: "1rem", padding: "0.75rem", background: "rgba(37,99,235,0.1)", borderRadius: "0.5rem" }}>
              <div style={{ fontWeight: 500 }}>Selected User:</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
                <span>{selectedUser.name || selectedUser.email}</span>
                <span className="badge">
                  {selectedUser.wallet ? `${selectedUser.wallet.slice(0, 6)}…${selectedUser.wallet.slice(-4)}` : "no wallet"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inbox Section */}
      <div className="card" style={{ marginTop: "2rem" }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <span style={{ fontSize: "1.5rem" }}>📥</span>
          Inbox
        </h2>
        {!account && <p><small>Connect your wallet to see documents sent to you.</small></p>}
        {account && inbox.length === 0 && <p><small>No documents yet.</small></p>}
        {account && inbox.length > 0 && (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>WHEN</th>
                  <th>SENDER</th>
                  <th>HASH</th>
                  <th>LINK</th>
                  <th>DOWNLOAD</th>
                </tr>
              </thead>
              <tbody>
                {inbox.map((it) => (
                  <tr key={it.txHash + it.id}>
                    <td>{new Date(it.timestamp * 1000).toLocaleString()}</td>
                    <td className="mono">{it.sender.slice(0, 6)}…{it.sender.slice(-4)}</td>
                    <td className="mono">{it.hash.slice(0, 10)}...</td>
                    <td>
                      <button
                        onClick={async () => {
                          try {
                            const blob = await getDocument(it.hash);
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `document-${it.id}`;
                            document.body.appendChild(a);
                            a.click();
                            window.URL.revokeObjectURL(url);
                            document.body.removeChild(a);
                          } catch (error) {
                            console.error('Download failed:', error);
                            alert('Failed to download document: ' + error.message);
                          }
                        }}
                        className="btn secondary"
                        style={{ padding: "4px 8px", fontSize: "0.875rem" }}
                      >
                        Download
                      </button>
                    </td>
                    <td>
                      <button className="btn" style={{ padding: "4px 8px", fontSize: "0.875rem" }}>
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Additional Panels */}
      <div className="dashboard-grid" style={{ marginTop: "2rem" }}>
        <VerifyPanel allEvents={allEvents} />
      </div>
    </div>
  );
}

function VerifyPanel({ allEvents }) {
  const [selectedId, setSelectedId] = useState("");
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);

  const byId = useMemo(() => {
    const m = new Map();
    for (const it of allEvents) m.set(String(it.id), it);
    return m;
  }, [allEvents]);

  const verify = async () => {
    if (!selectedId) return alert("Select a document id");
    if (!file) return alert("Choose the original file to verify");

    const ev = byId.get(String(selectedId));
    if (!ev) return alert("Unknown id");
    const localHash = await sha256Bytes32(file);
    const ok = localHash.toLowerCase() === ev.hash.toLowerCase();
    setResult({ ok, expected: ev.hash, actual: localHash, uri: ev.uri, sender: ev.sender, recipient: ev.recipient, timestamp: ev.timestamp });
  };

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h2>Verify a Document</h2>
      <div className="row">
        <select className="input" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          <option value="">Select a Document ID</option>
          {allEvents
            .slice()
            .sort((a, b) => b.timestamp - a.timestamp)
            .map((it) => (
              <option key={it.txHash + it.id} value={String(it.id)}>
                #{it.id} → {it.recipient.slice(0, 6)}…{it.recipient.slice(-4)} ({new Date(it.timestamp*1000).toLocaleString()})
              </option>
            ))}
        </select>

        <input className="input" type="file" onChange={(e) => setFile(e.target.files?.[0])} />
        <button className="btn secondary" onClick={verify}>Verify</button>
      </div>

      {result && (
        <div style={{ marginTop: 10 }}>
          <div className="badge" style={{ background: result.ok ? "#dcfce7" : "#fee2e2", color: result.ok ? "#166534" : "#991b1b" }}>
            {result.ok ? "MATCH ✅" : "NO MATCH ❌"}
          </div>
          <div style={{ marginTop: 6 }}>
            <div><small>Expected:</small> <span className="mono">{result.expected}</span></div>
            <div><small>Your file hash:</small> <span className="mono">{result.actual}</span></div>
            <div>
              <small>Actions:</small>
              <button
                onClick={async () => {
                  try {
                    const blob = await getDocument(result.hash);
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `document-${result.id}`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                  } catch (error) {
                    console.error('Download failed:', error);
                    alert('Failed to download document: ' + error.message);
                  }
                }}
                className="btn secondary"
                style={{ padding: "4px 8px", fontSize: "0.875rem", marginLeft: "8px" }}
              >
                Download Original
              </button>
            </div>
            <div><small>Sender:</small> <span className="mono">{result.sender}</span></div>
            <div><small>Recipient:</small> <span className="mono">{result.recipient}</span></div>
            <div><small>Timestamp:</small> {new Date(result.timestamp*1000).toLocaleString()}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
