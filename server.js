const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// Read credentials from environment variables (set in Railway)
const PAYNECTA_API_KEY = process.env.PAYNECTA_API_KEY;
const PAYNECTA_EMAIL = process.env.PAYNECTA_EMAIL;
const PAYNECTA_BASE = "https://paynecta.co.ke/api/v1";

// Health check
app.get('/', (req, res) => {
    res.json({ status: 'active', service: 'EduMark AI Paynecta Backend' });
});

// Initiate STK Push payment
app.post('/api/pay', async (req, res) => {
    const { amount, phone, description, userId, itemType } = req.body;

    // Validate amount based on item type
    const validAmounts = { exam: 20, quiz: 10, weekly: 100, notes: 30, report: 50 };
    if (validAmounts[itemType] && amount !== validAmounts[itemType]) {
        return res.status(400).json({ error: `Invalid amount for ${itemType}. Expected KSh ${validAmounts[itemType]}` });
    }

    // Format phone number for Paynecta (expects +254XXXXXXXXX)
    let formattedPhone = phone.replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) formattedPhone = '254' + formattedPhone.substring(1);
    if (!formattedPhone.startsWith('254')) formattedPhone = '254' + formattedPhone;
    formattedPhone = '+' + formattedPhone;

    try {
        // Verify auth (optional)
        await axios.get(`${PAYNECTA_BASE}/auth/verify`, {
            headers: {
                'X-API-Key': PAYNECTA_API_KEY,
                'X-User-Email': PAYNECTA_EMAIL
            }
        });

        // Initiate STK Push
        const stkRes = await axios.post(`${PAYNECTA_BASE}/stkpush/initiate`, {
            amount: amount,
            phone_number: formattedPhone,
            reference: `EDU_${itemType}_${userId}_${Date.now()}`,
            description: description || `${itemType.toUpperCase()} purchase`
        }, {
            headers: {
                'X-API-Key': PAYNECTA_API_KEY,
                'X-User-Email': PAYNECTA_EMAIL,
                'Content-Type': 'application/json'
            }
        });

        res.json({
            success: true,
            checkoutRequestID: stkRes.data.checkout_request_id || stkRes.data.id,
            message: 'STK Push sent to your phone'
        });

    } catch (error) {
        console.error('Paynecta error:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: error.response?.data?.message || error.message
        });
    }
});

// Webhook for payment confirmation (optional)
app.post('/api/webhook/paynecta', (req, res) => {
    console.log('Webhook received:', req.body);
    // Update Firebase here
    res.json({ received: true });
});

// Status check (frontend polling)
app.post('/api/status', (req, res) => {
    // For demo, always return completed
    // In production, query Paynecta for actual status
    res.json({ status: 'completed' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ EduMark Paynecta backend running on port ${PORT}`);
});
