/**
 * In-page section ids for Business settings — used by AppSidebar (hash links) and BusinessSettingsPage (section elements).
 */
export type BusinessSettingsAnchorId =
  | 'general'
  | 'business-hours'
  | 'branding'
  | 'inventory'
  | 'payroll'
  | 'tax'
  | 'receipts'
  | 'payments'
  | 'data-export';

export function getBusinessSettingsAnchorNavItems(
  isFeatureVisible: (key: string) => boolean
): { id: BusinessSettingsAnchorId; labelKey: string }[] {
  const items: { id: BusinessSettingsAnchorId; labelKey: string }[] = [
    { id: 'general', labelKey: 'businessSettings.navGeneral' },
    { id: 'business-hours', labelKey: 'businessSettings.navBusinessHours' },
    { id: 'branding', labelKey: 'businessSettings.navBranding' },
    { id: 'inventory', labelKey: 'businessSettings.navInventory' },
    { id: 'payroll', labelKey: 'businessSettings.navPayroll' },
  ];
  if (isFeatureVisible('tax_settings')) {
    items.push({ id: 'tax', labelKey: 'businessSettings.navTax' });
  }
  if (isFeatureVisible('receipt_personalization')) {
    items.push({ id: 'receipts', labelKey: 'businessSettings.navReceipts' });
  }
  if (isFeatureVisible('payment_configuration')) {
    items.push({ id: 'payments', labelKey: 'businessSettings.navPayments' });
  }
  items.push({ id: 'data-export', labelKey: 'businessSettings.navDataExport' });
  return items;
}
