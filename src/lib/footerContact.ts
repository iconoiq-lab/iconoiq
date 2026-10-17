import type { CustomerSupportSettings, FooterSettings } from '@/services/siteSettingsService';

/**
 * The footer's phone, email and opening hours.
 *
 * They are edited once, in Admin > Commerce > Support (the saved support settings). The footer editor
 * (Admin > Footer and brand) has its own phone, email and hours fields, but they are an optional
 * override: left empty, the footer shows the support values. A footer saved with its own phone,
 * email or hours keeps showing those.
 */
export function withSupportContact(
  footer: FooterSettings,
  support: Pick<CustomerSupportSettings, 'phone' | 'email' | 'hours'>,
): FooterSettings {
  const own = (list: string[] | undefined) => (list ?? []).map((v) => v.trim()).filter(Boolean);
  const phones = own(footer.phones);
  const emails = own(footer.emails);
  const supportPhone = support.phone?.trim();
  const supportEmail = support.email?.trim();
  return {
    ...footer,
    phones: phones.length ? phones : supportPhone ? [supportPhone] : [],
    emails: emails.length ? emails : supportEmail ? [supportEmail] : [],
    businessHours: footer.businessHours?.trim() || support.hours?.trim() || '',
  };
}
