import React, { useState } from 'react';
import { View, TextInput, Button, Alert, StyleSheet } from 'react-native';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

const AirplaneUploadForm = ({ ownerId }) => {
  const [airplaneName, setAirplaneName] = useState('');
  const [airplaneModel, setAirplaneModel] = useState('');
  const [availability, setAvailability] = useState('');

  const handleUpload = async () => {
    if (!airplaneName || !airplaneModel || !availability) {
      Alert.alert('Missing Fields', 'Please fill out all fields.');
      return;
    }

    const db = getFirestore();
    try {
      await addDoc(collection(db, 'airplanes'), {
        ownerId,
        airplaneName,
        airplaneModel,
        availability,
        isBookable: true,
      });
      Alert.alert('Success', 'Airplane listing uploaded!');
      setAirplaneName('');
      setAirplaneModel('');
      setAvailability('');
    } catch (error) {
      console.error('Error uploading airplane listing:', error);
      Alert.alert('Error', 'There was a problem uploading the listing.');
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Airplane Name"
        value={airplaneName}
        onChangeText={setAirplaneName}
      />
      <TextInput
        style={styles.input}
        placeholder="Airplane Model"
        value={airplaneModel}
        onChangeText={setAirplaneModel}
      />
      <TextInput
        style={styles.input}
        placeholder="Availability"
        value={availability}
        onChangeText={setAvailability}
      />
      <Button title="Upload Airplane Listing" onPress={handleUpload} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  input: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
});

export default AirplaneUploadForm;
