import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { CardField, useConfirmPayment } from '@stripe/stripe-react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { db } from '../../firebaseConfig'; // Make sure to include Firebase if needed for backend integration

const PaymentScreen = ({ route }) => {
  const { totalAmount, description, aircraftId, renterId } = route.params; // Parameters to pass totalAmount, description, etc.
  const [loading, setLoading] = useState(false);
  const { confirmPayment } = useConfirmPayment();
  const stripe = useStripe();

  const handlePayment = async () => {
    try {
      setLoading(true);

      // Fetch payment intent client secret from your server
      const response = await fetch('pk_live_51PoTvh00cx1Ta1YEkbOV5Nh5cZhtiJbKT5ZYPfev3jVFJOJwSn6ep3BZMqGbZbXazgsW5WEw5Gkqh2OrG2vn6tvo00llA3yt0P', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: totalAmount, // Send totalAmount in cents to your server
        }),
      });

      const { clientSecret } = await response.json();

      if (!clientSecret) {
        Alert.alert('Error', 'Unable to process payment');
        setLoading(false);
        return;
      }

      // Confirm the payment with Stripe using the client secret
      const { paymentIntent, error } = await confirmPayment(clientSecret, {
        type: 'Card',
        billingDetails: {
          name: 'Renter Name', // Optional - you can get this from the user context if available
        },
      });

      if (error) {
        Alert.alert('Payment failed', error.message);
      } else if (paymentIntent && paymentIntent.status === 'Succeeded') {
        Alert.alert('Payment successful', 'Your payment has been processed.');

        // Save payment details in Firebase or backend (optional)
        // await savePaymentDetailsToFirebase(paymentIntent.id);
      }
    } catch (error) {
      console.error('Payment Error:', error);
      Alert.alert('Error', 'Payment processing failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
      <Text style={{ fontSize: 18, marginBottom: 20 }}>Payment for {description}</Text>

      {/* Stripe CardField component to enter card details */}
      <CardField
        postalCodeEnabled={true}
        placeholders={{ number: '4242 4242 4242 4242' }}
        cardStyle={{
          backgroundColor: '#FFFFFF',
          textColor: '#000000',
        }}
        style={{
          width: '100%',
          height: 50,
          marginVertical: 30,
        }}
        onCardChange={(cardDetails) => {
          console.log('Card details', cardDetails);
        }}
      />

      {/* Button to trigger payment */}
      <TouchableOpacity
        onPress={handlePayment}
        disabled={loading}
        style={{
          backgroundColor: loading ? '#d3d3d3' : '#FF5A5F',
          padding: 15,
          borderRadius: 5,
          alignItems: 'center',
        }}
      >
        {loading ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white' }}>Pay ${totalAmount / 100}</Text>}
      </TouchableOpacity>
    </View>
  );
};

export default PaymentScreen;
