// Réglages des rappels : tout est désactivé par défaut, la permission n'est demandée qu'à l'activation.
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, StyleSheet, Switch, Text, View } from 'react-native';
import { T } from './theme';
import { Chip, GhostButton, SectionTitle, Stepper } from './ui';
import { useMenus } from './MenusContext';
import useT from './useT';
import { anyReminderOn } from '../../lib/menus/reminders';
import {
  getMenuReminderPermission,
  requestMenuReminderPermission,
} from '../../services/menuReminders';

const JOURS = [0, 1, 2, 3, 4, 5, 6];
const PAS_MINUTES = 30;
const DERNIERE_MINUTE = 23 * 60 + 30;

const p2 = (n) => String(n).padStart(2, '0');
const heure = (m) => `${p2(Math.floor(m / 60))}:${p2(m % 60)}`;

function Ligne({ label, hint, on, onChange }) {
  return (
    <View style={s.ligne}>
      <View style={s.ligneTxt}>
        <Text style={s.label}>{label}</Text>
        {hint ? <Text style={s.hint}>{hint}</Text> : null}
      </View>
      <Switch
        value={on}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ false: T.borderInput, true: T.brand }}
        thumbColor="#fff"
        ios_backgroundColor={T.borderInput}
      />
    </View>
  );
}

function Quand({ reglage, onChange }) {
  const t = useT();
  const minutes = reglage.hour * 60 + reglage.minute;
  return (
    <View style={s.quand}>
      <View style={s.jours}>
        {JOURS.map((j) => (
          <Chip
            key={j}
            small
            label={t(`days.short.${j}`)}
            on={reglage.weekday === j}
            onPress={() => onChange({ weekday: j })}
          />
        ))}
      </View>
      <Stepper
        label={t('reminders.time')}
        value={minutes}
        min={0}
        max={DERNIERE_MINUTE}
        step={PAS_MINUTES}
        format={heure}
        onChange={(m) => onChange({ hour: Math.floor(m / 60), minute: m % 60 })}
      />
    </View>
  );
}

export default function RemindersSection() {
  const t = useT();
  const { reminders, updateReminders } = useMenus();
  const [permission, setPermission] = useState(null);

  const relire = useCallback(() => {
    getMenuReminderPermission().then(setPermission);
  }, []);
  useEffect(() => {
    relire();
    const sub = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') relire();
    });
    return () => sub.remove();
  }, [relire]);

  const basculer = async (cle, valeur) => {
    if (!valeur) {
      updateReminders(cle, { on: false });
      return;
    }
    const p = await requestMenuReminderPermission();
    setPermission(p);
    if (p.granted) updateReminders(cle, { on: true });
  };

  if (permission && !permission.available)
    return (
      <>
        <SectionTitle title={t('reminders.title')} />
        <Text style={s.hint}>{t('reminders.unavailable')}</Text>
      </>
    );

  const refusee = !!permission && permission.status === 'denied';
  // Rappel activé sur un autre appareil du compte : la permission reste propre à celui-ci.
  const aAutoriser = !!permission && !permission.granted && !refusee && anyReminderOn(reminders);

  return (
    <>
      <SectionTitle title={t('reminders.title')} hint={t('reminders.hint')} />
      {refusee ? (
        <View style={s.alerte}>
          <Text style={s.alerteTxt}>{t('reminders.denied')}</Text>
          <GhostButton
            icon="settings-outline"
            label={t('reminders.openSettings')}
            onPress={() => Linking.openSettings().catch(() => {})}
          />
        </View>
      ) : null}
      {aAutoriser ? (
        <View style={s.alerte}>
          <Text style={s.alerteTxt}>{t('reminders.allowHere')}</Text>
          <GhostButton
            icon="notifications-outline"
            label={t('reminders.allow')}
            onPress={() => requestMenuReminderPermission().then(setPermission)}
          />
        </View>
      ) : null}
      <Ligne
        label={t('reminders.plan')}
        on={reminders.plan.on}
        onChange={(v) => basculer('plan', v)}
      />
      {reminders.plan.on ? (
        <Quand reglage={reminders.plan} onChange={(p) => updateReminders('plan', p)} />
      ) : null}
      <Ligne
        label={t('reminders.shop')}
        on={reminders.shop.on}
        onChange={(v) => basculer('shop', v)}
      />
      {reminders.shop.on ? (
        <Quand reglage={reminders.shop} onChange={(p) => updateReminders('shop', p)} />
      ) : null}
      <Ligne
        label={t('reminders.prep')}
        hint={t('reminders.prepHint')}
        on={reminders.prep.on}
        onChange={(v) => basculer('prep', v)}
      />
    </>
  );
}

const s = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingVertical: 6 },
  ligneTxt: { flex: 1, paddingRight: 12 },
  label: { fontSize: 15, fontWeight: '700', color: T.ink },
  hint: { fontSize: 13, color: T.muted, lineHeight: 18, marginTop: 2 },
  quand: { paddingBottom: 10, gap: 10, alignItems: 'flex-start' },
  jours: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  alerte: {
    backgroundColor: T.subtle,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    alignItems: 'flex-start',
    gap: 8,
  },
  alerteTxt: { fontSize: 14, color: T.ink, lineHeight: 20 },
});
