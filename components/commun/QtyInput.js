import React, { useEffect, useState } from "react";
import { TextInput } from "react-native";
import { styles } from "./styles";

export const QtyInput = ({ value, onCommit }) => {
  const [temp, setTemp] = useState(String(value ?? 1));
  useEffect(() => { setTemp(String(value ?? 1)); }, [value]);

  return (
    <TextInput
      value={temp}
      onChangeText={(t) => {
        const digits = (t || "").replace(/[^\d.,]/g, "");
        setTemp(digits);
      }}
      onEndEditing={() => {
        const n = parseFloat(String(temp).replace(',', '.'));
        const next = !temp || !isFinite(n) ? 1 : Math.max(1, Math.round(n * 100) / 100);
        onCommit(next);
        setTemp(String(next));
      }}
      keyboardType="decimal-pad"
      style={styles.qtyInput}
    />
  );
};
