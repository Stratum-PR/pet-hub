import { Outlet } from 'react-router-dom';

export function SettingsLayout() {
  return (
    <div className="min-h-0 flex-1">
      <Outlet />
    </div>
  );
}
