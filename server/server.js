const express = require('express');
const stripe = require('stripe')('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'); // Replace with your actual secret key
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 8081;

app.use(bodyParser.json());

// Endpoint for handling Payment Sheet
app.post('/PaymentScreen', async (req, res) => {
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
      currency: 'usd', // Corrected the currency
      customer: customer.id,
      automatic_payment_methods: { enabled: true },
    });

    // Respond with payment details for the frontend
    res.json({
      paymentIntent: paymentIntent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customer: customer.id,
      publishableKey: 'pk_test_XXXX', // Use your test publishable key
    });
  } catch (error) {
    console.error('Error creating payment sheet:', error);
    res.status(500).json({ error: 'Failed to create payment sheet' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
