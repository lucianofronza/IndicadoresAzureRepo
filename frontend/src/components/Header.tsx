import { Settings } from 'lucide-react'
import { Link } from 'react-router-dom'

export const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <div className="flex flex-1"></div>
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          {/* Settings menu */}
          <div className="relative">
            <Link
              to="/system-config"
              className="flex items-center gap-x-3 text-sm font-semibold leading-6 text-gray-900 hover:text-gray-700"
              title="Configurações"
            >
              <Settings className="h-5 w-5" />
              <span className="hidden lg:block">Configurações</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
