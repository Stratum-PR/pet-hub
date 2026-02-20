/**
 * Geofencing Settings Component
 * Allows managers to configure geofencing for time clock
 */

import { useState, useEffect } from 'react';
import { MapPin, Navigation, ToggleLeft, ToggleRight, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useGeolocation } from '@/hooks/useGeolocation';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessId } from '@/hooks/useBusinessId';
import { toast } from 'sonner';

interface GeofencingSettingsProps {
  onSave?: () => void;
}

export function GeofencingSettings({ onSave }: GeofencingSettingsProps) {
  const businessId = useBusinessId();
  const { getCurrentLocation, loading: geoLoading } = useGeolocation();
  const [enabled, setEnabled] = useState(false);
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
  const [radius, setRadius] = useState<number>(100);
  const [locationName, setLocationName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) return;
    loadSettings();
  }, [businessId]);

  const loadSettings = async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('businesses')
        .select('geofencing_enabled, geofencing_latitude, geofencing_longitude, geofencing_radius_meters, geofencing_location_name')
        .eq('id', businessId)
        .single();

      if (err) throw err;

      if (data) {
        setEnabled(data.geofencing_enabled || false);
        setLatitude(data.geofencing_latitude?.toString() || '');
        setLongitude(data.geofencing_longitude?.toString() || '');
        setRadius(data.geofencing_radius_meters || 100);
        setLocationName(data.geofencing_location_name || '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    try {
      const location = await getCurrentLocation();
      setLatitude(location.latitude.toString());
      setLongitude(location.longitude.toString());
      setError(null);
      toast.success('Current location captured');
    } catch (err) {
      setError('Failed to get current location. Please enable location services.');
      toast.error('Failed to get current location');
    }
  };

  const handleSave = async () => {
    if (!businessId) return;

    if (enabled) {
      if (!latitude || !longitude) {
        setError('Please set the store location before enabling geofencing');
        return;
      }
      if (isNaN(parseFloat(latitude)) || isNaN(parseFloat(longitude))) {
        setError('Invalid latitude or longitude');
        return;
      }
      if (parseFloat(latitude) < -90 || parseFloat(latitude) > 90) {
        setError('Latitude must be between -90 and 90');
        return;
      }
      if (parseFloat(longitude) < -180 || parseFloat(longitude) > 180) {
        setError('Longitude must be between -180 and 180');
        return;
      }
      if (radius < 10 || radius > 10000) {
        setError('Radius must be between 10 and 10,000 meters');
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      const { error: err } = await supabase
        .from('businesses')
        .update({
          geofencing_enabled: enabled,
          geofencing_latitude: enabled ? parseFloat(latitude) : null,
          geofencing_longitude: enabled ? parseFloat(longitude) : null,
          geofencing_radius_meters: enabled ? radius : null,
          geofencing_location_name: enabled ? locationName || null : null,
        })
        .eq('id', businessId);

      if (err) throw err;

      toast.success('Geofencing settings saved');
      onSave?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
      toast.error('Failed to save geofencing settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Loading geofencing settings...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Geofencing Settings
        </CardTitle>
        <CardDescription>
          Require employees to be at the store location to clock in. Employees must enable location services on their device.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="geofencing-enabled">Enable Geofencing</Label>
            <p className="text-sm text-muted-foreground">
              When enabled, employees must be within the specified radius to clock in
            </p>
          </div>
          <Switch
            id="geofencing-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        {enabled && (
          <>
            {/* Store Location */}
            <div className="space-y-2">
              <Label>Store Location</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="latitude" className="text-xs text-muted-foreground">
                    Latitude
                  </Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="e.g., 18.2208"
                  />
                </div>
                <div>
                  <Label htmlFor="longitude" className="text-xs text-muted-foreground">
                    Longitude
                  </Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="e.g., -66.5901"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleUseCurrentLocation}
                disabled={geoLoading}
                className="w-full"
              >
                <Navigation className="w-4 h-4 mr-2" />
                {geoLoading ? 'Getting location...' : 'Use My Current Location'}
              </Button>
            </div>

            {/* Location Name */}
            <div className="space-y-2">
              <Label htmlFor="location-name">Location Name (Optional)</Label>
              <Input
                id="location-name"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="e.g., Main Store, Downtown Location"
              />
            </div>

            {/* Radius */}
            <div className="space-y-2">
              <Label htmlFor="radius">Radius (meters)</Label>
              <Input
                id="radius"
                type="number"
                min="10"
                max="10000"
                step="10"
                value={radius}
                onChange={(e) => setRadius(parseInt(e.target.value) || 100)}
              />
              <p className="text-xs text-muted-foreground">
                Employees must be within {radius} meters ({Math.round(radius * 3.28084)} feet) of the store to clock in
              </p>
            </div>

            {/* Preview */}
            {latitude && longitude && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-1">Store Location:</p>
                <p className="text-sm text-muted-foreground">
                  {locationName || 'Unnamed Location'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {parseFloat(latitude).toFixed(6)}, {parseFloat(longitude).toFixed(6)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Radius: {radius}m ({Math.round(radius * 3.28084)}ft)
                </p>
              </div>
            )}
          </>
        )}

        {/* Error Message */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full"
        >
          {saving ? 'Saving...' : 'Save Geofencing Settings'}
        </Button>
      </CardContent>
    </Card>
  );
}

