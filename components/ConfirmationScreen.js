// ConfirmationScreen.js
import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const ConfirmationScreen = ({ route }) => {
  const navigation = useNavigation();
  const { selectedDate, availableRentals } = route.params;

  const handleConfirm = () => {
    // Handle the booking confirmation logic here
    navigation.navigate('BookingConfirmed');
  };

  return (
    <SafeAreaView className="flex-1 bg-white p-4">
      <Text className="text-2xl font-bold mb-4">Confirm Your Booking</Text>
      <Text className="text-lg mb-2">Selected Date: {selectedDate}</Text>

      {availableRentals.length > 0 ? (
        <View>
          <Text className="text-xl font-bold mb-2">Available Rentals:</Text>
          {availableRentals.map((rental, index) => (
            <View key={index} className="p-4 mb-4 border rounded-lg">
              <Text className="text-lg font-bold">{rental.title}</Text>
              <Text>{rental.description}</Text>
              <Text className="text-gray-500">{rental.price}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text>No rentals available for the selected date.</Text>
      )}

      <TouchableOpacity
        onPress={handleConfirm}
        className="bg-blue-500 p-4 rounded-lg mt-4"
      >
        <Text className="text-center text-white font-bold">Confirm Booking</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default ConfirmationScreen;
