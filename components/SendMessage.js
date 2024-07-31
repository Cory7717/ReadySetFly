import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet } from 'react-native';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

const SendMessage = ({ userId, contactId }) => {
  const [messageText, setMessageText] = useState('');

  const handleSendMessage = async () => {
    if (messageText.trim() === '') return;

    const db = getFirestore();
    const messagesCollection = collection(db, 'messages');
    
    await addDoc(messagesCollection, {
      senderId: userId,
      receiverId: contactId,
      messageText,
      timestamp: serverTimestamp(),
      participants: [userId, contactId]
    });

    setMessageText('');
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Type a message..."
        value={messageText}
        onChangeText={setMessageText}
      />
      <Button title="Send" onPress={handleSendMessage} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10
  },
  input: {
    flex: 1,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    marginRight: 10,
    padding: 10
  }
});

export default SendMessage;
