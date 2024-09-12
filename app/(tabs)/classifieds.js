import React, { useState, useEffect } from 'react';
import { 
  SafeAreaView, 
  View, 
  Image, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  FlatList, 
  Modal,
  ActivityIndicator, 
  ScrollView,
  Animated,
  RefreshControl,
  StyleSheet
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, FontAwesome, Feather } from '@expo/vector-icons';
import { useUser } from '@clerk/clerk-expo';
import { collection, addDoc, orderBy, deleteDoc, doc, limit, startAfter, getDocs, query } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import FullScreenRental from '../../components/FullScreenRental';
import FullScreenPost from '../../components/FullScreenPost';

// Stack Navigator
const Stack = createStackNavigator();

// Post card component
const Post = ({ post, onDelete, onViewPost, onLike, onShare }) => {
  const { user } = useUser();

  return (
    <TouchableOpacity onPress={() => onViewPost(post)}>
      <View style={styles.postContainer}>
        <View style={styles.postHeader}>
          <Image source={{ uri: post?.profileImage || 'default_profile_image_url' }} style={styles.profileImage} />
          <View style={styles.postUserInfo}>
            <Text style={styles.userName}>{post?.userName || 'Unknown User'}</Text>
            <Text>{post?.createdAt ? new Date(post.createdAt.toDate()).toLocaleDateString() : 'Unknown Date'}</Text>
          </View>
          {(user?.id === post?.userId) && (
            <TouchableOpacity onPress={() => onDelete(post.id)} style={styles.deleteButton}>
              <Feather name="trash" size={24} color="red" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.postContent}>{post?.content || ''}</Text>
        {post?.image && <Image source={{ uri: post.image }} style={styles.postImage} />}
        <View style={styles.postActions}>
          <TouchableOpacity onPress={() => onLike(post)} style={styles.actionButton}>
            <FontAwesome name="thumbs-up" size={20} color="gray" />
            <Text style={styles.actionText}>Like</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onShare(post)} style={styles.actionButton}>
            <Ionicons name="share-social-outline" size={24} color="black" />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// CreateNewPost component with slide-up modal and modern border
const CreateNewPost = ({ onSubmit, onCancel, isVisible }) => {
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const { user } = useUser();
  const slideAnim = useState(new Animated.Value(600))[0];

  useEffect(() => {
    if (isVisible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 600,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });
    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (content.trim() || image) {
      const newPost = {
        content,
        image: image || null,
        userName: user.fullName,
        profileImage: user.imageUrl,
        createdAt: new Date(),
        userId: user.id,
      };

      try {
        await addDoc(collection(db, 'posts'), newPost);
        onSubmit(newPost);
        setContent('');
        setImage(null);
      } catch (error) {
        Alert.alert('Error', 'Could not submit post.');
      }
    } else {
      Alert.alert('Error', 'Please enter some text or upload an image.');
    }
  };

  return (
    <Modal transparent visible={isVisible} animationType="none">
      <Animated.View
        style={[styles.modal, { transform: [{ translateY: slideAnim }] }]}
      >
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onCancel}>
            <Feather name="x-circle" size={32} color="gray" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSubmit} style={styles.submitButton}>
            <Text style={styles.submitText}>Post</Text>
            <Ionicons name="send" size={26} color="white" />
          </TouchableOpacity>
        </View>
        <TextInput
          placeholder="What's on your mind?"
          value={content}
          onChangeText={setContent}
          multiline
          style={styles.input}
        />
        <TouchableOpacity onPress={pickImage} style={styles.uploadButton}>
          <Text style={styles.uploadText}>Upload Image</Text>
        </TouchableOpacity>
        {image && <Image source={{ uri: image }} style={styles.modalImage} />}
      </Animated.View>
    </Modal>
  );
};

// FullScreen Post modal
const FullScreenPostModal = ({ post, visible, onClose, onLike, onShare }) => {
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([]);
  const { user } = useUser(); 

  const handleAddComment = () => {
    if (comment.trim()) {
      const newComment = {
        userId: user.id,
        text: comment,
      };
      setComments([...comments, newComment]);
      setComment('');
    }
  };

  return (
    <Modal visible={visible} transparent={false}>
      <Animated.View style={styles.modal}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={30} color="black" />
          </TouchableOpacity>
          <View style={styles.socialMediaHeader}>
            <Image source={{ uri: post?.profileImage }} style={styles.profileImage} />
            <View style={styles.postUserInfo}>
              <Text style={styles.modalUserName}>{post?.userName}</Text>
              <Text>{post?.createdAt ? new Date(post.createdAt.toDate()).toLocaleDateString() : 'Unknown Date'}</Text>
            </View>
          </View>
        </View>
        <Text style={styles.modalContent}>{post?.content}</Text>
        {post?.image && <Image source={{ uri: post?.image }} style={styles.modalFullImage} />}
        <View style={styles.postActions}>
          <TouchableOpacity onPress={() => onLike(post)} style={styles.actionButton}>
            <FontAwesome name="thumbs-up" size={20} color="gray" />
            <Text style={styles.actionText}>Like</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onShare(post)} style={styles.actionButton}>
            <Ionicons name="share-social-outline" size={24} color="black" />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.commentSection}>
          <Text style={styles.commentTitle}>Comments:</Text>
          {comments.map((cmt, index) => (
            <View key={index} style={styles.comment}>
              <Text>{cmt.userId}</Text>
              <Text>{cmt.text}</Text>
            </View>
          ))}
          <View style={styles.commentInputContainer}>
            <TextInput
              placeholder="Add a comment"
              value={comment}
              onChangeText={setComment}
              style={styles.commentInput}
            />
            <TouchableOpacity onPress={handleAddComment} style={styles.commentButton}>
              <Text style={styles.commentButtonText}>Post</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
};

// Main Feed Component
const MainFeed = () => {
  const [posts, setPosts] = useState([]);
  const [lastVisible, setLastVisible] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [isPostModalVisible, setPostModalVisible] = useState(false);

  const PAGE_SIZE = 10;

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async (loadMore = false) => {
    setLoading(true);
    let postsRef = collection(db, 'posts');
    let q = query(postsRef, orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
    if (loadMore && lastVisible) {
      q = query(postsRef, orderBy('createdAt', 'desc'), startAfter(lastVisible), limit(PAGE_SIZE));
    }
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const newPosts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setPosts((prevPosts) => (loadMore ? [...prevPosts, ...newPosts] : newPosts));
      setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
    }
    setLoading(false);
  };

  const handleLoadMore = () => {
    if (!loading) {
      fetchPosts(true);
    }
  };

  const handleViewPost = (post) => {
    setSelectedPost(post);
    setPostModalVisible(true);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPosts().then(() => setRefreshing(false));
  };

  const handleLike = (post) => {
    Alert.alert('Liked!', `You liked ${post.userName}'s post.`);
  };

  const handleShare = (post) => {
    Alert.alert('Share', `Sharing ${post.userName}'s post.`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="airplane-outline" size={24} color="black" />
        <Text style={styles.headerText}>Aviation News and Events</Text>
      </View>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Post 
            key={item.id} 
            post={item} 
            onDelete={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))} 
            onViewPost={handleViewPost}
            onLike={handleLike}
            onShare={handleShare}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loading && <ActivityIndicator size="large" color="#0000ff" />}
      />
      <CreateNewPost isVisible={isCreatingPost} onSubmit={(newPost) => setPosts([newPost, ...posts])} onCancel={() => setIsCreatingPost(false)} />
      {!isCreatingPost && (
        <View style={styles.createPostButtonContainer}>
          <TouchableOpacity 
            onPress={() => setIsCreatingPost(true)} 
            style={styles.createPostButton}
          >
            <Ionicons name="create" size={24} color="white" />
            <Text style={styles.createPostButtonText}>Create Post</Text>
          </TouchableOpacity>
        </View>
      )}
      <FullScreenPostModal 
        post={selectedPost} 
        visible={isPostModalVisible} 
        onClose={() => setPostModalVisible(false)} 
        onLike={handleLike}
        onShare={handleShare}
      />
    </SafeAreaView>
  );
};

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerText: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  postContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
    borderRadius: 10,
    borderColor: '#E2E8F0',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 5,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  profileImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  postUserInfo: {
    marginLeft: 10,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  postContent: {
    marginBottom: 10,
    fontSize: 16,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 10,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    marginLeft: 4,
    fontSize: 16,
    color: '#666',
  },
  modal: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  socialMediaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitButton: {
    padding: 10,
    backgroundColor: '#007bff',
    borderRadius: 50,
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitText: {
    color: 'white',
    fontWeight: 'bold',
    marginRight: 10,
  },
  input: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    fontSize: 16,
  },
  uploadButton: {
    padding: 10,
    backgroundColor: '#E2E8F0',
    borderRadius: 5,
  },
  uploadText: {
    textAlign: 'center',
    color: '#4A5568',
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginTop: 10,
  },
  modalContainer: {
    flex: 1,
    padding: 16,
  },
  modalUserInfo: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalUserName: {
    fontWeight: 'bold',
    fontSize: 18,
    marginTop: 8,
  },
  modalContent: {
    fontSize: 16,
    marginBottom: 16,
  },
  modalFullImage: {
    width: '100%',
    height: 400,
    borderRadius: 10,
  },
  commentSection: {
    marginTop: 20,
  },
  commentTitle: {
    fontWeight: 'bold',
    marginBottom: 10,
  },
  comment: {
    paddingVertical: 4,
    borderBottomColor: '#ccc',
    borderBottomWidth: 1,
  },
  commentInputContainer: {
    flexDirection: 'row',
    marginTop: 10,
  },
  commentInput: {
    flex: 1,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
  },
  commentButton: {
    marginLeft: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#007bff',
    borderRadius: 5,
  },
  commentButtonText: {
    color: 'white',
  },
  createPostButtonContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  createPostButton: {
    backgroundColor: '#007bff',
    padding: 16,
    borderRadius: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 5,
  },
  createPostButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

// Root App Component
export default function App() {
  return (
    <NavigationContainer independent={true}>
      <Stack.Navigator initialRouteName="MainFeed">
        <Stack.Screen name="MainFeed" component={MainFeed} options={{ headerShown: false }} />
        <Stack.Screen name="FullScreenPost" component={FullScreenPost} options={{ headerShown: false }} />
        <Stack.Screen name="FullScreenRental" component={FullScreenRental} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
