import { useAuth } from '../context/AuthContext';
import { canAccessPage, canWrite, canZerarBanco, canAccessConfigTab } from '../utils/permissions';

/**
 * Convenience hook that exposes all permission helpers
 * pre-filled with the current user's role.
 */
export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role;

  return {
    role,
    isAdmin:      role === 'admin',
    isAdvogado:   role === 'advogado',
    isAssistente: role === 'assistente',
    /** Can create / edit / delete records */
    canWrite:         canWrite(role),
    /** Can wipe the entire database */
    canZerarBanco:    canZerarBanco(role),
    /** Can navigate to a given page key */
    canAccessPage:    (page: string) => canAccessPage(role, page),
    /** Can view a given Configurações tab */
    canAccessConfigTab: (tab: string) => canAccessConfigTab(role, tab),
  };
}
