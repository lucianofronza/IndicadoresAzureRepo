import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { 
  BarChart3, 
  Users, 
  Building2, 
  UserCheck, 
  Code2, 
  GitBranch, 
  RefreshCw,
  GitPullRequest,
  Settings,
  Menu,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Dashboard', href: '/', icon: BarChart3 },
  { name: 'Desenvolvedores', href: '/developers', icon: Users },
  { name: 'Times', href: '/teams', icon: Building2 },
  { name: 'Cargos', href: '/roles', icon: UserCheck },
  { name: 'Stacks', href: '/stacks', icon: Code2 },
  { name: 'Repositórios', href: '/repositories', icon: GitBranch },
  { name: 'Sincronização', href: '/sync', icon: RefreshCw },
  { name: 'Azure DevOps', href: '/azure-devops', icon: GitPullRequest },
  { name: 'Configurações', href: '/system-config', icon: Settings },
]

interface TooltipProps {
  children: React.ReactNode
  content: string
  isVisible: boolean
  delay?: number
}

const Tooltip: React.FC<TooltipProps> = ({ children, content, isVisible, delay = 500 }) => {
  const [showTooltip, setShowTooltip] = useState(false)
  const [timeoutId, setTimeoutId] = useState<number | null>(null)

  const handleMouseEnter = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    const id = setTimeout(() => {
      setShowTooltip(true)
    }, delay)
    setTimeoutId(id)
  }

  const handleMouseLeave = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    setShowTooltip(false)
  }

  return (
    <div 
      className="relative group"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isVisible && showTooltip && (
        <div className="absolute left-full ml-3 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 min-w-max">
          {content}
          <div className="absolute top-1/2 -left-1 transform -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-gray-900"></div>
        </div>
      )}
    </div>
  )
}

interface SidebarProps {
  onCollapseChange?: (collapsed: boolean) => void
}

export const Sidebar: React.FC<SidebarProps> = ({ onCollapseChange }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  const toggleCollapse = () => {
    const newCollapsed = !isCollapsed
    setIsCollapsed(newCollapsed)
    onCollapseChange?.(newCollapsed)
  }

  return (
    <>
      {/* Mobile sidebar */}
      <div className={cn(
        'fixed inset-0 z-50 lg:hidden',
        sidebarOpen ? 'block' : 'hidden'
      )}>
        <div className="fixed inset-0 bg-gray-900/80" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-72 flex-col bg-white">
          <div className="flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 px-6">
            <h1 className="text-lg font-semibold text-gray-900">
              Indicadores Azure
            </h1>
            <button
              type="button"
              className="ml-auto"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex flex-1 flex-col px-6 py-4">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => (
                    <li key={item.name}>
                      <NavLink
                        to={item.href}
                        className={({ isActive }) =>
                          cn(
                            isActive
                              ? 'bg-primary-50 text-primary-600'
                              : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50',
                            'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                          )
                        }
                        onClick={() => setSidebarOpen(false)}
                      >
                        <item.icon className="h-6 w-6 shrink-0" />
                        {item.name}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className={cn(
        'hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:flex-col transition-all duration-300 ease-in-out',
        isCollapsed ? 'lg:w-16' : 'lg:w-72'
      )}>
        <div className={cn(
          'flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white pb-4 transition-all duration-300',
          isCollapsed ? 'px-2' : 'px-6'
        )}>
          <div className={cn(
            'flex h-16 shrink-0 items-center transition-all duration-300',
            isCollapsed ? 'justify-center' : 'justify-between'
          )}>
            <h1 className={cn(
              'text-xl font-semibold text-gray-900 transition-all duration-300',
              isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
            )}>
              Indicadores Azure
            </h1>
            <Tooltip content={isCollapsed ? 'Expandir menu' : 'Recolher menu'} isVisible={true} delay={0}>
              <button
                type="button"
                onClick={toggleCollapse}
                className={cn(
                  'p-1 rounded-md hover:bg-gray-100 transition-colors duration-200',
                  isCollapsed ? 'ml-0' : 'ml-auto'
                )}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-5 w-5 text-gray-600" />
                ) : (
                  <ChevronLeft className="h-5 w-5 text-gray-600" />
                )}
              </button>
            </Tooltip>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => (
                    <li key={item.name}>
                      <Tooltip 
                        content={item.name} 
                        isVisible={true} 
                        delay={isCollapsed ? 0 : 1000}
                      >
                        <NavLink
                          to={item.href}
                          className={({ isActive }) =>
                            cn(
                              isActive
                                ? 'bg-primary-50 text-primary-600'
                                : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50',
                              'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-all duration-200 relative',
                              isCollapsed && 'justify-center gap-x-0'
                            )
                          }
                        >
                          <item.icon className="h-6 w-6 shrink-0" />
                          <span className={cn(
                            'transition-all duration-300',
                            isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
                          )}>
                            {item.name}
                          </span>
                        </NavLink>
                      </Tooltip>
                    </li>
                  ))}
                </ul>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Mobile menu button */}
      <div className="sticky top-0 z-40 flex items-center gap-x-6 bg-white px-4 py-4 shadow-sm sm:px-6 lg:hidden">
        <button
          type="button"
          className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
          onClick={() => setSidebarOpen(true)}
        >
          <span className="sr-only">Open sidebar</span>
          <Menu className="h-6 w-6" />
        </button>
        <div className="flex-1 text-sm font-semibold leading-6 text-gray-900">
          Indicadores Azure
        </div>
      </div>
    </>
  )
}
