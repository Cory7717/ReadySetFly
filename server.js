import axios from 'axios';
import { API_URL } from '@env'; // Assuming you're using react-native-dotenv

export const createPaymentIntent = async (amount, currency) => {
  try {
    const response = await axios.post(`${API_URL}/create-payment-intent`, {
      amount,
      currency,
    });
    return response.data.clientSecret;
  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw error;
  }
};
