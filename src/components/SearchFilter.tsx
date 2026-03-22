import { Search, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface SearchFilterProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  filterOptions?: { value: string; label: string }[];
  filterLabel?: string;
  /** Single-line toolbar: horizontal flex, search grows (inventory / dense toolbars). */
  variant?: 'default' | 'toolbar';
}

export function SearchFilter({
  searchTerm,
  onSearchChange,
  placeholder = 'Search...',
  filterValue,
  onFilterChange,
  filterOptions,
  filterLabel = 'Filter',
  variant = 'default',
}: SearchFilterProps) {
  const isToolbar = variant === 'toolbar';
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1',
        isToolbar ? 'flex-row items-center gap-2' : 'flex-col gap-3 sm:flex-row'
      )}
    >
      <div className={cn('relative min-w-0 flex-1', !isToolbar && 'max-w-md')}>
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'pl-10 pr-10',
            isToolbar
              ? 'h-9 rounded-lg border-border/50 bg-white/70 backdrop-blur-sm dark:bg-background/50'
              : 'rounded-xl border-border/50 bg-white/70 backdrop-blur-sm dark:bg-background/45'
          )}
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
            onClick={() => onSearchChange('')}
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>
      {filterOptions && onFilterChange && (
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground hidden sm:block" />
          <Select value={filterValue} onValueChange={onFilterChange}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder={filterLabel} />
            </SelectTrigger>
            <SelectContent>
              {filterOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}