import React, { useState, useEffect } from 'react';
import { StripeProvider } from '@stripe/stripe-react-native';
import { View, ActivityIndicator } from 'react-native';

function App() {
  const [publishableKey, setPublishableKey] = useState('');

  const fetchPublishableKey = async () => {
    try {
      const key = await fetchKey(); // fetch key from your server here
      setPublishableKey(key);
    } catch (error) {
      console.error('Error fetching Stripe publishable key:', error);
    }
  };

  useEffect(() => {
    fetchPublishableKey();
  }, []);

  if (!publishableKey) {
    // Show a loading indicator while the publishable key is being fetched
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <StripeProvider
      publishableKey={publishableKey}
      merchantIdentifier="merchant.identifier" // required for Apple Pay
      urlScheme="your-url-scheme" // required for 3D Secure and bank redirects
    >
      {/* Your app code here */}
    </StripeProvider>
  );
}

export default App;
