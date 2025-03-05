// src/payment/classifiedsPaymentScreen.js

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
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getAuth } from 'firebase/auth';
import { Formik } from 'formik';
import * as Yup from 'yup';

// Configuration Constants
const API_URL = 'https://us-central1-ready-set-fly-71506.cloudfunctions.net/api';

// Pricing packages mapping for classifieds listings
const PRICING_PACKAGES = { Basic: 25, Featured: 70, Enhanced: 150 };

// Helper function: calculates total amount (in cents) based on the pricing tier
const calculateAmount = (pricingTier) => {
  if (pricingTier === 'FreeTrial') return 0;
  const baseCost = PRICING_PACKAGES[pricingTier] || 0;
  const totalWithTax = baseCost * 1.0825;
  return Math.round(totalWithTax * 100);
};

// Colors Constants
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
  discountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  discountInput: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: COLORS.white,
    fontSize: 16,
  },
  applyButton: {
    marginLeft: 10,
    backgroundColor: COLORS.green,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  applyButtonDisabled: {
    backgroundColor: '#a5d6a7',
  },
  applyButtonText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  errorText: {
    color: COLORS.red,
    marginTop: 10,
    textAlign: 'center',
    fontSize: 14,
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
  finalizeButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginTop: 20,
    width: '100%',
    alignItems: 'center',
  },
  finalizeButtonDisabled: {
    backgroundColor: '#ccc',
  },
  finalizeButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 16,
  },
});

export default function ClassifiedsPaymentScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { confirmPayment } = useConfirmPayment();

  // Firebase Auth
  const auth = getAuth();
  const user = auth.currentUser;

  // Extract route parameters from classifieds.js
  const {
    listingDetails = {},
    selectedPricing: initialSelectedPricing = 'Basic',
    // Note: amount is no longer passed from classifieds.js since we auto-calculate below.
    listingId: routeListingId = '',
  } = route.params || {};

  console.log("ClassifiedsPaymentScreen received params:", route.params);

  // Local state
  const [loading, setLoading] = useState(false);
  const [isOperationSuccess, setIsOperationSuccess] = useState(false);
  const [discountCode, setDiscountCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [cardholderName, setCardholderName] = useState(user?.displayName || '');
  const [totalAmount, setTotalAmount] = useState(0);
  const [selectedPricing, setSelectedPricing] = useState(initialSelectedPricing);

  // Animation
  const bounceValue = useRef(new Animated.Value(0)).current;
  const displayTotal = (totalAmount / 100).toFixed(2);

  useEffect(() => {
    console.log("ClassifiedsPaymentScreen useEffect triggered");
    startBouncing();
    // When the selected pricing changes, recalc the total amount.
    const computedAmount = calculateAmount(selectedPricing);
    setTotalAmount(computedAmount);
  }, [selectedPricing]);

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

  // Discount code logic (optional)
  const applyDiscount = async () => {
    const code = discountCode.trim().toUpperCase();
    if (!code) {
      setErrorMessage('Please enter a discount code.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');

      const response = await fetch(`${API_URL}/validateDiscount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discountCode: code, amount: totalAmount }),
      });

      let data;
      try {
        data = await response.json();
      } catch (err) {
        const text = await response.clone().text();
        console.error('Response is not JSON:', text);
        setErrorMessage('Failed to apply discount. Please try again.');
        setLoading(false);
        return;
      }

      if (response.ok && data.valid) {
        setDiscountApplied(true);
        setTotalAmount(data.adjustedAmount);
        setSelectedPricing(data.pricingTier);
        Alert.alert(
          'Discount Applied',
          data.message || 'Discount has been successfully applied.',
          [{ text: 'OK' }],
          { cancelable: false }
        );
      } else {
        setDiscountApplied(false);
        setErrorMessage(data.message || 'Invalid discount code.');
      }
    } catch (error) {
      console.error('Discount application error:', error);
      setErrorMessage('Failed to apply discount. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle classifieds payment (and listing creation if needed)
  const handleClassifiedPayment = async (values) => {
    // === New block: Skip payment for Aviation Gear ===
    if (listingDetails.category === 'Aviation Gear') {
      try {
        setLoading(true);
        const token = await getFirebaseIdToken();
        if (!token) {
          throw new Error('Authentication token is missing for classifieds payment.');
        }

        let finalListingId = listingDetails.id || routeListingId;
        if (!finalListingId) {
          // Prepare listingDetails (perform any necessary transformations)
          const preparedListing = {
            ...listingDetails,
          };
          if (preparedListing.salePrice) {
            preparedListing.salePrice = parseFloat(preparedListing.salePrice);
          }
          if (preparedListing.packageCost) {
            preparedListing.packageCost = parseFloat(preparedListing.packageCost);
          }

          const createResponse = await fetch(`${API_URL}/createListing`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ listingDetails: preparedListing }),
          });
          if (!createResponse.ok) {
            let errorData;
            try {
              errorData = await createResponse.json();
            } catch (e) {
              errorData = { error: 'Failed to create listing.' };
            }
            Alert.alert('Error', errorData.error || 'Failed to create listing.');
            setLoading(false);
            return;
          }
          const createData = await createResponse.json();
          finalListingId = createData.listingId;
          listingDetails.id = finalListingId;
        }

        Alert.alert(
          'Payment was Successful',
          'Your Aviation Gear listing has been posted!',
          [
            {
              text: 'Close',
              onPress: () => {
                navigation.navigate('Classifieds', { refresh: true });
              },
            },
          ],
          { cancelable: false }
        );
        setIsOperationSuccess(true);
      } catch (error) {
        console.error('Classified payment error for Aviation Gear:', error);
        Alert.alert('Error', 'Failed to post your Aviation Gear listing.');
      } finally {
        setLoading(false);
      }
      return; // Skip the rest of the payment flow
    }

    // === Existing payment logic for other categories ===
    if (values.cardholderName.trim() === '') {
      Alert.alert('Validation Error', 'Please enter the name on the credit card.');
      return;
    }
    try {
      setLoading(true);
      const token = await getFirebaseIdToken();
      if (!token) {
        throw new Error('Authentication token is missing for classifieds payment.');
      }

      // Check for a valid listing ID
      let finalListingId = listingDetails.id || routeListingId;
      if (!finalListingId) {
        // Prepare listingDetails (perform any necessary transformations)
        const preparedListing = {
          ...listingDetails,
        };
        if (preparedListing.salePrice) {
          preparedListing.salePrice = parseFloat(preparedListing.salePrice);
        }
        if (preparedListing.packageCost) {
          preparedListing.packageCost = parseFloat(preparedListing.packageCost);
        }

        const createResponse = await fetch(`${API_URL}/createListing`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ listingDetails: preparedListing }),
        });
        if (!createResponse.ok) {
          let errorData;
          try {
            errorData = await createResponse.json();
          } catch (e) {
            errorData = { error: 'Failed to create listing.' };
          }
          Alert.alert('Error', errorData.error || 'Failed to create listing.');
          setLoading(false);
          return;
        }
        const createData = await createResponse.json();
        finalListingId = createData.listingId;
        listingDetails.id = finalListingId;
      }

      // Auto-calculate the amount based on the selected pricing package.
      const computedAmount = calculateAmount(selectedPricing);
      setTotalAmount(computedAmount);

      const body = {
        amount: computedAmount, // in cents
        listingId: finalListingId,
      };

      const response = await fetch(`${API_URL}/create-classified-payment-intent`, {
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
        Alert.alert('Error', 'Failed to create payment intent for classified.');
        setLoading(false);
        return;
      }
      
      if (!response.ok) {
        Alert.alert('Error', data.error || 'Failed to create payment intent.');
        setLoading(false);
        return;
      }
      
      // Handle free trial (zero-amount) listings
      if (data.freeListing === true) {
        Alert.alert(
          'Payment was Successful',
          'Your listing has been finalized with a free trial period!',
          [
            {
              text: 'Close',
              onPress: () => {
                navigation.navigate('Classifieds', { refresh: true });
              },
            },
          ],
          { cancelable: false }
        );
        setIsOperationSuccess(true);
        setLoading(false);
        return;
      }
      
      const clientSecret = data.clientSecret;
      if (!clientSecret) {
        console.error("Error: Client secret is missing for classified payment.");
        Alert.alert('Error', 'Payment details are missing.');
        setLoading(false);
        return;
      }
      
      const { error, paymentIntent } = await confirmPayment(clientSecret, {
        paymentMethodType: 'Card',
        billingDetails: { name: values.cardholderName.trim() },
      });
      
      if (error) {
        Alert.alert(
          'Payment was Unsuccessful',
          error.message,
          [
            {
              text: 'Close',
              onPress: () => {
                navigation.navigate('Classifieds', { refresh: true });
              },
            },
          ],
          { cancelable: false }
        );
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        Alert.alert(
          'Payment was Successful',
          'Your listing has been finalized!',
          [
            {
              text: 'Close',
              onPress: () => {
                navigation.navigate('Classifieds', { refresh: true });
              },
            },
          ],
          { cancelable: false }
        );
        setIsOperationSuccess(true);
      }
      
    } catch (error) {
      console.error('Classified payment error:', error);
      Alert.alert('Error', 'Payment processing failed for your listing.');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (values) => {
    if (loading) {
      console.warn("Operation is already in progress.");
      return;
    }
    handleClassifiedPayment(values);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={60}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.cancelButton}
          accessibilityLabel="Cancel operation"
          accessibilityRole="button"
        >
          <Ionicons name="close-outline" size={28} color={COLORS.red} />
        </TouchableOpacity>

        <View style={styles.content}>
          <Animated.View style={[styles.animatedContainer, { transform: [{ translateY: bounceValue }] }]}>
            <Ionicons
              name={isOperationSuccess ? "checkmark-circle-outline" : "card-outline"}
              size={80}
              color={isOperationSuccess ? COLORS.green : COLORS.primary}
              accessibilityLabel={isOperationSuccess ? "Operation Successful" : "Operation Required"}
            />
          </Animated.View>

          <Text style={styles.title}>Finalize Your Listing</Text>
          <Text style={styles.description}>
            Provide your payment details below to finalize your listing.
          </Text>

          <Formik
            initialValues={{ cardholderName, discountCode }}
            validationSchema={Yup.object({
              cardholderName: Yup.string().required('Name on card is required.'),
              discountCode: Yup.string(), // Optional
            })}
            onSubmit={handleFormSubmit}
            enableReinitialize
          >
            {({ handleSubmit, values, errors, touched, setFieldValue }) => (
              <>
                {!discountApplied && (
                  <View style={styles.discountContainer}>
                    <TextInput
                      style={styles.discountInput}
                      placeholder="Enter Discount Code"
                      placeholderTextColor="#888"
                      value={discountCode}
                      onChangeText={(text) => {
                        setDiscountCode(text);
                        setFieldValue('discountCode', text);
                      }}
                      autoCapitalize="characters"
                      editable={!loading}
                      accessibilityLabel="Discount Code Input"
                    />
                    <TouchableOpacity
                      onPress={applyDiscount}
                      style={[
                        styles.applyButton,
                        (loading || discountApplied) && styles.applyButtonDisabled,
                      ]}
                      disabled={loading || discountApplied}
                      accessibilityLabel="Apply Discount"
                      accessibilityRole="button"
                    >
                      <Text style={styles.applyButtonText}>Apply</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {errorMessage !== '' && (
                  <Text style={styles.errorText} accessibilityLiveRegion="polite">
                    {errorMessage}
                  </Text>
                )}

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
                  style={[styles.finalizeButton, loading && styles.finalizeButtonDisabled]}
                  accessibilityLabel="Finalize Listing"
                  accessibilityRole="button"
                >
                  {loading ? (
                    <ActivityIndicator color="white" accessibilityLabel="Finalizing Listing" />
                  ) : (
                    <Text style={styles.finalizeButtonText}>Finalize Listing</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </Formik>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
