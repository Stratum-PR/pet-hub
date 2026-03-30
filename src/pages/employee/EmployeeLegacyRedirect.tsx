import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { PawStagedLoadingFullscreen } from '@/components/PawStagedLoading';
import { getEmployeePostLoginPath } from '@/lib/employeePostLogin';
import { t } from '@/lib/translations';

/**
 * Legacy `/employee/hub` and similar: sends employees into the main business shell.
 */
export function EmployeeLegacyRedirect() {
  const { user, loading, role, business } = useAuth();

  if (loading) {
    return <PawStagedLoadingFullscreen label={t('common.loading')} />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role !== 'employee') {
    return <Navigate to="/" replace />;
  }

  const path = getEmployeePostLoginPath(business);
  if (path === '/employee/hub') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <p className="text-sm text-muted-foreground max-w-md">
          Tu cuenta de empleado aún no tiene un enlace público al negocio. Pide a un administrador que verifique la
          configuración del negocio.
        </p>
      </div>
    );
  }

  return <Navigate to={path} replace />;
}
