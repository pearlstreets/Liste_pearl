// Réglages : partage de la semaine avec les proches, mesure d'usage anonyme.
import React, { useCallback, useEffect, useState } from 'react';
import { SectionTitle } from './ui';
import { Ligne } from './RemindersSection';
import { useMenus } from './MenusContext';
import useT from './useT';
import { isMenusUsageEnabled, setMenusUsageEnabled } from '../../services/menusUsage';

export default function PrivacySection({ connected }) {
  const t = useT();
  const { familyShare, updateFamilyShare } = useMenus();
  const [usage, setUsage] = useState(true);
  useEffect(() => {
    let vivant = true;
    isMenusUsageEnabled().then((on) => vivant && setUsage(on));
    return () => {
      vivant = false;
    };
  }, []);
  const changeUsage = useCallback((on) => {
    setUsage(on);
    setMenusUsageEnabled(on);
  }, []);
  return (
    <>
      <SectionTitle title={t('settings.privacy')} />
      {connected ? (
        <Ligne
          label={t('settings.familyShareLabel')}
          hint={t('settings.familyShareHint')}
          on={familyShare.enabled}
          onChange={updateFamilyShare}
        />
      ) : null}
      <Ligne
        label={t('settings.usageLabel')}
        hint={t('settings.usageHint')}
        on={usage}
        onChange={changeUsage}
      />
    </>
  );
}
