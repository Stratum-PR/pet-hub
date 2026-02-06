import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CreditCard } from 'lucide-react';
import { BusinessClient } from '@/hooks/useBusinessData';
import { formatPhoneNumber } from '@/lib/phoneFormat';
import { t } from '@/lib/translations';

interface CustomerFormProps {
  initialData?: BusinessClient | null;
  onSubmit: (data: Omit<BusinessClient, 'id' | 'created_at' | 'updated_at' | 'business_id'>) => void;
  onCancel?: () => void;
  isEditing?: boolean;
}

export function CustomerForm({ initialData, onSubmit, onCancel, isEditing }: CustomerFormProps) {
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
    });
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormData({ ...formData, phone: formatted });
  };

  return (
    <Card id="customer-form" className="shadow-sm animate-fade-in">
      <CardHeader>
        <CardTitle>
          {isEditing ? t('clientForm.editClient') : t('clientForm.addNewClient')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">{t('clientForm.firstName')} *</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                required
                placeholder={t('clientForm.firstNamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">{t('clientForm.lastName')} *</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                required
                placeholder={t('clientForm.lastNamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('clientForm.email')}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder={t('clientForm.emailPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t('clientForm.phone')} *</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={handlePhoneChange}
                required
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">{t('clientForm.address')}</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder={t('clientForm.addressPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">{t('clientForm.city')}</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder={t('clientForm.cityPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">{t('clientForm.state')}</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                placeholder={t('clientForm.statePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip_code">{t('clientForm.zipCode')}</Label>
              <Input
                id="zip_code"
                value={formData.zip_code}
                onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                placeholder={t('clientForm.zipCodePlaceholder')}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">{t('clientForm.notes')}</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t('clientForm.notesPlaceholder')}
                rows={3}
              />
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="submit" className="shadow-sm">
              {isEditing ? t('clientForm.updateClient') : t('clientForm.addClient')}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                {t('common.cancel')}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
