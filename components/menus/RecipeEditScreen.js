// Créer ou modifier une recette personnelle : import par lien (facultatif), puis un formulaire simple.
import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '../ui/IoniconsSens';
import {
  emptyDraft,
  draftFromRecipe,
  draftFromImport,
  validateDraft,
  UNITS,
} from '../../lib/menus/myRecipes';
import { importRecipe } from '../../services/myRecipesApi';
import { pickPhoto, photoSources } from '../../services/recipePhotos';
import { T } from './theme';
import { Chip, Field, PrimaryButton, GhostButton, RoundIcon, Stepper } from './ui';
import { useMenus } from './MenusContext';
import useT from './useT';

const IMPORT_MSG = {
  invalid_url: 'importInvalid',
  not_a_recipe: 'importNotRecipe',
  rate_limited: 'importRate',
  offline: 'importOffline',
  login: 'importLogin',
  unavailable: 'importUnavailable',
};

export default function RecipeEditScreen({ id, onClose }) {
  const t = useT();
  const m = useMenus();
  const existing = id ? m.recipeById.get(id) : null;
  const tr = (k, o) => t(`myRecipes.${k}`, o);
  const [draft, setDraft] = useState(() =>
    existing && existing.custom ? draftFromRecipe(existing, m.texts) : emptyDraft()
  );
  const initial = useRef(JSON.stringify(draft));
  const [url, setUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const [errors, setErrors] = useState([]);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);

  const patch = (p) => setDraft((d) => ({ ...d, ...p }));
  const setIngredient = (i, p) =>
    setDraft((d) => ({
      ...d,
      ingredients: d.ingredients.map((x, j) => (j === i ? { ...x, ...p } : x)),
    }));
  const setStep = (i, v) =>
    setDraft((d) => ({ ...d, steps: d.steps.map((x, j) => (j === i ? v : x)) }));

  const photoUri = useMemo(() => {
    if (draft.photoTemp) return draft.photoTemp;
    return photoSources({ custom: true, photoFile: draft.photoFile, photoUrl: draft.photoUrl })[0];
  }, [draft.photoTemp, draft.photoFile, draft.photoUrl]);

  const doImport = async () => {
    if (importing || !url.trim()) return;
    setImporting(true);
    setImportMsg(null);
    const r = await importRecipe(url);
    setImporting(false);
    if (r.status === 'ok') {
      setDraft((d) => draftFromImport(r.data, d));
      setErrors([]);
      setImportMsg({ ok: true, text: tr('importDone') });
    } else setImportMsg({ ok: false, text: tr(IMPORT_MSG[r.status] || 'importUnavailable') });
  };

  const choosePhoto = async () => {
    const r = await pickPhoto();
    if (r.status === 'ok') patch({ photoTemp: r.uri });
    else if (r.status === 'denied') Alert.alert(tr('photo'), tr('photoDenied'));
  };

  const close = () => {
    if (JSON.stringify(draft) === initial.current) {
      onClose();
      return;
    }
    Alert.alert(tr('discardTitle'), tr('discardText'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: tr('discard'), style: 'destructive', onPress: onClose },
    ]);
  };

  const save = async () => {
    if (saving) return;
    const v = validateDraft(draft);
    setErrors(v.errors);
    setSaveError(null);
    if (!v.ok) return;
    setSaving(true);
    const r = await m.saveMyRecipe(draft);
    setSaving(false);
    if (!r.ok) {
      setSaveError(tr(r.reason === 'full' ? 'errFull' : 'errStorage'));
      return;
    }
    if (r.photoLost) Alert.alert(tr('photo'), tr('photoFailed'));
    onClose();
  };

  const unitLabel = (u) => {
    if (u === 'u') return tr('piece');
    return u === 'cl' || u === 'dl' ? u : t(`units.${u}`);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.head}>
        <RoundIcon name="chevron-back" onPress={close} label={t('common.back')} />
        <Text style={s.title} numberOfLines={1}>
          {tr(id ? 'editTitle' : 'newTitle')}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={s.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {id ? null : (
          <View style={s.box}>
            <Text style={[s.label, { marginTop: 0 }]}>{tr('importLabel')}</Text>
            <Field
              value={url}
              onChangeText={setUrl}
              placeholder={tr('importPlaceholder')}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={doImport}
            />
            <PrimaryButton
              soft
              icon="download-outline"
              label={tr('importBtn')}
              loading={importing}
              disabled={!url.trim()}
              onPress={doImport}
              style={{ marginTop: 10 }}
            />
            {importMsg ? (
              <Text style={[s.msg, !importMsg.ok && { color: T.danger }]}>{importMsg.text}</Text>
            ) : null}
          </View>
        )}

        <Text style={s.label}>{tr('title')}</Text>
        <Field
          value={draft.title}
          onChangeText={(v) => patch({ title: v })}
          placeholder={tr('titlePlaceholder')}
          maxLength={120}
        />
        {errors.includes('title') ? <Text style={s.err}>{tr('errTitle')}</Text> : null}

        <View style={s.line}>
          <Text style={s.inlineLabel}>{tr('servings')}</Text>
          <Stepper
            value={draft.servings}
            min={1}
            max={24}
            onChange={(v) => patch({ servings: v })}
            label={tr('servings')}
          />
        </View>
        <View style={s.line}>
          <Text style={s.inlineLabel}>{tr('time')}</Text>
          <Stepper
            value={draft.timeMin}
            min={5}
            max={480}
            step={5}
            onChange={(v) => patch({ timeMin: v })}
            label={tr('time')}
          />
        </View>

        <Text style={s.label}>{tr('ingredients')}</Text>
        {draft.ingredients.map((ing, i) => (
          <View key={i} style={s.ingBox}>
            <View style={s.rowCenter}>
              <Field
                value={ing.name}
                onChangeText={(v) => setIngredient(i, { name: v })}
                placeholder={tr('ingName')}
                maxLength={80}
                style={{ flex: 1 }}
              />
              <TouchableOpacity
                onPress={() => patch({ ingredients: draft.ingredients.filter((_, j) => j !== i) })}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={s.remove}
                accessibilityRole="button"
                accessibilityLabel={tr('remove')}
              >
                <Ionicons name="close-circle-outline" size={24} color={T.faint} />
              </TouchableOpacity>
            </View>
            <View style={[s.rowCenter, { marginTop: 8 }]}>
              <Field
                value={ing.qty}
                onChangeText={(v) => setIngredient(i, { qty: v })}
                placeholder={tr('ingQty')}
                keyboardType="decimal-pad"
                style={s.qty}
              />
              <ScrollView
                horizontal
                keyboardShouldPersistTaps="handled"
                showsHorizontalScrollIndicator={false}
                style={{ flex: 1, marginLeft: 8 }}
              >
                {UNITS.map((u) => (
                  <View key={u} style={{ marginRight: 6 }}>
                    <Chip
                      small
                      label={unitLabel(u)}
                      on={ing.unit === u}
                      onPress={() => setIngredient(i, { unit: u })}
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        ))}
        {errors.includes('ingredients') ? <Text style={s.err}>{tr('errIngredients')}</Text> : null}
        <GhostButton
          icon="add"
          label={tr('addIngredient')}
          onPress={() =>
            patch({ ingredients: [...draft.ingredients, { name: '', qty: '', unit: 'g' }] })
          }
        />

        <Text style={s.label}>{tr('steps')}</Text>
        {draft.steps.map((st, i) => (
          <View key={i} style={[s.rowCenter, { marginBottom: 8 }]}>
            <Field
              value={st}
              onChangeText={(v) => setStep(i, v)}
              placeholder={tr('stepPlaceholder')}
              multiline
              style={{ flex: 1, minHeight: 64, textAlignVertical: 'top' }}
            />
            <TouchableOpacity
              onPress={() => patch({ steps: draft.steps.filter((_, j) => j !== i) })}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={s.remove}
              accessibilityRole="button"
              accessibilityLabel={tr('remove')}
            >
              <Ionicons name="close-circle-outline" size={24} color={T.faint} />
            </TouchableOpacity>
          </View>
        ))}
        <GhostButton
          icon="add"
          label={tr('addStep')}
          onPress={() => patch({ steps: [...draft.steps, ''] })}
        />

        <Text style={s.label}>{tr('photo')}</Text>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={s.photo} resizeMode="cover" />
        ) : null}
        <GhostButton
          icon="image-outline"
          label={tr(photoUri ? 'changePhoto' : 'addPhoto')}
          onPress={choosePhoto}
        />
        {photoUri ? (
          <GhostButton
            danger
            icon="trash-outline"
            label={tr('removePhoto')}
            onPress={() => patch({ photoTemp: null, photoFile: null, photoUrl: null })}
          />
        ) : null}
      </ScrollView>
      <View style={s.bar}>
        {saveError ? <Text style={s.err}>{saveError}</Text> : null}
        <PrimaryButton icon="checkmark" label={tr('save')} loading={saving} onPress={save} />
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  title: { flex: 1, marginLeft: 12, fontSize: 20, fontWeight: '900', color: T.ink },
  body: { paddingHorizontal: 18, paddingBottom: 30 },
  box: { backgroundColor: T.subtle, borderRadius: 16, padding: 14 },
  label: { fontSize: 15, fontWeight: '800', color: T.ink, marginTop: 20, marginBottom: 8 },
  inlineLabel: { flex: 1, fontSize: 15, fontWeight: '800', color: T.ink },
  line: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  msg: { fontSize: 14, lineHeight: 20, color: T.brandDark, marginTop: 10, fontWeight: '600' },
  err: { fontSize: 14, color: T.danger, marginTop: 6, marginBottom: 6, fontWeight: '600' },
  ingBox: { marginBottom: 12 },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  remove: { marginLeft: 8 },
  qty: { width: 96 },
  photo: { height: 180, borderRadius: 16, backgroundColor: T.subtle, marginBottom: 6 },
  bar: { padding: 14, borderTopWidth: 1, borderTopColor: T.border, backgroundColor: '#fff' },
});
