// Dashboard.js
import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import OwnerDashboard from "./OwnerDashboard"; // Ensure the path is correct
import RenterDashboard from "./RenterDashboard"; // Ensure the path is correct

const Dashboard = ({ user }) => {
  const [activeTab, setActiveTab] = useState("rent"); // 'rent' or 'own'

  return (
    <View style={styles.container}>
      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "rent" && styles.activeTab]}
          onPress={() => setActiveTab("rent")}
        >
          <Text style={[styles.tabText, activeTab === "rent" && styles.activeTabText]}>
            Rent
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "own" && styles.activeTab]}
          onPress={() => setActiveTab("own")}
        >
          <Text style={[styles.tabText, activeTab === "own" && styles.activeTabText]}>
            My Listings
          </Text>
        </TouchableOpacity>
      </View>

      {/* Conditional Rendering Based on Active Tab */}
      <View style={styles.dashboardContainer}>
        {activeTab === "rent" ? <RenterDashboard user={user} /> : <OwnerDashboard user={user} />}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
    backgroundColor: "#f0f0f0",
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: "#e0e0e0",
  },
  activeTab: {
    backgroundColor: "#1E90FF",
  },
  tabText: {
    color: "#000",
    fontWeight: "bold",
  },
  activeTabText: {
    color: "#fff",
  },
  dashboardContainer: {
    flex: 1,
  },
});

export default Dashboard;
