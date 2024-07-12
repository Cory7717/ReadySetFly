// src/MessagingScreen.js

import React, { useState } from 'react';
import { View } from 'react-native';
import { tw } from 'nativewind';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

const MessagingScreen = () => {
  const [messages, setMessages] = useState([]);

  const handleSend = (text) => {
    const newMessage = {
      id: messages.length + 1,
      sender: 'You',
      text: text,
    };
    setMessages([...messages, newMessage]);
  };

  return (
    <View style={tw`flex-1`}>
      <MessageList messages={messages} />
      <MessageInput onSend={handleSend} />
    </View>
  );
};

export default MessagingScreen;
