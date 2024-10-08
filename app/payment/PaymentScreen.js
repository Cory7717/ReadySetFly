import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator, 
  StyleSheet, 
  Animated, 
  Easing, 
  TextInput, 
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { CardField, useConfirmPayment } from '@stripe/stripe-react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

// Configuration Constants
const BACKEND_URL = 'https://us-central1-ready-set-fly-71506.cloudfunctions.net';
const DISCOUNT_CODE = 'rsf2024';

const PaymentScreen = ({ route }) => {
  const navigation = useNavigation();
  const { 
    totalCost: initialTotalCost = 0, 
    listingDetails = {}, 
    selectedPricing: initialPricing = '' 
  } = route.params || {};
  
  const [loading, setLoading] = useState(false);
  const [isPaymentSuccess, setIsPaymentSuccess] = useState(false); // To track payment status
  const { confirmPayment } = useConfirmPayment();

  // Discount code state
  const [discountCode, setDiscountCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Cardholder name state
  const [cardholderName, setCardholderName] = useState('');

  // Manage totalCost and selectedPricing as state to allow updates
  const [totalCost, setTotalCost] = useState(initialTotalCost);
  const [selectedPricing, setSelectedPricing] = useState(initialPricing);

  // For displaying animation
  const bounceValue = useRef(new Animated.Value(0)).current;

  // Convert totalCost to a fixed amount for displaying
  const displayTotal = (totalCost / 100).toFixed(2);

  useEffect(() => {
    // Start the bounce animation on component mount
    startBouncing();
  }, []);

  // Start the bouncing animation
  const startBouncing = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceValue, {
          toValue: -20, // Move up
          duration: 1000,
          easing: Easing.bounce,
          useNativeDriver: true,
        }),
        Animated.timing(bounceValue, {
          toValue: 0, // Move back down
          duration: 1000,
          easing: Easing.bounce,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  // Function to create the listing on the backend
  const createListing = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/createListing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingDetails }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create listing');
      }

      return true;
    } catch (error) {
      console.error('Listing creation error:', error);
      Alert.alert('Error', error.message || 'Failed to create listing.');
      return false;
    }
  };

  // Function to apply discount code by validating it with the backend
  const applyDiscount = async () => {
    const code = discountCode.trim().toLowerCase();

    if (code === '') {
      setErrorMessage('Please enter a discount code.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');

      // Send discount code to backend for validation and get discount details
      const response = await fetch(`${BACKEND_URL}/validateDiscount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discountCode: code }),
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        setDiscountApplied(true);
        setTotalCost(data.adjustedAmount); // Updated amount from backend
        setSelectedPricing(data.pricingTier); // Updated pricing tier from backend
        Alert.alert(
          'Discount Applied',
          data.message || 'Discount has been successfully applied.',
          [{ text: 'OK' }],
          { cancelable: false }
        );
      } else {
        setDiscountApplied(false);
        setTotalCost(initialTotalCost); // Reset to initial total cost
        setSelectedPricing(initialPricing);
        setErrorMessage(data.message || 'Invalid discount code.');
      }
    } catch (error) {
      console.error('Discount application error:', error);
      setErrorMessage('Failed to apply discount. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    // Validate cardholder name
    if (cardholderName.trim() === '') {
      Alert.alert('Validation Error', 'Please enter the name on the credit card.');
      return;
    }

    if (discountApplied && totalCost === 0) {
      // If discount is applied and totalCost is 0, create listing and navigate
      try {
        setLoading(true);
        const listingCreated = await createListing();
        if (listingCreated) {
          Alert.alert(
            'Success',
            'Your listing has been created with a free 2-week basic package.',
            [
              {
                text: 'OK',
                onPress: () => navigation.navigate('Classifieds', { refresh: true }),
              },
            ],
            { cancelable: false }
          );
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      setLoading(true);
  
      // Fetch payment intent client secret from your server, sending discount code if any
      const response = await fetch(`${BACKEND_URL}/paymentSheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount: totalCost, // Total cost in cents
          discountCode: discountApplied ? discountCode : null, // Send discount code if applied
        }),
      });
  
      const { clientSecret, error: backendError } = await response.json();

      if (backendError) {
        Alert.alert('Error', backendError);
        setLoading(false);
        return;
      }

      if (!clientSecret) {
        Alert.alert('Error', 'Unable to process payment. Please try again.');
        setLoading(false);
        return;
      }
  
      // Confirm the payment with Stripe using the client secret
      const { error, paymentIntent } = await confirmPayment(clientSecret, {
        type: 'Card',
        billingDetails: { 
          name: cardholderName.trim(), // Use user's input name
        },
      });
  
      if (error) {
        Alert.alert('Payment failed', error.message);
      } else if (paymentIntent.status === 'Succeeded') {
        // After successful payment, create the listing
        const listingCreated = await createListing();
        if (listingCreated) {
          Alert.alert(
            'Success',
            'Payment processed successfully and your listing has been created.',
            [
              {
                text: 'OK',
                onPress: () => navigation.navigate('Classifieds', { refresh: true }),
              },
            ],
            { cancelable: false }
          );
          setIsPaymentSuccess(true); // Update state to reflect successful payment
        }
      }
    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert('Error', 'Payment processing failed. Please try again.');
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={60}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Logo */}
        {/* <Image 
          source={require('../assets/images/fulllogo_transparent.png')} // Adjust the path based on your project structure
          style={styles.logo}
          resizeMode="contain"
        /> */}

        {/* Cancel button */}
        <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
          <Ionicons name="close-outline" size={28} color="#FF5A5F" />
        </TouchableOpacity>

        {/* Main Content */}
        <View style={styles.content}>
          {/* Bouncing animation */}
          <Animated.View style={[styles.animatedContainer, { transform: [{ translateY: bounceValue }] }]}>
            <Ionicons
              name={isPaymentSuccess ? "checkmark-circle-outline" : "card-outline"}
              size={80}
              color={isPaymentSuccess ? "#32CD32" : "#FF5A5F"} // Green on success, red otherwise
            />
          </Animated.View>

          <Text style={styles.title}>Complete Your Payment</Text>
          <Text style={styles.description}>You are purchasing a {selectedPricing} package.</Text>
          <Text style={styles.amount}>Total Amount: ${displayTotal}</Text>

          {/* Cardholder Name Input */}
          <TextInput
            style={styles.nameInput}
            placeholder="Name on Card"
            value={cardholderName}
            onChangeText={setCardholderName}
            autoCapitalize="words"
            editable={!loading}
          />

          {/* Stripe CardField component */}
          <CardField
            postalCodeEnabled={true}
            placeholders={{ number: '**** **** **** ****' }} // Stripe test card
            style={styles.cardField}
            onCardChange={(cardDetails) => console.log('Card details:', cardDetails)}
            editable={!discountApplied || totalCost > 0} // Disable card input if discount makes it free
          />

          {/* Button to trigger payment */}
          <TouchableOpacity
            onPress={handlePayment}
            disabled={loading || (discountApplied && totalCost === 0)}
            style={[
              styles.payButton, 
              (loading || (discountApplied && totalCost === 0)) && styles.payButtonDisabled
            ]}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.payButtonText}>
                {discountApplied && totalCost === 0 ? 'Finalize Listing' : `Pay $${displayTotal}`}
              </Text>
            )}
          </TouchableOpacity>

          {/* Discount Code Input */}
          {!discountApplied && (
            <View style={styles.discountContainer}>
              <TextInput
                style={styles.discountInput}
                placeholder="Enter Discount Code"
                value={discountCode}
                onChangeText={setDiscountCode}
                autoCapitalize="characters"
                editable={!loading}
              />
              <TouchableOpacity 
                onPress={applyDiscount} 
                style={styles.applyButton}
                disabled={loading || discountApplied}
              >
                <Text style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Display error message if any */}
          {errorMessage !== '' && (
            <Text style={styles.errorText}>{errorMessage}</Text>
          )}

          {/* Secure Payment Text */}
          <View style={styles.securePaymentContainer}>
            <Ionicons name="lock-closed-outline" size={16} color="#555" />
            <Text style={styles.securePaymentText}>
              Your payment is secure and encrypted.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  scrollContent: {
    padding: 20,
    justifyContent: 'flex-start', // Accommodate the logo and content
    flexGrow: 1,
  },
  logo: {
    width: 150, // Adjust the width as needed
    height: 50, // Adjust the height as needed
    alignSelf: 'center',
    marginBottom: 20,
  },
  cancelButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
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
  amount: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
    color: '#000',
  },
  nameInput: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: 'white',
    marginBottom: 15,
    fontSize: 16,
  },
  cardField: {
    width: '100%',
    height: 50,
    marginVertical: 10,
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
    marginTop: 20,
  },
  payButtonDisabled: {
    backgroundColor: '#ccc',
  },
  payButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  discountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  discountInput: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: 'white',
    fontSize: 16,
  },
  applyButton: {
    marginLeft: 10,
    backgroundColor: '#32CD32',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  applyButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  errorText: {
    color: '#FF5A5F',
    marginTop: 10,
    textAlign: 'center',
    fontSize: 14,
  },
  securePaymentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 30,
    justifyContent: 'center',
  },
  securePaymentText: {
    marginLeft: 5,
    color: '#555',
    fontSize: 14,
  },
});

export default PaymentScreen;
