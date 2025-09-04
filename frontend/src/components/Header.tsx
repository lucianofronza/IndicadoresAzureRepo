import { useAuth } from '../hooks/useAuth';
import { LogOut, User } from 'lucide-react';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      // Silenciar erro de logout
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <div className="flex flex-1"></div>
        
        {/* User Info and Logout */}
        <div className="flex items-center gap-x-4">
          <div className="flex items-center gap-x-2 text-sm text-gray-700">
            <User className="h-4 w-4" />
            <span className="hidden sm:block">{user?.name}</span>
            <span className="hidden sm:block text-gray-500">({typeof user?.role === 'string' ? user.role : user?.role?.name})</span>
          </div>
          
          <button
            onClick={handleLogout}
            className="flex items-center gap-x-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:block">Sair</span>
          </button>
        </div>
      </div>
    </header>
  )
}
