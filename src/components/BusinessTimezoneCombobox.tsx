import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { buildTimezonePickerOptions } from '@/lib/businessTimezonePicker';
import { t } from '@/lib/translations';

interface BusinessTimezoneComboboxProps {
  value: string;
  onChange: (iana: string) => void;
  disabled?: boolean;
  className?: string;
}

export function BusinessTimezoneCombobox({ value, onChange, disabled, className }: BusinessTimezoneComboboxProps) {
  const [open, setOpen] = useState(false);
  const options = useMemo(() => buildTimezonePickerOptions(value), [value]);
  const selected = options.find((o) => o.iana === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full max-w-xs justify-between font-normal', className)}
        >
          <span className="truncate text-left">
            {selected ? selected.label : value ? `${value}` : t('businessSettings.timezonePlaceholder')}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-2rem,380px)] p-0" align="start">
        <Command>
          <CommandInput placeholder={t('businessSettings.timezoneSearchPlaceholder')} />
          <CommandList>
            <CommandEmpty>{t('businessSettings.timezoneNoResults')}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.iana}
                  value={`${opt.iana} ${opt.label}`}
                  onSelect={() => {
                    onChange(opt.iana);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === opt.iana ? 'opacity-100' : 'opacity-0')} />
                  <span className="flex flex-col gap-0.5 min-w-0">
                    <span className="truncate font-medium">{opt.label}</span>
                    <span className="truncate text-xs text-muted-foreground font-mono">{opt.iana}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
