// Utility to upload files to Pinata IPFS
// Usage: import { uploadToPinata } from './ipfs';
import axios from 'axios';

const PINATA_API_KEY = "8b2a29be79871fd3da04";
const PINATA_API_SECRET = "2b19a72f5fecba4632f9db95d0b8f5620344335f0b99281a019f2c99e6811fcf";

export async function uploadToPinata(file) {
  const url = "https://api.pinata.cloud/pinning/pinFileToIPFS";
  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await axios.post(url, formData, {
      maxContentLength: Infinity,
      headers: {
        'Content-Type': 'multipart/form-data',
        pinata_api_key: PINATA_API_KEY,
        pinata_secret_api_key: PINATA_API_SECRET,
      },
    });
    // Returns the IPFS gateway URL
    const cid = res.data.IpfsHash;
    return `https://gateway.pinata.cloud/ipfs/${cid}`;
  } catch (e) {
    throw new Error('Pinata upload failed: ' + (e.response?.data?.error || e.message));
  }
}
