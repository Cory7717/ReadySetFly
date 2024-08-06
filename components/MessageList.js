import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { getFirestore, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { firebase } from '../firebaseConfig';
import tw from 'nativewind';

const MessageList = ({ userId, contactId }) => {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const db = getFirestore();
    const messagesCollection = collection(db, 'messages');
    const q = query(
      messagesCollection,
      where('participants', 'array-contains', userId),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const messagesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(messagesData);
    });

    return () => unsubscribe();
  }, [userId]);

  return (
    <FlatList
      data={messages}
      keyExtractor={item => item.id}
      renderItem={({ item }) => (
        <View style={item.senderId === userId ? styles.myMessage : styles.contactMessage}>
          <Text>{item.messageText}</Text>
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#DCF8C6',
    borderRadius: 5,
    margin: 5,
    padding: 10
  },
  contactMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#ECECEC',
    borderRadius: 5,
    margin: 5,
    padding: 10
  }
});

export default MessageList;
