// The signed-in customer's partner record and the partner programme settings.
// Both are live listeners; `ready` turns true once both have answered.

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_PARTNER_SETTINGS, type PartnerSettings } from '@/lib/partner';
import { subscribeOwnPartner, subscribePartnerSettings, type PartnerRecord } from '@/services/partnerService';

export interface PartnerState {
  ready: boolean;
  record: PartnerRecord | null;
  settings: PartnerSettings;
  error: string | null;
}

export function usePartner(): PartnerState {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [record, setRecord] = useState<PartnerRecord | null>(null);
  const [recordReady, setRecordReady] = useState(false);
  const [settings, setSettings] = useState<PartnerSettings>(DEFAULT_PARTNER_SETTINGS);
  const [settingsReady, setSettingsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      subscribePartnerSettings(
        (s, answered) => {
          setSettings(s);
          if (answered) setSettingsReady(true);
        },
        () => setSettingsReady(true), // defaults (programme off) on a read error
      ),
    [],
  );

  useEffect(() => {
    setRecord(null);
    setRecordReady(false);
    if (!uid) return;
    return subscribeOwnPartner(
      uid,
      (r, answered) => {
        setRecord(r);
        if (answered) setRecordReady(true);
      },
      (e) => {
        setError(e.message);
        setRecordReady(true);
      },
    );
  }, [uid]);

  return { ready: Boolean(uid) && recordReady && settingsReady, record, settings, error };
}
