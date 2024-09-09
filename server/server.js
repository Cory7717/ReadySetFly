// server.js
const express = require('express');
const stripe = require('stripe')('your_stripe_secret_key');  // Replace with your actual secret key
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// Assume amount is calculated based on user selections
const calculateAmount = (userSelection) => {
    // Logic to calculate price based on user's selection
    return userSelection.price * 100;  // Stripe expects the amount in cents
};

// Create the checkout session endpoint
app.post('/create-checkout-session', async (req, res) => {
    const { userSelection } = req.body;  // Expect userSelection from frontend

    try {
        // Calculate amount dynamically
        const amount = calculateAmount(userSelection);

        // Create a checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: 'Your Dynamic Product',
                    },
                    unit_amount: amount,
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: 'https://your-app.com/success',  // Update with your success URL
            cancel_url: 'https://your-app.com/cancel',    // Update with your cancel URL
        });

        // Return session ID to frontend
        res.json({ id: session.id });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
