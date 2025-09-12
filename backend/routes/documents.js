const express = require('express');
const router = express.Router();
const fileUpload = require('express-fileupload');
const Document = require('../models/Document');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Middleware
router.use(fileUpload());

// Middleware to verify JWT token
const authMiddleware = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    
    try {
        const decoded = jwt.verify(token, 'SECRET');
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Upload document
router.post('/upload', authMiddleware, async (req, res) => {
    try {
        if (!req.files || !req.files.document) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const file = req.files.document;
        const fileBuffer = file.data;
        
        // Calculate file hash
        const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        // Create new document in MongoDB
        const document = new Document({
            fileName: file.name,
            fileData: fileBuffer,
            mimeType: file.mimetype,
            hash: hash,
            uploadedBy: req.user.email
        });

        await document.save();

        res.json({
            message: 'Document uploaded successfully',
            documentId: document._id,
            hash: hash
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Error uploading document' });
    }
});

// Get document by hash
router.get('/document/:hash', authMiddleware, async (req, res) => {
    try {
        const document = await Document.findOne({ hash: req.params.hash });
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        res.set({
            'Content-Type': document.mimeType,
            'Content-Disposition': `attachment; filename="${document.fileName}"`
        });
        res.send(document.fileData);
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Error retrieving document' });
    }
});

// Get user's documents
router.get('/documents', authMiddleware, async (req, res) => {
    try {
        const documents = await Document.find({ uploadedBy: req.user.email })
            .select('fileName hash uploadedAt -_id');
        res.json(documents);
    } catch (error) {
        console.error('List documents error:', error);
        res.status(500).json({ error: 'Error listing documents' });
    }
});

module.exports = router;
