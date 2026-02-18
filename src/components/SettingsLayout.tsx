import { Outlet } from 'react-router-dom';

export function SettingsLayout() {
  return (
    <div className="flex flex-1 min-h-0">
      <main className="flex-1 min-w-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
