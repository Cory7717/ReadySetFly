import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { CardField, useConfirmPayment, useStripe } from '@stripe/stripe-react-native';

const PaymentScreen = ({ route }) => {
  const { totalAmount, description } = route.params; // Use route params for payment data
  const [loading, setLoading] = useState(false);
  const { confirmPayment } = useConfirmPayment();

  const handlePayment = async () => {
    try {
      setLoading(true);

      // Fetch payment intent client secret from your server
      const response = await fetch('https://api.stripe.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: totalAmount * 100 }), // Total amount in cents
      });

      const { paymentIntent } = await response.json();
      if (!paymentIntent) {
        Alert.alert('Error', 'Unable to process payment');
        setLoading(false);
        return;
      }

      // Confirm the payment with Stripe using the client secret
      const { error, paymentIntent: confirmedPaymentIntent } = await confirmPayment(paymentIntent, {
        type: 'Card',
        billingDetails: { name: 'Renter' },
      });

      if (error) {
        Alert.alert('Payment failed', error.message);
      } else if (confirmedPaymentIntent.status === 'Succeeded') {
        Alert.alert('Success', 'Payment processed successfully');
      }
    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert('Error', 'Payment processing failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 20, justifyContent: 'center' }}>
      <Text>Payment for {description}</Text>

      {/* Stripe CardField component */}
      <CardField
        postalCodeEnabled={true}
        placeholders={{ number: '4242 4242 4242 4242' }}
        style={{ width: '100%', height: 50, marginVertical: 30 }}
        onCardChange={(cardDetails) => console.log('Card details:', cardDetails)}
      />

      {/* Button to trigger payment */}
      <TouchableOpacity
        onPress={handlePayment}
        disabled={loading}
        style={{ backgroundColor: '#FF5A5F', padding: 15, borderRadius: 5 }}
      >
        {loading ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white' }}>Pay ${totalAmount / 100}</Text>}
      </TouchableOpacity>
    </View>
  );
};

export default PaymentScreen;
