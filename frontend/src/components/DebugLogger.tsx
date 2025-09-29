import React, { useState, useEffect } from 'react';

interface LogEntry {
  id: number;
  timestamp: string;
  message: string;
  type: 'info' | 'error' | 'success' | 'warning';
}

class DebugLogger {
  private static instance: DebugLogger;
  private logs: LogEntry[] = [];
  private listeners: ((logs: LogEntry[]) => void)[] = [];
  private nextId = 1;

  static getInstance(): DebugLogger {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger();
    }
    return DebugLogger.instance;
  }

  log(message: string, type: 'info' | 'error' | 'success' | 'warning' = 'info') {
    const logEntry: LogEntry = {
      id: this.nextId++,
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    };
    
    this.logs.push(logEntry);
    
    // Manter apenas os últimos 50 logs
    if (this.logs.length > 50) {
      this.logs = this.logs.slice(-50);
    }
    
    // Notificar listeners
    this.listeners.forEach(listener => listener([...this.logs]));
    
    // Também log no console
    console.log(`[${logEntry.timestamp}] ${message}`);
  }

  subscribe(listener: (logs: LogEntry[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clear() {
    this.logs = [];
    this.listeners.forEach(listener => listener([]));
  }
}

export const debugLogger = DebugLogger.getInstance();

export const DebugLoggerComponent: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = debugLogger.subscribe(setLogs);
    return unsubscribe;
  }, []);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-red-500 text-white px-3 py-1 rounded text-xs z-50"
      >
        Debug ({logs.length})
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black bg-opacity-90 text-white p-4 rounded-lg max-w-md max-h-96 overflow-auto z-50 text-xs">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold">Debug Logs</h3>
        <div className="space-x-2">
          <button
            onClick={() => debugLogger.clear()}
            className="bg-red-500 px-2 py-1 rounded text-xs"
          >
            Clear
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="bg-gray-500 px-2 py-1 rounded text-xs"
          >
            Hide
          </button>
        </div>
      </div>
      <div className="space-y-1">
        {logs.slice(-20).map(log => (
          <div
            key={log.id}
            className={`p-1 rounded text-xs ${
              log.type === 'error' ? 'bg-red-600' :
              log.type === 'success' ? 'bg-green-600' :
              log.type === 'warning' ? 'bg-yellow-600' :
              'bg-gray-600'
            }`}
          >
            <span className="text-gray-300">[{log.timestamp}]</span> {log.message}
          </div>
        ))}
      </div>
    </div>
  );
};
