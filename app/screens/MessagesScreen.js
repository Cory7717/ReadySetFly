// src/screens/MessagesScreen.js

import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from "react-native";
import { getFirestore, collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { Ionicons } from "@expo/vector-icons";

const MessagesScreen = () => {
  const auth = getAuth();
  const user = auth.currentUser;
  const db = getFirestore();
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const route = useRoute();
  const { rentalRequestId } = route.params;
  const renterId = user?.uid;

  useEffect(() => {
    if (!rentalRequestId) {
      Alert.alert("Error", "No rental request ID provided.");
      return;
    }

    const messagesRef = collection(db, "renters", renterId, "messages");
    const messagesQuery = query(
      messagesRef,
      where("rentalRequestId", "==", rentalRequestId),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const msgs = [];
        snapshot.forEach((docSnap) => {
          msgs.push({ id: docSnap.id, ...docSnap.data() });
        });
        setMessages(msgs);
      },
      (error) => {
        console.error("Error fetching messages:", error);
        Alert.alert("Error", "Failed to fetch messages.");
      }
    );

    return () => unsubscribe();
  }, [rentalRequestId, renterId, db]);

  const sendMessage = async () => {
    if (!messageText.trim()) {
      Alert.alert("Validation Error", "Message cannot be empty.");
      return;
    }

    try {
      await addDoc(collection(db, "renters", renterId, "messages"), {
        rentalRequestId,
        senderId: renterId,
        senderName: user.displayName || "Renter",
        text: messageText.trim(),
        timestamp: serverTimestamp(),
      });
      setMessageText("");
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message.");
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.messagesContainer}>
        {messages.map((msg) => (
          <View
            key={msg.id}
            style={[
              styles.messageBubble,
              msg.senderId === renterId ? styles.sent : styles.received,
            ]}
          >
            <Text style={styles.senderName}>{msg.senderName}</Text>
            <Text style={styles.messageText}>{msg.text}</Text>
            <Text style={styles.timestamp}>
              {msg.timestamp
                ? new Date(msg.timestamp.toDate()).toLocaleTimeString()
                : "N/A"}
            </Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.inputContainer}>
        <TextInput
          placeholder="Type your message..."
          placeholderTextColor="#888"
          style={styles.input}
          value={messageText}
          onChangeText={setMessageText}
        />
        <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
          <Ionicons name="send" size={24} color="#3182ce" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default MessagesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0fff4",
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  messageBubble: {
    maxWidth: "80%",
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  sent: {
    backgroundColor: "#3182ce",
    alignSelf: "flex-end",
  },
  received: {
    backgroundColor: "#edf2f7",
    alignSelf: "flex-start",
  },
  senderName: {
    fontWeight: "bold",
    color: "#2d3748",
    marginBottom: 5,
  },
  messageText: {
    color: "#2d3748",
  },
  timestamp: {
    fontSize: 10,
    color: "#4a5568",
    marginTop: 5,
    textAlign: "right",
  },
  inputContainer: {
    flexDirection: "row",
    padding: 10,
    borderTopWidth: 1,
    borderColor: "#cbd5e0",
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    backgroundColor: "#edf2f7",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    fontSize: 16,
  },
  sendButton: {
    justifyContent: "center",
    alignItems: "center",
    padding: 10,
  },
});
