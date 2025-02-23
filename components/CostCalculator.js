// CostOfOwnershipCalculator.js
import React, { useState } from "react";
import { View, Text, ActivityIndicator, Alert } from "react-native";
import { setDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebaseConfig";

// (Re)use your reusable components.
// Adjust these import paths as needed.
import CustomTextInput from "../components/CustomTextInput";
import CustomButton from "./CustomButton";
import Section from "../components/Section";

// Helper function to sanitize data
const sanitizeData = (data) => {
  const sanitizedData = {};
  for (const key in data) {
    if (data[key] !== undefined && data[key] !== null) {
      sanitizedData[key] = data[key];
    } else if (typeof data[key] === "boolean") {
      sanitizedData[key] = data[key];
    } else {
      sanitizedData[key] = "";
    }
  }
  return sanitizedData;
};

const CostOfOwnershipCalculator = ({ ownerId, initialCostData = {} }) => {
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
    ...initialCostData,
  });
  const [costSaved, setCostSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const onEditCostData = () => {
    setCostSaved(false);
  };

  const handleInputChange = (name, value) => {
    setCostData((prev) => ({ ...prev, [name]: value }));
  };

  const saveCostData = async () => {
    setLoading(true);
    try {
      // Check for any empty fields
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

      // Calculate mortgage and depreciation expenses
      const monthlyInterestRate =
        parseFloat(costData.interestRate) / 100 / 12;
      const numberOfPayments = parseFloat(costData.loanTerm) * 12;
      const principal = parseFloat(costData.loanAmount);
      const mortgageExpense = principal
        ? (
            (principal * monthlyInterestRate) /
            (1 - Math.pow(1 + monthlyInterestRate, -numberOfPayments))
          ).toFixed(2)
        : 0;

      const depreciationExpense = (
        (parseFloat(costData.purchasePrice) *
          parseFloat(costData.depreciationRate)) /
        100
      ).toFixed(2);

      // Calculate total fixed and variable costs
      const totalFixedCosts =
        parseFloat(mortgageExpense) * 12 +
        parseFloat(depreciationExpense) +
        parseFloat(costData.insuranceCost) +
        parseFloat(costData.hangarCost) +
        parseFloat(costData.maintenanceReserve) +
        parseFloat(costData.annualRegistrationFees);

      const totalVariableCosts =
        (parseFloat(costData.fuelCostPerHour) +
          parseFloat(costData.oilCostPerHour) +
          parseFloat(costData.routineMaintenancePerHour) +
          parseFloat(costData.tiresPerHour) +
          parseFloat(costData.otherConsumablesPerHour)) *
        parseFloat(costData.rentalHoursPerYear);

      const totalCostPerYear = totalFixedCosts + totalVariableCosts;
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

      // Persist the calculated data to Firestore if an ownerId is provided
      if (ownerId) {
        await setDoc(
          doc(db, "users", ownerId, "owners", ownerId),
          {
            costData: sanitizeData({
              ...costData,
              costPerHour,
              mortgageExpense,
              depreciationExpense,
            }),
          },
          { merge: true }
        );
      }

      Alert.alert("Success", `Estimated cost per hour: $${costPerHour}`);
    } catch (error) {
      console.error("Error saving cost data:", error);
      Alert.alert("Error", "Failed to save cost data.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ paddingHorizontal: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
        Cost of Ownership Calculator
      </Text>
      {costSaved ? (
        <View
          style={{
            backgroundColor: "#f7fafc",
            padding: 16,
            borderRadius: 8,
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontWeight: "bold",
              marginBottom: 8,
            }}
          >
            Estimated Cost per Hour: ${costData.costPerHour}
          </Text>
          <Text style={{ fontSize: 16, marginBottom: 4 }}>
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
          <Text style={{ fontSize: 16, marginBottom: 16 }}>
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
            backgroundColor="#ecc94b"
            accessibilityLabel="Edit Cost Data button"
          />
        </View>
      ) : (
        <View>
          <Section title="Loan Details">
            <CustomTextInput
              placeholder="Purchase Price ($)"
              value={costData.purchasePrice}
              onChangeText={(value) => handleInputChange("purchasePrice", value)}
              keyboardType="numeric"
              accessibilityLabel="Purchase Price input"
            />
            <CustomTextInput
              placeholder="Loan Amount ($)"
              value={costData.loanAmount}
              onChangeText={(value) => handleInputChange("loanAmount", value)}
              keyboardType="numeric"
              accessibilityLabel="Loan Amount input"
            />
            <CustomTextInput
              placeholder="Interest Rate (%)"
              value={costData.interestRate}
              onChangeText={(value) => handleInputChange("interestRate", value)}
              keyboardType="numeric"
              accessibilityLabel="Interest Rate input"
            />
            <CustomTextInput
              placeholder="Loan Term (years)"
              value={costData.loanTerm}
              onChangeText={(value) => handleInputChange("loanTerm", value)}
              keyboardType="numeric"
              accessibilityLabel="Loan Term input"
            />
            <CustomTextInput
              placeholder="Depreciation Rate (%)"
              value={costData.depreciationRate}
              onChangeText={(value) =>
                handleInputChange("depreciationRate", value)
              }
              keyboardType="numeric"
              accessibilityLabel="Depreciation Rate input"
            />
            <CustomTextInput
              placeholder="Useful Life (years)"
              value={costData.usefulLife}
              onChangeText={(value) => handleInputChange("usefulLife", value)}
              keyboardType="numeric"
              accessibilityLabel="Useful Life input"
            />
            <Text style={{ fontSize: 16, color: "#4a5568" }}>
              Mortgage Expense: ${costData.mortgageExpense}
            </Text>
            <Text style={{ fontSize: 16, color: "#4a5568" }}>
              Depreciation Expense: ${costData.depreciationExpense}
            </Text>
          </Section>

          <Section title="Annual Costs">
            <CustomTextInput
              placeholder="Estimated Annual Cost ($)"
              value={costData.estimatedAnnualCost}
              onChangeText={(value) =>
                handleInputChange("estimatedAnnualCost", value)
              }
              keyboardType="numeric"
              accessibilityLabel="Estimated Annual Cost input"
            />
            <CustomTextInput
              placeholder="Insurance Cost ($)"
              value={costData.insuranceCost}
              onChangeText={(value) => handleInputChange("insuranceCost", value)}
              keyboardType="numeric"
              accessibilityLabel="Insurance Cost input"
            />
            <CustomTextInput
              placeholder="Hangar Cost ($)"
              value={costData.hangarCost}
              onChangeText={(value) => handleInputChange("hangarCost", value)}
              keyboardType="numeric"
              accessibilityLabel="Hangar Cost input"
            />
            <CustomTextInput
              placeholder="Annual Registration & Fees ($)"
              value={costData.annualRegistrationFees}
              onChangeText={(value) =>
                handleInputChange("annualRegistrationFees", value)
              }
              keyboardType="numeric"
              accessibilityLabel="Annual Registration & Fees input"
            />
            <CustomTextInput
              placeholder="Maintenance Reserve ($)"
              value={costData.maintenanceReserve}
              onChangeText={(value) =>
                handleInputChange("maintenanceReserve", value)
              }
              keyboardType="numeric"
              accessibilityLabel="Maintenance Reserve input"
            />
          </Section>

          <Section title="Operational Costs">
            <CustomTextInput
              placeholder="Fuel Cost Per Hour ($)"
              value={costData.fuelCostPerHour}
              onChangeText={(value) => handleInputChange("fuelCostPerHour", value)}
              keyboardType="numeric"
              accessibilityLabel="Fuel Cost Per Hour input"
            />
            <CustomTextInput
              placeholder="Oil Cost Per Hour ($)"
              value={costData.oilCostPerHour}
              onChangeText={(value) => handleInputChange("oilCostPerHour", value)}
              keyboardType="numeric"
              accessibilityLabel="Oil Cost Per Hour input"
            />
            <CustomTextInput
              placeholder="Routine Maintenance Per Hour ($)"
              value={costData.routineMaintenancePerHour}
              onChangeText={(value) =>
                handleInputChange("routineMaintenancePerHour", value)
              }
              keyboardType="numeric"
              accessibilityLabel="Routine Maintenance Per Hour input"
            />
            <CustomTextInput
              placeholder="Tires Per Hour ($)"
              value={costData.tiresPerHour}
              onChangeText={(value) => handleInputChange("tiresPerHour", value)}
              keyboardType="numeric"
              accessibilityLabel="Tires Per Hour input"
            />
            <CustomTextInput
              placeholder="Other Consumables Per Hour ($)"
              value={costData.otherConsumablesPerHour}
              onChangeText={(value) =>
                handleInputChange("otherConsumablesPerHour", value)
              }
              keyboardType="numeric"
              accessibilityLabel="Other Consumables Per Hour input"
            />
            <CustomTextInput
              placeholder="Rental Hours Per Year"
              value={costData.rentalHoursPerYear}
              onChangeText={(value) => handleInputChange("rentalHoursPerYear", value)}
              keyboardType="numeric"
              accessibilityLabel="Rental Hours Per Year input"
            />
          </Section>

          <CustomButton
            onPress={saveCostData}
            title="Save Cost Data"
            accessibilityLabel="Save Cost Data button"
          />
          {loading && (
            <ActivityIndicator
              size="large"
              color="#3182ce"
              style={{ marginTop: 16 }}
            />
          )}
        </View>
      )}
    </View>
  );
};

export default CostOfOwnershipCalculator;
