const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const documentRoutes = require('./routes/documents');

const app = express();
app.use(express.json());
app.use(cors());
app.use('/api/documents', documentRoutes);

mongoose.connect('mongodb://localhost:27017/docchain', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: String,
  wallet: { type: String, required: true }, // Ethereum address
});

const User = mongoose.model('User', UserSchema);

app.post('/signup', async (req, res) => {
  const { email, password, name, wallet } = req.body;
  const existing = await User.findOne({ email });
  if (existing) return res.status(400).json({ error: 'Email already exists' });
  const hash = await bcrypt.hash(password, 10);
  const user = new User({ email, password: hash, name, wallet });
  await user.save();
  res.json({ message: 'Signup successful' });
});

app.post('/signin', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ error: 'Invalid credentials' });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ userId: user._id, email: user.email }, 'SECRET');
  res.json({ token, user: { email: user.email, name: user.name, wallet: user.wallet } });
});


app.get('/users', async (req, res) => {
  const query = req.query.query;
  if (!query) return res.json([]);
  // Search by email or name (case-insensitive)
  const users = await User.find({
    $or: [
      { email: { $regex: query, $options: 'i' } },
      { name: { $regex: query, $options: 'i' } }
    ]
  }).select('email name wallet');
  res.json(users);
});

app.get('/profile', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, 'SECRET');
    const user = await User.findById(decoded.userId);
  res.json({ email: user.email, name: user.name, wallet: user.wallet });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});
app.listen(4000, () => console.log('Backend running on http://localhost:4000'));
