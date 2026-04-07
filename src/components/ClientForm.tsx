import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessId } from '@/hooks/useBusinessId';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BusinessClient } from '@/hooks/useBusinessData';
import { formatPhoneNumber } from '@/lib/phoneFormat';
import { t } from '@/lib/translations';

interface ClientFormProps {
  initialData?: BusinessClient | null;
  onSubmit: (data: Omit<BusinessClient, 'id' | 'created_at' | 'updated_at' | 'business_id'> & { staff_notes_business?: string | null }) => void;
  onCancel?: () => void;
  isEditing?: boolean;
  /** When true, omit outer Card (parent provides section chrome). */
  embedded?: boolean;
  /** Override CardTitle text (e.g. portal section heading). */
  titleOverride?: string | null;
  /** Business app: load/save client_business_notes (staff-only). */
  showStaffInternalNotes?: boolean;
}

export function ClientForm({
  initialData,
  onSubmit,
  onCancel,
  isEditing,
  embedded,
  titleOverride,
  showStaffInternalNotes = false,
}: ClientFormProps) {
  const businessId = useBusinessId();
  const [staffNotes, setStaffNotes] = useState('');
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    notes: '',
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        first_name: initialData.first_name || '',
        last_name: initialData.last_name || '',
        email: initialData.email || '',
        phone: initialData.phone || '',
        address: initialData.address || '',
        city: initialData.city || '',
        state: initialData.state || '',
        zip_code: initialData.zip_code || '',
        notes: initialData.notes || '',
      });
    }
  }, [initialData]);

  useEffect(() => {
    if (!showStaffInternalNotes || !businessId || !initialData?.id) {
      setStaffNotes('');
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('client_business_notes')
        .select('notes')
        .eq('client_id', initialData.id)
        .eq('business_id', businessId)
        .maybeSingle();
      if (cancelled || error) return;
      setStaffNotes(((data as { notes?: string | null } | null)?.notes ?? '') || '');
    })();
    return () => {
      cancelled = true;
    };
  }, [showStaffInternalNotes, businessId, initialData?.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      email: formData.email || null,
      address: formData.address || null,
      city: formData.city || null,
      state: formData.state || null,
      zip_code: formData.zip_code || null,
      notes: formData.notes || null,
      ...(showStaffInternalNotes ? { staff_notes_business: staffNotes.trim() || null } : {}),
    });
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormData({ ...formData, phone: formatted });
  };

  const title =
    titleOverride?.trim() ||
    (isEditing ? t('form.editClient') : t('form.addNewClient'));

  const formInner = (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">{t('form.firstName')} *</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                required
                placeholder={t('form.firstName')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">{t('form.lastName')} *</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                required
                placeholder={t('form.lastName')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('form.email')}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder={t('form.email')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t('form.phone')} *</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={handlePhoneChange}
                required
                placeholder={t('form.phone')}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">{t('form.address')}</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder={t('form.address')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">{t('form.city')}</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder={t('form.city')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">{t('form.state')}</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                placeholder={t('form.state')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip_code">{t('form.zipCode')}</Label>
              <Input
                id="zip_code"
                value={formData.zip_code}
                onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                placeholder={t('form.zipCode')}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">{t('form.notes')}</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t('form.notes')}
                rows={3}
              />
            </div>
            {showStaffInternalNotes && (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="staff_client_notes">Notas internas (solo personal)</Label>
                <Textarea
                  id="staff_client_notes"
                  value={staffNotes}
                  onChange={(e) => setStaffNotes(e.target.value)}
                  placeholder="Notas visibles solo en este negocio."
                  rows={3}
                />
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="submit" className="shadow-sm">
              {isEditing ? t('common.save') : t('clients.addClient')}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                {t('common.cancel')}
              </Button>
            )}
          </div>
        </form>
  );

  if (embedded) {
    return (
      <div id="client-form" className="animate-fade-in">
        {formInner}
      </div>
    );
  }

  return (
    <Card id="client-form" className="animate-fade-in">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{formInner}</CardContent>
    </Card>
  );
}
