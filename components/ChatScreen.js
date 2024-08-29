import React from 'react';
import { View, StyleSheet } from 'react-native';
import MessageList from './MessageList';
import SendMessage from './SendMessage';

const ChatScreen = ({ route }) => {
  const { userId, contactId } = route.params;

  return (
    <View style={styles.container}>
      <MessageList userId={userId} contactId={contactId} />
      <SendMessage userId={userId} contactId={contactId} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 16, // Replaces the "className='p-4'" for padding
  },
});

export default ChatScreen;
