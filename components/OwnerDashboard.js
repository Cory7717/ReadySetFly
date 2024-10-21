// OwnerDashboard.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from "react-native";
import { db, auth } from "../../firebaseConfig";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";

const OwnerDashboard = ({ user }) => {
  const [listings, setListings] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newListing, setNewListing] = useState({
    make: "",
    model: "",
    year: "",
    location: "",
    ratesPerHour: "",
    description: "",
    images: [], // Handle image uploads separately
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      const listingsRef = collection(db, "airplanes");
      const q = query(listingsRef, where("ownerId", "==", user.uid), orderBy("createdAt", "desc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const ownerListings = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setListings(ownerListings);
      });

      return () => unsubscribe();
    }
  }, [user]);

  const handleAddListing = async () => {
    const { make, model, year, location, ratesPerHour, description } = newListing;

    if (!make || !model || !year || !location || !ratesPerHour || !description) {
      Alert.alert("Error", "Please fill out all fields.");
      return;
    }

    setIsSubmitting(true);

    try {
      await addDoc(collection(db, "airplanes"), {
        ...newListing,
        ownerId: user.uid,
        createdAt: new Date(),
      });
      setModalVisible(false);
      setNewListing({
        make: "",
        model: "",
        year: "",
        location: "",
        ratesPerHour: "",
        description: "",
        images: [],
      });
      Alert.alert("Success", "Listing added successfully.");
    } catch (error) {
      console.error("Error adding listing: ", error);
      Alert.alert("Error", "Failed to add listing.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteListing = async (listingId) => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this listing?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "airplanes", listingId));
              Alert.alert("Deleted", "Listing has been deleted.");
            } catch (error) {
              console.error("Error deleting listing: ", error);
              Alert.alert("Error", "Failed to delete listing.");
            }
          },
        },
      ]
    );
  };

  const renderListing = ({ item }) => (
    <View style={styles.listingItem}>
      <Text style={styles.listingTitle}>{`${item.year} ${item.make} ${item.model}`}</Text>
      <Text style={styles.listingDetail}>{`Location: ${item.location}`}</Text>
      <Text style={styles.listingDetail}>{`Rate: $${item.ratesPerHour}/hour`}</Text>
      <Text style={styles.listingDescription}>{item.description}</Text>
      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => {
            // Implement edit functionality
            Alert.alert("Edit", "Edit functionality to be implemented.");
          }}
        >
          <Ionicons name="create-outline" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteListing(item.id)}
        >
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Add New Listing Button */}
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        style={styles.addButton}
      >
        <Text style={styles.addButtonText}>Add New Listing</Text>
      </TouchableOpacity>

      {/* Listings List */}
      <FlatList
        data={listings}
        renderItem={renderListing}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.emptyText}>No listings found.</Text>}
      />

      {/* Modal for Adding New Listing */}
      <Modal
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
        animationType="slide"
      >
        <SafeAreaView style={styles.modalContainer}>
          <ScrollView>
            <Text style={styles.modalTitle}>New Listing</Text>
            <TextInput
              placeholder="Make"
              placeholderTextColor="#888"
              value={newListing.make}
              onChangeText={(text) => setNewListing({ ...newListing, make: text })}
              style={styles.input}
            />
            <TextInput
              placeholder="Model"
              placeholderTextColor="#888"
              value={newListing.model}
              onChangeText={(text) => setNewListing({ ...newListing, model: text })}
              style={styles.input}
            />
            <TextInput
              placeholder="Year"
              placeholderTextColor="#888"
              value={newListing.year}
              onChangeText={(text) => setNewListing({ ...newListing, year: text })}
              keyboardType="numeric"
              style={styles.input}
            />
            <TextInput
              placeholder="Location"
              placeholderTextColor="#888"
              value={newListing.location}
              onChangeText={(text) => setNewListing({ ...newListing, location: text })}
              style={styles.input}
            />
            <TextInput
              placeholder="Rate per Hour"
              placeholderTextColor="#888"
              value={newListing.ratesPerHour}
              onChangeText={(text) => setNewListing({ ...newListing, ratesPerHour: text })}
              keyboardType="numeric"
              style={styles.input}
            />
            <TextInput
              placeholder="Description"
              placeholderTextColor="#888"
              value={newListing.description}
              onChangeText={(text) => setNewListing({ ...newListing, description: text })}
              multiline
              style={[styles.input, { height: 100 }]}
            />
            {/* Implement Image Uploads as Needed */}
            <TouchableOpacity
              onPress={handleAddListing}
              style={styles.submitButton}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.closeModalButton}
            >
              <Ionicons name="close-circle" size={36} color="red" />
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10 },
  addButton: {
    backgroundColor: "#1E90FF",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  addButtonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },
  listingItem: {
    padding: 15,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: "#f9f9f9",
  },
  listingTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
  },
  listingDetail: {
    fontSize: 16,
    marginBottom: 3,
    color: "#555",
  },
  listingDescription: {
    fontSize: 14,
    marginBottom: 10,
    color: "#666",
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFA500",
    padding: 8,
    borderRadius: 5,
    marginRight: 10,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF6347",
    padding: 8,
    borderRadius: 5,
  },
  actionButtonText: {
    color: "#fff",
    marginLeft: 5,
  },
  emptyText: {
    textAlign: "center",
    color: "#4a5568",
    marginTop: 20,
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    padding: 20,
  },
  modalTitle: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: "center",
    fontWeight: "bold",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  submitButton: {
    backgroundColor: "#1E90FF",
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  submitButtonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },
  closeModalButton: {
    alignSelf: "center",
    marginTop: 20,
  },
});

export default OwnerDashboard;
