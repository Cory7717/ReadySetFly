import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, StyleSheet, Animated, Easing } from 'react-native';
import { CardField, useConfirmPayment, useStripe } from '@stripe/stripe-react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getAuth } from 'firebase/auth'; // Import Firebase Auth

const API_URL = 'https://us-central1-ready-set-fly-71506.cloudfunctions.net'; // Replace with your actual server URL
const READY_SET_FLY_ACCOUNT = 'acct_readysetfly'; // Replace with actual Stripe account ID

export default function CheckoutScreen({ route }) {
  const navigation = useNavigation();
  const { initPaymentSheet, confirmPayment } = useStripe();
  const [loading, setLoading] = useState(false);
  const [isPaymentSuccess, setIsPaymentSuccess] = useState(false);
  const [isPaymentReady, setIsPaymentReady] = useState(false);
  const [totalAmount, setTotalAmount] = useState(0);
  const bounceValue = useRef(new Animated.Value(0)).current;

  const auth = getAuth(); // Initialize Firebase Auth
  const user = auth.currentUser; // Get current Firebase user

  // Safely retrieve params and set default values if undefined
  const rentalHours = route?.params?.rentalHours || 0;
  const costPerHour = route?.params?.costPerHour || 0;
  const taxAmount = route?.params?.taxAmount || 0;
  const processingFee = route?.params?.processingFee || 0;
  const bookingFee = route?.params?.bookingFee || 0;
  const ownerAmount = route?.params?.ownerAmount || 0;
  const total = route?.params?.total || 0;

  useEffect(() => {
    startBouncing();
    setTotalAmount(total); // Set the pre-calculated total amount
  }, [total]);

  const startBouncing = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceValue, {
          toValue: -20,
          duration: 1000,
          easing: Easing.bounce,
          useNativeDriver: true,
        }),
        Animated.timing(bounceValue, {
          toValue: 0,
          duration: 1000,
          easing: Easing.bounce,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  // Initialize payment sheet
  const initializePaymentSheet = async () => {
    if (totalAmount > 0) {
      try {
        const response = await fetch(`${API_URL}/PaymentScreen`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: totalAmount * 100 }), // Amount in cents
        });

        const { paymentIntent, ephemeralKey, customer } = await response.json();

        const { error } = await initPaymentSheet({
          merchantDisplayName: "Ready Set Fly",
          customerId: customer,
          customerEphemeralKeySecret: ephemeralKey,
          paymentIntentClientSecret: paymentIntent,
          allowsDelayedPaymentMethods: true,
          defaultBillingDetails: { name: user?.displayName || 'Renter' }, // Use Firebase user name
        });

        if (!error) setIsPaymentReady(true);
        return !error;
      } catch (error) {
        console.error("Error initializing payment sheet:", error);
        Alert.alert("Error", "Failed to initialize payment.");
      }
    } else {
      Alert.alert("Invalid Payment Details", "Payment details are incorrect.");
    }
    return false;
  };

  // Handle payment processing
  const handlePayment = async () => {
    // Initialize payment sheet before proceeding
    const initialized = await initializePaymentSheet();
    if (!initialized) return;

    try {
      setLoading(true);

      // Create payment intent and transfer details
      const response = await fetch(`${API_URL}/create-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: totalAmount * 100, // Total cost in cents
          readySetFlyAmount: (taxAmount + processingFee + bookingFee) * 100, // Fees to Ready Set Fly in cents
          ownerAmount: ownerAmount * 100, // Owner's amount in cents
          readySetFlyAccount: READY_SET_FLY_ACCOUNT, // Destination account ID
        }),
      });

      const { clientSecret } = await response.json();
      if (!clientSecret) {
        Alert.alert('Error', 'Unable to process payment');
        setLoading(false);
        return;
      }

      // Confirm the payment with Stripe using the client secret
      const { error, paymentIntent } = await confirmPayment(clientSecret, {
        paymentMethodType: 'Card',
        paymentMethodData: {
          billingDetails: { name: user?.displayName || 'Renter' }, // Use Firebase user's name
        },
      });

      if (error) {
        Alert.alert('Payment failed', error.message);
      } else if (paymentIntent.status === 'Succeeded') {
        Alert.alert('Success', 'Payment processed successfully');
        setIsPaymentSuccess(true);
        navigation.navigate('Classifieds');
      }
    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert('Error', 'Payment processing failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (!loading) {
      navigation.goBack();
    } else {
      Alert.alert('Please wait', 'Payment is being processed. Please wait until it finishes.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Cancel button */}
      <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
        <Ionicons name="close-outline" size={28} color="#FF5A5F" />
      </TouchableOpacity>

      {/* Bouncing animation */}
      <Animated.View style={[styles.animatedContainer, { transform: [{ translateY: bounceValue }] }]}>
        <Ionicons
          name={isPaymentSuccess ? "checkmark-circle-outline" : "card-outline"}
          size={80}
          color={isPaymentSuccess ? "#32CD32" : "#FF5A5F"} // Green on success, red otherwise
        />
      </Animated.View>

      <Text style={styles.title}>Complete Your Payment</Text>
      <Text style={styles.description}>Verify your payment details below.</Text>

      {/* Display Payment Details */}
      <Text style={styles.detail}>Hours: {rentalHours}</Text>
      <Text style={styles.detail}>Cost per Hour: ${costPerHour}</Text>
      <Text style={styles.detail}>Tax: ${taxAmount}</Text>
      <Text style={styles.detail}>Processing Fee: ${processingFee}</Text>
      <Text style={styles.detail}>Booking Fee: ${bookingFee}</Text>
      <Text style={styles.amount}>Total Amount: ${totalAmount}</Text>

      {/* Stripe CardField component */}
      <CardField
        postalCodeEnabled={true}
        placeholders={{ number: '4242 4242 4242 4242' }} // Stripe test card
        style={styles.cardField}
        onCardChange={(cardDetails) => console.log('Card details:', cardDetails)}
      />

      {/* Pay Button */}
      <TouchableOpacity
        onPress={handlePayment}
        disabled={loading}
        style={styles.payButton}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.payButtonText}>Pay ${totalAmount}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#f9f9f9',
  },
  cancelButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
  },
  animatedContainer: {
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
    color: '#555',
  },
  detail: {
    fontSize: 16,
    marginBottom: 5,
    textAlign: 'center',
    color: '#333',
  },
  amount: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
    color: '#000',
  },
  cardField: {
    width: '100%',
    height: 50,
    marginVertical: 30,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    backgroundColor: 'white',
  },
  payButton: {
    backgroundColor: '#FF5A5F',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  payButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
