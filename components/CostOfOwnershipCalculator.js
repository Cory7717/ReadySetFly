import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  ScrollView,
} from "react-native";

// Reusable Input Component
const CustomTextInput = ({
  placeholder,
  value,
  onChangeText,
  keyboardType = "default",
  editable = true,
  multiline = false,
  style,
  ...rest
}) => (
  <TextInput
    placeholder={placeholder}
    placeholderTextColor="#888"
    value={value}
    onChangeText={onChangeText}
    keyboardType={keyboardType}
    style={[styles.input, style]}
    editable={editable}
    multiline={multiline}
    {...rest}
  />
);

// Reusable Button Component
const CustomButton = ({
  onPress,
  title,
  backgroundColor = "#3182ce",
  style,
  textStyle,
  ...rest
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.button, { backgroundColor }, style]}
    accessibilityLabel={title}
    accessibilityRole="button"
    {...rest}
  >
    <Text style={[styles.buttonText, textStyle]}>{title}</Text>
  </TouchableOpacity>
);

// Reusable Section Component
const Section = ({ title, children }) => (
  <View style={{ marginBottom: 16 }}>
    <Text style={{ fontSize: 20, fontWeight: "bold", marginBottom: 8 }}>
      {title}
    </Text>
    {children}
  </View>
);

const CostOfOwnershipCalculator = () => {
  const [costData, setCostData] = useState({
    purchasePrice: "",
    loanAmount: "",
    interestRate: "",
    loanTerm: "",
    depreciationRate: "",
    usefulLife: "",
    estimatedAnnualCost: "",
    insuranceCost: "",
    hangarCost: "",
    annualRegistrationFees: "",
    maintenanceReserve: "",
    oilCostPerHour: "",
    routineMaintenancePerHour: "",
    tiresPerHour: "",
    otherConsumablesPerHour: "",
    fuelCostPerHour: "",
    rentalHoursPerYear: "",
    costPerHour: "",
    mortgageExpense: "",
    depreciationExpense: "",
  });

  const [costSaved, setCostSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  /**
   * Function to handle input changes.
   */
  const handleInputChange = (name, value) => {
    setCostData((prev) => ({ ...prev, [name]: value }));
  };

  /**
   * Function to save cost data.
   */
  const saveCostData = async () => {
    setLoading(true);
    try {
      // Validate Inputs
      const requiredFields = Object.values(costData).filter(
        (field) => field === ""
      );
      if (requiredFields.length > 0) {
        Alert.alert(
          "Error",
          "Please fill in all fields for accurate calculation."
        );
        setLoading(false);
        return;
      }

      // Calculate Monthly Mortgage Expense
      const monthlyInterestRate = parseFloat(costData.interestRate) / 100 / 12;
      const numberOfPayments = parseFloat(costData.loanTerm) * 12;
      const principal = parseFloat(costData.loanAmount);
      const mortgageExpense = principal
        ? (
            (principal * monthlyInterestRate) /
            (1 - Math.pow(1 + monthlyInterestRate, -numberOfPayments))
          ).toFixed(2)
        : 0;

      // Calculate Depreciation Expense
      const depreciationExpense = (
        (parseFloat(costData.purchasePrice) * parseFloat(costData.depreciationRate)) /
        100
      ).toFixed(2);

      // Total Fixed Costs per Year
      const totalFixedCosts =
        parseFloat(mortgageExpense) * 12 +
        parseFloat(depreciationExpense) +
        parseFloat(costData.insuranceCost) +
        parseFloat(costData.hangarCost) +
        parseFloat(costData.maintenanceReserve) +
        parseFloat(costData.annualRegistrationFees);

      // Total Variable Costs per Year
      const totalVariableCosts =
        (parseFloat(costData.fuelCostPerHour) +
          parseFloat(costData.oilCostPerHour) +
          parseFloat(costData.routineMaintenancePerHour) +
          parseFloat(costData.tiresPerHour) +
          parseFloat(costData.otherConsumablesPerHour)) *
        parseFloat(costData.rentalHoursPerYear);

      // Total Cost per Year
      const totalCostPerYear = totalFixedCosts + totalVariableCosts;

      // Cost per Hour
      const costPerHour = (
        totalCostPerYear / parseFloat(costData.rentalHoursPerYear)
      ).toFixed(2);

      setCostData((prev) => ({
        ...prev,
        costPerHour,
        mortgageExpense,
        depreciationExpense,
      }));
      setCostSaved(true);
      setLoading(false);

      Alert.alert("Success", `Estimated cost per hour: $${costPerHour}`);
    } catch (error) {
      console.error("Error saving cost data:", error);
      Alert.alert("Error", "Failed to save cost data.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Function to allow users to edit cost data after it has been saved.
   */
  const onEditCostData = () => {
    setCostSaved(false);
  };

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
        Cost of Ownership Calculator
      </Text>
      {costSaved ? (
        <View style={styles.calculatorResultContainer}>
          <Text style={styles.calculatorTitle}>
            Estimated Cost per Hour: ${costData.costPerHour}
          </Text>
          <Text style={styles.calculatorText}>
            Total Fixed Costs per Year: $
            {(
              parseFloat(costData.mortgageExpense) * 12 +
              parseFloat(costData.depreciationExpense) +
              parseFloat(costData.insuranceCost) +
              parseFloat(costData.hangarCost) +
              parseFloat(costData.maintenanceReserve) +
              parseFloat(costData.annualRegistrationFees)
            ).toFixed(2)}
          </Text>
          <Text style={styles.calculatorText}>
            Total Variable Costs per Year: $
            {(
              (parseFloat(costData.fuelCostPerHour) +
                parseFloat(costData.oilCostPerHour) +
                parseFloat(costData.routineMaintenancePerHour) +
                parseFloat(costData.tiresPerHour) +
                parseFloat(costData.otherConsumablesPerHour)) *
              parseFloat(costData.rentalHoursPerYear)
            ).toFixed(2)}
          </Text>
          <CustomButton
            onPress={onEditCostData}
            title="Edit Cost Data"
            style={{ marginTop: 16 }}
          />
        </View>
      ) : (
        <ScrollView>
          {/* Loan Details Section */}
          <Section title="Loan Details">
            <CustomTextInput
              placeholder="Purchase Price ($)"
              value={costData.purchasePrice}
              onChangeText={(value) => handleInputChange("purchasePrice", value)}
              keyboardType="numeric"
            />
            <CustomTextInput
              placeholder="Loan Amount ($)"
              value={costData.loanAmount}
              onChangeText={(value) => handleInputChange("loanAmount", value)}
              keyboardType="numeric"
            />
            <CustomTextInput
              placeholder="Interest Rate (%)"
              value={costData.interestRate}
              onChangeText={(value) => handleInputChange("interestRate", value)}
              keyboardType="numeric"
            />
            <CustomTextInput
              placeholder="Loan Term (years)"
              value={costData.loanTerm}
              onChangeText={(value) => handleInputChange("loanTerm", value)}
              keyboardType="numeric"
            />
            <CustomTextInput
              placeholder="Depreciation Rate (%)"
              value={costData.depreciationRate}
              onChangeText={(value) => handleInputChange("depreciationRate", value)}
              keyboardType="numeric"
            />
            <CustomTextInput
              placeholder="Useful Life (years)"
              value={costData.usefulLife}
              onChangeText={(value) => handleInputChange("usefulLife", value)}
              keyboardType="numeric"
            />
            <Text style={styles.modalText}>
              Mortgage Expense: ${costData.mortgageExpense}
            </Text>
            <Text style={styles.modalText}>
              Depreciation Expense: ${costData.depreciationExpense}
            </Text>
          </Section>

          {/* Annual Costs Section */}
          <Section title="Annual Costs">
            <CustomTextInput
              placeholder="Estimated Annual Cost ($)"
              value={costData.estimatedAnnualCost}
              onChangeText={(value) =>
                handleInputChange("estimatedAnnualCost", value)
              }
              keyboardType="numeric"
            />
            <CustomTextInput
              placeholder="Insurance Cost ($)"
              value={costData.insuranceCost}
              onChangeText={(value) => handleInputChange("insuranceCost", value)}
              keyboardType="numeric"
            />
            <CustomTextInput
              placeholder="Hangar Cost ($)"
              value={costData.hangarCost}
              onChangeText={(value) => handleInputChange("hangarCost", value)}
              keyboardType="numeric"
            />
            <CustomTextInput
              placeholder="Annual Registration & Fees ($)"
              value={costData.annualRegistrationFees}
              onChangeText={(value) =>
                handleInputChange("annualRegistrationFees", value)
              }
              keyboardType="numeric"
            />
            <CustomTextInput
              placeholder="Maintenance Reserve ($)"
              value={costData.maintenanceReserve}
              onChangeText={(value) =>
                handleInputChange("maintenanceReserve", value)
              }
              keyboardType="numeric"
            />
          </Section>

          {/* Operational Costs Section */}
          <Section title="Operational Costs">
            <CustomTextInput
              placeholder="Fuel Cost Per Hour ($)"
              value={costData.fuelCostPerHour}
              onChangeText={(value) => handleInputChange("fuelCostPerHour", value)}
              keyboardType="numeric"
            />
            <CustomTextInput
              placeholder="Oil Cost Per Hour ($)"
              value={costData.oilCostPerHour}
              onChangeText={(value) => handleInputChange("oilCostPerHour", value)}
              keyboardType="numeric"
            />
            <CustomTextInput
              placeholder="Routine Maintenance Per Hour ($)"
              value={costData.routineMaintenancePerHour}
              onChangeText={(value) =>
                handleInputChange("routineMaintenancePerHour", value)
              }
              keyboardType="numeric"
            />
            <CustomTextInput
              placeholder="Tires Per Hour ($)"
              value={costData.tiresPerHour}
              onChangeText={(value) => handleInputChange("tiresPerHour", value)}
              keyboardType="numeric"
            />
            <CustomTextInput
              placeholder="Other Consumables Per Hour ($)"
              value={costData.otherConsumablesPerHour}
              onChangeText={(value) =>
                handleInputChange("otherConsumablesPerHour", value)
              }
              keyboardType="numeric"
            />
            <CustomTextInput
              placeholder="Rental Hours Per Year"
              value={costData.rentalHoursPerYear}
              onChangeText={(value) =>
                handleInputChange("rentalHoursPerYear", value)
              }
              keyboardType="numeric"
            />
          </Section>

          <CustomButton
            onPress={saveCostData}
            title="Save Cost Data"
            accessibilityLabel="Save Cost Data button"
            accessibilityRole="button"
          />
          {loading && (
            <ActivityIndicator size="large" color="#3182ce" style={{ marginTop: 16 }} />
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  input: {
    height: 48,
    borderColor: "#CBD5E0",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  button: {
    height: 48,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  calculatorResultContainer: {
    backgroundColor: "#f7fafc",
    padding: 16,
    borderRadius: 8,
  },
  calculatorTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  calculatorText: {
    fontSize: 16,
    marginBottom: 4,
  },
  modalText: {
    fontSize: 16,
    marginBottom: 4,
  },
});

export default CostOfOwnershipCalculator;
