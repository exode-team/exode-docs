/**
 * Redlock decorator
 *
 * @author: exode <hello@exode.ru>
 */

import * as _ from 'lodash';

import { RedlockAbortSignal, Settings } from '@sesamecare-oss/redlock';

import { RedlockService } from '@/libs/modules/redlock/redlock.service';
import { RedlockKeyFunction, RedlockOperationError } from '@/libs/modules/redlock/interfaces/redlock.interface';


/**
 * Global store for RedlockService
 * @type {null}
 */
let globalRedlockService: RedlockService | null = null;

/**
 * Global setter for globalRedlockService
 * @type {null}
 */
export const setGlobalRedlockService = (service: RedlockService) => {
    globalRedlockService = service;
};

/**
 * Redlock decorator
 * @param {string | string[] | RedlockKeyFunction<T>} key
 * @param {Partial<Settings>} settings
 * @returns {MethodDecorator}
 * @constructor
 */
export const Redlock = <T extends (...args: any) => any = (...args: any) => any>(
    key: string | string[] | RedlockKeyFunction<T>,
    settings: Partial<Settings> = {},
): MethodDecorator => {
    const getKeys = (
        key: string | string[] | RedlockKeyFunction,
        context: any,
        propertyKey: string,
        args: any[],
    ): string[] => {
        if (typeof key === 'string') {
            return [ key ];
        } 
        
        if (Array.isArray(key)) {
            return key;
        } 
        
        if (typeof key === 'function') {
            const dynamicKeys = key(...args);
            const baseKey = [ context.constructor?.name, propertyKey ].join(':');
            
            // If function returns array of keys, return them as separate resources
            if (Array.isArray(dynamicKeys)) {
                return dynamicKeys.map(k => `${baseKey}.${k}`);
            }
            
            return [ `${baseKey}.${dynamicKeys}` ];
        }

        return [];
    };

    return (
        target: object,
        propertyKey: string | symbol,
        descriptor: TypedPropertyDescriptor<any>,
    ) => {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const context = this;

            const scope = {
                startTime: Date.now(),
                abortController: new AbortController(),
                timeoutId: null as NodeJS.Timeout | null,
            };

            const keys = getKeys(
                key,
                context,
                propertyKey.toString(),
                args,
            );

            /**
             * Try to get RedlockService
             */
            const redlockService: RedlockService | null = context.redlockService
                ? context.redlockService
                : globalRedlockService;

            /**
             * Skip locking (if service not found)
             */
            if (!redlockService) {
                console.error('RedlockService not available', propertyKey);

                return originalMethod.apply(context, args);
            }

            const duration = redlockService.options?.duration || 5000;
            const timeoutMs = duration * 2; // Safety margin for timeout

            /**
             * Create effective settings without mutating the original
             */
            const effectiveSettings: Partial<Settings> = {
                // Default settings from service
                ..._.pick(redlockService?.options?.settings, [
                    'retryCount',
                    'retryDelay',
                    'retryJitter',
                    'driftFactor',
                    'automaticExtensionThreshold',
                ]),
                // Override with decorator settings
                ...settings,
                // Always add abort signal for timeout handling
                signal: scope.abortController.signal,
            };

            /**
             * Setup timeout that properly cancels the operation
             */
            scope.timeoutId = setTimeout(() => {
                scope.abortController.abort(new Error(RedlockOperationError.Timeout));
            }, timeoutMs);

            try {
                await redlockService.options?.decoratorHooks?.preLockKeys?.({ keys, duration });

                return await redlockService
                    .using(
                        keys,
                        duration,
                        effectiveSettings,
                        async (signal: RedlockAbortSignal) => {
                            // Check if operation was aborted before starting
                            if (signal.aborted) {
                                console.error('Redlock operation aborted before execution', keys);
                                throw signal.error;
                            }

                            await redlockService.options?.decoratorHooks?.lockedKeys?.({
                                keys,
                                duration,
                                elapsedTime: Date.now() - scope.startTime,
                            });

                            return await originalMethod.apply(context, args);
                        })
                    .finally(async () => {
                        // Clear timeout to prevent unnecessary abort
                        if (scope.timeoutId) {
                            clearTimeout(scope.timeoutId);
                            scope.timeoutId = null;
                        }

                        await redlockService.options?.decoratorHooks?.unlockedKeys?.({
                            keys,
                            duration,
                            elapsedTime: Date.now() - scope.startTime,
                        });
                    });
            } catch (error) {
                /**
                 * Handle timeout error
                 */
                if (error.message === RedlockOperationError.Timeout) {
                    console.error('Redlock operation timeout', keys, `after ${timeoutMs}ms`);
                    throw error;
                }

                /**
                 * Handle quorum error - fallback to execution without lock
                 */
                if (error.message?.includes(RedlockOperationError.Quorum)) {
                    console.error('Error in redlock decorator - executing without lock', keys, error.message);
                    return originalMethod.apply(context, args);
                }

                /**
                 * Any other error - rethrow
                 */
                throw error;
            } finally {
                // Ensure timeout is cleared in any case
                if (scope.timeoutId) {
                    clearTimeout(scope.timeoutId);
                }
            }
        };

        return descriptor;
    };

};