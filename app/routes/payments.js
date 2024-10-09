import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';
import { useEffect, useState } from 'react';
import { View, Button, Alert } from 'react-native';
import { getAuth } from 'firebase/auth'; // Firebase Auth

const API_URL = 'https://your-api-url.com'; // Replace with your API URL

export default function Payments() {
  const [paymentSheetEnabled, setPaymentSheetEnabled] = useState(false);
  const auth = getAuth(); // Initialize Firebase Auth
  const user = auth.currentUser; // Get the current user

  const fetchPaymentSheetParams = async () => {
    if (!user) {
      Alert.alert('Error', 'You need to be logged in to make a payment.');
      return;
    }

    const response = await fetch(`${API_URL}/payment-sheet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: 1000, // example amount in cents
        userId: user.uid, // Send the user's ID to your backend for tracking the payment
      }),
    });

    const { paymentIntent, ephemeralKey, customer } = await response.json();

    return {
      paymentIntent,
      ephemeralKey,
      customer,
    };
  };

  const initializePaymentSheet = async () => {
    const { paymentIntent, ephemeralKey, customer } = await fetchPaymentSheetParams();

    if (paymentIntent && ephemeralKey && customer) {
      const { error } = await initPaymentSheet({
        customerId: customer,
        customerEphemeralKeySecret: ephemeralKey,
        paymentIntentClientSecret: paymentIntent,
      });

      if (!error) {
        setPaymentSheetEnabled(true);
      } else {
        console.error('Error initializing payment sheet:', error);
      }
    }
  };

  const openPaymentSheet = async () => {
    const { error } = await presentPaymentSheet();

    if (error) {
      Alert.alert(`Error code: ${error.code}`, error.message);
    } else {
      Alert.alert('Success', 'Your order is confirmed!');
    }
  };

  useEffect(() => {
    initializePaymentSheet();
  }, []);

  return (
    <View>
      <Button
        disabled={!paymentSheetEnabled}
        title="Checkout"
        onPress={openPaymentSheet}
      />
    </View>
  );
}
