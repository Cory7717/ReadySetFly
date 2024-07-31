import React, { useState, useEffect } from 'react';
import { View, Text, Button, Alert } from 'react-native';
import { Calendar, CalendarList, Agenda } from 'react-native-calendars';
import { getFirestore, collection, addDoc, query, where, getDocs } from 'firebase/firestore';

const BookingCalendar = ({ airplaneId, userId }) => {
  const [bookings, setBookings] = useState({});
  const [selectedDate, setSelectedDate] = useState('');

  useEffect(() => {
    const fetchBookings = async () => {
      const db = getFirestore();
      const bookingsCollection = collection(db, 'bookings');
      const q = query(bookingsCollection, where('airplaneId', '==', airplaneId));
      const querySnapshot = await getDocs(q);
      let bookingsData = {};
      querySnapshot.forEach((doc) => {
        const { startDate, endDate } = doc.data();
        bookingsData[startDate] = { marked: true, dotColor: 'red' };
        bookingsData[endDate] = { marked: true, dotColor: 'red' };
      });
      setBookings(bookingsData);
    };

    fetchBookings();
  }, []);

  const handleDayPress = (day) => {
    setSelectedDate(day.dateString);
  };

  const handleBooking = async () => {
    if (!selectedDate) {
      Alert.alert('Please select a date first.');
      return;
    }
    const db = getFirestore();
    await addDoc(collection(db, 'bookings'), {
      airplaneId,
      renterId: userId,
      startDate: selectedDate,
      endDate: selectedDate,
      status: 'pending'
    });
    Alert.alert('Booking request sent!');
  };

  return (
    <View>
      <Calendar
        onDayPress={handleDayPress}
        markedDates={bookings}
      />
      <Button title="Book Airplane" onPress={handleBooking} />
    </View>
  );
};

export default BookingCalendar;
