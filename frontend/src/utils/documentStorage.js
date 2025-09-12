// Utility to handle document storage with MongoDB backend
import axios from 'axios';

const API_URL = 'http://localhost:4000/api/documents';

export async function uploadDocument(file) {
    const formData = new FormData();
    formData.append('document', file);

    try {
        const token = localStorage.getItem('token');
        const res = await axios.post(`${API_URL}/upload`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
                'Authorization': `Bearer ${token}`
            }
        });
        // Convert the hex hash to bytes32 format by adding 0x prefix
        return '0x' + res.data.hash;
    } catch (error) {
        throw new Error('Document upload failed: ' + (error.response?.data?.error || error.message));
    }
}

export async function getDocument(hash) {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/document/${hash}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            },
            responseType: 'blob'
        });
        return response.data;
    } catch (error) {
        throw new Error('Failed to retrieve document: ' + (error.response?.data?.error || error.message));
    }
}

export async function getUserDocuments() {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/documents`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    } catch (error) {
        throw new Error('Failed to list documents: ' + (error.response?.data?.error || error.message));
    }
}
