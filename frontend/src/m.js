import React, { useEffect, useMemo, useState } from "react";
import { BrowserProvider, Contract, formatEther } from "ethers";
import artifact from "./contracts/DocumentSender.json";
import { sha256Bytes32 } from "./utils/hash";

function useWeb3() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState(null);

  useEffect(() => {
    const init = async () => {
      if (!window.ethereum) return;
      const p = new BrowserProvider(window.ethereum);
      const network = await p.getNetwork();
      setChainId(Number(network.chainId));
      setProvider(p);

      // Auto-connect if permissions exist
      const accs = await window.ethereum.request({ method: "eth_accounts" });
      if (accs.length) {
        const s = await p.getSigner();
        setSigner(s);
        setAccount(accs[0]);
      }

      window.ethereum.on("accountsChanged", async (accs) => {
        if (accs.length) {
          const s = await p.getSigner();
          setSigner(s);
          setAccount(accs[0]);
        } else {
          setSigner(null);
          setAccount("");
        }
      });

      window.ethereum.on("chainChanged", () => window.location.reload());
    };
    init();
  }, []);

  const connect = async () => {
    if (!window.ethereum) return alert("Please install MetaMask.");
    const p = new BrowserProvider(window.ethereum);
    await p.send("eth_requestAccounts", []);
    const s = await p.getSigner();
    const acc = await s.getAddress();
    const network = await p.getNetwork();
    setProvider(p);
    setSigner(s);
    setAccount(acc);
    setChainId(Number(network.chainId));
  };

  return { provider, signer, account, chainId, connect };
}

function App() {
  const { provider, signer, account, chainId, connect } = useWeb3();
  const [recipient, setRecipient] = useState("");
  const [file, setFile] = useState(null);
  const [uri, setUri] = useState(""); // optional IPFS/URL
  const [sending, setSending] = useState(false);
  const [balance, setBalance] = useState("0");

  const [inbox, setInbox] = useState([]); // events for current user
  const [allEvents, setAllEvents] = useState([]);

  const contract = useMemo(() => {
    if (!provider || !artifact.address || !artifact.abi?.length) return null;
    return new Contract(artifact.address, artifact.abi, signer || provider);
  }, [provider, signer]);

  // Load user balance whenever account/provider changes
  useEffect(() => {
    if (!provider || !account) return;
    (async () => {
      const bal = await provider.getBalance(account);
      setBalance(formatEther(bal));
    })();
  }, [provider, account]);

  const currencySymbol =
    chainId === 11155111 ? "SepoliaETH" : "ETH";

  // ... your existing event loading & handleSend unchanged ...

  return (
    <div className="container">
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <h1>📄 Document Sender & Verifier (Blockchain)</h1>
        <div>
          {account ? (
            <>
              <span className="badge mono">
                Connected: {account.slice(0, 6)}…{account.slice(-4)}
              </span>
              <span className="badge" style={{ marginLeft: 8 }}>
                Balance: {parseFloat(balance).toFixed(4)} {currencySymbol}
              </span>
            </>
          ) : (
            <button className="btn" onClick={connect}>Connect Wallet</button>
          )}
        </div>
      </div>

      {/* rest of your UI unchanged */}
      {/* ... */}
    </div>
  );
}

export default App;
