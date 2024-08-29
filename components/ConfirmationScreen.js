import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const ConfirmationScreen = ({ route }) => {
  const navigation = useNavigation();
  const { selectedDate, availableRentals } = route.params;

  const handleConfirm = () => {
    // Handle the booking confirmation logic here
    navigation.navigate('BookingConfirmed');
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Confirm Your Booking</Text>
      <Text style={styles.selectedDate}>Selected Date: {selectedDate}</Text>

      {availableRentals.length > 0 ? (
        <View>
          <Text style={styles.availableRentalsTitle}>Available Rentals:</Text>
          {availableRentals.map((rental, index) => (
            <View key={index} style={styles.rentalContainer}>
              <Text style={styles.rentalTitle}>{rental.title}</Text>
              <Text>{rental.description}</Text>
              <Text style={styles.rentalPrice}>{rental.price}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.noRentalsText}>No rentals available for the selected date.</Text>
      )}

      <TouchableOpacity onPress={handleConfirm} style={styles.confirmButton}>
        <Text style={styles.confirmButtonText}>Confirm Booking</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  selectedDate: {
    fontSize: 18,
    marginBottom: 12,
  },
  availableRentalsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  rentalContainer: {
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
  },
  rentalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  rentalPrice: {
    color: '#888',
  },
  noRentalsText: {
    fontSize: 16,
    color: '#888',
  },
  confirmButton: {
    backgroundColor: '#007bff',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default ConfirmationScreen;
