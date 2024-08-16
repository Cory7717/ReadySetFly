import { Modal } from "react-native";

const PaymentModal = ({ visible, onClose }) => {
  return (
    <Modal
      transparent={true}
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center items-center bg-black bg-opacity-50">
        <View className="bg-white p-5 rounded-lg w-80">
          <Text className="text-xl font-bold mb-3">Pricing Information</Text>
          <Text>
            Here you can add information about pricing for listing aircraft. For example:
            {"\n"}
            - Basic Listing: $50
            {"\n"}
            - Premium Listing: $100
            {"\n"}
            - Featured Listing: $200
          </Text>
          <TouchableOpacity onPress={onClose} className="mt-5 bg-blue-500 p-3 rounded-lg">
            <Text className="text-white text-center">Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
