import { StyleSheet, Platform } from "react-native";
import { MARCHE, SERIF, TAILLES } from "../../components/ui/marche";
import { THEME } from "../../components/commun/theme";

export const profStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: THEME.bg },

  // Custom in-screen header
  header: { paddingHorizontal: TAILLES.marge, paddingTop: 10, paddingBottom: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 26, fontFamily: SERIF, fontWeight: '400', color: THEME.ink, letterSpacing: -0.3 },
  subtitle: { fontSize: 13, color: THEME.muted, marginTop: 2, fontWeight: '600' },

  // Profile identity card
  profileCard: { backgroundColor: THEME.card, borderRadius: 16, marginHorizontal: TAILLES.marge, marginTop: 8, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  avatarWrap: { width: 60, height: 60, marginBottom: 8 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#9ca3af', alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: '#3B82F6', overflow: 'hidden' },
  avatarImg: { width: 60, height: 60 },
  avatarInitials: { fontSize: 24, fontWeight: '600', color: '#fff' },
  avatarBadge: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: THEME.card, zIndex: 10 },
  profileName: { fontSize: 19, fontFamily: SERIF, fontWeight: '600', color: THEME.ink, letterSpacing: -0.3, textAlign: 'center' },
  profileHandle: { fontSize: 13, color: THEME.muted, marginTop: 2, fontWeight: '600' },
  editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.borderInput, paddingHorizontal: 16, height: TAILLES.boutonPetit, borderRadius: TAILLES.rayonBouton, marginTop: 10 },
  editBtnTxt: { color: THEME.ink, fontWeight: '700', fontSize: 13, marginLeft: 6 },

  // Section
  section: { marginTop: 14, paddingHorizontal: TAILLES.marge },
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontFamily: SERIF, fontWeight: '600', color: THEME.ink, letterSpacing: -0.3 },
  sectionCount: { fontSize: 12.5, fontWeight: '700', color: THEME.muted },

  // Verification banners
  banner: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 14, marginBottom: 10 },
  bannerWarn: { backgroundColor: '#FEF3C7' },
  bannerOk: { backgroundColor: THEME.brandSoft },
  bannerTxt: { flex: 1, fontSize: 13, fontWeight: '600', marginLeft: 10, lineHeight: 18 },

  // Document status card
  docCard: { backgroundColor: THEME.card, borderRadius: 16, padding: 6, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  docRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10 },
  docDivider: { borderBottomWidth: 1, borderBottomColor: THEME.border },
  docIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  docLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: THEME.ink, marginLeft: 10 },
  docStatusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  docStatusTxt: { fontSize: 11.5, fontWeight: '600' },

  // Order card
  orderCard: { backgroundColor: THEME.card, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  orderRow: { flexDirection: 'row', alignItems: 'center' },
  orderIcon: { width: 44, height: 44, borderRadius: 16, backgroundColor: THEME.brandSoft, alignItems: 'center', justifyContent: 'center' },
  orderBody: { flex: 1, marginLeft: 12, marginRight: 8 },
  orderTitle: { fontSize: 15.5, fontWeight: '700', color: THEME.ink },
  orderStatusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  orderDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  orderStatusTxt: { fontSize: 12.5, fontWeight: '700' },
  orderShops: { fontSize: 12.5, color: THEME.muted, marginTop: 3, fontWeight: '600' },
  orderDate: { fontSize: 11.5, color: THEME.faint, marginTop: 2, fontWeight: '600' },
  orderSide: { alignItems: 'flex-end' },
  modePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: THEME.subtle, marginBottom: 4 },
  modePillTxt: { fontSize: 10, fontWeight: '600', color: THEME.muted },
  orderPrice: { fontSize: 15.5, fontWeight: '600', color: THEME.ink },

  // Settings rows
  settingsCard: { backgroundColor: THEME.card, borderRadius: 16, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm, overflow: 'hidden' },
  settingRow: { flexDirection: 'row', alignItems: 'center', minHeight: 62, paddingVertical: 11, paddingHorizontal: 14 },
  settingDivider: { borderBottomWidth: 1, borderBottomColor: THEME.border },
  settingIcon: { width: TAILLES.icone, height: TAILLES.icone, borderRadius: TAILLES.icone / 2, borderWidth: 1, borderColor: THEME.border, backgroundColor: THEME.card, alignItems: 'center', justifyContent: 'center' },
  settingBody: { flex: 1, marginLeft: 12, marginRight: 8 },
  settingLabel: { fontSize: 15, fontWeight: '700', color: THEME.ink },
  settingValue: { fontSize: 12.5, color: THEME.muted, marginTop: 1, fontWeight: '600' },

  // Driver CTA card
  driverCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.brandSoft, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: THEME.border },
  driverIcon: { width: 44, height: 44, borderRadius: 16, borderWidth: 1, borderColor: '#DCC9B8', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  driverBody: { flex: 1, marginLeft: 12, marginRight: 8 },
  driverTitle: { fontSize: 15.5, fontWeight: '600', color: THEME.ink },
  driverSub: { fontSize: 12.5, color: THEME.muted, marginTop: 2, fontWeight: '600' },

  // Logout
  logoutBtn: { height: TAILLES.bouton, borderRadius: TAILLES.rayonBouton, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.danger, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  logoutTxt: { fontSize: 15.5, fontWeight: '600', color: THEME.danger, marginLeft: 8 },
  deleteAccountBtn: { height: TAILLES.boutonPetit, borderRadius: TAILLES.rayonBouton, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  deleteAccountTxt: { fontSize: 13.5, fontWeight: '700', color: THEME.danger, marginLeft: 6, textDecorationLine: 'underline' },

  // Empty state
  empty: { backgroundColor: THEME.card, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 24, alignItems: 'center', borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  emptyCircle: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: THEME.border, backgroundColor: THEME.card, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 17, fontFamily: SERIF, fontWeight: '600', color: THEME.ink, textAlign: 'center' },
  emptyHint: { fontSize: 13.5, color: THEME.muted, textAlign: 'center', marginTop: 6, lineHeight: 19 },

  // Guest screen
  guestWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  guestTitle: { fontSize: 17, fontFamily: SERIF, fontWeight: '600', color: THEME.ink, textAlign: 'center' },
  guestHint: { fontSize: 13.5, color: THEME.muted, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  guestBtn: { height: TAILLES.bouton, borderRadius: TAILLES.rayonBouton, borderWidth: 1, borderColor: THEME.borderInput, backgroundColor: THEME.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', marginTop: 24, ...THEME.shadow },
  guestBtnTxt: { color: THEME.ink, fontWeight: '600', fontSize: 16, marginLeft: 8 },
  // Guest hero (design soigné) + préférences accessibles sans connexion
  guestHero: { marginHorizontal: TAILLES.marge, marginVertical: 20, borderRadius: TAILLES.rayonCarte, borderWidth: 1, borderColor: THEME.border, backgroundColor: THEME.card, paddingVertical: 26, paddingHorizontal: 24, alignItems: 'center', ...THEME.shadow },
  guestHeroIcon: { width: 78, height: 78, borderRadius: 39, backgroundColor: THEME.subtle, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  guestHeroTitle: { fontSize: 20, fontFamily: SERIF, fontWeight: '600', color: THEME.ink, textAlign: 'center', letterSpacing: -0.3 },
  guestHeroHint: { fontSize: 13, color: THEME.muted, textAlign: 'center', marginTop: 8, lineHeight: 19, fontWeight: '600' },
  guestHeroBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', backgroundColor: MARCHE.noir, borderWidth: 1, borderColor: MARCHE.noir, paddingHorizontal: 26, height: TAILLES.bouton, borderRadius: TAILLES.rayonBouton, marginTop: 18 },
  guestHeroBtnTxt: { color: MARCHE.blanc, fontWeight: '600', fontSize: 15, marginLeft: 8 },
  guestHeroBtnAlt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.borderInput, paddingHorizontal: 26, height: TAILLES.bouton, borderRadius: TAILLES.rayonBouton, marginTop: 10 },
  guestHeroBtnAltTxt: { color: THEME.ink, fontWeight: '600', fontSize: 15, marginLeft: 8 },
  guestPrefTitle: { fontSize: 12, fontWeight: '600', color: THEME.faint, marginBottom: 10, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.6 },

  // Full-page modal header
  modalScreen: { flex: 1, backgroundColor: THEME.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: THEME.border },
  modalBack: { width: TAILLES.icone, height: TAILLES.icone, borderRadius: TAILLES.icone / 2, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  modalTitle: { fontSize: 20, fontFamily: SERIF, fontWeight: '600', color: THEME.ink, flex: 1, letterSpacing: -0.4 },
  modalHeaderPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: THEME.terraSoft },
  modalHeaderPillTxt: { fontSize: 12, fontWeight: '600', color: THEME.terraDark },

  // Form fields
  fieldLabel: { fontSize: 12.5, fontWeight: '700', color: THEME.muted, marginBottom: 6 },
  field: { height: TAILLES.champ, backgroundColor: THEME.card, borderRadius: TAILLES.rayonCarte, paddingHorizontal: 14, fontSize: 15, color: THEME.ink, borderWidth: 1, borderColor: THEME.border },
  fieldGroup: { marginBottom: 16 },
  fieldRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },

  // Generic white card inside modals
  modalCard: { backgroundColor: THEME.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },

  // Geolocation button
  geoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: TAILLES.bouton, borderRadius: TAILLES.rayonBouton, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.borderInput, marginBottom: 20 },
  geoBtnTxt: { fontSize: 14.5, fontWeight: '700', color: THEME.ink, marginLeft: 8 },

  // Password change collapsible
  pwdToggle: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.card, borderRadius: 16, borderWidth: 1, borderColor: THEME.border, paddingVertical: 14, paddingHorizontal: 14, marginBottom: 22, ...THEME.shadowSm },
  pwdToggleTxt: { flex: 1, fontSize: 15, fontWeight: '700', color: THEME.ink, marginLeft: 10 },
  pwdPanel: { backgroundColor: THEME.card, borderRadius: 16, borderWidth: 1, borderColor: THEME.border, padding: 16, marginBottom: 22, ...THEME.shadowSm },
  pwdPanelHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  pwdPanelTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: THEME.ink, marginLeft: 8 },
  pwdAlert: { borderRadius: 16, padding: 10, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  pwdAlertTxt: { fontSize: 12.5, fontWeight: '600', marginLeft: 6, flex: 1 },

  // Button row (cancel / save)
  btnRow: { flexDirection: 'row', gap: 12 },
  saveBtn: { flex: 1, height: TAILLES.bouton, borderRadius: TAILLES.rayonBouton, borderWidth: 1, borderColor: THEME.borderInput, backgroundColor: THEME.card, alignItems: 'center', justifyContent: 'center', ...THEME.shadow },
  saveBtnTxt: { color: THEME.ink, fontWeight: '600', fontSize: 15 },

  // Primary full-width button
  primaryBtn: { height: TAILLES.bouton, borderRadius: TAILLES.rayonBouton, borderWidth: 1, borderColor: THEME.borderInput, backgroundColor: THEME.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', ...THEME.shadow },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnTxt: { color: THEME.ink, fontWeight: '600', fontSize: 16, marginLeft: 8 },

  // Picker rows (language / currency)
  pickerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.card, borderRadius: 16, minHeight: 64, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  pickerRowOn: { backgroundColor: THEME.card, borderColor: MARCHE.noir },
  pickerFlag: { fontSize: 24, marginRight: 14 },
  pickerName: { fontSize: 15.5, fontWeight: '700', color: THEME.ink },
  pickerNameOn: { color: THEME.ink, fontWeight: '600' },
  pickerSub: { fontSize: 12, color: THEME.faint, marginTop: 2, fontWeight: '600' },

  // Sheet footer (confirm button area)
  sheetFooter: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 34 : 16 },

  // Driver info modal hero
  driverHero: { alignItems: 'center', marginBottom: 22 },
  driverHeroIcon: { width: 72, height: 72, borderRadius: 24, borderWidth: 1, borderColor: THEME.border, backgroundColor: THEME.card, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  driverHeroTitle: { fontSize: 22, fontFamily: SERIF, fontWeight: '600', color: THEME.ink, textAlign: 'center', letterSpacing: -0.4 },
  driverHeroSub: { fontSize: 14, color: THEME.muted, marginTop: 6, textAlign: 'center', lineHeight: 20, fontWeight: '600' },
  driverTypeCard: { backgroundColor: THEME.card, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  driverTypeHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  driverTypeIcon: { width: 36, height: 36, borderRadius: 16, backgroundColor: THEME.brandSoft, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  driverTypeTitle: { fontSize: 15.5, fontWeight: '600', color: THEME.ink },
  driverTypeTxt: { fontSize: 13, color: THEME.muted, lineHeight: 20, fontWeight: '600' },
  limitRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.card, borderRadius: 16, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  limitFlag: { fontSize: 22, marginRight: 12 },
  limitName: { fontSize: 14, fontWeight: '700', color: THEME.ink },
  limitInfo: { fontSize: 11.5, color: THEME.muted, marginTop: 1, fontWeight: '600' },
  limitValue: { fontSize: 13, fontWeight: '600' },
  legalNote: { fontSize: 11.5, color: THEME.faint, textAlign: 'center', marginTop: 10, lineHeight: 16, fontWeight: '600' },

  // Order detail rows
  detailInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  detailInfoLabel: { fontSize: 13, color: THEME.muted, marginLeft: 8, fontWeight: '600' },
  detailInfoValue: { fontSize: 13, fontWeight: '700', color: THEME.ink, marginLeft: 6 },
  driverChip: { backgroundColor: THEME.brandSoft, borderRadius: 16, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  driverChipIcon: { width: TAILLES.icone, height: TAILLES.icone, borderRadius: TAILLES.icone / 2, borderWidth: 1, borderColor: THEME.border, backgroundColor: THEME.card, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  driverChipName: { fontSize: 13.5, fontWeight: '600', color: THEME.ink },
  driverChipSub: { fontSize: 12, color: THEME.muted, marginTop: 1, fontWeight: '600' },
  driverChipCall: { width: TAILLES.icone, height: TAILLES.icone, borderRadius: TAILLES.icone / 2, borderWidth: 1, borderColor: THEME.border, backgroundColor: THEME.card, alignItems: 'center', justifyContent: 'center' },
  costBlock: { borderTopWidth: 1, borderTopColor: THEME.border, paddingTop: 12, marginTop: 4 },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  costLabel: { fontSize: 13, color: THEME.muted, fontWeight: '600' },
  costValue: { fontSize: 13, fontWeight: '700', color: THEME.ink },
  costValueFree: { fontSize: 13, fontWeight: '700', color: THEME.terra },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: THEME.border, paddingTop: 10, marginTop: 4 },
  grandLabel: { fontSize: 16, fontWeight: '600', color: THEME.ink },
  grandValue: { fontSize: 16, fontWeight: '600', color: THEME.ink },
  statusCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.brandSoft, borderRadius: 16, padding: 14, marginBottom: 12 },
  // Annulation par le client (sous le suivi de commande)
  cancelWrap: { marginTop: -4, marginBottom: 12 },
  cancelMsg: { fontSize: 13.5, lineHeight: 19, color: THEME.muted, fontWeight: '600', marginBottom: 8 },
  cancelBtn: { height: TAILLES.bouton, borderRadius: TAILLES.rayonBouton, borderWidth: 1, borderColor: THEME.danger, alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.card },
  cancelBtnTxt: { color: THEME.danger, fontSize: 15, fontWeight: '600' },
  statusCardIcon: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  statusCardLabel: { fontSize: 12.5, color: THEME.muted, fontWeight: '600' },
  statusCardValue: { fontSize: 16, fontWeight: '600', marginTop: 1 },
  shopBlock: { backgroundColor: THEME.card, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  shopBlockHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  shopBlockIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: THEME.brandSoft, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  shopBlockName: { fontSize: 15, fontWeight: '600', color: THEME.ink },
  detailItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  detailItemDivider: { borderTopWidth: 1, borderTopColor: THEME.border },
  detailItemBody: { flex: 1, marginLeft: 10 },
  detailItemName: { fontSize: 14, fontWeight: '700', color: THEME.ink },
  detailItemMeta: { fontSize: 12, color: THEME.muted, marginTop: 2, fontWeight: '600' },
  detailItemPrice: { fontSize: 14, fontWeight: '600', color: THEME.ink },
  detailFooter: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 34 : 16, borderTopWidth: 1, borderTopColor: THEME.border, backgroundColor: THEME.card },

  // Reorder bottom sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: THEME.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '78%', paddingBottom: Platform.OS === 'ios' ? 32 : 20, ...THEME.shadow, borderWidth: 1, borderColor: THEME.border },
  sheetGrabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: THEME.border, alignSelf: 'center', marginTop: 10, marginBottom: 2 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 },
  sheetTitle: { fontSize: 20, fontFamily: SERIF, fontWeight: '600', color: THEME.ink, letterSpacing: -0.4 },
  selectAllPill: { paddingHorizontal: 14, height: TAILLES.icone, borderRadius: 999, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  selectAllTxt: { fontSize: 12, fontWeight: '700', color: THEME.ink },
  closeBtn: { width: TAILLES.icone, height: TAILLES.icone, borderRadius: TAILLES.icone / 2, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border, alignItems: 'center', justifyContent: 'center' },
  reorderRow: { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 8, borderRadius: 16, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border, ...THEME.shadowSm },
  reorderRowOn: { backgroundColor: THEME.card, borderColor: MARCHE.noir },
  reorderBody: { flex: 1, marginLeft: 10 },
  reorderName: { fontSize: 14, fontWeight: '700', color: THEME.ink },
  reorderShop: { fontSize: 11.5, color: THEME.muted, marginTop: 2, fontWeight: '600' },
  reorderSide: { alignItems: 'flex-end' },
  reorderQty: { fontSize: 13, fontWeight: '700', color: THEME.muted },
  reorderPrice: { fontSize: 13.5, fontWeight: '600', color: THEME.ink, marginTop: 2 },
  reorderTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  reorderTotalLabel: { fontSize: 15, fontWeight: '600', color: THEME.ink },
  reorderTotalValue: { fontSize: 17, fontWeight: '600', color: THEME.ink },

  // Delivery address — list, cards & form
  addrSectionTitle: { fontSize: 15, fontFamily: SERIF, fontWeight: '600', color: THEME.ink, marginBottom: 12 },
  addrCard: { backgroundColor: THEME.card, borderRadius: 16, borderWidth: 1, borderColor: THEME.border, padding: 14, marginBottom: 12, ...THEME.shadowSm },
  addrCardOn: { borderColor: THEME.brand, borderWidth: 2, padding: 13 },
  addrCardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  addrTypeIcon: { width: 26, height: 26, borderRadius: 9, borderWidth: 1, borderColor: '#DCC9B8', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  addrType: { fontSize: 14.5, fontWeight: '600', color: THEME.ink },
  addrBadge: { backgroundColor: THEME.terraSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginLeft: 8 },
  addrBadgeTxt: { fontSize: 9.5, fontWeight: '600', color: THEME.terraDark, letterSpacing: 0.4, textTransform: 'uppercase' },
  addrCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: '#DCC9B8', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  addrName: { fontSize: 13.5, fontWeight: '700', color: THEME.ink, marginBottom: 3 },
  addrText: { fontSize: 13, color: THEME.muted, fontWeight: '600', lineHeight: 19 },
  addrDivider: { height: 1, backgroundColor: THEME.border, marginVertical: 12 },
  addrActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addrAction: { flexDirection: 'row', alignItems: 'center' },
  addrActionTxt: { fontSize: 13.5, fontWeight: '700', color: THEME.ink, marginLeft: 7 },
  addrEmpty: { alignItems: 'center', paddingVertical: 44 },
  addrEmptyIcon: { width: 58, height: 58, borderRadius: 16, borderWidth: 1, borderColor: '#DCC9B8', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  addrEmptyTxt: { fontSize: 14, fontWeight: '700', color: THEME.muted },
  addrFooter: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 30 : 16, borderTopWidth: 1, borderTopColor: THEME.border, backgroundColor: THEME.card },
  addrTypeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: TAILLES.champ, borderRadius: 999, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border },
  addrTypeBtnOn: { backgroundColor: MARCHE.noir, borderColor: MARCHE.noir },
  addrTypeBtnTxt: { fontSize: 14, fontWeight: '700', color: THEME.muted, marginLeft: 8 },
  addrTypeBtnTxtOn: { color: MARCHE.blanc, fontWeight: '600' },
});
