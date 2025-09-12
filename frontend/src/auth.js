import React, { useState } from "react";
import axios from "axios";

export function Signup({ onSignup }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await axios.post("http://localhost:4000/signup", { email, password, name });
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
      {error && <div style={{ color: "#b91c1c", marginBottom: 8 }}>{error}</div>}
      <button className="btn" type="submit">Sign Up</button>
    </form>
  );
}

export function Signin({ onSignin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSignin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await axios.post("http://localhost:4000/signin", { email, password });
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
      {error && <div style={{ color: "#b91c1c", marginBottom: 8 }}>{error}</div>}
      <button className="btn" type="submit">Sign In</button>
    </form>
  );
}
