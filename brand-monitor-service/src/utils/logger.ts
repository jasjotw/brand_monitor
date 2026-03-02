type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function stringifyMeta(meta?: Record<string, unknown>): string {
    if (!meta) return '';
    try {
        return ` ${JSON.stringify(meta)}`;
    } catch {
        return ' {"meta":"[unserializable]"}';
    }
}

function write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const ts = new Date().toISOString();
    const line = `[${ts}] [${level.toUpperCase()}] ${message}${stringifyMeta(meta)}`;
    if (level === 'error') {
        console.error(line);
        return;
    }
    if (level === 'warn') {
        console.warn(line);
        return;
    }
    console.log(line);
}

export function logDebug(message: string, meta?: Record<string, unknown>): void {
    write('debug', message, meta);
}

export function logInfo(message: string, meta?: Record<string, unknown>): void {
    write('info', message, meta);
}

export function logWarn(message: string, meta?: Record<string, unknown>): void {
    write('warn', message, meta);
}

export function logError(message: string, meta?: Record<string, unknown>): void {
    write('error', message, meta);
}

export function logMethodEntry(method: string, meta?: Record<string, unknown>): void {
    logInfo(`ENTER ${method}`, meta);
}

