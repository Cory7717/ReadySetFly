// const express = require('express');
// const Stripe = require('stripe');
// const cors = require('cors');
// const bodyParser = require('body-parser');
// require('dotenv').config();

// // Initialize Express app
// const app = express();
// const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// // Middleware
// app.use(cors());
// app.use(bodyParser.json());

// // Endpoint to create a Payment Intent
// app.post('/create-payment-intent', async (req, res) => {
//     const { amount, currency } = req.body;

//     try {
//         const paymentIntent = await stripe.paymentIntents.create({
//             amount: amount,
//             currency: currency,
//         });

//         res.status(200).send({
//             clientSecret: paymentIntent.client_secret,
//         });
//     } catch (error) {
//         console.error('Error creating payment intent:', error);
//         res.status(500).send({ error: error.message });
//     }
// });

// // Endpoint to handle webhooks (optional but recommended)
// app.post('/webhook', express.raw({ type: 'application/json' }), (request, response) => {
//     const sig = request.headers['stripe-signature'];

//     let event;

//     try {
//         event = stripe.webhooks.constructEvent(request.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
//     } catch (err) {
//         console.log(`⚠️  Webhook signature verification failed.`, err.message);
//         return response.sendStatus(400);
//     }

//     // Handle the event
//     switch (event.type) {
//         case 'payment_intent.succeeded':
//             const paymentIntent = event.data.object;
//             console.log(`PaymentIntent for ${paymentIntent.amount} was successful!`);
//             // Then define and call a function to handle the event payment_intent.succeeded
//             break;
//         // Other event types can be handled here
//         default:
//             console.log(`Unhandled event type ${event.type}.`);
//     }

//     // Return a 200 response to acknowledge receipt of the event
//     response.send();
// });

// // Start the server
// const port = process.env.PORT || 8080;
// app.listen(port, () => {
//     console.log(`Server is running on port ${port}`);
// });
