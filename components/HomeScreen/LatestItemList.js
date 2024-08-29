import { View, Text, FlatList, StyleSheet } from 'react-native';
import React from 'react';
import PostItem from './PostItem';

export default function LatestItemList({ latestItemList, heading }) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{heading}</Text>
      <FlatList
        data={latestItemList}
        numColumns={2}
        renderItem={({ item }) => <PostItem item={item} />}
        keyExtractor={(item, index) => index.toString()} // Ensure a unique key for each item
        columnWrapperStyle={styles.columnWrapper} // Ensure spacing between columns
        contentContainerStyle={styles.contentContainer} // Add padding for better layout
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    paddingHorizontal: 10,
  },
  heading: {
    fontWeight: 'bold',
    fontSize: 20,
    marginBottom: 8,
  },
  columnWrapper: {
    justifyContent: 'space-between', // Ensure items are evenly spaced
    marginBottom: 10,
  },
  contentContainer: {
    paddingBottom: 20, // Add padding at the bottom of the list
  },
});
