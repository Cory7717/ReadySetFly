// import React, { useState } from 'react';
// import { View, TextInput, Button, StyleSheet } from 'react-native';
// import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
// // import { firebase } from '../firebaseConfig';
// import tw from 'nativewind';

// const SendMessage = ({ userId, contactId }) => {
//   const [messageText, setMessageText] = useState('');
//   const [text, setText] = useState('');


//   const sendMessage = async () => {
//     if (text.length > 0) {
//       await firebase.firestore().collection('messages').add({
//         text,
//         user: 'User1',
//         createdAt: firebase.firestore.FieldValue.serverTimestamp()
//       });
//       setText('');
//     }
//   };
//   const handleSendMessage = async () => {
//     if (messageText.trim() === '') return;

//     const db = getFirestore();
//     const messagesCollection = collection(db, 'messages');
    
//     await addDoc(messagesCollection, {
//       senderId: userId,
//       receiverId: contactId,
//       messageText,
//       timestamp: serverTimestamp(),
//       participants: [userId, contactId]
//     });

//     setMessageText('');
//   };

//   return (
//     <View style={tw`flex-row items-center p-4`}>
//     <TextInput
//       style={tw`flex-1 border rounded p-2`}
//       placeholder="Type a message"
//       value={text}
//       onChangeText={setText}
//     />
//     <Button title="Send" onPress={sendMessage} />
//   </View>
// );
// };

// const styles = StyleSheet.create({
//   container: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     padding: 10
//   },
//   input: {
//     flex: 1,
//     borderColor: '#ccc',
//     borderWidth: 1,
//     borderRadius: 5,
//     marginRight: 10,
//     padding: 10
//   }
// });

// export default SendMessage;
