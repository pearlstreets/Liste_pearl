// Petits composants communs aux écrans Menus.
import React, { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '../ui/IoniconsSens';
import { T } from './theme';

export const Chip = memo(function Chip({ label, on, onPress, icon, small, emoji }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      hitSlop={{ top: small ? 6 : 2, bottom: small ? 6 : 2, left: 2, right: 2 }}
      style={[s.chip, small && s.chipSmall, on ? s.chipOn : s.chipOff]}
    >
      {emoji ? <Text style={{ marginRight: 5, fontSize: small ? 12 : 14 }}>{emoji}</Text> : null}
      {icon ? (
        <Ionicons
          name={icon}
          size={small ? 13 : 15}
          color={on ? '#fff' : T.muted}
          style={{ marginRight: 5 }}
        />
      ) : null}
      <Text
        style={[s.chipTxt, small && { fontSize: 12 }, on && { color: '#fff' }, { flexShrink: 1 }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
});

export const PrimaryButton = memo(function PrimaryButton({
  label,
  onPress,
  icon,
  disabled,
  loading,
  style,
  soft,
}) {
  const off = disabled || loading;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={off ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      style={[s.btn, soft ? s.btnSoft : s.btnOn, off && { opacity: 0.55 }, style]}
    >
      {loading ? (
        <ActivityIndicator color={soft ? T.brandDark : '#fff'} />
      ) : (
        <>
          {icon ? (
            <Ionicons
              name={icon}
              size={19}
              color={soft ? T.brandDark : '#fff'}
              style={{ marginRight: 8 }}
            />
          ) : null}
          <Text
            style={[s.btnTxt, soft && { color: T.brandDark }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
});

export const GhostButton = memo(function GhostButton({ label, onPress, icon, danger }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      style={s.ghost}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={16}
          color={danger ? T.danger : T.muted}
          style={{ marginRight: 6 }}
        />
      ) : null}
      <Text style={[s.ghostTxt, danger && { color: T.danger }]}>{label}</Text>
    </TouchableOpacity>
  );
});

export const RoundIcon = memo(function RoundIcon({
  name,
  onPress,
  color,
  bg,
  size = 40,
  label,
  active,
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
        },
        { backgroundColor: bg || (active ? T.brand : T.subtle) },
      ]}
    >
      <Ionicons name={name} size={size * 0.5} color={color || (active ? '#fff' : T.ink)} />
    </TouchableOpacity>
  );
});

export const Stepper = memo(function Stepper({
  value,
  onChange,
  min = 0,
  max = 12,
  step = 1,
  format,
  label,
}) {
  const v = Number(value) || 0;
  return (
    <View style={s.stepper} accessibilityRole="adjustable" accessibilityLabel={label}>
      <TouchableOpacity
        onPress={() => onChange(Math.max(min, v - step))}
        style={[s.stepBtn, v <= min && { opacity: 0.4 }]}
        disabled={v <= min}
        accessibilityLabel="-"
      >
        <Ionicons name="remove" size={20} color={T.ink} />
      </TouchableOpacity>
      <Text style={s.stepVal}>{format ? format(v) : String(v)}</Text>
      <TouchableOpacity
        onPress={() => onChange(Math.min(max, v + step))}
        style={[s.stepBtn, v >= max && { opacity: 0.4 }]}
        disabled={v >= max}
        accessibilityLabel="+"
      >
        <Ionicons name="add" size={20} color={T.ink} />
      </TouchableOpacity>
    </View>
  );
});

export const Field = React.forwardRef(function Field(props, ref) {
  return (
    <TextInput ref={ref} placeholderTextColor={T.faint} {...props} style={[s.input, props.style]} />
  );
});

export const SectionTitle = memo(function SectionTitle({ title, hint, right }) {
  return (
    <View style={s.sectionRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>{title}</Text>
        {hint ? <Text style={s.sectionHint}>{hint}</Text> : null}
      </View>
      {right || null}
    </View>
  );
});

export const Empty = memo(function Empty({ emoji = '🍽️', title, text, action }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyBubble}>
        <Text style={{ fontSize: 40 }}>{emoji}</Text>
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      {text ? <Text style={s.emptyText}>{text}</Text> : null}
      {action || null}
    </View>
  );
});

export const Loading = memo(function Loading({ label }) {
  return (
    <View style={s.empty}>
      <ActivityIndicator size="large" color={T.brand} />
      {label ? <Text style={[s.emptyText, { marginTop: 14 }]}>{label}</Text> : null}
    </View>
  );
});

export const ErrorBox = memo(function ErrorBox({ text, onRetry, retryLabel }) {
  return (
    <View style={s.errBox}>
      <Ionicons name="alert-circle" size={20} color={T.danger} />
      <Text style={s.errTxt}>{text}</Text>
      {onRetry ? (
        <TouchableOpacity onPress={onRetry}>
          <Text
            style={[s.errTxt, { color: T.ink, fontWeight: '800', textDecorationLine: 'underline' }]}
          >
            {retryLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

const s = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    minHeight: 40,
    maxWidth: '100%',
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  chipSmall: { paddingHorizontal: 11, paddingVertical: 6 },
  chipOn: { backgroundColor: T.brand, borderColor: T.brand },
  chipOff: { backgroundColor: '#fff', borderColor: T.border },
  chipTxt: { fontSize: 14, fontWeight: '700', color: T.ink },
  btn: {
    minHeight: 54,
    borderRadius: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOn: { backgroundColor: T.brand, ...T.shadowSm },
  btnSoft: { backgroundColor: T.brandSoft },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  ghost: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  ghostTxt: { color: T.muted, fontSize: 14, fontWeight: '700' },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: T.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepVal: { minWidth: 44, textAlign: 'center', fontSize: 18, fontWeight: '800', color: T.ink },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: T.borderInput,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: T.ink,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 24, marginBottom: 12 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: T.ink },
  sectionHint: { fontSize: 13, color: T.muted, marginTop: 2 },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  emptyBubble: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: T.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: T.ink, textAlign: 'center' },
  emptyText: {
    fontSize: 15,
    color: T.muted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 21,
  },
  errBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    backgroundColor: T.dangerSoft,
    borderRadius: 14,
    padding: 12,
    marginVertical: 8,
  },
  errTxt: { color: T.danger, fontSize: 14, fontWeight: '600', marginLeft: 8, flexShrink: 1 },
});
