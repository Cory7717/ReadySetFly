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
  Modal
} from 'react-native';
import { CardField, useConfirmPayment } from '@stripe/stripe-react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { collection, addDoc, serverTimestamp,query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig'; 
import { Formik } from 'formik';
import * as Yup from 'yup';

const API_URL = 'https://us-central1-ready-set-fly-71506.cloudfunctions.net/api';

const COLORS = {
  primary: '#FF5A5F',
  secondary: '#6B7280',
  background: '#F9F9F9',
  white: '#FFFFFF',
  black: '#000000',
  gray: '#9CA3AF',
  lightGray: '#D1D5DB',
  green: '#32CD32',
  red: '#EF4444',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 20,
    justifyContent: 'flex-start',
    flexGrow: 1,
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
    color: COLORS.black,
  },
  description: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
    color: COLORS.gray,
  },
  nameInput: {
    height: 50,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: COLORS.white,
    marginBottom: 15,
    fontSize: 16,
    color: COLORS.black,
  },
  cardField: {
    width: '100%',
    height: 50,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    padding: 10,
    backgroundColor: COLORS.white,
  },
  payButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginTop: 20,
    width: '100%',
    alignItems: 'center',
  },
  payButtonDisabled: {
    backgroundColor: '#ccc',
  },
  payButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 16,
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
  errorText: {
    color: COLORS.red,
    marginTop: 10,
    textAlign: 'center',
    fontSize: 14,
  },
});

export default function CheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { confirmPayment } = useConfirmPayment();

  // Firebase Auth
  const auth = getAuth();
  const user = auth.currentUser;

  // Expected parameters (including ownerId)
  const {
    costPerHour = 0,
    rentalHours = 1,
    rentalRequestId: routeRentalRequestId = '',
    ownerId: routeOwnerId = '',
    listingDetails = {}, // Kept original name
    selectedPricing: initialSelectedPricing = '', // Kept original name
  } = params || {};

  console.log("CheckoutScreen (Rental) received params:", params);

  // Local state (Original)
  const [loading, setLoading] = useState(false);
  const [isOperationSuccess, setIsOperationSuccess] = useState(false); // Kept, though less used now
  const [cardholderName, setCardholderName] = useState(user?.displayName || '');
  const [totalAmount, setTotalAmount] = useState(0);
  const [selectedPricing, setSelectedPricing] = useState(initialSelectedPricing); // Kept, though maybe less relevant for rentals
  const [rentalRequestId, setRentalRequestId] = useState(routeRentalRequestId || '');
  const [ownerId, setOwnerId] = useState(routeOwnerId || '');
  // Removed showConfirmationModal state - no longer used here

  // Animation (Original)
  const bounceValue = useRef(new Animated.Value(0)).current;
  const displayTotal = (totalAmount / 100).toFixed(2);

  // Original useEffects
  useEffect(() => {
    console.log("CheckoutScreen useEffect triggered");
    startBouncing();
    validateParamsAndSetAmount();
  }, [costPerHour, rentalHours, router]);

  const validateParamsAndSetAmount = () => {
    if (isNaN(costPerHour) || costPerHour <= 0) {
      Alert.alert('Invalid Cost Per Hour', 'Please provide a valid cost per hour.');
      router.back();
      return;
    }
    if (isNaN(rentalHours) || rentalHours <= 0) {
      Alert.alert('Invalid Rental Hours', 'Please provide valid rental hours.');
      router.back();
      return;
    }
    calculateRentalTotal(parseFloat(costPerHour), parseFloat(rentalHours));
  };

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

  // Original calculateRentalTotal
  const calculateRentalTotal = (costHr, hours) => {
    const baseAmount = costHr * hours;
    const bookingFee = baseAmount * 0.06;
    const processingFee = baseAmount * 0.03;
    const tax = baseAmount * 0.0825;
    const totalCents = Math.round((baseAmount + bookingFee + processingFee + tax) * 100);
    setTotalAmount(totalCents);
  };

  // Original getFirebaseIdToken
  const getFirebaseIdToken = async () => {
    try {
      if (user) {
        const token = await user.getIdToken(true);
        console.log("Firebase ID Token:", token);
        return token;
      } else {
        throw new Error('User not authenticated.');
      }
    } catch (error) {
      console.error('Error fetching Firebase ID token:', error);
      Alert.alert('Authentication Error', 'Failed to authenticate user.');
      return '';
    }
  };

  // Original createRentalRequest (if needed)
  const createRentalRequest = async () => {
    try {
      const actualListingId = listingDetails.id; 
      if (!actualListingId) {
        Alert.alert('Error', 'Listing information is missing.');
        return null;
      }
      const rentalRequestData = {
        renterId: user.uid,
        listingId: actualListingId,
        rentalStatus: 'pending',
        costPerHour: parseFloat(costPerHour),
        rentalHours: parseFloat(rentalHours),
        createdAt: serverTimestamp(),
        ownerId: ownerId, 
      };
      const rentalRequestRef = await addDoc(collection(db, 'rentalRequests'), rentalRequestData);
      const newRentalRequestId = rentalRequestRef.id;
      setRentalRequestId(newRentalRequestId);
      console.log(`Rental Request Created with ID: ${newRentalRequestId}`);
      return newRentalRequestId;
    } catch (error) {
      console.error('Error creating rental request:', error);
      Alert.alert('Error', 'Failed to create rental request.');
      return null;
    }
  };

  // *** MODIFIED: handleRentalPayment function ***
  const handleRentalPayment = async (values) => {
    if (values.cardholderName.trim() === '') {
      Alert.alert('Validation Error', 'Please enter the name on the credit card.');
      return;
    }
    if (!ownerId) {
      Alert.alert('Error', 'Cannot process payment: Owner information missing.');
      console.error("ownerId is missing in handleRentalPayment");
      return;
    }
    
    try {
      setLoading(true);
      let currentRentalRequestId = rentalRequestId; 
      
      if (!currentRentalRequestId) {
        console.warn("rentalRequestId not found in params, attempting to create...");
        currentRentalRequestId = await createRentalRequest(); 
        if (!currentRentalRequestId) {
          setLoading(false);
          return;
        }
      }

      const endpoint = '/create-rental-payment-intent';
      const body = {
        rentalRequestId: currentRentalRequestId,
        ownerId: ownerId,
        amount: totalAmount,
        renterId: user.uid,
      };

      const token = await getFirebaseIdToken();
      if (!token) {
        setLoading(false);
        return; 
      }

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        const text = await response.clone().text();
        console.error('Response is not JSON:', text);
        Alert.alert('Error', 'Failed to create payment intent.');
        setLoading(false);
        return;
      }

      if (!response.ok) {
        Alert.alert('Error', data.error || 'Failed to create payment intent.');
        setLoading(false);
        return;
      }

      const clientSecret = data.clientSecret;
      if (!clientSecret) {
        console.error("Error: Client secret is missing for rental payment.");
        Alert.alert('Error', 'Payment details are missing.');
        setLoading(false);
        return;
      }

      const { error, paymentIntent } = await confirmPayment(clientSecret, {
        paymentMethodType: 'Card',
        billingDetails: { name: values.cardholderName.trim() },
      });

      if (error) {
        Alert.alert('Payment failed', error.message);
        setLoading(false);
      } else if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) {
        console.log("Payment Succeeded on CheckoutScreen for rental:", currentRentalRequestId);
        setLoading(false);
        router.replace({
          pathname: '/renter',
          params: { paymentSuccessFor: currentRentalRequestId, ownerId: ownerId },
        });
      } else {
        Alert.alert('Payment Status Unknown', 'Payment status could not be confirmed.');
        setLoading(false);
      }
      
    } catch (error) {
      console.error('Rental payment error:', error);
      Alert.alert('Error', 'Payment processing failed for your rental.');
      setLoading(false);
    }
  };

  // Original handleFormSubmit
  const handleFormSubmit = (values) => {
    if (loading) {
      console.warn("Operation is already in progress.");
      return;
    }
    handleRentalPayment(values);
  };

  // Original handleCancel
  const handleCancel = () => {
    if (!loading) {
      router.back();
    } else {
      Alert.alert('Please wait', 'Operation is in progress. Please wait until it finishes.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={60}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity
          onPress={handleCancel}
          style={styles.cancelButton}
          accessibilityLabel="Cancel operation"
          accessibilityRole="button"
        >
          <Ionicons name="close-outline" size={28} color={COLORS.red} />
        </TouchableOpacity>
        <View style={styles.content}>
          <Animated.View style={[styles.animatedContainer, { transform: [{ translateY: bounceValue }] }]} >
            <Ionicons
              name={isOperationSuccess ? "checkmark-circle-outline" : "card-outline"}
              size={80}
              color={isOperationSuccess ? COLORS.green : COLORS.primary}
              accessibilityLabel={isOperationSuccess ? "Operation Successful" : "Operation Required"}
            />
          </Animated.View>
          <Text style={styles.title}>Complete Your Payment</Text>
          <Text style={styles.description}>Verify your payment details below.</Text>
          <Formik
            initialValues={{ cardholderName }}
            validationSchema={Yup.object({
              cardholderName: Yup.string().required('Name on card is required.'),
            })}
            onSubmit={handleFormSubmit}
            enableReinitialize
          >
            {({ handleSubmit, values, errors, touched, setFieldValue }) => (
              <>
                <TextInput
                  style={styles.nameInput}
                  placeholder="Name on Card"
                  placeholderTextColor="#888"
                  value={values.cardholderName}
                  onChangeText={(text) => {
                    setCardholderName(text);
                    setFieldValue('cardholderName', text);
                  }}
                  autoCapitalize="words"
                  editable={!loading}
                  accessibilityLabel="Cardholder Name Input"
                />
                {touched.cardholderName && errors.cardholderName && (
                  <Text style={styles.errorText}>{errors.cardholderName}</Text>
                )}
                <CardField
                  postalCodeEnabled={true}
                  placeholders={{ number: '**** **** **** ****' }}
                  placeholderTextColor="#888"
                  style={styles.cardField}
                  onCardChange={(cardDetails) => console.log('Card details:', cardDetails)}
                  onFocus={() => console.log('CardField focused')}
                  editable={!loading}
                  accessibilityLabel="Credit Card Input"
                />
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={loading}
                  style={[styles.payButton, loading && styles.payButtonDisabled]}
                  accessibilityLabel={`Pay $${(totalAmount / 100).toFixed(2)}`}
                  accessibilityRole="button"
                >
                  {loading ? (
                    <ActivityIndicator color="white" accessibilityLabel="Processing Payment" />
                  ) : (
                    <Text style={styles.payButtonText}>{`Pay $${(totalAmount / 100).toFixed(2)}`}</Text>
                  )}
                </TouchableOpacity>
                <View style={styles.securePaymentContainer}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={16}
                    color="#555"
                    accessibilityLabel="Secure Payment Lock Icon"
                  />
                  <Text style={styles.securePaymentText}>
                    Your payment is secure and encrypted.
                  </Text>
                </View>
              </>
            )}
          </Formik>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
