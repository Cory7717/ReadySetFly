require('dotenv').config(); // Import dotenv to load environment variables
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // Initialize Stripe with secret key
const bodyParser = require('body-parser');
const cors = require('cors'); 
const app = express();
const PORT = process.env.PORT || 8081;

// Use CORS and Body-parser
app.use(cors()); // Allow all origins (be sure to limit this in production)
app.use(bodyParser.json());

// Endpoint for handling Payment Sheet
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount } = req.body; // Expect cost in cents from frontend

    if (!amount) {
      return res.status(400).json({ error: "Amount is required" });
    }

    // Create a customer
    const customer = await stripe.customers.create();

    // Create an ephemeral key for the customer
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customer.id },
      { apiVersion: '2022-11-15' }
    );

    // Create a PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // Amount in cents from the client
      currency: 'usd',
      customer: customer.id,
      automatic_payment_methods: { enabled: true },
    });

    // Respond with payment details for the frontend
    res.json({
      clientSecret: paymentIntent.client_secret, // Corrected to clientSecret
      ephemeralKey: ephemeralKey.secret,
      customer: customer.id,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY, // Use environment variable
    });
  } catch (error) {
    console.error('Error creating payment sheet:', error);
    res.status(500).json({ error: 'Failed to create payment sheet' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
