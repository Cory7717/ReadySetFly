// src/MessageInput.js

import React, { useState } from 'react';
import { View, TextInput, Button } from 'react-native';
import { tw } from 'nativewind';

const MessageInput = ({ onSend }) => {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim()) {
      onSend(message);
      setMessage('');
    }
  };

  return (
    <View style={tw`flex-row items-center p-4 bg-white border-t`}>
      <TextInput
        style={tw`flex-1 border p-2 rounded`}
        value={message}
        onChangeText={setMessage}
        placeholder="Type your message"
      />
      <Button title="Send" onPress={handleSend} />
    </View>
  );
};

export default MessageInput;
