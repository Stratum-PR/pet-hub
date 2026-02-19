/**
 * Geolocation Hook
 * Provides browser geolocation API functionality for time kiosk
 */

import { useState, useCallback } from 'react';

export interface GeolocationPosition {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

export interface GeolocationError {
  code: number;
  message: string;
}

export interface UseGeolocationReturn {
  position: GeolocationPosition | null;
  error: GeolocationError | null;
  loading: boolean;
  getCurrentLocation: () => Promise<GeolocationPosition>;
  clearPosition: () => void;
}

/**
 * Hook for getting current geolocation
 * @param options - Geolocation options (timeout, maximumAge, enableHighAccuracy)
 * @returns Geolocation state and functions
 */
export function useGeolocation(
  options: PositionOptions = {
    timeout: 10000,
    maximumAge: 60000, // 1 minute
    enableHighAccuracy: false,
  }
): UseGeolocationReturn {
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<GeolocationError | null>(null);
  const [loading, setLoading] = useState(false);

  const getCurrentLocation = useCallback((): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const err: GeolocationError = {
          code: 0,
          message: 'Geolocation is not supported by this browser',
        };
        setError(err);
        reject(err);
        return;
      }

      setLoading(true);
      setError(null);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const location: GeolocationPosition = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp,
          };
          setPosition(location);
          setLoading(false);
          resolve(location);
        },
        (err) => {
          const geolocationError: GeolocationError = {
            code: err.code,
            message: err.message,
          };
          setError(geolocationError);
          setLoading(false);
          reject(geolocationError);
        },
        options
      );
    });
  }, [options]);

  const clearPosition = useCallback(() => {
    setPosition(null);
    setError(null);
  }, []);

  return {
    position,
    error,
    loading,
    getCurrentLocation,
    clearPosition,
  };
}

/**
 * Format location name from coordinates (optional reverse geocoding)
 * For now, returns formatted coordinates. Can be enhanced with reverse geocoding API.
 * @param latitude - Latitude
 * @param longitude - Longitude
 * @returns Formatted location string
 */
export function formatLocationName(
  latitude: number,
  longitude: number
): string {
  // For now, return formatted coordinates
  // Can be enhanced with reverse geocoding API (e.g., Google Maps, Mapbox)
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

