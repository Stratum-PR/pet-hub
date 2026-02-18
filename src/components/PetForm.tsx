import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Pet, BusinessClient } from '@/hooks/useBusinessData';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SPANISH_MONTHS, calculateVaccinationStatus, formatVaccinationStatusSpanish, getVaccinationStatusColor } from '@/lib/petHelpers';
import { Upload, X, Image as ImageIcon, Edit2, Trash2, Replace } from 'lucide-react';
import { isDemoMode } from '@/lib/authRouting';
import { t } from '@/lib/translations';
import { useBreeds } from '@/hooks/useSupabaseData';
import { useAuth } from '@/contexts/AuthContext';
import { useBusinessId } from '@/hooks/useBusinessId';
import { PhotoCropDialog } from '@/components/PhotoCropDialog';

interface PetFormProps {
  clients: BusinessClient[];
  onSubmit: (pet: Omit<Pet, 'id' | 'created_at' | 'updated_at' | 'business_id'>) => void;
  onCancel?: () => void;
  initialData?: Pet | null;
  isEditing?: boolean;
}

export function PetForm({ clients, onSubmit, onCancel, initialData, isEditing }: PetFormProps) {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const businessId = useBusinessId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [originalPhotoUrl, setOriginalPhotoUrl] = useState<string | null>(null); // Track original photo URL from Supabase
  const [photoToDelete, setPhotoToDelete] = useState(false); // Flag to track if photo should be deleted
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [tempPhotoForCrop, setTempPhotoForCrop] = useState<string | null>(null);
  const { breeds, loading: breedsLoading } = useBreeds();
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [breedOpen, setBreedOpen] = useState(false);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [breedSearch, setBreedSearch] = useState('');
  
  // Check if user is in demo mode (read-only for photos)
  const isDemoUser = isDemoMode() && !isAdmin;
  
  // Defensive: ensure we always work with an array to avoid runtime map() crashes
  const safeClients = Array.isArray(clients) ? clients : [];
  const [formData, setFormData] = useState({
    client_id: '',
    name: '',
    species: '' as 'dog' | 'cat' | 'other',
    breed_id: '' as string | null, // CRITICAL: Use breed_id (references breeds.id)
    birth_month: null as number | null,
    birth_year: null as number | null,
    weight: 0,
    notes: '',
    last_vaccination_date: null as string | null,
    photo_url: null as string | null,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      // Get client ID from Supabase
      // Also check if client data came from JOIN (initialData.clients)
      const clientId = (initialData as any).client_id || '';
      const species = (initialData.species || '').trim() as 'dog' | 'cat' | 'other';
      
      // CRITICAL: Get breed_id from Supabase (canonical breed reference)
      // Prefer breed_id from initialData, fallback to breeds join, then legacy breed TEXT
      let breedId = (initialData as any).breed_id || (initialData as any).breeds?.id || null;
      
      // Ensure breedId is a string (UUID)
      if (breedId) {
        breedId = String(breedId).trim();
      }
      
      // If breed_id is missing but breeds join has data, use it
      if (!breedId && (initialData as any).breeds?.id) {
        breedId = String((initialData as any).breeds.id).trim();
      }
      
      // CRITICAL: Always set client_id from Supabase data
      // The Select component will display the name once safeClients loads
      let validClientId = clientId || '';
      
      // Verify client exists in the list if clients are loaded
      if (safeClients.length > 0 && clientId) {
        const foundCustomer = safeClients.find(c => String(c.id).trim() === String(clientId).trim());
        if (!foundCustomer) {
          if (import.meta.env.DEV) console.warn('[PetForm] Client not found in list:', clientId);
        } else {
          const firstName = (foundCustomer as any).first_name || '';
          const lastName = (foundCustomer as any).last_name || '';
          if (import.meta.env.DEV) console.log('[PetForm] Found client in list:', {
            clientId,
            clientName: `${firstName} ${lastName}`.trim(),
          });
        }
      }
      
      if (import.meta.env.DEV) console.log('[PetForm] Initializing form data from Supabase:', {
        clientId,
        validClientId,
        breedId,
        breedName: (initialData as any).breeds?.name || (initialData as any).breed,
        species,
        clientsCount: safeClients.length,
        breedsCount: breeds.length,
        hasInitialData: !!initialData,
      });
      
      setFormData({
        client_id: validClientId, // CRITICAL: Use client_id from Supabase
        name: (initialData.name || '').trim(),
        species: species || '' as 'dog' | 'cat' | 'other',
        breed_id: breedId || null, // CRITICAL: Use breed_id from Supabase (canonical breed reference)
        birth_month: initialData.birth_month ?? null,
        birth_year: initialData.birth_year ?? null,
        weight: initialData.weight || 0,
        notes: initialData.notes || '',
        last_vaccination_date: initialData.last_vaccination_date || null,
        photo_url: initialData.photo_url || null,
      });
      
      // Set photo preview - check demo mode first
      const demoMode = isDemoMode();
      if (demoMode && initialData.id) {
        const storageKey = `demo-pet-photo-${initialData.id}`;
        const demoPhoto = localStorage.getItem(storageKey);
        if (demoPhoto) {
          setPhotoPreview(demoPhoto);
          setOriginalPhotoUrl(demoPhoto); // Track original for demo mode
        } else if (initialData.photo_url) {
          setPhotoPreview(initialData.photo_url);
          setOriginalPhotoUrl(initialData.photo_url); // Track original photo URL
        }
      } else if (initialData.photo_url) {
        setPhotoPreview(initialData.photo_url);
        setOriginalPhotoUrl(initialData.photo_url); // Track original photo URL from Supabase
      }
      
      // Reset deletion flag when initializing
      setPhotoToDelete(false);
    } else {
      // Reset form when not editing
      setFormData({
        client_id: '', // CRITICAL: Use client_id
        name: '',
        species: '' as 'dog' | 'cat' | 'other',
        breed_id: null, // CRITICAL: Use breed_id
        birth_month: null,
        birth_year: null,
        weight: 0,
        notes: '',
        last_vaccination_date: null,
        photo_url: null,
      });
      setPhotoPreview(null);
      setOriginalPhotoUrl(null);
      setPhotoToDelete(false);
    }
  }, [initialData, safeClients]);

  // CRITICAL: Re-initialize breed_id when breeds load (if we have initialData but breeds weren't loaded yet)
  useEffect(() => {
    if (initialData && breeds.length > 0 && !formData.breed_id) {
      // Try to get breed_id from initialData again now that breeds are loaded
      const breedId = (initialData as any).breed_id || (initialData as any).breeds?.id || null;
      if (breedId) {
        const breedIdStr = String(breedId).trim();
        const breedExists = breeds.find(b => String(b.id).trim() === breedIdStr);
        if (breedExists) {
          if (import.meta.env.DEV) console.log('[PetForm] Re-initializing breed_id after breeds loaded:', breedIdStr);
          setFormData(prev => ({ ...prev, breed_id: breedIdStr }));
        }
      }
    }
  }, [breeds.length, initialData]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.client_id) {
      newErrors.client_id = 'El propietario es requerido';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre de la mascota es requerido';
    }

    if (!formData.species) {
      newErrors.species = 'La especie es requerida';
    }

    if (!formData.breed_id) {
      newErrors.breed_id = 'La raza es requerida';
    }

    if (formData.birth_month !== null && (formData.birth_month < 1 || formData.birth_month > 12)) {
      newErrors.birth_month = 'El mes debe estar entre 1 y 12';
    }

    const currentYear = new Date().getFullYear();
    if (formData.birth_year !== null && (formData.birth_year < 1990 || formData.birth_year > currentYear)) {
      newErrors.birth_year = `El año debe estar entre 1990 y ${currentYear}`;
    }

    if (formData.weight < 0) {
      newErrors.weight = 'El peso no puede ser negativo';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePhotoUpload = async (file: File) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Error',
        description: 'Por favor selecciona un archivo de imagen válido',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Error',
        description: 'La imagen no puede ser mayor a 5MB',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      const demoMode = isDemoMode();
      
      if (demoMode) {
        // Demo mode: Store image as data URL in local state (not persisted until save)
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          // Store in local state only - will be saved to localStorage on form submit
          setFormData({ ...formData, photo_url: dataUrl });
          setPhotoPreview(dataUrl);
          
          toast({
            title: 'Foto cargada',
            description: 'Foto cargada (se guardará al presionar "Guardar cambios")',
          });
          setUploading(false);
        };
        reader.onerror = () => {
          toast({
            title: 'Error',
            description: 'Error al leer el archivo',
            variant: 'destructive',
          });
          setUploading(false);
        };
        reader.readAsDataURL(file);
        return;
      }

      // Real mode: Store file in local state - upload will happen on save
      // For now, create a preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        // Store file reference for later upload on save
        setFormData({ ...formData, photo_url: dataUrl }); // Temporary preview (data URL)
        setPhotoPreview(dataUrl);
        setPhotoToDelete(false); // Clear deletion flag when uploading new photo
        
        toast({
          title: 'Foto cargada',
          description: 'Foto cargada (se subirá al presionar "Guardar cambios")',
        });
        setUploading(false);
      };
      reader.onerror = () => {
        toast({
          title: 'Error',
          description: 'Error al leer el archivo',
          variant: 'destructive',
        });
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      if (import.meta.env.DEV) console.error('Error processing photo:', error);
      toast({
        title: 'Error',
        description: t('common.genericError') || 'Error al procesar la foto. Por favor intenta de nuevo.',
        variant: 'destructive',
      });
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // For demo users, just show preview without uploading
      if (isDemoUser) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          setTempPhotoForCrop(dataUrl);
          setCropDialogOpen(true);
        };
        reader.readAsDataURL(file);
        return;
      }
      handlePhotoUpload(file);
    }
  };

  const handleReplacePhoto = () => {
    fileInputRef.current?.click();
  };

  const handleEditPhoto = () => {
    if (photoPreview) {
      setTempPhotoForCrop(photoPreview);
      setCropDialogOpen(true);
    }
  };

  const handleCropSave = useCallback((croppedImageDataUrl: string) => {
    // Update state immediately - don't wait for dialog to close
    setPhotoPreview(croppedImageDataUrl);
    setFormData(prev => ({ ...prev, photo_url: croppedImageDataUrl }));
    setPhotoToDelete(false);
    toast({
      title: 'Foto editada',
      description: 'La foto se guardará al presionar "Guardar cambios"',
    });
  }, [toast]);

  const handleRemovePhoto = () => {
    // Mark photo for deletion (don't delete from Supabase until Save Changes)
    setFormData({ ...formData, photo_url: null });
    setPhotoPreview(null);
    setPhotoToDelete(true); // Set deletion flag
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    toast({
      title: 'Foto eliminada',
      description: 'La foto será eliminada al guardar los cambios',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast({
        title: 'Error de validación',
        description: 'Por favor corrige los errores en el formulario',
        variant: 'destructive',
      });
      return;
    }

    try {
      const demoMode = isDemoMode();
      setUploading(true);
      
      // Demo users: Don't write to Supabase, only update local state
      if (isDemoUser) {
        // For demo users, just update the form data without uploading to Supabase
        const petData = {
          ...formData,
          photo_url: formData.photo_url, // Keep local photo URL
          vaccination_status: calculateVaccinationStatus(formData.last_vaccination_date),
        };
        
        onSubmit(petData as any);
        setUploading(false);
        
        toast({
          title: 'Cambios guardados',
          description: 'Los cambios se han guardado correctamente.',
        });
        
        // Update original photo URL for local state
        if (formData.photo_url) {
          setOriginalPhotoUrl(formData.photo_url);
        } else {
          setOriginalPhotoUrl(null);
        }
        setPhotoToDelete(false);
        return;
      }
      
      // Helper function to extract file path from Supabase Storage URL
      const extractFilePathFromUrl = (url: string): string | null => {
        try {
          // Supabase Storage URLs typically look like:
          // https://[project].supabase.co/storage/v1/object/public/pet-photos/[filename]
          const urlObj = new URL(url);
          const pathParts = urlObj.pathname.split('/');
          const bucketIndex = pathParts.indexOf('pet-photos');
          if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
            // Get everything after 'pet-photos'
            return pathParts.slice(bucketIndex + 1).join('/');
          }
          // Fallback: try to extract from the end of the path
          const lastPart = pathParts[pathParts.length - 1];
          if (lastPart && lastPart.includes('.')) {
            return lastPart;
          }
          return null;
        } catch (e) {
          if (import.meta.env.DEV) console.error('Error extracting file path from URL:', e);
          return null;
        }
      };
      
      // Helper function to delete photo from Supabase Storage
      const deletePhotoFromStorage = async (photoUrl: string): Promise<void> => {
        if (!photoUrl) return;
        
        const filePath = extractFilePathFromUrl(photoUrl);
        if (!filePath) {
          if (import.meta.env.DEV) console.warn('[PetForm] Could not extract file path from URL');
          return;
        }
        
        try {
          const { error: deleteError } = await supabase.storage
            .from('pet-photos')
            .remove([filePath]);
          
          if (deleteError) {
            if (import.meta.env.DEV) console.error('[PetForm] Error deleting photo from Storage:', deleteError);
          }
        } catch (err) {
          if (import.meta.env.DEV) console.error('[PetForm] Exception deleting photo:', err);
          // Continue with update even if deletion fails
        }
      };
      
      // Security: only allow storage operations when pet belongs to current business
      const petBusinessId = initialData ? (initialData as { business_id?: string }).business_id : null;
      const canTouchStorage = !businessId || !petBusinessId || petBusinessId === businessId;
      if (!canTouchStorage) {
        toast({
          title: 'Error',
          description: t('common.genericError') || t('pets.saveError'),
          variant: 'destructive',
        });
        setUploading(false);
        return;
      }

      // Delete old photo if it exists (when replacing or deleting)
      if (originalPhotoUrl && !demoMode) {
        if ((formData.photo_url && formData.photo_url.startsWith('data:image/')) || photoToDelete) {
          await deletePhotoFromStorage(originalPhotoUrl);
        }
      }
      
      let finalPhotoUrl = formData.photo_url;
      
      if (formData.photo_url && formData.photo_url.startsWith('data:image/')) {
        if (demoMode) {
          // Demo mode: Store in localStorage
          const petId = initialData?.id || `demo-pet-${Date.now()}`;
          const storageKey = `demo-pet-photo-${petId}`;
          localStorage.setItem(storageKey, formData.photo_url);
          finalPhotoUrl = formData.photo_url;
          
          // Remove old photo from localStorage if it exists
          if (originalPhotoUrl && initialData?.id) {
            const oldStorageKey = `demo-pet-photo-${initialData.id}`;
            if (localStorage.getItem(oldStorageKey) === originalPhotoUrl) {
              localStorage.removeItem(oldStorageKey);
            }
          }
        } else {
          // Real mode: Upload to Supabase Storage (path = business_id/filename for RLS)
          try {
            if (!businessId) {
              toast({
                title: 'Error',
                description: t('common.genericError') || t('pets.saveError'),
                variant: 'destructive',
              });
              setUploading(false);
              return;
            }
            // Convert data URL to blob
            const response = await fetch(formData.photo_url);
            const blob = await response.blob();
            
            // Generate unique filename; path prefix by business_id for Storage RLS
            const fileExt = blob.type.split('/')[1] || 'jpg';
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `${businessId}/${fileName}`;

            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('pet-photos')
              .upload(filePath, blob, {
                cacheControl: '3600',
                upsert: false,
              });

            if (uploadError) {
              throw uploadError;
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
              .from('pet-photos')
              .getPublicUrl(filePath);

            finalPhotoUrl = publicUrl;
          } catch (uploadError: any) {
            if (import.meta.env.DEV) console.error('Error uploading photo:', uploadError);
            toast({
              title: 'Error',
              description: 'Error al subir la foto. Por favor intenta de nuevo.',
              variant: 'destructive',
            });
            setUploading(false);
            return;
          }
        }
      } else if (photoToDelete || (formData.photo_url === null && originalPhotoUrl)) {
        // Photo was deleted - set to null
        finalPhotoUrl = null;
        
        if (demoMode && initialData?.id) {
          // Remove from localStorage in demo mode
          const storageKey = `demo-pet-photo-${initialData.id}`;
          localStorage.removeItem(storageKey);
        }
        // Note: Old photo deletion from Storage already handled above
      }
      
      // Calculate vaccination status from date
      const vaccination_status = calculateVaccinationStatus(formData.last_vaccination_date);

      const petData = {
        ...formData,
        photo_url: finalPhotoUrl,
        vaccination_status,
      };

      onSubmit(petData as any);
      setUploading(false);
      
      // Update original photo URL after successful save
      if (finalPhotoUrl) {
        setOriginalPhotoUrl(finalPhotoUrl);
      } else {
        setOriginalPhotoUrl(null);
      }
      setPhotoToDelete(false); // Reset deletion flag

      if (!isEditing) {
        setFormData({
          client_id: '', // CRITICAL: Use client_id
          name: '',
          species: '' as 'dog' | 'cat' | 'other',
          breed_id: null, // CRITICAL: Use breed_id
          birth_month: null,
          birth_year: null,
          weight: 0,
          notes: '',
          last_vaccination_date: null,
          photo_url: null,
        });
        setPhotoPreview(null);
        setOriginalPhotoUrl(null);
        setPhotoToDelete(false);
        setErrors({});
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: t('common.genericError') || t('pets.saveError'),
        variant: 'destructive',
      });
    }
  };

  // CRITICAL: Filter breeds by species from Supabase breeds table
  const availableBreeds = useMemo(() => {
    if (!formData.species || breeds.length === 0) return [];
    return breeds.filter(b => b.species === formData.species);
  }, [breeds, formData.species]);
  
  // Get the selected breed object for display
  const selectedBreed = useMemo(() => {
    if (!formData.breed_id) {
      if (import.meta.env.DEV) console.log('[PetForm] No breed_id in formData');
      return null;
    }
    if (breeds.length === 0) {
      if (import.meta.env.DEV) console.log('[PetForm] Breeds array is empty');
      return null;
    }
    // Ensure we're comparing strings
    const breedIdStr = String(formData.breed_id).trim();
    const found = breeds.find(b => String(b.id).trim() === breedIdStr);
    if (found) {
      if (import.meta.env.DEV) console.log('[PetForm] Found selected breed:', found.name);
    } else {
      if (import.meta.env.DEV) console.warn('[PetForm] Breed not found in breeds list:', {
        breedId: formData.breed_id,
        breedIdType: typeof formData.breed_id,
        breedIdStr,
        breedsCount: breeds.length,
        availableBreedIds: breeds.slice(0, 10).map(b => ({ id: String(b.id).trim(), name: b.name, species: b.species })),
        matchingSpeciesBreeds: breeds.filter(b => b.species === formData.species).slice(0, 5).map(b => ({ id: String(b.id).trim(), name: b.name })),
      });
    }
    return found || null;
  }, [formData.breed_id, formData.species, breeds]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1989 }, (_, i) => currentYear - i);

  // Calculate vaccination status for display
  const calculatedVaccinationStatus = calculateVaccinationStatus(formData.last_vaccination_date);
  const vaccinationStatusText = formatVaccinationStatusSpanish(calculatedVaccinationStatus);
  const vaccinationStatusColor = getVaccinationStatusColor(calculatedVaccinationStatus);

  return (
    <Card className="shadow-sm animate-fade-in transition-all duration-300" id="pet-form">
      <CardHeader>
        <CardTitle>{isEditing ? 'Editar Mascota' : 'Agregar Nueva Mascota'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientId">Propietario *</Label>
              <Popover open={ownerOpen} onOpenChange={setOwnerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={ownerOpen}
                    className={cn(
                      "w-full justify-between",
                      errors.client_id && "border-destructive"
                    )}
                  >
                    {(() => {
                      if (formData.client_id && safeClients.length > 0) {
                        const selectedCustomer = safeClients.find(c => String(c.id).trim() === String(formData.client_id).trim());
                        if (selectedCustomer) {
                          const firstName = (selectedCustomer as any).first_name || '';
                          const lastName = (selectedCustomer as any).last_name || '';
                          const fullName = `${firstName} ${lastName}`.trim();
                          const phone = (selectedCustomer as any).phone || '';
                          return fullName ? `${fullName}${phone ? ` • ${phone}` : ''}` : 'Sin nombre';
                        }
                      }
                      return formData.client_id ? 'Cargando...' : 'Seleccionar propietario';
                    })()}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="Buscar por nombre o teléfono..." 
                      value={ownerSearch}
                      onValueChange={setOwnerSearch}
                    />
                    <CommandList>
                      <CommandEmpty>No se encontraron clientes.</CommandEmpty>
                      <CommandGroup>
                        {safeClients
                          .filter((cl) => {
                            if (!ownerSearch) return true;
                            const search = ownerSearch.toLowerCase();
                            const firstName = ((cl as any).first_name || '').toLowerCase();
                            const lastName = ((cl as any).last_name || '').toLowerCase();
                            const phone = ((cl as any).phone || '').toLowerCase();
                            const email = ((cl as any).email || '').toLowerCase();
                            return firstName.includes(search) || 
                                   lastName.includes(search) || 
                                   `${firstName} ${lastName}`.includes(search) ||
                                   phone.includes(search) ||
                                   email.includes(search);
                          })
                          .map((cl) => {
                            const firstName = (cl as any).first_name || '';
                            const lastName = (cl as any).last_name || '';
                            const finalDisplayName = `${firstName} ${lastName}`.trim() || 'Sin nombre';
                            const phone = (cl as any).phone || '';
                            const isSelected = String(formData.client_id) === String(cl.id);
                            
                            return (
                              <CommandItem
                                key={cl.id}
                                value={String(cl.id)}
                                onSelect={() => {
                                  setFormData({ ...formData, client_id: String(cl.id) });
                                  setErrors({ ...errors, client_id: '' });
                                  setOwnerOpen(false);
                                  setOwnerSearch('');
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                                <div className="flex flex-col">
                                  <span>{finalDisplayName}</span>
                                  {phone && <span className="text-xs text-muted-foreground">{phone}</span>}
                                </div>
                              </CommandItem>
                            );
                          })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {errors.client_id && (
                <p className="text-sm text-destructive">{errors.client_id}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nombre de la Mascota *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  setErrors({ ...errors, name: '' });
                }}
                required
                placeholder="Buddy"
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="species">Especie *</Label>
              <Select
                value={formData.species}
                onValueChange={(value: 'dog' | 'cat' | 'other') => {
                  setFormData({ ...formData, species: value, breed_id: null });
                  setErrors({ ...errors, species: '', breed_id: '' });
                }}
                required
              >
                <SelectTrigger className={errors.species ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Seleccionar especie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dog">Perro</SelectItem>
                  <SelectItem value="cat">Gato</SelectItem>
                  <SelectItem value="other">Otro</SelectItem>
                </SelectContent>
              </Select>
              {errors.species && (
                <p className="text-sm text-destructive">{errors.species}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="breed">Raza *</Label>
              <Popover open={breedOpen} onOpenChange={setBreedOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={breedOpen}
                    disabled={!formData.species || breedsLoading}
                    className={cn(
                      "w-full justify-between",
                      errors.breed_id && "border-destructive"
                    )}
                  >
                    {(() => {
                      if (breedsLoading) return "Cargando razas...";
                      if (!formData.species) return "Selecciona la especie primero";
                      if (selectedBreed) return selectedBreed.name;
                      if (formData.breed_id && breeds.length > 0) return "Raza no encontrada";
                      return "Seleccionar raza";
                    })()}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="Buscar raza..." 
                      value={breedSearch}
                      onValueChange={setBreedSearch}
                    />
                    <CommandList>
                      <CommandEmpty>No se encontraron razas.</CommandEmpty>
                      <CommandGroup>
                        {availableBreeds
                          .filter((breed) => {
                            if (!breedSearch) return true;
                            return breed.name.toLowerCase().includes(breedSearch.toLowerCase());
                          })
                          .map((breed) => {
                            const isSelected = String(formData.breed_id) === String(breed.id);
                            return (
                              <CommandItem
                                key={breed.id}
                                value={breed.id}
                                onSelect={() => {
                                  setFormData({ ...formData, breed_id: breed.id });
                                  setErrors({ ...errors, breed_id: '' });
                                  setBreedOpen(false);
                                  setBreedSearch('');
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                                {breed.name}
                              </CommandItem>
                            );
                          })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {errors.breed_id && (
                <p className="text-sm text-destructive">{errors.breed_id}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="birth_month">Mes de Nacimiento</Label>
              <Select
                value={formData.birth_month?.toString() || '__none__'}
                onValueChange={(value) => {
                  setFormData({ ...formData, birth_month: value === '__none__' ? null : parseInt(value) });
                  setErrors({ ...errors, birth_month: '' });
                }}
              >
                <SelectTrigger className={errors.birth_month ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Seleccionar mes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No especificado</SelectItem>
                  {SPANISH_MONTHS.map((month, index) => (
                    <SelectItem key={index + 1} value={(index + 1).toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.birth_month && (
                <p className="text-sm text-destructive">{errors.birth_month}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="birth_year">Año de Nacimiento</Label>
              <Select
                value={formData.birth_year?.toString() || '__none__'}
                onValueChange={(value) => {
                  setFormData({ ...formData, birth_year: value === '__none__' ? null : parseInt(value) });
                  setErrors({ ...errors, birth_year: '' });
                }}
              >
                <SelectTrigger className={errors.birth_year ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Seleccionar año" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="__none__">No especificado</SelectItem>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.birth_year && (
                <p className="text-sm text-destructive">{errors.birth_year}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight">Peso (lbs)</Label>
              <Input
                id="weight"
                type="number"
                min="0"
                step="0.1"
                value={formData.weight || ''}
                onChange={(e) => {
                  setFormData({ ...formData, weight: Number(e.target.value) });
                  setErrors({ ...errors, weight: '' });
                }}
                placeholder="45"
                className={errors.weight ? 'border-destructive' : ''}
              />
              {errors.weight && (
                <p className="text-sm text-destructive">{errors.weight}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_vaccination_date">Última Fecha de Vacunación</Label>
              <Input
                id="last_vaccination_date"
                type="date"
                value={formData.last_vaccination_date || ''}
                onChange={(e) => setFormData({ ...formData, last_vaccination_date: e.target.value || null })}
              />
              {formData.last_vaccination_date && (
                <div className="mt-2">
                  <span className={`px-2 py-1 rounded text-xs ${vaccinationStatusColor}`}>
                    Estado: {vaccinationStatusText}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="photo">Foto de la Mascota</Label>
            <div className="flex items-center gap-4">
              {photoPreview ? (
                <div className="relative">
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-32 h-32 object-cover rounded-lg border"
                  />
                </div>
              ) : (
                <div className="w-32 h-32 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted">
                  <ImageIcon className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 flex flex-col gap-2">
                <Input
                  ref={fileInputRef}
                  id="photo"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="hidden"
                />
                {photoPreview ? (
                  // Existing photo: Show Replace, Edit, Delete options
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleReplacePhoto}
                      disabled={uploading}
                      className="flex items-center gap-2"
                    >
                      <Replace className="w-4 h-4" />
                      Reemplazar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleEditPhoto}
                      disabled={uploading}
                      className="flex items-center gap-2"
                    >
                      <Edit2 className="w-4 h-4" />
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRemovePhoto}
                      disabled={uploading}
                      className="flex items-center gap-2 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar
                    </Button>
                  </div>
                ) : (
                  // No photo: Show Upload option
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 w-fit"
                  >
                    <Upload className="w-4 h-4" />
                    {uploading ? 'Procesando...' : 'Subir Foto'}
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  {photoPreview 
                    ? 'La foto se guardará al presionar "Guardar cambios"'
                    : 'Máximo 5MB. Formatos: JPG, PNG, WEBP, GIF'}
                </p>
              </div>
            </div>
          </div>

          {/* Photo Crop/Edit Dialog */}
          {tempPhotoForCrop && (
            <PhotoCropDialog
              key={tempPhotoForCrop} // Key ensures clean remount
              open={cropDialogOpen}
              onOpenChange={(open) => {
                setCropDialogOpen(open);
                if (!open) {
                  // Clear temp photo after dialog closes
                  setTimeout(() => {
                    setTempPhotoForCrop(null);
                  }, 400);
                }
              }}
              imageSrc={tempPhotoForCrop}
              onSave={(dataUrl) => {
                // Update state immediately
                handleCropSave(dataUrl);
                // Close dialog
                setCropDialogOpen(false);
                // Clear temp photo after dialog closes
                setTimeout(() => {
                  setTempPhotoForCrop(null);
                }, 400);
              }}
              onCancel={() => {
                setCropDialogOpen(false);
                // Clear temp photo after dialog closes
                setTimeout(() => {
                  setTempPhotoForCrop(null);
                }, 400);
              }}
            />
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Requisitos especiales de aseo, alergias, o notas de comportamiento..."
              rows={3}
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="submit" className="shadow-sm" disabled={uploading}>
              {isEditing ? 'Guardar cambios' : 'Agregar Mascota'}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
