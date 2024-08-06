import React, { useState } from 'react';
import { View, TextInput, Button, Alert } from 'react-native';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

const AirplaneUploadForm = ({ ownerId }) => {
  const [airplaneName, setAirplaneName] = useState('');
  const [airplaneModel, setAirplaneModel] = useState('');
  const [availability, setAvailability] = useState('');

  const handleUpload = async () => {
    if (!airplaneName || !airplaneModel || !availability) {
      Alert.alert('Please fill out all fields.');
      return;
    }

    const db = getFirestore();
    try {
      await addDoc(collection(db, 'airplanes'), {
        ownerId,
        airplaneName,
        airplaneModel,
        availability,
        isBookable: true
      });
      Alert.alert('Airplane listing uploaded!');
    } catch (error) {
      console.error('Error uploading airplane listing:', error);
    }
  };

  return (
    <View>
      <TextInput
        placeholder="Airplane Name"
        value={airplaneName}
        onChangeText={setAirplaneName}
      />
      <TextInput
        placeholder="Airplane Model"
        value={airplaneModel}
        onChangeText={setAirplaneModel}
      />
      <TextInput
        placeholder="Availability"
        value={availability}
        onChangeText={setAvailability}
      />
      <Button title="Upload Airplane Listing" onPress={handleUpload} />
    </View>
  );
};

export default AirplaneUploadForm;
