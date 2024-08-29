import React, { useState, useEffect } from 'react';
import { View, Text, Button, FlatList, Alert, StyleSheet } from 'react-native';
import { getFirestore, collection, getDocs, addDoc } from 'firebase/firestore';

const AirplaneList = ({ userId }) => {
  const [airplanes, setAirplanes] = useState([]);

  useEffect(() => {
    const fetchAirplanes = async () => {
      const db = getFirestore();
      const airplanesCollection = collection(db, 'airplanes');
      try {
        const querySnapshot = await getDocs(airplanesCollection);
        const airplanesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAirplanes(airplanesData);
      } catch (error) {
        console.error('Error fetching airplanes:', error);
      }
    };

    fetchAirplanes();
  }, []);

  const handleBookAirplane = async (airplaneId) => {
    const db = getFirestore();
    try {
      await addDoc(collection(db, 'bookings'), {
        airplaneId,
        renterId: userId,
        status: 'pending'
      });
      Alert.alert('Booking request sent!');
    } catch (error) {
      console.error('Error booking airplane:', error);
      Alert.alert('Error', 'There was an issue booking the airplane. Please try again.');
    }
  };

  const renderAirplaneItem = ({ item }) => (
    <View style={styles.airplaneItem}>
      <Text style={styles.airplaneName}>{item.airplaneName}</Text>
      <Text style={styles.airplaneModel}>{item.airplaneModel}</Text>
      <Text style={styles.availability}>{item.availability}</Text>
      <Button title="Book Airplane" onPress={() => handleBookAirplane(item.id)} />
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={airplanes}
        keyExtractor={item => item.id}
        renderItem={renderAirplaneItem}
        contentContainerStyle={styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  list: {
    paddingBottom: 16,
  },
  airplaneItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    elevation: 2, // For Android shadow
    shadowColor: '#000', // For iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  airplaneName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  airplaneModel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  availability: {
    fontSize: 14,
    color: '#888',
    marginBottom: 12,
  },
});

export default AirplaneList;
