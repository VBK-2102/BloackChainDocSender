import React, { useEffect, useMemo, useState } from "react";
import { BrowserProvider, Contract, ethers } from "ethers";
import artifact from "./contracts/DocumentSender.json";
import { sha256Bytes32 } from "./utils/hash";
import { uploadToPinata } from "./utils/ipfs";

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
  const [recipient, setRecipient] = useState("");
  const [file, setFile] = useState(null);
  const [uri, setUri] = useState(""); // optional IPFS/URL
  const [sending, setSending] = useState(false);

  const [inbox, setInbox] = useState([]); // events for current user
  const [allEvents, setAllEvents] = useState([]);

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

  const handleSend = async (e) => {
    e.preventDefault();
    if (!signer) return connect();
    if (!recipient) return alert("Recipient is required");
    if (!file) return alert("Please choose a file");

    try {
      setSending(true);
      // Upload file to IPFS
      let ipfsUrl = uri;
      if (!uri) {
        ipfsUrl = await uploadToPinata(file);
      }
      const hash = await sha256Bytes32(file);
      const tx = await contract.sendDocument(recipient, hash, ipfsUrl || "");
      await tx.wait();
      alert("Document uploaded to IPFS and reference sent on-chain ✅");
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

  // Pick currency label
  let currencyLabel = "ETH";
  if (network?.chainId === 11155111) {
    currencyLabel = "SepoliaETH";
  }

  return (
    <div className="container">
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <h1>📄 Document Sender & Verifier</h1>
        <div>
          {account ? (
            <>
              <span className="badge mono">Connected: {account.slice(0, 6)}…{account.slice(-4)}</span>
              <span className="badge" style={{ marginLeft: 8 }}>
                {balance} {currencyLabel}
              </span>
            </>
          ) : (
            <button className="btn" onClick={connect}>Connect Wallet</button>
          )}
        </div>
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <div className="card" style={{ flex: 1, minWidth: 320 }}>
          <h2>Send Document</h2>
          <form onSubmit={handleSend} className="row">
            <input
              className="input mono"
              placeholder="Recipient address (0x...)"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value.trim())}
            />
            <input id="fileInput" className="input" type="file" onChange={(e) => setFile(e.target.files?.[0])} />
            <input
              className="input"
              placeholder="Optional link (IPFS CID or URL)"
              value={uri}
              onChange={(e) => setUri(e.target.value)}
            />
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn" disabled={sending}>{sending ? "Sending..." : "Send"}</button>
            </div>
          </form>
        </div>

        <div className="card" style={{ flex: 1, minWidth: 320 }}>
          <h2>Inbox</h2>
          {!account && <p><small>Connect your wallet to see documents sent to you.</small></p>}
          {account && inbox.length === 0 && <p><small>No documents yet.</small></p>}
          {account && inbox.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Sender</th>
                  <th>Hash</th>
                  <th>Link</th>
                  <th>Download</th>
                </tr>
              </thead>
              <tbody>
                {inbox.map((it) => (
                  <tr key={it.txHash + it.id}>
                    <td>{new Date(it.timestamp * 1000).toLocaleString()}</td>
                    <td className="mono">{it.sender.slice(0, 6)}…{it.sender.slice(-4)}</td>
                    <td className="mono">{it.hash}</td>
                    <td>{it.uri ? <a href={it.uri} target="_blank" rel="noreferrer">Open</a> : "-"}</td>
                    <td>
                      {it.uri ? (
                        <a href={it.uri} download target="_blank" rel="noreferrer" className="btn secondary">Download</a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <VerifyPanel allEvents={allEvents} />
      <AllActivity allEvents={allEvents} />
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
            {result.uri && <div><small>URI:</small> <a href={result.uri} target="_blank" rel="noreferrer">{result.uri}</a></div>}
            <div><small>Sender:</small> <span className="mono">{result.sender}</span></div>
            <div><small>Recipient:</small> <span className="mono">{result.recipient}</span></div>
            <div><small>Timestamp:</small> {new Date(result.timestamp*1000).toLocaleString()}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function AllActivity({ allEvents }) {
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h2>All Activity</h2>
      {allEvents.length === 0 && <p><small>No activity yet.</small></p>}
      {allEvents.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>When</th>
              <th>Sender</th>
              <th>Recipient</th>
              <th>Hash</th>
              <th>Link</th>
              <th>Tx</th>
            </tr>
          </thead>
          <tbody>
            {allEvents
              .slice()
              .sort((a, b) => b.timestamp - a.timestamp)
              .map((it) => (
                <tr key={it.txHash + it.id}>
                  <td>#{it.id}</td>
                  <td>{new Date(it.timestamp * 1000).toLocaleString()}</td>
                  <td className="mono">{it.sender.slice(0, 6)}…{it.sender.slice(-4)}</td>
                  <td className="mono">{it.recipient.slice(0, 6)}…{it.recipient.slice(-4)}</td>
                  <td className="mono">{it.hash}</td>
                  <td>{it.uri ? <a href={it.uri} target="_blank" rel="noreferrer">Open</a> : "-"}</td>
                  <td className="mono">{it.txHash.slice(0, 10)}…</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default App;
