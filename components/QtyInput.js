import React, { useState, useEffect } from 'react';
import { TextInput } from 'react-native';
import { styles } from '../styles/shared';

export const QtyInput = ({ value, onCommit }) => {
  const [temp, setTemp] = useState(String(value ?? 1));
  useEffect(() => { setTemp(String(value ?? 1)); }, [value]);
  return (
    <TextInput
      value={temp}
      onChangeText={(t) => { setTemp((t || "").replace(/[^\d]/g, "")); }}
      onEndEditing={() => {
        const next = temp === "" ? 1 : Math.max(1, parseInt(temp, 10));
        onCommit(next);
        setTemp(String(next));
      }}
      keyboardType="number-pad"
      style={styles.qtyInput}
      accessibilityLabel="Quantity"
    />
  );
};
