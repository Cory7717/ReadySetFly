import React, { useState, useEffect } from 'react';
import { View, Text, Button, FlatList, Alert } from 'react-native';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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
    }
  };

  return (
    <View>
      <FlatList
        data={airplanes}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View>
            <Text>{item.airplaneName}</Text>
            <Text>{item.airplaneModel}</Text>
            <Text>{item.availability}</Text>
            <Button title="Book Airplane" onPress={() => handleBookAirplane(item.id)} />
          </View>
        )}
      />
    </View>
  );
};

export default AirplaneList;
