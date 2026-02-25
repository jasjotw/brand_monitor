'use client';

/**
 * Client-side error handlers initialization
 * Sets up global error listeners for uncaught errors and unhandled promise rejections
 */

import { useEffect } from 'react';
import { clientLogger } from '@/lib/client-logger';

export function ClientErrorHandler() {
    useEffect(() => {
        // Handle uncaught errors
        const handleError = (event: ErrorEvent) => {
            event.preventDefault();
            clientLogger.error(
                'Uncaught Error',
                new Error(event.message),
                {
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                    type: 'uncaught',
                }
            );
        };

        // Handle unhandled promise rejections
        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            event.preventDefault();
            const error = event.reason instanceof Error
                ? event.reason
                : new Error(String(event.reason));

            clientLogger.error(
                'Unhandled Promise Rejection',
                error,
                {
                    type: 'unhandledRejection',
                    reason: event.reason,
                }
            );
        };

        // Add event listeners
        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);

        // Cleanup
        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        };
    }, []);

    return null; // This component doesn't render anything
}
