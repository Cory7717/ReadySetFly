// BankDetailsForm.js

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { API_URL } from '@env';
import { getAuth } from 'firebase/auth'; // Import Firebase Auth

const BankDetailsForm = ({ ownerId }) => {
  const { createToken } = useStripe(); // Utilize Stripe's createToken method
  const [bankName, setBankName] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [accountType, setAccountType] = useState('checking'); // 'checking' or 'savings'
  const [accountHolderType, setAccountHolderType] = useState('individual'); // 'individual' or 'company'
  const [loading, setLoading] = useState(false);

  const submitBankDetails = async () => {
    if (!bankName || !accountHolderName || !accountNumber || !routingNumber) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }

    setLoading(true);
    try {
      // Step 1: Tokenize bank account details using Stripe
      const { token, error } = await createToken({
        type: 'bank_account',
        account_holder_name: accountHolderName,
        account_holder_type: accountHolderType, // 'individual' or 'company'
        routing_number: routingNumber,
        account_number: accountNumber,
        country: 'US', // Adjust based on your target country
        currency: 'usd', // Adjust based on your target currency
        account_type: accountType, // 'checking' or 'savings'
      });

      if (error) {
        Alert.alert('Tokenization Error', error.message);
        setLoading(false);
        return;
      }

      // Step 2: Retrieve Firebase ID Token for authentication
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        Alert.alert('Authentication Error', 'User is not authenticated.');
        setLoading(false);
        return;
      }

      const idToken = await user.getIdToken();

      // Step 3: Send the token to the backend to attach the bank account
      const response = await fetch(`${API_URL}/attach-bank-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`, // Include the ID Token in the Authorization header
        },
        body: JSON.stringify({
          ownerId,
          token: token.id, // Send the token ID instead of raw bank details
          bankName,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Success', 'Bank details submitted successfully.');
        // Optionally, navigate to another screen or update the UI
      } else {
        Alert.alert('Submission Error', data.error || 'Failed to submit bank details.');
      }
    } catch (error) {
      console.error('Bank Details Submission Error:', error);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>Bank Details</Text>

      <TextInput
        placeholder="Bank Name"
        placeholderTextColor="#888"
        value={bankName}
        onChangeText={setBankName}
        style={styles.input}
      />
      <TextInput
        placeholder="Account Holder Name"
        placeholderTextColor="#888"
        value={accountHolderName}
        onChangeText={setAccountHolderName}
        style={styles.input}
      />
      <TextInput
        placeholder="Account Number"
        placeholderTextColor="#888"
        value={accountNumber}
        onChangeText={setAccountNumber}
        keyboardType="numeric"
        style={styles.input}
      />
      <TextInput
        placeholder="Routing Number"
        placeholderTextColor="#888"
        value={routingNumber}
        onChangeText={setRoutingNumber}
        keyboardType="numeric"
        style={styles.input}
      />

      <Text style={{ marginTop: 8 }}>Account Type:</Text>
      <View style={{ flexDirection: 'row', marginBottom: 16, alignItems: 'center' }}>
        <TouchableOpacity
          onPress={() => setAccountType('checking')}
          style={[
            styles.radioButton,
            accountType === 'checking' && styles.radioButtonSelected,
          ]}
        />
        <Text style={{ marginRight: 16 }}>Checking</Text>
        <TouchableOpacity
          onPress={() => setAccountType('savings')}
          style={[
            styles.radioButton,
            accountType === 'savings' && styles.radioButtonSelected,
          ]}
        />
        <Text>Savings</Text>
      </View>

      <Text style={{ marginTop: 8 }}>Account Holder Type:</Text>
      <View style={{ flexDirection: 'row', marginBottom: 16, alignItems: 'center' }}>
        <TouchableOpacity
          onPress={() => setAccountHolderType('individual')}
          style={[
            styles.radioButton,
            accountHolderType === 'individual' && styles.radioButtonSelected,
          ]}
        />
        <Text style={{ marginRight: 16 }}>Individual</Text>
        <TouchableOpacity
          onPress={() => setAccountHolderType('company')}
          style={[
            styles.radioButton,
            accountHolderType === 'company' && styles.radioButtonSelected,
          ]}
        />
        <Text>Company</Text>
      </View>

      <TouchableOpacity onPress={submitBankDetails} style={styles.button}>
        <Text style={styles.buttonText}>Submit Bank Details</Text>
      </TouchableOpacity>

      {loading && <ActivityIndicator size="large" color="#3182ce" style={{ marginTop: 16 }} />}
    </View>
  );
};

const styles = {
  input: {
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    marginBottom: 12,
    paddingVertical: 8,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#3182ce',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginLeft: 8,
  },
  radioButtonSelected: {
    backgroundColor: '#3182ce',
  },
  button: {
    paddingVertical: 12,
    backgroundColor: '#3182ce',
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
};

export default BankDetailsForm;
