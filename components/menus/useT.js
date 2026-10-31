import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

/** t('menus.' + clé) : toutes les phrases de l'onglet sont dans le namespace "menus". */
export default function useT() {
  const { t } = useTranslation();
  return useCallback((k, o) => t(`menus.${k}`, o), [t]);
}
